import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { runNextSession, advanceRound, scoreRace } from '../src/domain/simulation';
import { createSave as legacySave } from '../src/domain/legacy/save';
import { runNextSession as legacyRun } from '../src/domain/legacy/simulation';
import {
  startProject,
  deliverUpgrades,
  prepareNextSeason,
  signContract,
  contractQuote,
  answerInterview,
  compareStats,
  prizeMoney,
  runTeamAI,
} from '../src/domain/simulation/management';
import {
  performance,
  newTyres,
  tyreStep,
  powerStep,
  weatherAt,
} from '../src/domain/simulation/mechanics';
import { applyPenalty } from '../src/domain/simulation/race';
import { cloneState } from '../src/domain/simulation/world';
import { seedFor } from '../src/domain/simulation/random';
import type { Save } from '../src/domain/types';
const weekend = (s: Save) => {
  for (let i = 0; i < 8; i++) s = runNextSession(s);
  return s;
};
test('legacy migration preserves validated results and never fabricates old telemetry', () => {
  let old = legacySave();
  for (let i = 0; i < 8; i++) old = legacyRun(old);
  const migrated = parseSave(JSON.stringify(old))!;
  assert.ok(migrated);
  assert.equal(migrated.version, 4);
  for (const [id, points] of Object.entries(old.driverPoints))
    assert.equal(migrated.driverPoints[id], points);
  assert.ok(migrated.world.pool.every((d) => migrated.driverPoints[d.id] === 0));
  assert.equal(migrated.weekends[0].tapes, undefined);
  assert.ok(parseSave(JSON.stringify(migrated)));
});
test('hierarchical seeds distinguish season, round, session and subsystem', () => {
  const seeds = [
    '2029/1/TL1/weather',
    '2029/1/TL2/weather',
    '2029/2/TL1/weather',
    '2030/1/TL1/weather',
    '2029/1/TL1/race',
  ].map((x) => seedFor(42, ...x.split('/')));
  assert.equal(new Set(seeds).size, 5);
});
test('each driver, team and engineer attribute and dynamic changes predicted lap performance', () => {
  const s = createSave(),
    d = s.game.drivers[0],
    c = s.game.circuits[0],
    w = weatherAt(c, 42, 1),
    decision = s.game.decisions[d.id];
  const lap = (state: Save) =>
    performance(state, state.game.drivers[0], c, w, decision, newTyres('M'), 0.5).lap;
  const baseline = lap(s);
  for (const group of ['drivers', 'teams', 'engineers'] as const) {
    const source =
      group === 'drivers'
        ? s.game.drivers[0]
        : group === 'teams'
          ? s.game.teams.find((t) => t.id === d.teamId)!
          : s.game.engineers.find((e) => e.driverId === d.id)!;
    for (const key of Object.keys(source.attributes)) {
      const next = cloneState(s);
      const entity = next.game[group].find((x) => x.id === source.id)!;
      entity.attributes[key] -= 5;
      assert.notEqual(lap(next), baseline, group + '/' + key);
    }
    for (let i = 0; i < source.dynamics.length; i++) {
      const next = cloneState(s);
      next.game[group].find((x) => x.id === source.id)!.dynamics[i].value -= 5;
      assert.notEqual(lap(next), baseline, group + '/dynamic/' + i);
    }
  }
});
test('compound, energy and engine map trade pace for tyre life, battery and mechanical wear', () => {
  const s = createSave(),
    d = s.game.drivers[0],
    c = s.game.circuits[0],
    w = weatherAt(c, 1, 1),
    dec = s.game.decisions[d.id];
  let soft = newTyres('S'),
    hard = newTyres('H');
  for (let i = 0; i < 20; i++) {
    soft = tyreStep(soft, d, s, c, w, dec);
    hard = tyreStep(hard, d, s, c, w, dec);
  }
  assert.ok(soft.wear > hard.wear);
  const safe = structuredClone(s.game.cars[d.id]),
    attack = structuredClone(s.game.cars[d.id]);
  for (let i = 0; i < 8; i++) {
    powerStep(safe, d, s, c, w, { ...dec, energy: 'Save', engineMap: 'Economy' });
    powerStep(attack, d, s, c, w, { ...dec, energy: 'Boost', engineMap: 'Quali' });
  }
  assert.ok(attack.battery < safe.battery);
  assert.ok(attack.wear > safe.wear);
  assert.ok(attack.fuel < safe.fuel);
  assert.ok(attack.temperature > safe.temperature);
});
test('weather evolves reproducibly; wet tyres and circuit setup affect pace', () => {
  const s = createSave(),
    d = s.game.drivers[0],
    c = { ...s.game.circuits[0], rain: 100 },
    dec = s.game.decisions[d.id];
  let w = weatherAt(c, 31, 0);
  const waters = [];
  for (let i = 1; i < 30; i++) {
    w = weatherAt(c, 31, i, w);
    waters.push(w.water);
  }
  assert.ok(new Set(waters).size > 3);
  const wet = { ...w, water: 0.9 };
  assert.ok(
    performance(s, d, c, wet, dec, newTyres('W'), 0).lap <
      performance(s, d, c, wet, dec, newTyres('S'), 0).lap,
  );
  const ideal = { ...dec, wing: c.aero, balance: 45 + (c.frontWear - c.rearWear) * 0.2 };
  assert.ok(
    performance(s, d, c, w, ideal, newTyres('M'), 0).lap <
      performance(s, d, c, w, { ...dec, wing: 0, balance: 0 }, newTyres('M'), 0).lap,
  );
});
test('practice consumes sets, learns setup and circuit knowledge without points', () => {
  const s = createSave(),
    id = s.game.drivers[0].id;
  const next = runNextSession(s);
  assert.ok(next.game.setups[id].confidence > s.game.setups[id].confidence);
  assert.ok(next.game.setups[id].setsUsed > 0);
  assert.ok(next.game.cars[id].mileage > 0);
  assert.notDeepEqual(next.game.knowledge[id], s.game.knowledge[id]);
  assert.equal(next.driverPoints[id], 0);
});
test('R&D spends team cash once, hides actual gain and changes only that team after delivery', () => {
  const s = createSave(),
    cash = s.game.finances[s.managedTeam].cash;
  let n = startProject(s, 'floor-v3');
  assert.ok(n.game.finances[n.managedTeam].cash < cash);
  assert.equal(n.game.development[0].actual, null);
  assert.equal(startProject(n, 'floor-v3'), n);
  const p = n.game.development[0];
  n.round = p.due - 1;
  deliverUpgrades(n);
  assert.equal(p.status, 'delivered');
  assert.notEqual(p.actual, null);
  for (const d of n.game.drivers)
    assert.equal(n.game.cars[d.id].upgradeSeconds, d.teamId === n.managedTeam ? p.actual : 0);
  assert.equal(s.game.development.length, 0);
});
test('driver and engineer contracts preserve two-seat roster and historical constructor points', () => {
  let s = weekend(createSave());
  const historical = { ...s.game.teamPoints };
  for (const kind of ['driver', 'engineer'] as const) {
    const list = kind === 'driver' ? s.game.drivers : s.game.engineers;
    const target = list.find((p) => p.teamId !== s.managedTeam)!,
      own = list.find((p) => p.teamId === s.managedTeam)!;
    assert.ok(contractQuote(s, target.id, kind, 100).accepted);
    s = signContract(s, target.id, own.id, kind, 2, 100);
    assert.equal(
      (kind === 'driver' ? s.game.drivers : s.game.engineers).find((p) => p.id === target.id)!
        .teamId,
      s.managedTeam,
    );
  }
  assert.deepEqual(s.game.teamPoints, historical);
  for (const t of s.game.teams) {
    assert.equal(s.game.drivers.filter((d) => d.teamId === t.id).length, 2);
    assert.equal(s.game.engineers.filter((e) => e.teamId === t.id).length, 2);
  }
  assert.ok(parseSave(JSON.stringify(s)));
});
test('interview changes relationships once and penalties carry discipline and grid consequences', () => {
  let s = createSave();
  for (let i = 0; i < 6; i++) s = runNextSession(s);
  const id = s.game.interviews[0].id;
  const n = answerInterview(s, id, 'rival');
  assert.notDeepEqual(n.game.relationships, s.game.relationships);
  assert.equal(answerInterview(n, id, 'team'), n);
  const d = n.game.drivers[0].id;
  assert.equal(applyPenalty(n, d, '15s'), 15);
  applyPenalty(n, d, 'Grid Penalty');
  assert.equal(n.game.gridPenalties[d], 3);
  assert.equal(n.game.discipline[d], 4);
});
test('DNF/DSQ cannot receive points or gain bonus; ties count back through all GP finishes', () => {
  const rows = weekend(createSave()).weekends[0].results.GP!;
  rows[0] = { ...rows[0], status: 'DSQ', gain: 31, fastestLap: true };
  assert.equal(scoreRace(rows, 'GP')[0].points, 0);
  assert.equal(scoreRace(rows, 'Sprint')[0].points, 0);
  assert.ok(compareStats({ points: 40, finishes: [1, 9] }, { points: 40, finishes: [2, 2] }) < 0);
  assert.ok(compareStats({ points: 40, finishes: [4, 5] }, { points: 40, finishes: [4, 6] }) < 0);
});
test('AI invests independently and no human-team project is silently created', () => {
  let s = createSave();
  for (let r = 1; r <= 3; r++) {
    s.round = r;
    s = runTeamAI(s);
  }
  assert.ok(s.game.development.length > 0);
  assert.ok(s.game.development.every((p) => p.teamId !== s.managedTeam));
});
test('35 GPs crown champions, pay P16, recalculate ATR and enter a playable 2030 with archived results', () => {
  let s = createSave(87);
  for (let r = 1; r <= 35; r++) {
    s = weekend(s);
    if (r === 12 || r === 24)
      assert.deepEqual(
        Object.values(s.game.atr).sort((a, b) => a - b),
        Array.from({ length: 16 }, (_, i) => 75 + i * 5),
      );
    if (r < 35) s = advanceRound(s);
  }
  assert.equal(s.game.phase, 'postseason');
  assert.ok(s.game.champion);
  const prizes = s.game.teams.flatMap((t) =>
    s.game.finances[t.id].ledger.filter((l) => l.category === 'prize'),
  );
  assert.equal(prizes.length, 16);
  assert.equal(Math.min(...prizes.map((l) => l.amount)), 10);
  assert.equal(prizeMoney[15], 10);
  assert.equal(
    Object.values(s.game.constructorBonus).reduce((a, b) => a + b, 0),
    70,
  );
  const n = prepareNextSeason(s);
  assert.equal(n.season, 2030);
  assert.equal(n.game.history[0].weekends.length, 35);
  assert.equal(n.round, 1);
  assert.ok(Object.values(n.driverPoints).every((v) => v === 0));
  assert.ok(n.game.circuits.every((c) => c.date.startsWith('2030')));
  assert.equal(n.game.drivers[0].age, s.game.drivers[0].age + 1);
  assert.ok(parseSave(JSON.stringify(n)));
  const first = runNextSession(n);
  assert.equal(first.weekends[0].results.TL1!.length, 32);
  assert.equal(s.season, 2029);
});

test('corrupt variable-length records and invalid circuit references are rejected', () => {
  const s = weekend(createSave());
  for (const corrupt of [
    (n: Save) => (n.game.circuits[0].id = 'invalid'),
    (n: Save) => ((n.game.news[0] as unknown as { category: number }).category = 1),
    (n: Save) =>
      delete (
        n.weekends[0].tapes!.GP!.frames[0] as Partial<
          import('../src/domain/simulation/types').RaceFrame
        >
      ).weather,
    (n: Save) =>
      n.game.history.push({
        season: 2028,
        driverChampion: 'lando-norris',
        teamChampion: 'mclaren',
        points: {},
        teamPoints: {},
        stats: {},
        weekends: s.weekends,
      } as import('../src/domain/simulation/types').Archive),
  ]) {
    const n = structuredClone(s);
    corrupt(n);
    assert.equal(parseSave(JSON.stringify(n)), null);
  }
});
