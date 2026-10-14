import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRaceGap } from '../src/presentation/race-gap';

const leader = { id: 'leader', lap: 12, elapsed: 1234.5, status: 'RUNNING' as const };

test('GAP mostra segundos somente para carros na mesma volta', () => {
  assert.equal(formatRaceGap(leader, leader), 'LÍDER');
  assert.equal(formatRaceGap({ id: 'other', lap: 12, elapsed: 1237.25, status: 'RUNNING' }, leader), '+2.8s');
});

test('GAP mostra voltas de déficit em vez de tempo enganoso', () => {
  assert.equal(formatRaceGap({ id: 'other', lap: 11, elapsed: 1240, status: 'RUNNING' }, leader), '+1V');
  assert.equal(formatRaceGap({ id: 'other', lap: 10, elapsed: 1240, status: 'RUNNING' }, leader), '+2V');
});

test('GAP não fabrica intervalo com dados inválidos ou carro fora da disputa', () => {
  assert.equal(formatRaceGap({ id: 'other', lap: 12, elapsed: 1230, status: 'RUNNING' }, leader), '—');
  assert.equal(formatRaceGap({ id: 'other', lap: 12, elapsed: NaN, status: 'RUNNING' }, leader), '—');
  assert.equal(formatRaceGap({ id: 'other', lap: 12, elapsed: 1240, status: 'DNF' }, leader), 'DNF');
  assert.equal(formatRaceGap({ id: 'other', lap: 12, elapsed: 1240, status: 'RUNNING' }, undefined), '—');
});
