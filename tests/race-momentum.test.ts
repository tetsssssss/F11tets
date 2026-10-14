import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { raceMomentum } from '../src/presentation/race-momentum';
const result = (driverId:string, points:number, teamId?:string) =>
  ({driverId, points, teamId, position:1, time:0, gain:0, fastestLap:false});
const weekend = (round:number, rows:ReturnType<typeof result>[]) =>
  ({round, results:{GP:rows}, qualifyingGrid:[], sprintGrid:[]});

test('new career does not invent race momentum', () => {
  assert.deepEqual(raceMomentum(createSave()),{rounds:[],points:0,best:0,delta:null});
});
test('driver mode selects only the managed driver and orders unsorted GP rounds', () => {
  const s = createSave();
  const a=s.game.drivers[0],b=s.game.drivers[1];
  s.career.mode='driver'; s.career.driverId=a.id;
  s.weekends=[weekend(2,[result(a.id,18),result(b.id,25)]),weekend(1,[result(a.id,25),result(b.id,18)])];
  const before=JSON.stringify(s);
  assert.deepEqual(raceMomentum(s),{rounds:[{round:1,points:25},{round:2,points:18}],points:43,best:25,delta:-7});
  assert.equal(JSON.stringify(s),before);
});
test('constructor mode combines the two cars, infers missing teamId and ignores duplicate rows', () => {
  const s=createSave();
  const drivers=s.game.drivers.filter(d=>d.teamId===s.managedTeam);
  assert.ok(drivers.length>=2);
  s.weekends=[weekend(1,[result(drivers[0].id,25),result(drivers[1].id,18),result(drivers[0].id,25)])];
  assert.equal(raceMomentum(s).points,43);
});
test('non-finite scores and unfinished sessions cannot inflate momentum', () => {
  const s=createSave(); const driver=s.game.drivers.find(d=>d.teamId===s.managedTeam)!;
  s.weekends=[{round:1,results:{Q1:[result(driver.id,25)]},qualifyingGrid:[],sprintGrid:[]},
    weekend(2,[result(driver.id,Number.NaN)]),weekend(3,[result(driver.id,-2)])];
  const data=raceMomentum(s);
  assert.deepEqual(data.rounds.map(r=>r.points),[0,0]);
  assert.equal(data.points,0);
});
