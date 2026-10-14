import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { seasonPulse } from '../src/presentation/season-pulse';

test('new season has no fictional leader, news or winner', () => {
  const save = createSave();
  const pulse = seasonPulse(save);
  assert.equal(pulse.completed, 0);
  assert.equal(pulse.total, save.game.circuits.length);
  assert.deepEqual(pulse.standings, []);
  assert.equal(pulse.lastWinner, null);
  assert.equal(pulse.upcoming[0]?.round, 1);
});
test('live season pulse uses persisted results without mutating saves', () => {
  const save = createSave();
  const snapshot = JSON.stringify(save);
  const a = save.game.drivers[0], b = save.game.drivers[1];
  save.driverPoints[a.id] = 25;
  save.driverPoints[b.id] = 18;
  save.weekends = [{ round: 1, qualifyingGrid: [], sprintGrid: [], results: { GP: [
    { driverId: a.id, position: 1, time: 0, points: 25, fastestLap: false, gain: 0 },
    { driverId: b.id, position: 2, time: 0, points: 18, fastestLap: false, gain: 0 },
  ] } }];
  const after = JSON.stringify(save);
  const pulse = seasonPulse(save);
  assert.equal(pulse.completed, 1);
  assert.equal(pulse.lastWinner, a.name);
  assert.equal(pulse.standings[0].id, a.id);
  assert.equal(pulse.upcoming[0]?.round, 2);
  assert.equal(JSON.stringify(save), after);
  assert.notEqual(snapshot, after);
});
test('finished calendar has no upcoming races', () => {
  const save = createSave();
  save.round = 36;
  assert.deepEqual(seasonPulse(save).upcoming, []);
});
test('empty provisional GP result does not advance season progress', () => {
  const save = createSave();
  save.weekends = [{ round: 1, results: { GP: [] }, sprintGrid: [], qualifyingGrid: [] }];
  const pulse = seasonPulse(save);
  assert.equal(pulse.completed, 0);
  assert.equal(pulse.upcoming[0]?.round, 1);
});
