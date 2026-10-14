import type { Circuit } from '../domain/types';
import { rng, seedFor } from '../domain/simulation/random';
export type TrackPoint = { x: number; y: number };
export type Track2DGeometry = {
  circuitId: string;
  geometryStatus: 'provisional' | 'verified';
  centerline: TrackPoint[];
  startFinish: number;
  sectors: number[];
  pitEntry: number;
  pitExit: number;
  pitLane: TrackPoint[];
  brakingZones: number[];
  overtakingZones: number[];
  drsZones?: never;
  path: string;
  points: TrackPoint[];
  nodes: TrackPoint[];
  at: (progress: number) => TrackPoint;
};
// Renderer contract: replace this geometry with surveyed SVG paths without changing RaceState.
export function circuitGeometry(c: Circuit): Track2DGeometry {
  const random = rng(seedFor(2029, c.id)),
    count = 10 + (c.corners % 5);
  const nodes = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const radial = 0.68 + random() * 0.32;
    return { x: 400 + Math.cos(a) * 305 * radial, y: 235 + Math.sin(a) * 172 * radial };
  });
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const p0 = nodes[(i + count - 1) % count],
      p1 = nodes[i],
      p2 = nodes[(i + 1) % count],
      p3 = nodes[(i + 2) % count];
    for (let j = 0; j < 60; j++) {
      const t = j / 60,
        t2 = t * t,
        t3 = t2 * t;
      const at = (key: 'x' | 'y') =>
        0.5 *
        (2 * p1[key] +
          (-p0[key] + p2[key]) * t +
          (2 * p0[key] - 5 * p1[key] + 4 * p2[key] - p3[key]) * t2 +
          (-p0[key] + 3 * p1[key] - 3 * p2[key] + p3[key]) * t3);
      points.push({ x: at('x'), y: at('y') });
    }
  }
  const path = 'M ' + points.map((p) => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' L ') + ' Z';
  const cumulative = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    cumulative.push(cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const at = (progress: number) => {
    const distance = (((progress % 1) + 1) % 1) * cumulative.at(-1)!;
    let lo = 0,
      hi = points.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= distance) lo = mid;
      else hi = mid;
    }
    const a = points[lo],
      b = points[(lo + 1) % points.length],
      t = (distance - cumulative[lo]) / (cumulative[lo + 1] - cumulative[lo] || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  const mark = at(0),
    start = at(0.89),
    end = at(0.08),
    control = { x: mark.x + 95, y: mark.y - 48 };
  const pitLane = Array.from({ length: 61 }, (_, i) => {
    const t = i / 60;
    return {
      x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
    };
  });
  return {
    circuitId: c.id,
    geometryStatus: 'provisional',
    centerline: points,
    startFinish: 0,
    sectors: [0, 1 / 3, 2 / 3],
    pitEntry: 0.89,
    pitExit: 0.08,
    pitLane,
    brakingZones: [0.28, 0.62, 0.88],
    overtakingZones: [0.25, 0.59, 0.85],
    path,
    points,
    at,
    nodes,
  };
}
/** Box around everything drawn for a circuit (track and pit lane), padded for kerbs and markers. */
export function trackBounds(g: Pick<Track2DGeometry, 'points' | 'pitLane'>, pad = 30) {
  const all = g.points.concat(g.pitLane),
    xs = all.map((p) => p.x),
    ys = all.map((p) => p.y),
    x = Math.min(...xs) - pad,
    y = Math.min(...ys) - pad,
    w = Math.max(...xs) + pad - x,
    h = Math.max(...ys) + pad - y;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}
/** Length of one lap in track units, for turning a distance on screen into lap progress. */
export function trackLength(g: Pick<Track2DGeometry, 'points'>) {
  let total = 0;
  for (let i = 0; i < g.points.length; i++) {
    const a = g.points[i],
      b = g.points[(i + 1) % g.points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}
/**
 * The same circuit turned a quarter clockwise, for tall screens where a wide track would be
 * drawn small. Only where things are drawn changes: lap progress, sectors and pit lane keep
 * their meaning, so RaceState and the race itself never notice.
 */
export function quarterTurn(g: Track2DGeometry): Track2DGeometry {
  const b = trackBounds(g, 0),
    turn = (p: TrackPoint): TrackPoint => ({ x: b.cx - (p.y - b.cy), y: b.cy + (p.x - b.cx) }),
    points = g.points.map(turn);
  return {
    ...g,
    points,
    centerline: points,
    nodes: g.nodes.map(turn),
    pitLane: g.pitLane.map(turn),
    path: 'M ' + points.map((p) => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' L ') + ' Z',
    at: (progress) => turn(g.at(progress)),
  };
}
