import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podiumOrder, safetyCarPose, pitCrewVisible } from '../src/presentation/race-ceremony';

test('pódio usa somente os três primeiros classificados oficiais', () => {
  const results = [
    { driverId: 'a', position: 1, status: 'FINISHED' },
    { driverId: 'b', position: 2, status: 'FINISHED' },
    { driverId: 'c', position: 3, status: 'FINISHED' },
    { driverId: 'd', position: 4, status: 'FINISHED' },
  ];
  assert.deepEqual(podiumOrder(results).map((r) => r.driverId), ['b', 'a', 'c']);
  assert.deepEqual(podiumOrder(results.slice(0, 2)).map((r) => r.driverId), ['b', 'a']);
});

test('Safety Car aparece apenas em SC, à frente do líder real', () => {
  const cars = [{ position: 2, progress: 0.2 }, { position: 1, progress: 0.93 }];
  const at = (progress: number) => ({ x: progress, y: 2 * progress });
  assert.equal(safetyCarPose('GREEN', cars, at), null);
  const pose = safetyCarPose('SC', cars, at)!;
  assert.ok(Math.abs(pose.point.x - 0.955) < 1e-9);
  assert.ok(Math.abs(pose.point.y - 1.91) < 1e-9);
  assert.ok(Math.abs(pose.angle - Math.atan2(2, 1)) < 1e-9);
});

test('equipe de boxes aparece apenas no estágio de parada real', () => {
  assert.equal(pitCrewVisible('ENTRY'), false);
  assert.equal(pitCrewVisible('STOP'), true);
  assert.equal(pitCrewVisible('EXIT'), false);
});
