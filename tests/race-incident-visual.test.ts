import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceIncidentPose } from '../src/presentation/race-incident-visual';

const event = (type: string, severity?: 'leve' | 'moderado' | 'grave' | 'terminal') => ({
  lap: 12, driverId: 'car-a', type, detail: type, severity,
});

test('não inventa incidente visual sem evento real da volta', () => {
  assert.equal(raceIncidentPose([], 'car-a', 'RUNNING', 12, .5), null);
  assert.equal(raceIncidentPose([event('spin')], 'car-b', 'RUNNING', 12, .5), null);
  assert.equal(raceIncidentPose([event('spin')], 'car-a', 'RUNNING', 13, .5), null);
});

test('rodada e saída de pista geram poses distintas sem alterar evento', () => {
  const spin = raceIncidentPose([event('spin')], 'car-a', 'RUNNING', 12, .55)!;
  const wide = raceIncidentPose([event('wide')], 'car-a', 'RUNNING', 12, .55)!;
  assert.equal(spin.kind, 'SPIN');
  assert.ok(Math.abs(spin.yaw) > 180);
  assert.equal(spin.dust, true);
  assert.equal(wide.kind, 'OFF_TRACK');
  assert.equal(wide.yaw, 0);
  assert.ok(Math.abs(wide.side) > Math.abs(spin.side));
});

test('colisão terminal mostra impacto e carro parado com fumaça', () => {
  const impact = raceIncidentPose([event('collision', 'terminal')], 'car-a', 'DNF', 12, .35)!;
  const stopped = raceIncidentPose([event('collision', 'terminal')], 'car-a', 'DNF', 12, .9)!;
  assert.equal(impact.kind, 'IMPACT');
  assert.equal(impact.sparks, true);
  assert.equal(stopped.kind, 'STOPPED');
  assert.equal(stopped.smoke, true);
});

test('abandono mecânico para o carro sem simular batida', () => {
  const pose = raceIncidentPose([event('mechanical failure', 'terminal')], 'car-a', 'DNF', 12, .6)!;
  assert.equal(pose.kind, 'STOPPED');
  assert.equal(pose.sparks, false);
  assert.equal(pose.smoke, true);
});
