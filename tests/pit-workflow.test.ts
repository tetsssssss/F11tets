import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSave } from '../src/domain/save';
import { configureCareer, controlledIds } from '../src/domain/gameplay/career';
import { runNextSession, beginLiveSession, tickLive } from '../src/domain/simulation';
import { callPit } from '../src/domain/gameplay/commands';
import { circuitGeometry } from '../src/presentation/circuit-geometry';
import { presentRace } from '../src/presentation/race-presentation';
import { pitCrewVisible } from '../src/presentation/race-ceremony';
import { babylonShotFor } from '../src/presentation/broadcast-director';
import type { Save } from '../src/domain/types';

function ready() {
  let s = configureCareer(createSave(2029), 'constructor', 'mclaren');
  for (let i = 0; i < 6; i++) s = runNextSession(s);
  return beginLiveSession(s);
}
const lap = (s: Save) => { for (let i = 0; i < 3; i++) s = tickLive(s, true); return s; };
const car = (s: Save, id: string) => s.race!.cars.find((c) => c.id === id)!;

test('constructor mode controls two cars; each pit call is independent and one call per driver', () => {
  let s = ready();
  const [a, b] = controlledIds(s);
  assert.ok(a && b && a !== b);
  s = callPit(s, a, 'now', 'H');
  s = callPit(s, b, 'next', 'S');
  assert.equal(s.race!.pitCalls[a].lap, s.race!.lap + 1);
  assert.equal(s.race!.pitCalls[b].lap, s.race!.lap + 2);
  assert.equal(s.race!.pitCalls[b].compound, 'S');
  // A second call for the same driver replaces the first instead of stacking.
  s = callPit(s, a, 'next', 'M');
  assert.equal(Object.keys(s.race!.pitCalls).filter((id) => id === a).length, 1);
  assert.deepEqual([s.race!.pitCalls[a].lap, s.race!.pitCalls[a].compound], [s.race!.lap + 2, 'M']);
  assert.equal(car(s, a).pitPhase, 'CALLED');
});
test('cancel only works on an existing call and restores the car to TRACK', () => {
  let s = ready();
  const [a] = controlledIds(s);
  assert.equal(callPit(s, a, 'cancel', 'H'), s, 'nothing to cancel returns the same save');
  s = callPit(s, a, 'now', 'H');
  s = callPit(s, a, 'cancel', 'H');
  assert.equal(s.race!.pitCalls[a], undefined);
  assert.equal(car(s, a).pitPhase, 'TRACK');
  s = lap(s);
  assert.equal(car(s, a).pits, 0, 'a cancelled call never produces a stop');
});
test('calling the box is refused for AI cars and for laps beyond the race', () => {
  const s = ready();
  const ai = s.race!.cars.find((c) => !controlledIds(s).includes(c.id))!.id;
  assert.equal(callPit(s, ai, 'now', 'H'), s);
  const late = ready();
  late.race!.lap = late.race!.laps;
  assert.equal(callPit(late, controlledIds(late)[0], 'now', 'H'), late);
});
test('a real stop changes compound, pit count and the event log; presentation only mirrors it', () => {
  let s = ready();
  const [a] = controlledIds(s);
  const before = car(s, a).tyre.compound;
  const target = before === 'H' ? 'S' : 'H';
  s = callPit(s, a, 'now', target);
  let sawStage = new Set<string>();
  const geometry = circuitGeometry(s.game.circuits[0]);
  for (let i = 0; i < 6; i++) {
    const hash = createHash('sha256').update(JSON.stringify(s.race)).digest('hex');
    const shown = presentRace(s.race!, geometry, 90, 0.3).find((c) => c.id === a)!;
    sawStage.add(shown.pitStage);
    // Reading the presentation (and choosing the pit camera) never writes to the race.
    babylonShotFor('pit', { auto: { kind: 'pit', ids: [a], label: 'x' }, follow: { ids: [a] }, battleIds: null, cars: presentRace(s.race!, geometry, 90, 0.3), selected: a, own: [a] });
    assert.equal(createHash('sha256').update(JSON.stringify(s.race)).digest('hex'), hash);
    s = tickLive(s, true);
  }
  const done = car(s, a);
  assert.equal(done.tyre.compound, target);
  assert.equal(done.pits, 1);
  assert.ok(s.race!.events.some((e) => e.driverId === a && e.type === 'pit'));
  assert.equal(s.race!.pitCalls[a], undefined, 'the call is consumed by the stop');
  assert.ok(sawStage.has('TRACK'));
});
test('crew actors appear only in the STOP stage and no stop duration is invented', () => {
  assert.equal(pitCrewVisible('STOP'), true);
  for (const stage of ['TRACK', 'ENTRY', 'EXIT']) assert.equal(pitCrewVisible(stage), false);
  const s = ready();
  const shown = presentRace(s.race!, circuitGeometry(s.game.circuits[0]), 90, 0.3);
  for (const c of shown) assert.ok(!('stopTime' in c) && !('pitDuration' in c));
});
