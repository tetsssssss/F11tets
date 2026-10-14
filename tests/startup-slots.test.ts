import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderedStartupSlots, allowLegacyCareer, type StartupSlot } from '../src/domain/startup-slots';
const slot = (id: number, raw: string | null, exists = Boolean(raw), updated = 0): StartupSlot => ({ slot: id, raw, exists, updated });
test('active slot is restored first, even when another slot has newer metadata', () => {
  const records = [slot(1, 'a', true, 1), slot(2, 'b', true, 99), slot(3, null)];
  assert.deepEqual(orderedStartupSlots(1, records).map((s) => s.slot), [1, 2]);
});
test('missing active slot falls back to the newest populated slot, not the shared mirror', () => {
  const records = [slot(1, null), slot(2, 'b', true, 99), slot(3, 'c', true, 7)];
  assert.deepEqual(orderedStartupSlots(1, records).map((s) => s.slot), [2, 3]);
  assert.equal(allowLegacyCareer(records), false);
});
test('a corrupt but present slot blocks legacy fallback and permits snapshot recovery', () => {
  const records = [slot(1, null, true, 10), slot(2, null), slot(3, null)];
  assert.deepEqual(orderedStartupSlots(1, records).map((s) => s.slot), [1]);
  assert.equal(allowLegacyCareer(records), false);
});
test('migration of global saves is allowed only for installations with no modern slots', () => {
  assert.equal(allowLegacyCareer([slot(1, null), slot(2, null), slot(3, null)]), true);
  assert.equal(allowLegacyCareer([slot(1, 'corrupt'), slot(2, null), slot(3, null)]), false);
});
test('invalid record identifiers are not candidates', () => {
  assert.deepEqual(orderedStartupSlots(2, [slot(0,'bad'), slot(4,'bad'), slot(2,'real')]).map(x=>x.slot),[2]);
});
