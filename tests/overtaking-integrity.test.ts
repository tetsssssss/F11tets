import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedOnTrackPasses } from '../src/domain/simulation/overtaking';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap, finishRace } from '../src/domain/simulation/race';

const car = (id: string, elapsed: number, status: 'RUNNING'|'DNF' = 'RUNNING') => ({ id, elapsed, status });
const passes = (before: any[], after: any[], pits: string[] = [], control: any = 'GREEN') =>
  confirmedOnTrackPasses(before as any, after as any, new Set(pits), 4, control, 70);

test('close on-track reversal counts as one confirmed overtake', () => {
  const result = passes([car('a', 100), car('b', 100.4)], [car('b', 198), car('a', 199)]);
  assert.equal(result.length, 1);
  assert.equal(result[0].driverId, 'b');
  assert.equal(result[0].otherId, 'a');
});
test('pit loss, distant reversal, retirement and neutralization do not fabricate overtakes', () => {
  const close = [car('a', 100), car('b', 100.4)];
  const swapped = [car('b', 198), car('a', 199)];
  assert.equal(passes(close, swapped, ['a']).length, 0);
  assert.equal(passes(close, swapped, ['b']).length, 0);
  assert.equal(passes([car('a', 100), car('b', 106)], swapped).length, 0);
  assert.equal(passes(close, swapped, [], 'SC').length, 0);
  assert.equal(passes(close, [car('b', 198), car('a', 199, 'DNF')]).length, 0);
});
test('multiple nearby opponents are counted without duplicates', () => {
  const before = [car('a',100), car('b',100.4), car('c',100.8)];
  const after = [car('c', 198), car('a',199), car('b',200)];
  const result=passes(before,after);
  assert.equal(result.length,2);
  assert.deepEqual(result.map(e=>e.otherId).sort(),['a','b']);
});
test('race result overtakes agree exactly with confirmed event counts and seed replay', () => {
  const run=()=>{
    const save=createSave(2032);
    const state=createRaceState(save,'GP',save.game.drivers.map(d=>d.id));
    state.laps=8;
    while(state.status==='RUNNING') stepRaceLap(save,state);
    return finishRace(save,state);
  };
  const first=run();
  const counts=new Map<string,number>();
  for(const event of first.tape.events.filter(e=>e.type==='overtake')) counts.set(event.driverId,(counts.get(event.driverId)||0)+1);
  for(const row of first.results) assert.equal(row.overtakes,counts.get(row.driverId)||0);
  assert.deepEqual(run().results,first.results);
});
