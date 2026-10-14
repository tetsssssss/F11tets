export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export const round = (n: number) => Math.round(n * 1000) / 1000;
export function seedFor(seed: number, ...parts: (string | number)[]) {
  let h = seed >>> 0;
  for (const c of parts.join('/')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h & 0x7fffffff;
}
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);

export function snapshotRng(seed: number) {
  let state = seed | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, state: () => state };
}
