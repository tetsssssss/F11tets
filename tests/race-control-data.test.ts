import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap } from '../src/domain/simulation/race';
import { gapRows, lapHistory, tyreHistory, positionChange } from '../src/presentation/race-control-data';

test('GAP completo, próximos e comparação leem a mesma ordem sem mutá-la', () => {
  const save = createSave();
  const race = createRaceState(save, 'GP', save.game.drivers.map(d => d.id));
  const order = [...race.cars];
  const before = JSON.stringify(order);
  assert.equal(gapRows(order, order[10].id, 'full', null).length, order.length);
  assert.deepEqual(gapRows(order, order[10].id, 'near', null).map(c => c.id), order.slice(8, 13).map(c => c.id));
  assert.deepEqual(gapRows(order, order[10].id, 'compare', order[2].id).map(c => c.id), [order[2].id, order[10].id]);
  assert.equal(JSON.stringify(order), before);
});

test('histórico não é inventado quando telemetria completa não foi gravada', () => {
  const save = createSave();
  const race = createRaceState(save, 'GP', save.game.drivers.map(d => d.id));
  assert.deepEqual(lapHistory(race, race.cars[0].id), []);
  assert.deepEqual(tyreHistory(race, race.cars[0].id), []);
  assert.equal(positionChange(race, race.cars[0].id), null);
});

test('históricos e movimento de posição vêm de snapshots reais', () => {
  const save = createSave();
  const race = createRaceState(save, 'GP', save.game.drivers.map(d => d.id));
  race.recordFrames = true;
  stepRaceLap(save, race);
  const id = race.cars[0].id;
  const first = race.frames[0].cars.find(c => c.id === id)!;
  first.position = 3;
  stepRaceLap(save, race);
  const second = race.frames[1].cars.find(c => c.id === id)!;
  assert.deepEqual(lapHistory(race, id).map(row => row.lap), [1, 2]);
  assert.equal(tyreHistory(race, id).at(-1), race.cars.find(c => c.id === id)!.tyre.compound);
  assert.equal(positionChange(race, id), 3 - second.position);
});
