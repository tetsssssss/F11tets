import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { nextSession, runNextSession, advanceRound } from '../src/domain/simulation';

test('calendar-limited save does not load impossible extra rounds', () => {
 const save=createSave();
 const complete=JSON.stringify(save);
 assert.ok(parseSave(complete));
 save.game.circuits=save.game.circuits.slice(0,2);
 save.world.league.calendarSize=2;
 save.world.settings.telemetry='summary';
 for(let round=1;round<=2;round++) {
  let sessions=0;
  while(nextSession(save)) { Object.assign(save,runNextSession(save)); if(++sessions>8)throw Error('stalled'); }
  Object.assign(save,advanceRound(save));
  assert.ok(parseSave(JSON.stringify(save)),`save valid after round ${round}`);
 }
 assert.equal(save.round,3);
 save.round=4;
 assert.equal(parseSave(JSON.stringify(save)),null,'round cannot exceed calendar length plus one');
});
test('calendar-aware menu progression works with shorter seasons',()=>{
 const save=createSave();
 save.game.circuits=save.game.circuits.slice(0,3);
 save.round=3;
 assert.equal(nextSession(save),'TL1');
 save.round=4;
 assert.equal(nextSession(save),null);
});
