import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import {
  configureCareer,
  controlledIds,
  makeOffers,
  acceptOffer,
} from '../src/domain/gameplay/career';
import {
  runNextSession,
  beginLiveSession,
  tickLive,
  getWeekend,
  advanceRound,
} from '../src/domain/simulation';
import { issueCommand, brakingOpportunity, callPit, radio } from '../src/domain/gameplay/commands';
import { devAction } from '../src/domain/gameplay/dev';
import { cloneState } from '../src/domain/simulation/world';
import { signContract } from '../src/domain/simulation/management';
import type { Save } from '../src/domain/types';
function ready(mode: 'driver' | 'constructor' = 'driver', seed = 2029) {
  let s = configureCareer(createSave(seed), mode, mode === 'driver' ? 'lando-norris' : 'mclaren');
  for (let i = 0; i < 6; i++) s = runNextSession(s);
  return s;
}
function lap(s: Save) {
  for (let i = 0; i < 3; i++) s = tickLive(s, true);
  return s;
}
function finish(s: Save) {
  while (s.race?.status === 'RUNNING') s = tickLive(s, true);
  return s;
}
test('incremental race agrees with unchanged batch API and scores only once', () => {
  const s = ready();
  const batch = runNextSession(s);
  const live = finish(beginLiveSession(s));
  assert.deepEqual(getWeekend(live).results.Sprint, getWeekend(batch).results.Sprint);
  assert.deepEqual(live.driverPoints, batch.driverPoints);
  assert.equal(tickLive(live, true), live);
  assert.ok(parseSave(JSON.stringify(live)));
});
test('midrace serialization resumes RNG, commands, pit calls and results exactly', () => {
  let s = beginLiveSession(ready());
  s = issueCommand(s, 'lando-norris', 'ATTACK', 3);
  s = callPit(s, 'lando-norris', 'next', 'H');
  s = lap(s);
  const copy = parseSave(JSON.stringify(s));
  assert.ok(copy);
  const resumed = finish(copy);
  const direct = finish(s);
  assert.deepEqual(resumed, direct);
});
test('pilot controls one car, constructor two, commands have real energy and tyre consequences', () => {
  const s = beginLiveSession(ready());
  assert.equal(controlledIds(s).length, 1);
  assert.equal(issueCommand(s, 'arvid-lindblad', 'ATTACK'), s);
  let attack = lap(issueCommand(s, 'lando-norris', 'ATTACK'));
  let conserve = lap(issueCommand(s, 'lando-norris', 'SAVE'));
  assert.ok(attack.game.cars['lando-norris'].battery < conserve.game.cars['lando-norris'].battery);
  assert.ok(
    attack.race!.cars.find((c) => c.id === 'lando-norris')!.tyre.wear >
      conserve.race!.cars.find((c) => c.id === 'lando-norris')!.tyre.wear,
  );
  attack = lap(attack);
  assert.equal(attack.race!.commands['lando-norris'].kind, 'NORMAL');
  const team = beginLiveSession(ready('constructor'));
  assert.equal(controlledIds(team).length, 2);
  for (const rel of Object.values(team.career.ceoRelations))
    for (const key of Object.keys(rel)) rel[key as keyof typeof rel] = 100;
  const commanded = issueCommand(
    issueCommand(team, 'lando-norris', 'ATTACK'),
    'arvid-lindblad',
    'DEFEND',
  );
  assert.equal(commanded.race!.commands['lando-norris'].kind, 'ATTACK');
  assert.equal(
    commanded.race!.commands['arvid-lindblad'].kind,
    commanded.race!.commands['arvid-lindblad'].acknowledged ? 'DEFEND' : 'NORMAL',
  );
  assert.ok(commanded.race!.radio.some((x) => x.driverId === 'arvid-lindblad'));
});
test('braking requires close gap, proper sector and green flag', () => {
  let s = beginLiveSession(ready());
  assert.equal(brakingOpportunity(s, 'lando-norris').available, false);
  s = devAction(s, 'gap', 'lando-norris');
  assert.equal(brakingOpportunity(s, 'lando-norris').available, true);
  s = issueCommand(s, 'lando-norris', 'BRAKING_ATTACK');
  assert.equal(s.race!.commands['lando-norris'].remaining, 1);
  s.race!.control = 'SC';
  assert.equal(brakingOpportunity(s, 'lando-norris').available, false);
});
test('pit call changes compound, charges time and cancellation preserves manual control', () => {
  let s = beginLiveSession(ready());
  s = callPit(s, 'lando-norris', 'next', 'H');
  assert.equal(s.race!.pitCalls['lando-norris'].lap, 2);
  s = callPit(s, 'lando-norris', 'cancel', 'H');
  assert.equal(s.race!.pitCalls['lando-norris'], undefined);
  s = callPit(s, 'lando-norris', 'now', 'H');
  s = lap(s);
  const car = s.race!.cars.find((c) => c.id === 'lando-norris')!;
  assert.equal(car.tyre.compound, 'H');
  assert.equal(car.pits, 1);
  assert.ok(s.race!.events.some((e) => e.driverId === car.id && e.type === 'pit'));
  assert.ok(parseSave(JSON.stringify(s)));
});
test('radio reports measured battery and tyres; team orders change CEO relationship', () => {
  let s = beginLiveSession(ready());
  s.game.cars['lando-norris'].battery = 37;
  s = radio(s, 'lando-norris', 'Como está a bateria?');
  assert.match(s.race!.radio.at(-1)!.text, /37%/);
  s = radio(s, 'lando-norris', 'Como estão os pneus?');
  assert.match(s.race!.radio.at(-1)!.text, /desgaste/);
  const before = s.career.ceoRelations['lando-norris'].Satisfação;
  s = radio(s, 'lando-norris', 'Troquem posições', 'driver');
  assert.ok(s.career.ceoRelations['lando-norris'].Satisfação < before);
});
test('critical orders respect pause policy; dev rain, SC, battery and DNF persist', () => {
  let s = beginLiveSession(ready());
  s.race!.autoEvents = 'pause';
  s.race!.paused = false;
  s = issueCommand(s, 'lando-norris', 'ATTACK');
  assert.equal(s.race!.paused, true);
  s = devAction(s, 'rain', 'lando-norris', 100);
  s = lap(s);
  assert.ok(s.race!.weather.water >= 0.6);
  s = devAction(s, 'SC', 'lando-norris');
  assert.equal(s.race!.control, 'SC');
  s = devAction(s, 'battery', 'lando-norris', 12);
  assert.equal(s.game.cars['lando-norris'].battery, 12);
  s = callPit(s, 'lando-norris', 'now', 'H');
  s = devAction(s, 'DNF', 'lando-norris');
  s = lap(s);
  assert.equal(s.race!.cars.find((c) => c.id === 'lando-norris')!.status, 'DNF');
  assert.ok(parseSave(JSON.stringify(s)));
});
test('laboratório cria fixtures visuais de rodada, saída e colisão sem avançar a corrida', () => {
  const base = beginLiveSession(ready());
  for (const [action, type] of [['spin', 'spin'], ['wide', 'wide'], ['crash', 'collision']] as const) {
    const beforeLap = base.race!.lap;
    const next = devAction(base, action, 'lando-norris');
    assert.equal(next.race!.lap, beforeLap);
    assert.equal(next.race!.events.at(-1)?.type, type);
    assert.equal(next.race!.events.at(-1)?.lap, beforeLap);
    assert.equal(next.race!.cars.find((car) => car.id === 'lando-norris')!.status, action === 'crash' ? 'DNF' : 'RUNNING');
  }
});
test('corrupted live state is rejected and v2 migrates to v3', () => {
  const s = beginLiveSession(ready());
  const broken = cloneState(s);
  broken.race!.commands['lando-norris'].kind = 'BAD' as any;
  assert.equal(parseSave(JSON.stringify(broken)), null);
  const v2: any = createSave();
  v2.version = 2;
  delete v2.career;
  delete v2.race;
  assert.equal(parseSave(JSON.stringify(v2))?.version, 4);
});
test('pilot transfer requires postseason offer and preserves two seats per team', () => {
  const s = ready();
  assert.equal(signContract(s, 'max-verstappen', 'lando-norris', 'driver', 2, 100), s);
  const n = cloneState(s);
  n.game.phase = 'postseason';
  makeOffers(n);
  assert.ok(n.career.offers.length);
  const moved = acceptOffer(n, n.career.offers[0].id, true);
  assert.notEqual(moved.managedTeam, s.managedTeam);
  assert.equal(moved.game.drivers.find((d) => d.id === 'lando-norris')!.teamId, moved.managedTeam);
  for (const t of moved.game.teams)
    assert.equal(moved.game.drivers.filter((d) => d.teamId === t.id).length, 2);
});

test('low CEO trust can produce actual refusal without forcing driver command', () => {
  let s = beginLiveSession(ready('constructor'));
  for (const rel of Object.values(s.career.ceoRelations))
    for (const k of Object.keys(rel)) rel[k as keyof typeof rel] = 0;
  for (let i = 0; i < 16; i++) s = issueCommand(s, 'lando-norris', 'ATTACK');
  assert.ok(s.race!.events.some((e) => e.type === 'command ignored'));
});
test('pilot completes a season, receives valid offers and reloads after transfer and season closure', () => {
  let s = configureCareer(createSave(93), 'driver', 'lando-norris');
  for (let r = 1; r <= 35; r++) {
    for (let i = 0; i < 8; i++) s = runNextSession(s);
    if (r < 35) s = advanceRound(s);
  }
  assert.equal(s.managedTeam, s.game.drivers.find((d) => d.id === 'lando-norris')!.teamId);
  assert.ok(s.career.offers.length);
  s = acceptOffer(s, s.career.offers[0].id, true);
  assert.ok(parseSave(JSON.stringify(s)));
  s = advanceRound(s);
  assert.equal(s.round, 36);
  assert.ok(parseSave(JSON.stringify(s)));
});
