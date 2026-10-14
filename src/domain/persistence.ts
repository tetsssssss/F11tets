import type { Save } from './types';
export const DATABASE = 'f1-universe-career';
type PackedSave = { encoding: 'gzip-json-v1'; data: Blob };
async function pack(raw: string): Promise<string | PackedSave> {
  if (raw.length < 1_000_000 || typeof CompressionStream === 'undefined') return raw;
  const data = await new Response(
    new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')),
  ).blob();
  return { encoding: 'gzip-json-v1', data };
}
async function unpack(value: unknown): Promise<unknown> {
  if (
    value &&
    typeof value === 'object' &&
    'encoding' in value &&
    value.encoding === 'gzip-json-v1' &&
    'data' in value &&
    value.data instanceof Blob
  )
    return new Response(value.data.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return value;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readStoredSave(): Promise<string | null> {
  return ((await readKey('active')) as string | null) ?? null;
}
export async function writeStoredSave(save: Save, slot = 1): Promise<void> {
  if (![1, 2, 3].includes(slot)) throw new RangeError('Slot de save inválido');
  const raw = JSON.stringify(save),
    payload = await pack(raw);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    const store = tx.objectStore('saves');
    const boundary = [
      save.seed,
      save.career.name,
      save.season,
      save.round,
      save.weekends.at(-1) ? Object.keys(save.weekends.at(-1)!.results).length : 0,
      save.world.offseason?.step ?? -1,
      Math.floor((save.race?.lap ?? 0) / 5),
    ].join(':');
    const previous = store.get('snapshot-index-' + slot);
    previous.onsuccess = () => {
      // Invalid metadata must never abort an otherwise valid career save.
      const copies: SnapshotIndexEntry[] = Array.isArray(previous.result)
        ? previous.result.filter((item: unknown) => isSnapshotEntry(item, slot)).slice(0, 3)
        : [];
      if (copies[0]?.boundary !== boundary) {
        const key = `checkpoint-${slot}-${boundary}`;
        // Separate records avoid the IndexedDB per-value limit for three full seasons.
        store.put(payload, key);
        const latest = {
          key,
          boundary,
          created: Date.now(),
          label: `${save.career.name} · ${save.season} / GP${save.round} · ${save.race ? save.race.session + ' volta ' + save.race.lap : 'sessões ' + (save.weekends.at(-1) ? Object.keys(save.weekends.at(-1)!.results).length : 0)}`,
        };
        store.put([latest, ...copies].slice(0, 3), 'snapshot-index-' + slot);
        for (const old of copies.slice(2))
          if (old.key.startsWith(`checkpoint-${slot}-`)) store.delete(old.key);
      }
    };
    store.put(payload, 'active');
    store.put(payload, 'slot-' + slot);
    store.put(slot, 'activeSlot');
    store.put(
      {
        slot,
        exists: true,
        name: save.career.name,
        mode: save.career.mode,
        season: save.season,
        round: save.round,
        updated: Date.now(),
        ...slotCard(save),
      },
      'meta-' + slot,
    );
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function preserveRejectedSave(raw: string): Promise<void> {
  const payload = await pack(raw);
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(payload, 'recovery-' + Date.now());
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error('Falha ao preservar save rejeitado'));
    };
  });
}

export type SlotSummary = {
  slot: number;
  exists: boolean;
  name: string;
  mode: string;
  season: number;
  round: number;
  updated: number;
  /** Card details; absent on slots written before they existed. */
  personId?: string | null;
  team?: string;
  teamColor?: string;
  position?: number;
  points?: number;
  lastGp?: string;
  nextGp?: string;
  preset?: string;
};
/** What a save card shows, read from the save at the moment it is written. */
export function slotCard(save: Save) {
  const g = save.game,
    team = g.teams.find((t) => t.id === save.managedTeam),
    driver = save.career.mode === 'driver',
    table = driver
      ? [...g.drivers].sort((a, b) => save.driverPoints[b.id] - save.driverPoints[a.id])
      : [...g.teams].sort((a, b) => g.teamPoints[b.id] - g.teamPoints[a.id]),
    id = driver ? save.career.driverId : save.managedTeam,
    last = [...save.weekends].reverse().find((w) => w.results.GP);
  return {
    personId: driver ? save.career.driverId : null,
    team: team?.name ?? '',
    teamColor: team?.color ?? '',
    position: table.findIndex((x) => x.id === id) + 1,
    points: driver ? (save.driverPoints[id ?? ''] ?? 0) : (g.teamPoints[save.managedTeam] ?? 0),
    lastGp: last ? g.circuits[last.round - 1]?.country : '',
    nextGp: save.round <= g.circuits.length ? g.circuits[save.round - 1]?.country : '',
    preset:
      (save.career.settings?.preset ?? 'NORMAL') +
      (save.career.settings?.custom ? ' · CUSTOM' : ''),
  };
}
async function readKey(key: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, value?: unknown) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };
    let tx: IDBTransaction;
    let r: IDBRequest;
    try {
      tx = db.transaction('saves');
      r = tx.objectStore('saves').get(key);
    } catch (error) {
      db.close();
      finish(error);
      return;
    }
    r.onsuccess = () => {
      unpack(r.result).then((value) => finish(undefined, value), finish);
    };
    r.onerror = () => finish(r.error ?? new Error(`Falha ao ler ${key}`));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      finish(tx.error ?? new Error(`Falha na transação de leitura: ${key}`));
    };
    tx.onabort = () => {
      db.close();
      finish(tx.error ?? new Error(`Leitura cancelada: ${key}`));
    };
  });
}
export async function readActiveSlot(): Promise<number> {
  const id = await readKey('activeSlot');
  return typeof id === 'number' && [1, 2, 3].includes(id) ? id : 1;
}
export async function readSlot(slot: number): Promise<string | null> {
  if (![1, 2, 3].includes(slot)) return null;
  const raw = await readKey('slot-' + slot);
  return typeof raw === 'string' ? raw : null;
}
export async function readSlots(): Promise<SlotSummary[]> {
  return Promise.all(
    [1, 2, 3].map(async (slot) => {
      const fallback: SlotSummary = {
        slot,
        exists: false,
        name: 'Slot vazio',
        mode: '',
        season: 2029,
        round: 1,
        updated: 0,
      };
      const value = await readKey('meta-' + slot);
      if (!value || typeof value !== 'object') return fallback;
      const meta = value as Partial<SlotSummary>;
      if (
        meta.slot !== slot ||
        meta.exists !== true ||
        typeof meta.name !== 'string' ||
        !meta.name.trim() ||
        typeof meta.mode !== 'string'
      ) return fallback;
      // Metadata is a display cache. Repair individual fields rather than
      // hiding a potentially valid career slot because the card is outdated.
      return {
        ...meta,
        slot,
        exists: true,
        name: meta.name,
        mode: meta.mode,
        season: Number.isInteger(meta.season) && (meta.season ?? 0) >= 2029
          ? meta.season! : 2029,
        round: Number.isInteger(meta.round) && (meta.round ?? 0) >= 1 && (meta.round ?? 0) <= 36
          ? meta.round! : 1,
        updated: typeof meta.updated === 'number' && Number.isFinite(meta.updated) && meta.updated >= 0
          ? meta.updated : 0,
      };
    }),
  );
}
export type SaveSnapshot = { boundary: string; raw: string; created: number; label: string };
type SnapshotIndexEntry = Omit<SaveSnapshot, 'raw'> & { key: string };
function isSnapshotEntry(value: unknown, slot: number): value is SnapshotIndexEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SnapshotIndexEntry>;
  return (
    typeof entry.key === 'string' &&
    entry.key.startsWith(`checkpoint-${slot}-`) &&
    typeof entry.boundary === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.created === 'number' &&
    Number.isFinite(entry.created)
  );
}
export async function readSnapshots(slot: number): Promise<SaveSnapshot[]> {
  if (![1, 2, 3].includes(slot)) return [];
  const index = await readKey('snapshot-index-' + slot);
  if (Array.isArray(index)) {
    const seen = new Set<string>();
    const entries = index
      .filter((item): item is SnapshotIndexEntry => {
        if (!isSnapshotEntry(item, slot) || seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      })
      .slice(0, 3);
    const loaded = await Promise.all(
      entries.map(async ({ key, boundary, label, created }) => {
        try {
          const raw = await readKey(key);
          return typeof raw === 'string' ? { boundary, label, created, raw } : null;
        } catch {
          // Keep other checkpoints usable if this particular blob is unreadable.
          return null;
        }
      }),
    );
    return loaded.filter((entry): entry is SaveSnapshot => entry !== null);
  }
  const legacy = await readKey('snapshots-' + slot);
  return Array.isArray(legacy)
    ? legacy.filter(
        (entry): entry is SaveSnapshot =>
          !!entry &&
          typeof entry.raw === 'string' &&
          typeof entry.boundary === 'string' &&
          typeof entry.label === 'string' &&
          typeof entry.created === 'number' &&
          Number.isFinite(entry.created),
      )
    : [];
}
