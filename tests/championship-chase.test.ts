import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { championshipChase } from '../src/presentation/championship-chase';

const result = (driverId: string, teamId: string, position: number, status: 'DNF' | 'FINISHED' = 'FINISHED') =>
  ({ driverId, teamId, position, status, time: 0, points: 0, fastestLap: false, gain: 0 });

test('without completed GP the universe does not invent championship opponent', () => {
  assert.equal(championshipChase(createSave()), null);
});
test('driver chase finds immediate table neighbor and real head-to-head without mutating save', () => {
  const save = createSave();
  const a = save.game.drivers[0], b = save.game.drivers[1];
  save.career.mode = 'driver';
  save.career.driverId = b.id;
  save.driverPoints = Object.fromEntries(save.game.drivers.map((d) => [d.id, 0]));
  save.driverPoints[a.id] = 25;
  save.driverPoints[b.id] = 18;
  save.weekends = [{ round: 1, qualifyingGrid: [], sprintGrid: [], results: {
    GP: [result(a.id, a.teamId, 1), result(b.id, b.teamId, 2)],
  } }];
  const before = JSON.stringify(save);
  const chase = championshipChase(save);
  assert.equal(chase?.id, a.id);
  assert.equal(chase?.gap, 7);
  assert.equal(chase?.direction, 'ahead');
  assert.deepEqual(chase?.duels, [{ round: 1, outcome: 'loss' }]);
  assert.equal(JSON.stringify(save), before);
});
test('team chase uses best finish and can infer team from driver when result teamId omitted', () => {
  const save = createSave();
  const teams = save.game.teams;
  const mine = save.managedTeam;
  const rival = teams.find((team) => team.id !== mine)!;
  save.game.teamPoints = Object.fromEntries(teams.map((team) => [team.id, 0]));
  save.game.teamPoints[mine] = 25;
  save.game.teamPoints[rival.id] = 18;
  const mineDriver = save.game.drivers.find((d) => d.teamId === mine)!;
  const rivalDriver = save.game.drivers.find((d) => d.teamId === rival.id)!;
  save.weekends = [{ round: 1, qualifyingGrid: [], sprintGrid: [], results: { GP: [
    { ...result(mineDriver.id, mine, 1), teamId: undefined },
    { ...result(rivalDriver.id, rival.id, 2), teamId: undefined },
  ] } }];
  const chase = championshipChase(save);
  assert.equal(chase?.mode, 'team');
  assert.equal(chase?.id, rival.id);
  assert.deepEqual(chase?.duels, [{ round: 1, outcome: 'win' }]);
});
test('a retirement is not counted as a head-to-head win or loss', () => {
  const save = createSave();
  const mine = save.managedTeam;
  const other = save.game.teams.find((team) => team.id !== mine)!;
  save.game.teamPoints = Object.fromEntries(save.game.teams.map((team) => [team.id, 0]));
  save.game.teamPoints[mine] = 20;
  save.game.teamPoints[other.id] = 18;
  const myDriver = save.game.drivers.find((d) => d.teamId === mine)!;
  const otherDriver = save.game.drivers.find((d) => d.teamId === other.id)!;
  save.weekends = [{ round: 1, qualifyingGrid: [], sprintGrid: [], results: { GP: [
    result(myDriver.id, mine, 25, 'DNF'), result(otherDriver.id, other.id, 8),
  ] } }];
  assert.deepEqual(championshipChase(save)?.duels, []);
});
