/**
 * Choose career records without ever treating another slot's global `active`
 * mirror as the selected career. That mirror exists solely for v1 migration.
 */
export type StartupSlot = { slot: number; raw: string | null; exists: boolean; updated: number };
export function orderedStartupSlots(activeSlot: number, records: readonly StartupSlot[]): StartupSlot[] {
  const eligible = records.filter((record) => [1, 2, 3].includes(record.slot) && (record.raw !== null || record.exists));
  return [...eligible].sort((a, b) =>
    (a.slot === activeSlot ? -1 : b.slot === activeSlot ? 1 : 0) ||
    b.updated - a.updated || a.slot - b.slot,
  );
}
/** Only an installation with no modern slot can import the old shared key. */
export function allowLegacyCareer(records: readonly StartupSlot[]): boolean {
  return records.every((record) => record.raw === null && !record.exists);
}
