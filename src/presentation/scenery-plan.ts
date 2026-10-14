/**
 * Camera-first scenery kit planner (presentation only).
 * Pure and deterministic: its own PRNG is seeded from the circuit id, so it never touches the
 * race RNG, the save, or the circuit GLB. Coordinates are Babylon scene units (x/z ground plane).
 *
 * Every circuit has a PROFILE: a look (palette), a prop mix and, for real-world circuits, a few
 * stylised landmarks that evoke the place (original low-poly shapes, no third-party assets).
 * Fictional/"wide" circuits get broad open landscapes on a larger ground plane.
 */
import { rng, seedFor } from '../domain/simulation/random';

export type SceneryTheme =
  | 'park' | 'urban' | 'desert' | 'harbor' | 'pine' | 'tropical' | 'alpine' | 'plains' | 'neon' | 'coast' | 'dunes';
export type SceneryKind =
  | 'tree' | 'pine' | 'palm' | 'building' | 'tower' | 'house' | 'hangar' | 'lamp' | 'mast'
  | 'dune' | 'hill' | 'peak' | 'water' | 'yacht' | 'neon' | 'ferris';
export type SceneryItem = { kind: SceneryKind; x: number; z: number; rot: number; sx: number; sy: number; sz: number; tone: number };
export type ScenerySceneQuality = 'baixo' | 'medio' | 'alto' | 'ultra';
export const SCENERY_KINDS: readonly SceneryKind[] = ['tree', 'pine', 'palm', 'building', 'tower', 'house', 'hangar', 'lamp', 'mast', 'dune', 'hill', 'peak', 'water', 'yacht', 'neon', 'ferris'];

type Tones = Partial<Record<SceneryKind, string[]>>;
const BASE_TONES: Required<Tones> = {
  tree: ['#2f7a45', '#3b8c4c', '#2a6b3c', '#4a9a52'], pine: ['#1f5a38', '#25683f', '#1b4d33'], palm: ['#3c8f4a', '#4aa055'],
  building: ['#d9d2c3', '#c9c0ae', '#b7b0a2'], tower: ['#6f8fa8', '#8aa5b9', '#5d7a92'], house: ['#e8dcc6', '#d8b894', '#c9876a', '#efe7da'],
  hangar: ['#b9c0c6', '#a2aab1', '#c9ced2'], lamp: ['#cfd6da'], mast: ['#9aa4aa'],
  dune: ['#6b8a4e'], hill: ['#58774a', '#4d6c43'], peak: ['#7a6a5a'], water: ['#2f6f9a'], yacht: ['#f2f4f5', '#e8edf0'],
  neon: ['#ff3d8b', '#32d6ff', '#ffd23d', '#7d5bff'], ferris: ['#e8edf0'],
};
const mixTones = (over: Tones): Required<Tones> => ({ ...BASE_TONES, ...over }) as Required<Tones>;

/** Terrain/colour language per theme. `tones` index a small palette shared by every instance of a kind. */
export const THEME_LOOK: Record<SceneryTheme, { ground: string; sky: [number, number, number]; tones: Required<Tones> }> = {
  park: { ground: '#235338', sky: [0.45, 0.64, 0.76], tones: mixTones({}) },
  urban: { ground: '#3a4249', sky: [0.36, 0.45, 0.62], tones: mixTones({ tree: ['#2f6f45', '#3a7d4d'], building: ['#4b5a6a', '#65768a', '#3a4756', '#7d8ea3', '#2f3b49', '#8b6f5a'], lamp: ['#f1d98a'], dune: ['#4a525a'] }) },
  desert: { ground: '#b59a68', sky: [0.56, 0.7, 0.82], tones: mixTones({ tree: ['#6b8e4a', '#5f7f43'], building: ['#d8c49b', '#c9b184', '#e3d3ae'], lamp: ['#e9e1c9'], dune: ['#c9ab74', '#bd9f69', '#d4b983'], hill: ['#a98a5b', '#9a7d52'], peak: ['#a58a64'] }) },
  dunes: { ground: '#d1b787', sky: [0.62, 0.76, 0.86], tones: mixTones({ pine: ['#4f7d4a', '#5a8a52'], dune: ['#dcc491', '#d0b681', '#e4cfa0'], house: ['#f0e6d2', '#e6d6b8', '#d7c19c'], hill: ['#cdb284'] }) },
  harbor: { ground: '#6f7a72', sky: [0.5, 0.68, 0.82], tones: mixTones({ house: ['#f1d5a8', '#e6b98a', '#f4e4c6', '#d98f6e', '#efc9a0', '#cfd9dc'], building: ['#e8d2ae', '#d6b88e', '#f0e0c4'], tower: ['#e9edf0', '#c9d3d8'], water: ['#2b78a8'], hill: ['#6f8a5c', '#5f7c52'], palm: ['#4c9a57'] }) },
  pine: { ground: '#1f4d33', sky: [0.46, 0.62, 0.74], tones: mixTones({ pine: ['#1b4d33', '#1f5a38', '#256a41', '#17402b'], hill: ['#2f5f3d', '#285636'], house: ['#e6dcc8', '#c9a27a', '#b88b66'] }) },
  tropical: { ground: '#2c6a3f', sky: [0.5, 0.72, 0.84], tones: mixTones({ palm: ['#3c9a4c', '#47a957', '#2f8a43'], tree: ['#2b8a46', '#339a50'], house: ['#f4e9d0', '#e8c9a0', '#d98f6e'], building: ['#e9eef0', '#cfd8dc'], hill: ['#3f7d49'], water: ['#2a8aa8'] }) },
  alpine: { ground: '#4d7a4a', sky: [0.5, 0.68, 0.84], tones: mixTones({ pine: ['#1f5a38', '#2a6b41'], hill: ['#6c8f5a', '#5d804f', '#7a9a68'], peak: ['#8a8f94', '#7c8288'], house: ['#e8dcc6', '#b98d62'] }) },
  plains: { ground: '#5f8a45', sky: [0.52, 0.7, 0.82], tones: mixTones({ tree: ['#4f8a45', '#5a9650', '#6f9c4f'], hill: ['#7c9a58', '#6d8c4f', '#8a9c60'], house: ['#e9ded0', '#d8c5ad', '#c9876a'], hangar: ['#c4c9cc', '#aab1b5'] }) },
  neon: { ground: '#24282f', sky: [0.12, 0.14, 0.26], tones: mixTones({ building: ['#2b3140', '#3a4152', '#222836'], tower: ['#3d4a66', '#4d5d80', '#2e3a54'], neon: ['#ff3d8b', '#32d6ff', '#ffd23d', '#7d5bff', '#3dff9a'], lamp: ['#ffe29a'], mast: ['#d8e0ea'], water: ['#1d4a6e'], ferris: ['#9fe8ff'] }) },
  coast: { ground: '#8a8f86', sky: [0.5, 0.7, 0.84], tones: mixTones({ tower: ['#e9edf0', '#bfcdd6', '#9fb7c6'], building: ['#e2d7c2', '#cfc3ab'], palm: ['#4aa05a'], water: ['#2c7fae'], hangar: ['#c9ced2', '#b3b9bd'], neon: ['#32d6ff', '#ffd23d'] }) },
};

export type Landmark = { kind: SceneryKind; at: number; side: 1 | -1; extra: number; sx: number; sy: number; sz: number; tone?: number };
export type SceneryProfile = {
  theme: SceneryTheme;
  /** Props at the reference ("alto") profile; lower/higher profiles scale it. */
  mix: Partial<Record<SceneryKind, number>>;
  landmarks?: Landmark[];
  /** Fictional / created circuits: broad open land on a larger ground plane. */
  wide?: boolean;
};

const P = (theme: SceneryTheme, mix: SceneryProfile['mix'], extra: Partial<SceneryProfile> = {}): SceneryProfile => ({ theme, mix, ...extra });
/** All 35 circuits. Real-world circuits evoke their place; "wide" ones are open created landscapes. */
export const CIRCUIT_PROFILE: Record<string, SceneryProfile> = {
  'gp-1': P('park', { tree: 200, building: 12, lamp: 24 }), // Albert Park (pilot)
  'gp-29': P('urban', { building: 84, tree: 22, lamp: 48 }), // Marina Bay (pilot)
  'gp-2': P('urban', { tower: 34, building: 40, neon: 14, tree: 26, lamp: 36 }, { landmarks: [{ kind: 'tower', at: 0.55, side: 1, extra: 6, sx: 3.2, sy: 26, sz: 3.2, tone: 1 }] }),
  'gp-3': P('pine', { pine: 150, tree: 24, house: 8, lamp: 20 }, { landmarks: [{ kind: 'ferris', at: 0.3, side: 1, extra: 6, sx: 11, sy: 11, sz: 1.6 }] }),
  'gp-4': P('coast', { hangar: 10, tower: 12, water: 4, yacht: 6, lamp: 30, dune: 14 }, { wide: true }),
  'gp-5': P('desert', { dune: 70, hangar: 8, tower: 4, mast: 30, lamp: 10 }, { landmarks: [{ kind: 'tower', at: 0.05, side: 1, extra: 4, sx: 4, sy: 20, sz: 4, tone: 2 }] }),
  'gp-6': P('coast', { water: 5, yacht: 10, palm: 44, tower: 28, mast: 34, building: 14 }),
  'gp-7': P('desert', { dune: 52, tower: 10, mast: 38, hangar: 6, palm: 8 }, { landmarks: [{ kind: 'tower', at: 0.7, side: -1, extra: 8, sx: 3, sy: 24, sz: 3, tone: 0 }] }),
  'gp-8': P('plains', { tree: 60, hill: 8, hangar: 6, house: 12, lamp: 16 }, { wide: true }),
  'gp-9': P('tropical', { palm: 80, building: 22, tower: 6, water: 4, yacht: 8, lamp: 30 }),
  'gp-10': P('plains', { hill: 14, house: 44, tree: 64, hangar: 8, lamp: 20 }, { landmarks: [{ kind: 'peak', at: 0.4, side: -1, extra: 4, sx: 34, sy: 20, sz: 34 }] }),
  'gp-11': P('plains', { tree: 40, hangar: 6, house: 10, water: 2, hill: 3 }, { wide: true }),
  'gp-12': P('plains', { house: 74, tree: 90, hill: 8, tower: 4, lamp: 18 }),
  'gp-13': P('dunes', { hill: 12, house: 18, pine: 36, dune: 24 }, { wide: true }),
  'gp-14': P('plains', { pine: 54, house: 30, hangar: 8, hill: 5, lamp: 22 }),
  'gp-15': P('harbor', { house: 96, tower: 12, water: 3, yacht: 16, palm: 14, hill: 6, lamp: 40 }),
  'gp-16': P('alpine', { hill: 10, tree: 140, house: 12, lamp: 12 }),
  'gp-17': P('park', { tree: 150, water: 2, tower: 10, lamp: 24, building: 6 }),
  'gp-18': P('dunes', { hill: 6, pine: 40, house: 14, hangar: 8, dune: 20 }),
  'gp-19': P('alpine', { pine: 150, hill: 12, house: 10 }, { landmarks: [{ kind: 'peak', at: 0.6, side: 1, extra: 4, sx: 30, sy: 18, sz: 30 }] }),
  'gp-20': P('plains', { hangar: 16, tree: 44, house: 6, lamp: 24 }),
  'gp-21': P('pine', { pine: 170, hangar: 6, lamp: 18 }),
  'gp-22': P('pine', { pine: 230, hill: 10, house: 6 }),
  'gp-23': P('plains', { tree: 60, house: 22, hill: 6, hangar: 4 }),
  'gp-24': P('dunes', { dune: 60, pine: 30, water: 2, house: 12 }),
  'gp-25': P('park', { tree: 260, lamp: 20, hangar: 4 }),
  'gp-26': P('plains', { house: 44, tower: 8, hill: 7, tree: 50, lamp: 20 }),
  'gp-27': P('neon', { tower: 40, neon: 26, building: 32, water: 2, lamp: 36 }),
  'gp-28': P('plains', { tree: 60, palm: 18, house: 28, tower: 6, hangar: 6 }, { wide: true }),
  'gp-30': P('tropical', { palm: 120, tree: 56, hangar: 4, hill: 5 }),
  'gp-31': P('tropical', { palm: 64, tree: 80, building: 8, hill: 7 }, { wide: true }),
  'gp-32': P('plains', { tree: 56, hangar: 8, hill: 6, lamp: 20 }, { landmarks: [{ kind: 'tower', at: 0.35, side: 1, extra: 10, sx: 3.4, sy: 28, sz: 3.4, tone: 1 }] }),
  'gp-33': P('neon', { tower: 62, neon: 44, building: 28, lamp: 36 }, { landmarks: [{ kind: 'ferris', at: 0.5, side: 1, extra: 8, sx: 10, sy: 10, sz: 1.4 }] }),
  'gp-34': P('pine', { pine: 120, house: 8, tower: 2, lamp: 14 }, { landmarks: [{ kind: 'peak', at: 0.45, side: -1, extra: 6, sx: 44, sy: 30, sz: 44 }] }),
  'gp-35': P('coast', { tower: 16, water: 3, yacht: 10, palm: 26, mast: 40, neon: 8, building: 10 }),
};
/** The two circuits whose kit was built and measured first (see RELATORIO). */
export const PILOT_CIRCUITS = ['gp-1', 'gp-29'] as const;
const FALLBACK: SceneryProfile = P('park', { tree: 120, lamp: 12 });
export const profileFor = (circuitId: string): SceneryProfile => CIRCUIT_PROFILE[circuitId] ?? FALLBACK;
export const themeFor = (circuitId: string): SceneryTheme => profileFor(circuitId).theme;
/** Back-compat view of the theme per circuit. */
export const CIRCUIT_THEME: Record<string, SceneryTheme> = Object.fromEntries(Object.entries(CIRCUIT_PROFILE).map(([id, p]) => [id, p.theme]));

const QUALITY_SCALE: Record<ScenerySceneQuality, number> = { baixo: 0.35, medio: 0.65, alto: 1, ultra: 1.4 };
/** Wide (created) circuits spread the same props over a bigger ground. */
export const WIDE_GROUND = 2.3;
/** Every circuit gets a ground broader than the track so the lens always has somewhere to look. */
export const BASE_GROUND = 1.5;
export function groundSize(bounds: { w: number; h: number }, circuitId: string) {
  const k = profileFor(circuitId).wide ? WIDE_GROUND : BASE_GROUND;
  return { width: Math.max(120, bounds.w * 0.2) * k, height: Math.max(92, bounds.h * 0.2) * k };
}

/** How close an item may sit to the racing surface, before adding its own footprint. */
export const MIN_CLEARANCE: Record<SceneryKind, number> = {
  tree: 9.5, pine: 9.5, palm: 9.5, building: 10, tower: 11, house: 9.5, hangar: 9, lamp: 6.2, mast: 6.6,
  dune: 9, hill: 4, peak: 6, water: 6, yacht: 0, neon: 10, ferris: 8,
};
const SPACING: Record<SceneryKind, number> = {
  tree: 2.6, pine: 2.4, palm: 3.2, building: 3.5, tower: 6, house: 2.6, hangar: 6, lamp: 5, mast: 7,
  dune: 4.5, hill: 5, peak: 20, water: 6, yacht: 1.6, neon: 6, ferris: 20,
};
const MAX_OFFSET: Record<SceneryKind, number> = {
  tree: 26, pine: 26, palm: 26, building: 30, tower: 30, house: 30, hangar: 30, lamp: 7.6, mast: 8.2,
  dune: 30, hill: 36, peak: 40, water: 34, yacht: 0, neon: 30, ferris: 30,
};
/** Half the footprint of an item: the part of it that must also stay clear of the track. */
export function footprint(item: Pick<SceneryItem, 'kind' | 'sx' | 'sz'>): number {
  switch (item.kind) {
    case 'hill': case 'peak': case 'water': case 'dune': case 'building': case 'hangar': case 'house': case 'tower': case 'neon': case 'ferris':
      return Math.max(item.sx, item.sz) / 2;
    default: return 0;
  }
}

type P2 = { x: number; z: number };
const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Curvature-weighted pick so corners (where the TV camera lingers) get the most dressing. */
function cornerWeights(points: P2[]): number[] {
  const n = points.length;
  return points.map((_, i) => {
    const a = points[(i + n - 6) % n], b = points[i], c = points[(i + 6) % n];
    const h1 = Math.atan2(b.z - a.z, b.x - a.x), h2 = Math.atan2(c.z - b.z, c.x - b.x);
    const turn = Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
    return 0.35 + Math.min(1, turn * 6);
  });
}

function size(kind: SceneryKind, theme: SceneryTheme, random: () => number): { sx: number; sy: number; sz: number } {
  const r = random;
  switch (kind) {
    case 'tree': { const s = 0.8 + r() * 0.9; return { sx: s, sy: s * (0.9 + r() * 0.5), sz: s }; }
    case 'pine': { const s = 0.75 + r() * 0.8; return { sx: s, sy: s * (1.1 + r() * 0.7), sz: s }; }
    case 'palm': { const s = 0.9 + r() * 0.6; return { sx: s, sy: s * (1.1 + r() * 0.6), sz: s }; }
    case 'building': return { sx: 3 + r() * 4, sy: theme === 'urban' || theme === 'neon' ? 5 + r() * 15 : 2 + r() * 4, sz: 3 + r() * 4 };
    case 'tower': return { sx: 2.4 + r() * 2.2, sy: 14 + r() * 22, sz: 2.4 + r() * 2.2 };
    case 'house': return { sx: 2.2 + r() * 1.8, sy: 1.6 + r() * 2.2, sz: 2.2 + r() * 1.8 };
    case 'hangar': return { sx: 9 + r() * 7, sy: 3 + r() * 2, sz: 4 + r() * 3 };
    case 'lamp': return { sx: 1, sy: 1, sz: 1 };
    case 'mast': return { sx: 1, sy: 1.7 + r() * 0.5, sz: 1 };
    case 'dune': { const s = 2 + r() * 4; return { sx: s * 1.6, sy: 0.5 + r() * 1.1, sz: s }; }
    case 'hill': { const s = 12 + r() * 16; return { sx: s * (1 + r() * 0.5), sy: 3 + r() * 6, sz: s }; }
    case 'peak': { const s = 22 + r() * 12; return { sx: s, sy: 12 + r() * 8, sz: s }; }
    case 'water': { const s = 12 + r() * 12; return { sx: s * (1 + r() * 0.4), sy: 1, sz: s }; }
    case 'yacht': return { sx: 0.8 + r() * 0.5, sy: 1, sz: 2.4 + r() * 1.4 };
    case 'neon': return { sx: 1.2 + r() * 2.4, sy: 3 + r() * 5, sz: 0.5 };
    case 'ferris': return { sx: 9, sy: 9, sz: 1.4 };
  }
}

export function sceneryPlan(
  trackPoints: P2[],
  options: { circuitId: string; quality: ScenerySceneQuality; pitLane?: P2[]; half: { x: number; z: number } },
): SceneryItem[] {
  const profile = profileFor(options.circuitId), theme = profile.theme;
  const random = rng(seedFor(7001, 'scenery', options.circuitId));
  const n = trackPoints.length;
  if (n < 8) return [];
  const scale = QUALITY_SCALE[options.quality];
  const wide = !!profile.wide;
  const weights = cornerWeights(trackPoints), total = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = random() * total;
    for (let i = 0; i < n; i++) { r -= weights[i]; if (r <= 0) return i; }
    return n - 1;
  };
  // Coarse grid over track + pit points: each candidate only checks nearby cells.
  const cell = 14, grid = new Map<string, P2[]>();
  const key = (x: number, z: number) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  const surface = [...trackPoints, ...(options.pitLane ?? [])];
  for (const p of surface) { const k = key(p.x, p.z); (grid.get(k) ?? grid.set(k, []).get(k)!).push(p); }
  const nearestSurface = (p: P2, limit: number) => {
    const span = Math.ceil(limit / cell);
    const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    let best = Infinity;
    for (let dx = -span; dx <= span; dx++) for (let dz = -span; dz <= span; dz++)
      for (const q of grid.get(cx + dx + ',' + (cz + dz)) ?? []) best = Math.min(best, dist(p, q));
    return best;
  };
  const items: SceneryItem[] = [];
  const small = new Map<string, (P2 & { r: number })[]>(), large: (P2 & { r: number; kind: SceneryKind })[] = [];
  const ALIGNED = new Set<SceneryKind>(['building', 'tower', 'neon', 'hangar', 'house']);
  const BIG = new Set<SceneryKind>(['hill', 'peak', 'water', 'hangar', 'ferris']);
  const crowded = (kind: SceneryKind, p: P2, r: number) => {
    const spacing = SPACING[kind];
    for (const q of large) if (kind !== 'yacht' && dist(p, q) < spacing + r + q.r) return true;
    const reach = Math.ceil((spacing + r + 6) / cell);
    const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++)
      for (const q of small.get(cx + dx + ',' + (cz + dz)) ?? []) if (dist(p, q) < spacing + r + q.r) return true;
    return false;
  };
  const place = (item: SceneryItem) => {
    items.push(item);
    const r = footprint(item), rec = { x: item.x, z: item.z, r };
    if (BIG.has(item.kind) && item.kind !== 'yacht') large.push({ ...rec, kind: item.kind });
    else { const k = key(item.x, item.z); (small.get(k) ?? small.set(k, []).get(k)!).push(rec); }
  };
  const inGround = (p: P2, r: number) => Math.abs(p.x) + r * 0.4 <= options.half.x && Math.abs(p.z) + r * 0.4 <= options.half.z;

  // 1) Landmarks first: they claim their spot so nothing else lands on top of them.
  for (const lm of profile.landmarks ?? []) {
    const i = Math.floor(((lm.at % 1) + 1) % 1 * n) % n, a = trackPoints[i], b = trackPoints[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / d, nz = (b.x - a.x) / d;
    for (let attempt = 0; attempt < 14; attempt++) {
      const side = (attempt % 2 === 0 ? lm.side : -lm.side) as number;
      const base = { kind: lm.kind, rot: lm.kind === 'ferris' ? -Math.atan2(b.z - a.z, b.x - a.x) : random() * Math.PI * 2, sx: lm.sx, sy: lm.sy, sz: lm.sz, tone: lm.tone ?? Math.floor(random() * 997) };
      const r = footprint(base);
      const offset = MIN_CLEARANCE[lm.kind] + r + lm.extra + attempt * 3;
      const p = { x: a.x + nx * side * offset, z: a.z + nz * side * offset };
      if (!inGround(p, r) || nearestSurface(p, MIN_CLEARANCE[lm.kind] + r + 1) < MIN_CLEARANCE[lm.kind] + r || crowded(lm.kind, p, r)) continue;
      place({ ...base, x: p.x, z: p.z });
      break;
    }
  }

  // 2) The prop mix, big shapes first so small props fill what is left.
  const order: SceneryKind[] = ['peak', 'hill', 'water', 'hangar', 'ferris', 'tower', 'building', 'house', 'neon', 'mast', 'lamp', 'dune', 'palm', 'pine', 'tree'];
  for (const kind of order) {
    const wanted = profile.mix[kind];
    if (!wanted) continue;
    let remaining = Math.max(1, Math.round(wanted * scale)), attempts = remaining * 90;
    // Wide circuits keep the same count but over a broader band, so the land reads as open.
    const reachFactor = wide && !['lamp', 'mast'].includes(kind) ? 1.35 : 1;
    while (remaining > 0 && attempts-- > 0) {
      const i = pick(), a = trackPoints[i], b = trackPoints[(i + 1) % n];
      const d = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / d, nz = (b.x - a.x) / d;
      const side = random() < 0.5 ? -1 : 1;
      const shape = size(kind, theme, random);
      const base = { kind, rot: random() * Math.PI * 2, tone: Math.floor(random() * 997), ...shape };
      const r = footprint(base), min = MIN_CLEARANCE[kind] + r;
      const reach = Math.max(min + 1, MAX_OFFSET[kind] * reachFactor + r * 0.5);
      const offset = kind === 'lamp' || kind === 'mast' ? min + random() * 1.1 : min + random() * (reach - min);
      const p = { x: a.x + nx * side * offset, z: a.z + nz * side * offset };
      if (!inGround(p, r)) continue;
      if (nearestSurface(p, min + 1) < min) continue;
      if (crowded(kind, p, r)) continue;
      const item: SceneryItem = { ...base, x: p.x, z: p.z };
      // Babylon's right-handed y-rotation turns +x towards -z, hence the minus: boxes line up with the road.
      if (ALIGNED.has(kind)) item.rot = -Math.atan2(b.z - a.z, b.x - a.x) + (kind === 'neon' ? Math.PI / 2 : 0);
      place(item);
      remaining--;
      // Yachts float inside the water they belong to.
      if (kind === 'water' && profile.mix.yacht) {
        const share = Math.max(1, Math.round((profile.mix.yacht * scale) / Math.max(1, (profile.mix.water ?? 1))));
        for (let y = 0; y < share; y++) {
          for (let tries = 0; tries < 12; tries++) {
            const ang = random() * Math.PI * 2, rad = random() * 0.55;
            const yp = { x: item.x + Math.cos(ang) * rad * item.sx * 0.5, z: item.z + Math.sin(ang) * rad * item.sz * 0.5 };
            const ys = size('yacht', theme, random);
            if (crowded('yacht', yp, 0.8)) continue;
            place({ kind: 'yacht', x: yp.x, z: yp.z, rot: random() * Math.PI * 2, tone: Math.floor(random() * 997), ...ys });
            break;
          }
        }
      }
    }
  }
  return items;
}

export function countByKind(items: SceneryItem[]): Record<SceneryKind, number> {
  const out = Object.fromEntries(SCENERY_KINDS.map((k) => [k, 0])) as Record<SceneryKind, number>;
  for (const item of items) out[item.kind]++;
  return out;
}
