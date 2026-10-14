import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battleFocus, battleMagnification, visualRaceAngle, visualRacePoint } from '../src/presentation/race-visual-focus';

const cars = [
  { id: 'a', point: { x: 100, y: 20 }, angle: 35, car: { status: 'RUNNING' }, pitStage: 'TRACK' },
  { id: 'b', point: { x: 112, y: 26 }, angle: 39, car: { status: 'RUNNING' }, pitStage: 'TRACK' },
  { id: 'c', point: { x: -200, y: 30 }, angle: 0, car: { status: 'RUNNING' }, pitStage: 'TRACK' },
];

test('enquadramento da disputa usa o meio dos dois carros reais', () => {
  assert.deepEqual(battleFocus(cars, ['a', 'b']), { x: 106, y: 23, angle: 35 });
});

test('não enquadra disputa ausente, distante ou fora da pista', () => {
  assert.equal(battleFocus(cars, ['a', 'c']), null);
  assert.equal(battleFocus(cars, ['a', 'inexistente']), null);
  assert.equal(battleFocus([{ ...cars[0], pitStage: 'STOP' }, cars[1]], ['a', 'b']), null);
});

test('2.5D aproxima mais a disputa em tela estreita sem esconder o modo pista inteira', () => {
  assert.ok(battleMagnification(390) > battleMagnification(1365));
  assert.ok(battleMagnification(1365) > 1);
});

test('linhas lado a lado usam a pose visual existente sem mudar a posição esportiva', () => {
  const attacker = { point: { x: 100, y: 20 }, angle: 0, duel: { side: 1 } };
  const defender = { point: { x: 100, y: 20 }, angle: 0, duel: { side: -0.3 } };
  assert.deepEqual(visualRacePoint(attacker), { x: 100, y: 26.5 });
  assert.deepEqual(visualRacePoint(defender), { x: 100, y: 18.05 });
  assert.deepEqual(attacker.point, { x: 100, y: 20 });
  assert.deepEqual(visualRacePoint({ ...attacker, duel: undefined }), attacker.point);
});

test('incidente desloca e gira apenas a representação do carro', () => {
  const car = { point: { x: 40, y: 60 }, angle: 0, incident: { side: 2, yaw: 270 } };
  assert.deepEqual(visualRacePoint(car), { x: 40, y: 73 });
  assert.equal(visualRaceAngle(car), 270);
  assert.deepEqual(car.point, { x: 40, y: 60 });
});
