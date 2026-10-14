import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tvCameraOffset, sceneryVisibility, battleCameraLookAhead, incidentYawDelta } from '../src/presentation/babylon-camera';

test('TV mobile aproxima a câmera e mantém alvo à frente do carro', () => {
  const desktop = tvCameraOffset(false);
  const mobile = tvCameraOffset(true);
  assert.ok(mobile.back < desktop.back);
  assert.ok(mobile.side < desktop.side);
  assert.ok(mobile.height < desktop.height);
  assert.ok(mobile.lookAhead > 0);
});

test('TV torna transparente somente o cenário que encobre a câmera', () => {
  assert.equal(sceneryVisibility(5, 'tv'), 0.12);
  assert.equal(sceneryVisibility(20, 'tv'), 1);
  assert.equal(sceneryVisibility(5, 'aerea'), 1);
  assert.ok(sceneryVisibility(11, 'tv') > 0.12 && sceneryVisibility(11, 'tv') < 1);
});

test('pit buildings não bloqueiam carros em câmeras próximas', () => {
  assert.equal(sceneryVisibility(20, 'tv', 'pit_roof_main'), 0);
  assert.equal(sceneryVisibility(20, 'onboard', 'pit_building_main'), 0);
  assert.equal(sceneryVisibility(20, 'aerea', 'pit_roof_main'), 1);
  assert.equal(sceneryVisibility(20, 'duelo', 'pit_roof_main'), 0);
  assert.equal(sceneryVisibility(20, 'duelo', 'grandstand_0'), 0);
  assert.equal(sceneryVisibility(20, 'aerea', 'grandstand_0'), 1);
});

test('câmera de disputa enquadra carros acima do painel inferior no celular', () => {
  assert.ok(battleCameraLookAhead(true) < battleCameraLookAhead(false));
  assert.ok(battleCameraLookAhead(false) <= 0);
});

test('rodada preserva giro completo; condução normal usa caminho angular curto', () => {
  assert.ok(Math.abs(incidentYawDelta(0, Math.PI * 2.3, true)) > Math.PI * 2);
  assert.ok(Math.abs(incidentYawDelta(0, Math.PI * 2.3, false)) < Math.PI);
});
