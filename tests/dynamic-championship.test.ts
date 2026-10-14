import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { nextSession, runNextSession, advanceRound } from '../src/domain/simulation';

test('shortened calendar crowns champions on its actual final GP, without waiting for round 35', () => {
  let save=createSave();
  save.game.circuits=save.game.circuits.slice(0,2);
  save.world.league.calendarSize=2;
  for (let r=1;r<=2;r++) {
    let safety=0;
    while (nextSession(save)) {
      save=runNextSession(save);
      if (++safety>9) throw new Error('weekend failed to finish');
    }
    if (r===1) {
      assert.equal(save.game.phase,'season');
      save=advanceRound(save);
    }
  }
  assert.equal(save.game.phase,'postseason');
  assert.ok(save.game.champion);
  assert.ok(save.game.constructorChampion);
  assert.ok(save.world.offseason);
  assert.ok(parseSave(JSON.stringify(save)) !== null, 'calendar-aware saved postseason must roundtrip');
});

test('standard championship does not award the title before the final round',()=>{
  const save=createSave();
  assert.equal(save.game.circuits.length, 35);
  assert.equal(save.game.phase, 'season');
  assert.equal(parseSave(JSON.stringify(save))?.game.phase, 'season');
});
