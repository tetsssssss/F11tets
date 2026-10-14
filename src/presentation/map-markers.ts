import type { TrackPoint } from './circuit-geometry';
import { LANES, type presentRace } from './race-presentation';
type Car = Pick<
  ReturnType<typeof presentRace>[number],
  | 'id'
  | 'position'
  | 'point'
  | 'angle'
  | 'progress'
  | 'lapProgress'
  | 'pitStage'
  | 'car'
  | 'battle'
  | 'duel'
>;
export const MARKER_MODES = ['cars', 'photos', 'hybrid', 'compact', 'auto'] as const;
export type MarkerMode = (typeof MARKER_MODES)[number];
export const MARKER_LABELS: Record<MarkerMode, string> = {
  cars: 'CARROS',
  photos: 'FOTOS',
  hybrid: 'HÍBRIDO',
  compact: 'COMPACTO',
  auto: 'AUTO',
};
/** 0 = compact tile (code, team colour, position), 1 = small portrait badge, 2 = large portrait. */
export type Tier = 0 | 1 | 2;
/** Detail level from how many screen pixels one track unit gets: far, medium or close. */
export const zoomTier = (scale: number): Tier => (scale < 2.1 ? 0 : scale < 4.2 ? 1 : 2);
const onTrack = (c: Car) => c.pitStage === 'TRACK' && c.car.status === 'RUNNING';
export type MarkerPlan = {
  tier: Tier;
  /** Other cars within one marker of this one on screen. */
  crowd: number;
  /** 3 selected, 2 the player's car, 1 in a fight, 0 the rest. */
  priority: 0 | 1 | 2 | 3;
  /** Relative size: the selected car and fights read a little larger, a dense pack smaller. */
  scale: number;
  /** Whether the code tag (and position) is worth drawing for this car. */
  label: boolean;
  showPosition: boolean;
};
/**
 * Decides how each car is drawn, from the zoom and from how crowded its stretch of track is.
 * Reads positions only; the race state is never touched.
 *
 * - `compact` always uses tiles and `photos` always portraits.
 * - `hybrid` decides car by car, so a tight pack turns compact while lone cars keep their photo.
 * - `auto` picks one level for the whole field from the zoom and the overall crowding.
 */
export function planMarkers(
  cars: Car[],
  o: {
    mode: Exclude<MarkerMode, 'cars'>;
    /** Screen pixels per track unit (fit × zoom). */
    scale: number;
    own: string[];
    selected: string | null;
    /** Radius in pixels inside which two markers count as crowding each other. */
    reach?: number;
  },
): Record<string, MarkerPlan> {
  const base = zoomTier(o.scale),
    reach = (o.reach ?? 30) / Math.max(o.scale, 0.01),
    pack = cars.filter(onTrack),
    crowd = new Map<string, number>();
  for (const a of pack) {
    let n = 0;
    for (const b of pack)
      if (a !== b && Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) < reach) n++;
    crowd.set(a.id, n);
  }
  const crowded = pack.filter((c) => crowd.get(c.id)! >= 2).length / Math.max(1, pack.length),
    field: Tier = crowded > 0.75 ? 0 : crowded > 0.4 ? (Math.max(0, base - 1) as Tier) : base,
    out: Record<string, MarkerPlan> = {};
  for (const c of cars) {
    const n = crowd.get(c.id) ?? 0,
      priority = o.selected === c.id ? 3 : o.own.includes(c.id) ? 2 : c.battle || c.duel ? 1 : 0,
      leader = c.position === 1;
    let tier: Tier =
      o.mode === 'compact'
        ? 0
        : o.mode === 'photos'
          ? (Math.max(1, base) as Tier)
          : o.mode === 'auto'
            ? field
            : n >= 5
              ? 0
              : n >= 2
                ? (Math.max(0, base - 1) as Tier)
                : base;
    if (o.mode === 'hybrid' || o.mode === 'auto') {
      // The selected and the player's cars always keep a face; a fight is never demoted.
      if (priority >= 2) tier = Math.max(tier, 1) as Tier;
      else if (priority === 1) tier = Math.max(tier, o.mode === 'hybrid' ? base : field) as Tier;
    }
    out[c.id] = {
      tier,
      crowd: n,
      priority,
      scale:
        (priority === 3 ? 1.25 : priority ? 1.12 : 1) * (!priority && n >= 5 && tier ? 0.88 : 1),
      // A tile is its own label. Portrait tags thin out in a dense group.
      label: tier === 0 || priority > 0 || leader || n < 3,
      showPosition: priority > 0 || leader || n < 2,
    };
  }
  return out;
}
export type Fan = TrackPoint & { lanes: number; stretched: boolean };
/**
 * Display-only layout for markers that would overlap: neighbours are fanned into lanes across
 * the track and, when the group is far denser than the markers (the starting grid), also spaced
 * out along the track in rows. Returns an offset from each car's true point; the true point,
 * the order and RaceState are left alone.
 */
export function fanOut(
  cars: Car[],
  /** Marker footprint on screen, in track units. */
  size: { w: number; h: number },
  o: {
    at: (progress: number) => TrackPoint;
    /** Lap length in track units. */
    length: number;
    maxLanes?: number;
    /** Furthest a marker may be moved along the track, in marker lengths. */
    maxShift?: number;
  },
): Record<string, Fan> {
  const out: Record<string, Fan> = {},
    pack = cars.filter(onTrack).sort((a, b) => b.lapProgress - a.lapProgress),
    n = pack.length,
    maxLanes = Math.min(8, o.maxLanes ?? 4);
  if (n < 2 || !(size.w > 0) || !(size.h > 0) || !(o.length > 0)) return out;
  // How much room one marker needs along and across the direction of travel.
  const along = (c: Car) => {
      const a = (c.angle * Math.PI) / 180;
      return Math.abs(Math.cos(a)) * size.w + Math.abs(Math.sin(a)) * size.h;
    },
    across = (c: Car) => {
      const a = (c.angle * Math.PI) / 180;
      return Math.abs(Math.sin(a)) * size.w + Math.abs(Math.cos(a)) * size.h;
    },
    gap = (i: number) => {
      const a = pack[i % n].point,
        b = pack[(i + 1) % n].point;
      return Math.hypot(a.x - b.x, a.y - b.y);
    },
    touching = (i: number) => gap(i) < along(pack[i % n]) * 0.95;
  // Start right after a break so a group straddling the start/finish line stays whole.
  let start = 0;
  for (let i = 0; i < n; i++)
    if (!touching(i)) {
      start = i + 1;
      break;
    }
  for (let k = 0; k < n;) {
    let count = 1,
      span = 0;
    while (k + count < n && touching(start + k + count - 1)) {
      span += gap(start + k + count - 1);
      count++;
    }
    if (count > 1) {
      const group = Array.from({ length: count }, (_, j) => pack[(start + k + j) % n]),
        middle = group[count >> 1],
        step = along(middle) * 1.04,
        pitch = across(middle) * 1.1,
        lanes = Math.min(
          maxLanes,
          count,
          Math.max(2, Math.ceil((step * (count - 1)) / Math.max(span, 0.001))),
        ),
        rows = Math.ceil(count / lanes),
        // Rows need this much track; a group shorter than that is stretched to fit them.
        need = (rows - 1) * step,
        stretched = need > span * 1.05 && rows > 1,
        limit = (o.maxShift ?? 2) * step;
      group.forEach((c, j) => {
        let shift = 0,
          lane: number;
        if (stretched) {
          // Rows from the front: race order reads front to back, left to right.
          // The front car of the group stays where it is; the rest queue up behind it.
          const row = Math.floor(j / lanes),
            real = (((group[0].lapProgress - c.lapProgress) % 1) + 1) % 1;
          lane = j % lanes;
          shift = Math.max(-limit, Math.min(limit, real * o.length - row * step));
        } else lane = (LANES[lanes] ?? LANES[8])[(c.position - 1) % lanes] % lanes;
        const p = shift ? o.at(c.progress + shift / o.length) : c.point,
          q = shift ? o.at(c.progress + shift / o.length + 0.0003) : null,
          a = q ? Math.atan2(q.y - p.y, q.x - p.x) : (c.angle * Math.PI) / 180,
          side = (lane - (lanes - 1) / 2) * pitch;
        out[c.id] = {
          x: p.x - c.point.x - Math.sin(a) * side,
          y: p.y - c.point.y + Math.cos(a) * side,
          lanes,
          stretched,
        };
      });
    }
    k += count;
  }
  return out;
}
