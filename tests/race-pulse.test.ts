import { test } from 'node:test';
import assert from 'node:assert/strict';
import { racePulse } from '../src/presentation/race-pulse';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap } from '../src/domain/simulation/race';
test('TV pulse counts only real state and known incidents without invented numbers',()=>{
 const s=createSave();const r=createRaceState(s,'GP',s.game.drivers.map(d=>d.id));
 let pulse=racePulse(r);
 assert.deepEqual([pulse.active,pulse.field,pulse.passes,pulse.pits,pulse.incidents],[32,32,0,0,0]);
 stepRaceLap(s,r);
 pulse=racePulse(r);
 assert.equal(pulse.passes,r.cars.reduce((n,c)=>n+c.overtakes,0));
 assert.equal(pulse.incidents,r.events.filter(e=>/contact|collision|mechanical failure|retirement|puncture|red flag|spin/i.test(e.type)).length);
 assert.equal(pulse.retirements,r.cars.filter(c=>c.status!=='RUNNING').length);
});
