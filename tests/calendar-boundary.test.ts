import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { nextSession } from '../src/domain/simulation';
test('calendar progression reads the loaded championship length rather than hardcoding the final GP',()=>{
 const s=createSave(2029);
 assert.equal(s.game.circuits.length,35);
 assert.equal(nextSession(s),'TL1');
 s.game.circuits=s.game.circuits.slice(0,2);
 s.round=2;
 assert.equal(nextSession(s),'TL1');
 s.round=3;
 assert.equal(nextSession(s),null);
});
