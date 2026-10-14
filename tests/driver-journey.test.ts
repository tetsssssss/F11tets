import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSave} from '../src/domain/save';
import {driverJourney} from '../src/presentation/driver-journey';
test('journey starts empty for newcomers; no invented results',()=>{
  const s=createSave(),d=s.world.pool[0];assert.ok(d);
  const before=JSON.stringify(s);const j=driverJourney(s,d.id);
  assert.deepEqual(j.events,[]);assert.equal(j.careerStarts,0);assert.equal(JSON.stringify(s),before);
});
test('journey uses archived feeder, actual race positions and original points',()=>{
  const s=createSave();const d=s.game.drivers[0];const rookie=s.world.pool[0];
  s.world.feederHistory.push({season:2029,category:'F3',standings:[{id:rookie.id,position:1,points:155}]});
  s.weekends.push({round:1,qualifyingGrid:[],sprintGrid:[],results:{GP:[{driverId:d.id,position:1,points:25,status:'FINISHED',fastestLap:false,gain:0,time:100}]}});
  assert.equal(driverJourney(s,rookie.id).feederTitles,1);
  const result=driverJourney(s,d.id);assert.equal(result.careerStarts,1);assert.equal(result.careerWins,1);assert.equal(result.careerPoints,25);
  assert.equal(result.events.filter((row)=>row.kind==='f1').length,1);
});
test('journey includes transfers without forging starts',()=>{
  const s=createSave(),d=s.game.drivers[0];
  s.world.transfers.push({id:'x',season:s.season,round:4,personId:d.id,from:'old',to:'new',kind:'driver',detail:'mudança registrada'});
  assert.equal(driverJourney(s,d.id).events[0].kind,'transfer');assert.equal(driverJourney(s,d.id).careerStarts,0);
});
test('preloaded 2026-28 champions are context, not career achievements',()=>{
  const s=createSave(),pilot=s.game.drivers.find((d)=>s.game.champions.some((c)=>c.driver===d.name));
  assert.ok(pilot);
  assert.equal(driverJourney(s,pilot!.id).events.some((e)=>e.kind==='milestone'),false);
});
test('championship becomes a milestone only after a real archived season',()=>{
  const s=createSave(),pilot=s.game.drivers[0];
  s.game.champions.push({season:s.season,driver:pilot.name,team:pilot.teamId});
  assert.equal(driverJourney(s,pilot.id).events.some((e)=>e.kind==='milestone'),false);
  s.game.phase='postseason';
  assert.equal(driverJourney(s,pilot.id).events.some((e)=>e.kind==='milestone'),true);
});
