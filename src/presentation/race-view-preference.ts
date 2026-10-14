/** Presentation preference only; never written into the sporting career save. */
export type RaceViewMode = '2d' | 'iso' | 'babylon';
export const RACE_VIEW_STORAGE_KEY = 'f1-universe:race-view-mode:v1';
export function normalizeRaceViewMode(value: unknown): RaceViewMode {
  return value === 'iso' || value === 'babylon' ? value : '2d';
}
export function readRaceViewMode(): RaceViewMode {
  if (typeof window === 'undefined') return '2d';
  try { return normalizeRaceViewMode(window.localStorage.getItem(RACE_VIEW_STORAGE_KEY)); }
  catch { return '2d'; }
}
export function writeRaceViewMode(value: RaceViewMode): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(RACE_VIEW_STORAGE_KEY, normalizeRaceViewMode(value)); }
  catch { /* Private browsing may disable storage. Live session still works. */ }
}
