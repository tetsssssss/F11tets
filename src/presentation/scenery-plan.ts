/**
 * Camera-first scenery kit planner (presentation only).
 * Pure and deterministic: its own PRNG is seeded from the circuit id, so it never touches the
 * race RNG, the save, or the circuit GLB. Coordinates are Babylon scene units (x/z ground plane).
 */
import { rng, seedFor } from '../domain/simulation/random';

export type SceneryTheme = 'park' | 'urban' | 'desert';
export type SceneryKind = 'tree' | 'building' | 'lamp' | 'dune';
export type SceneryItem = { kind: SceneryKind; x: number; z: number; rot: number; sx: number; sy: number; sz: number; tone: number };
export type ScenerySceneQuality = 'baixo' | 'medio' | 'alto' | 'ultra';

/** Terrain/colour language per theme. `tones` index a small palette shared by every instance of a kind. */
export const THEME_LOOK: Record<SceneryTheme, { ground: string; sky: [number, number, number]; tones: Record<SceneryKind, string[]> }> = {
  park: {
    ground: '#235338', sky: [0.45, 0.64, 0.76],
    tones: { tree: ['#2f7a45', '#3b8c4c', '#2a6b3c', '#4a9a52'], building: ['#d9d2c3', '#c9c0ae', '#b7b0a2'], lamp: ['#cfd6da'], dune: ['#6b8a4e'] },
  },
  urban: {
    ground: '#3a4249', sky: [0.36, 0.45, 0.62],
    tones: { tree: ['#2f6f45', '#3a7d4d'], building: ['#4b5a6a', '#65768a', '#3a4756', '#7d8ea3', '#2f3b49', '#8b6f5a'], lamp: ['#f1d98a'], dune: ['#4a525a'] },
  },
  desert: {
    ground: '#b59a68', sky: [0.56, 0.7, 0.82],
    tones: { tree: ['#6b8e4a', '#5f7f43'], building: ['#d8c49b', '#c9b184', '#e3d3ae'], lamp: ['#e9e1c9'], dune: ['#c9ab74', '#bd9f69', '#d4b983'] },
  },
};

/** Which look each of the 35 circuits wears. Anything unlisted keeps the park look. */
export const CIRCUIT_THEME: Record<string, SceneryTheme> = {
  'gp-1': 'park', 'gp-3': 'park', 'gp-4': 'park', 'gp-12': 'park', 'gp-13': 'park', 'gp-14': 'park', 'gp-16': 'park', 'gp-17': 'park',
  'gp-19': 'park', 'gp-20': 'park', 'gp-21': 'park', 'gp-22': 'park', 'gp-23': 'park', 'gp-24': 'park', 'gp-25': 'park', 'gp-26': 'park',
  'gp-30': 'park', 'gp-31': 'park', 'gp-32': 'park', 'gp-34': 'park', 'gp-18': 'park', 'gp-28': 'park', 'gp-11': 'park', 'gp-10': 'park',
  'gp-6': 'urban', 'gp-9': 'urban', 'gp-15': 'urban', 'gp-27': 'urban', 'gp-29': 'urban', 'gp-33': 'urban', 'gp-35': 'urban', 'gp-2': 'urban',
  'gp-5': 'desert', 'gp-7': 'desert', 'gp-8': 'desert',
};
/** The two circuits whose kit was built and measured first (see RELATORIO). */
export const PILOT_CIRCUITS = ['gp-1', 'gp-29'] as const;
export const themeFor = (circuitId: string): SceneryTheme => CIRCUIT_THEME[circuitId] ?? 'park';

const BUDGET: Record<SceneryTheme, Record<ScenerySceneQuality, Record<SceneryKind, number>>> = {
  park: {
    baixo: { tree: 70, building: 4, lamp: 0, dune: 0 }, medio: { tree: 130, building: 8, lamp: 10, dune: 0 },
    alto: { tree: 200, building: 12, lamp: 24, dune: 0 }, ultra: { tree: 280, building: 16, lamp: 36, dune: 0 },
  },
  urban: {
    baixo: { tree: 8, building: 36, lamp: 0, dune: 0 }, medio: { tree: 14, building: 60, lamp: 28, dune: 0 },
    alto: { tree: 22, building: 84, lamp: 48, dune: 0 }, ultra: { tree: 30, building: 110, lamp: 72, dune: 0 },
  },
  desert: {
    baixo: { tree: 4, building: 6, lamp: 0, dune: 26 }, medio: { tree: 8, building: 10, lamp: 8, dune: 46 },
    alto: { tree: 12, building: 16, lamp: 18, dune: 70 }, ultra: { tree: 16, building: 22, lamp: 28, dune: 96 },
  },
};
/** How close an item may sit to the racing surface; keeps lenses and barriers clear. */
export const MIN_CLEARANCE: Record<SceneryKind, number> = { tree: 9.5, building: 12, lamp: 6.2, dune: 11 };
const SPACING: Record<SceneryKind, number> = { tree: 2.6, building: 6, lamp: 5, dune: 4.5 };
const MAX_OFFSET: Record<SceneryKind, number> = { tree: 26, building: 30, lamp: 7.6, dune: 30 };

type P = { x: number; z: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);

/** Curvature-weighted pick so corners (where the TV camera lingers) get the most dressing. */
function cornerWeights(points: P[]): number[] {
  const n = points.length;
  return points.map((_, i) => {
    const a = points[(i + n - 6) % n], b = points[i], c = points[(i + 6) % n];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c.z - b.z, c.x - b.x);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    return 0.35 + Math.min(1, turn * 6);
  });
}

export function sceneryPlan(
  trackPoints: P[],
  options: { circuitId: string; quality: ScenerySceneQuality; pitLane?: P[]; half: { x: number; z: number } },
): SceneryItem[] {
  const theme = themeFor(options.circuitId);
  const budget = BUDGET[theme][options.quality];
  const random = rng(seedFor(7001, 'scenery', options.circuitId));
  const n = trackPoints.length;
  if (n < 8) return [];
  const weights = cornerWeights(trackPoints), total = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = random() * total;
    for (let i = 0; i < n; i++) { r -= weights[i]; if (r <= 0) return i; }
    return n - 1;
  };
  // Coarse grid over track + pit points: each candidate only checks nearby cells.
  const cell = 14, grid = new Map<string, P[]>();
  const key = (x: number, z: number) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  const surface = [...trackPoints, ...(options.pitLane ?? [])];
  for (const p of surface) { const k = key(p.x, p.z); (grid.get(k) ?? grid.set(k, []).get(k)!).push(p); }
  const nearestSurface = (p: P, limit: number) => {
    const span = Math.ceil(limit / cell);
    const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    let best = Infinity;
    for (let dx = -span; dx <= span; dx++) for (let dz = -span; dz <= span; dz++)
      for (const q of grid.get(cx + dx + ',' + (cz + dz)) ?? []) best = Math.min(best, dist(p, q));
    return best;
  };
  const items: SceneryItem[] = [];
  const placed = new Map<string, P[]>();
  const tooClose = (p: P, spacing: number) => {
    const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      for (const q of placed.get(cx + dx + ',' + (cz + dz)) ?? []) if (dist(p, q) < spacing) return true;
    return false;
  };
  const order: SceneryKind[] = ['building', 'lamp', 'dune', 'tree'];
  for (const kind of order) {
    let remaining = budget[kind], attempts = remaining * 40;
    while (remaining > 0 && attempts-- > 0) {
      const i = pick(), a = trackPoints[i], b = trackPoints[(i + 1) % n];
      const d = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / d, nz = (b.x - a.x) / d;
      const side = random() < 0.5 ? -1 : 1;
      const min = MIN_CLEARANCE[kind];
      const offset = kind === 'lamp' ? min + random() * 1.1 : min + random() * (MAX_OFFSET[kind] - min);
      const p = { x: a.x + nx * side * offset, z: a.z + nz * side * offset };
      if (Math.abs(p.x) > options.half.x || Math.abs(p.z) > options.half.z) continue;
      if (nearestSurface(p, min + 1) < min) continue;
      if (tooClose(p, SPACING[kind])) continue;
      const base = { kind, x: p.x, z: p.z, rot: random() * Math.PI * 2, tone: Math.floor(random() * 997) };
      let item: SceneryItem;
      if (kind === 'tree') { const s = 0.8 + random() * 0.9; item = { ...base, sx: s, sy: s * (0.9 + random() * 0.5), sz: s }; }
      else if (kind === 'building') {
        const h = theme === 'urban' ? 5 + random() * 15 : 2 + random() * 4;
        item = { ...base, rot: Math.atan2(b.z - a.z, b.x - a.x), sx: 3 + random() * 4, sy: h, sz: 3 + random() * 4 };
      } else if (kind === 'lamp') item = { ...base, sx: 1, sy: 1, sz: 1 };
      else { const s = 2 + random() * 4; item = { ...base, sx: s * 1.6, sy: 0.5 + random() * 1.1, sz: s }; }
      items.push(item);
      const k = key(p.x, p.z);
      (placed.get(k) ?? placed.set(k, []).get(k)!).push(p);
      remaining--;
    }
  }
  return items;
}

export function countByKind(items: SceneryItem[]): Record<SceneryKind, number> {
  const out: Record<SceneryKind, number> = { tree: 0, building: 0, lamp: 0, dune: 0 };
  for (const item of items) out[item.kind]++;
  return out;
}
