import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap } from '../src/domain/simulation/race';

test('first-lap grid cannot reorder the field without overtaking actions', () => {
  const save=createSave(2029);
  const ids=save.game.drivers.map(d=>d.id);
  const state=createRaceState(save, 'GP', ids);
  // All the cars are spread far enough apart to prevent wheel-to-wheel attacks.
  // This tests the first-lap guard, not a normal tight F1 standing start.
  state.cars.forEach((car, i)=> {car.elapsed = i*15;});
  const start=[...state.cars].sort((a,b)=>a.elapsed-b.elapsed).map(c=>c.id);
  stepRaceLap(save,state);
  const end=[...state.cars].filter(c=>c.status==='RUNNING').sort((a,b)=>a.elapsed-b.elapsed).map(c=>c.id);
  assert.deepEqual(end, start.filter(id=>state.cars.find(c=>c.id===id)?.status==='RUNNING'));
});
