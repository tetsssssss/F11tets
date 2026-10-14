import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRaceViewMode, readRaceViewMode, writeRaceViewMode } from '../src/presentation/race-view-preference';
test('a opção de câmera mantém 2D como padrão seguro', () => {
  for (const value of [null,undefined,'','3d','random',{},8]) assert.equal(normalizeRaceViewMode(value),'2d');
  assert.equal(normalizeRaceViewMode('2d'),'2d');
  assert.equal(normalizeRaceViewMode('iso'),'iso');
  assert.equal(normalizeRaceViewMode('babylon'),'babylon');
});
test('preferência não modifica saves nem exige localStorage em ambiente SSR', () => {
  assert.equal(readRaceViewMode(),'2d');
  assert.doesNotThrow(()=>writeRaceViewMode('iso'));
});
