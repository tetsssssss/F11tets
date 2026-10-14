import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preserveRejectedSave, readSlot, readSlots, readSnapshots, writeStoredSave } from '../src/domain/persistence';
import { createSave } from '../src/domain/save';

// Minimal IndexedDB fake exercising request, transaction completion and abort behavior.
// This is not a replacement for a real-browser IndexedDB test.
function withDatabase<T>(
  values: Record<string, unknown>,
  mode: 'ok' | 'get-abort' | 'put-abort',
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.indexedDB;
  const db = {
    close() {},
    transaction() {
      const transaction: Record<string, unknown> = { error: new Error('IndexedDB transaction aborted') };
      transaction.objectStore = () => ({
        get(key: string) {
          const request: Record<string, unknown> = { result: values[key], error: null };
          queueMicrotask(() => {
            if (mode === 'get-abort') {
              (transaction.onabort as (() => void) | undefined)?.();
            } else {
              (request.onsuccess as (() => void) | undefined)?.();
              queueMicrotask(() => (transaction.oncomplete as (() => void) | undefined)?.());
            }
          });
          return request;
        },
        put() {
          queueMicrotask(() => {
            if (mode === 'put-abort') (transaction.onabort as (() => void) | undefined)?.();
            else (transaction.oncomplete as (() => void) | undefined)?.();
          });
        },
      });
      return transaction;
    },
  };
  globalThis.indexedDB = {
    open() {
      const request: Record<string, unknown> = { result: db };
      queueMicrotask(() => (request.onsuccess as (() => void) | undefined)?.());
      return request;
    },
  } as unknown as IDBFactory;
  return run().finally(() => { globalThis.indexedDB = original; });
}

test('readSnapshots excludes missing, malformed, duplicated and foreign-slot checkpoints', async () => {
  const latest = { key: 'checkpoint-1-new', boundary: 'new', created: 100, label: 'Mais recente' };
  const previous = { key: 'checkpoint-1-old', boundary: 'old', created: 90, label: 'Anterior' };
  const bad = { key: 'checkpoint-2-other', boundary: 'wrong', created: 70, label: 'Slot diferente' };
  const missing = { key: 'checkpoint-1-missing', boundary: 'missing', created: 80, label: 'Apagado' };
  await withDatabase({
    'snapshot-index-1': [latest, missing, previous, latest, bad, null, {}],
    'checkpoint-1-new': '{"version":4}',
    'checkpoint-1-old': '{"version":3}',
  }, 'ok', async () => {
    const copies = await readSnapshots(1);
    assert.deepEqual(copies, [
      { boundary: 'new', created: 100, label: 'Mais recente', raw: '{"version":4}' },
      { boundary: 'old', created: 90, label: 'Anterior', raw: '{"version":3}' },
    ]);
    assert.deepEqual(await readSnapshots(4), []);
  });
});

test('readSnapshots accepts valid legacy records without letting malformed records through', async () => {
  const valid = { boundary: 'legacy', created: 1, label: 'Antigo', raw: '{}' };
  await withDatabase({ 'snapshots-1': [null, { raw: 12 }, valid] }, 'ok', async () => {
    assert.deepEqual(await readSnapshots(1), [valid]);
  });
});

test('corrupt slot metadata does not crash the save selection screen', async () => {
  await withDatabase({
    'meta-1': { exists: true, slot: 1, name: 'Temporada', mode: 'driver', season: 2029, round: 2, updated: 1 },
    'meta-2': { exists: true, slot: 2, name: null, mode: 'driver', season: 2029, round: 1, updated: 1 },
    'meta-3': { exists: true, slot: 3, name: 'Com falha', mode: 'driver', season: 2029, round: 90, updated: 1 },
  }, 'ok', async () => {
    const slots = await readSlots();
    assert.equal(slots.length, 3);
    assert.equal(slots[0].name, 'Temporada');
    assert.equal(slots[1].exists, false, 'unusable metadata is hidden');
    assert.equal(slots[2].exists, true, 'an otherwise valid career remains selectable');
    assert.equal(slots[2].round, 1, 'bad card information is repaired');
  });
});

test('invalid slot numbers are rejected before touching storage', async () => {
  assert.equal(await readSlot(0), null);
  assert.deepEqual(await readSnapshots(4), []);
  await assert.rejects(writeStoredSave(createSave(), 4), /Slot de save inválido/);
});

test('failed read rejects instead of leaving the save loading forever', async () => {
  await withDatabase({}, 'get-abort', async () => {
    await assert.rejects(readSlot(1), /transaction aborted/);
  });
});

test('rejected-save backup reports a failed write instead of hanging', async () => {
  await withDatabase({}, 'put-abort', async () => {
    await assert.rejects(preserveRejectedSave('{"bad":true}'), /transaction aborted/);
  });
});
