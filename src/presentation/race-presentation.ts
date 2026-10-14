import type { RaceState, RaceCar } from '../domain/gameplay/types';
import type { Track2DGeometry, TrackPoint } from './circuit-geometry';
import { raceIncidentPose } from './race-incident-visual';
export const raceOrder = (r: RaceState) =>
  [...r.cars].sort(
    (a, b) =>
      (a.status === 'RUNNING' ? 0 : 1) - (b.status === 'RUNNING' ? 0 : 1) ||
      b.lap - a.lap ||
      a.elapsed - b.elapsed,
  );
export const wrapProgress = (p: number) => ((p % 1) + 1) % 1;
const lanePoint = (points: TrackPoint[], t: number) => {
  const n = Math.max(0, Math.min(1, t)) * (points.length - 1),
    i = Math.floor(n),
    a = points[i],
    b = points[Math.min(i + 1, points.length - 1)];
  return { x: a.x + (b.x - a.x) * (n - i), y: a.y + (b.y - a.y) * (n - i) };
};
export type DuelState =
  | 'ATTACK'
  | 'DEFEND'
  | 'SIDE BY SIDE'
  | 'LOCKUP'
  | 'WIDE'
  | 'CONTACT'
  | 'OVERTAKE COMPLETE'
  | 'OVERTAKE FAILED';
/** How one car of a fight is drawn right now. Display only: the engine already decided the result. */
export type Duel = {
  role: 'attacker' | 'defender';
  other: string;
  state: DuelState;
  line: 'inside' | 'outside';
  /** Sideways shift in marker widths, along the track normal (positive = right of travel). */
  side: number;
};
type Outcome = 'pass' | 'attack' | 'held' | 'lockup' | 'aborted' | 'contact' | 'pressure';
type Part = { role: Duel['role']; other: string; outcome: Outcome };
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
/** 0 → 1 → 0 window over [from, to] with soft edges. */
const win = (u: number, from: number, to: number, edge = 0.16) =>
  smooth((u - from) / edge) * smooth((to - u) / edge);
/** Who is fighting whom this lap, read from engine battles and events only. */
function duelScript(r: RaceState) {
  const out = new Map<string, Part>();
  const now = r.events.filter((e) => e.lap === r.lap),
    running = new Set(r.cars.filter((c) => c.status === 'RUNNING').map((c) => c.id)),
    live = Object.values(r.battles ?? {}).filter((b) => b.lastLap >= r.lap);
  const set = (attacker: string, defender: string | undefined, outcome: Outcome) => {
    if (!defender || attacker === defender || out.has(attacker) || out.has(defender)) return;
    if (!running.has(attacker) || !running.has(defender)) return;
    out.set(attacker, { role: 'attacker', other: defender, outcome });
    out.set(defender, { role: 'defender', other: attacker, outcome });
  };
  // The most telling outcome of the lap wins when a pair has several events.
  for (const e of now) if (e.type === 'contact') set(e.driverId, e.otherId, 'contact');
  for (const e of now) if (e.type === 'overtake') set(e.driverId, e.otherId, 'pass');
  for (const e of now) if (e.type === 'braking lock-up') set(e.driverId, e.otherId, 'lockup');
  for (const e of now)
    if (e.type === 'braking aborted')
      set(e.driverId, live.find((b) => b.attacker === e.driverId)?.defender, 'aborted');
  for (const e of now)
    if (e.type === 'attack' && e.otherId)
      set(e.driverId, e.otherId, r.commands[e.otherId]?.kind === 'DEFEND' ? 'held' : 'attack');
  if (r.control === 'GREEN') for (const b of live) set(b.attacker, b.defender, 'pressure');
  return out;
}
/** The move as a short script over `u` (0 at the start of the lap, 1 two sectors later). */
function duelPose(outcome: Outcome, role: Duel['role'], u: number) {
  const me = role === 'attacker';
  let side = 0,
    close = 0,
    state: DuelState = me ? 'ATTACK' : 'DEFEND';
  if (outcome === 'pass') {
    side = me ? win(u, 0.04, 0.9) : -0.3 * win(u, 0.1, 0.7);
    state = u < 0.28 ? state : u < 0.62 ? 'SIDE BY SIDE' : 'OVERTAKE COMPLETE';
  } else if (outcome === 'attack' || outcome === 'held') {
    side = me
      ? 0.95 * win(u, 0.06, 0.78)
      : outcome === 'held'
        ? 0.6 * win(u, 0.12, 0.7)
        : -0.2 * win(u, 0.1, 0.6);
    close = win(u, 0.1, 0.72);
    state =
      u < 0.3 ? state : u < 0.6 ? (outcome === 'held' ? 'DEFEND' : 'SIDE BY SIDE') : 'OVERTAKE FAILED';
  } else if (outcome === 'lockup') {
    side = me ? 0.9 * win(u, 0.06, 0.5) + 1.7 * win(u, 0.4, 0.95) : 0;
    close = win(u, 0.08, 0.45);
    state = u < 0.28 ? state : u < 0.48 ? 'LOCKUP' : u < 0.85 ? 'WIDE' : 'OVERTAKE FAILED';
  } else if (outcome === 'aborted') {
    side = me ? 0.8 * win(u, 0.06, 0.5) : 0.55 * win(u, 0.1, 0.55);
    close = 0.7 * win(u, 0.08, 0.5);
    state = u < 0.25 ? state : u < 0.55 ? 'DEFEND' : 'OVERTAKE FAILED';
  } else if (outcome === 'contact') {
    side = me ? 0.42 * win(u, 0.06, 0.5) + 1.1 * win(u, 0.5, 0.95) : -0.5 * win(u, 0.45, 0.9);
    close = win(u, 0.08, 0.5);
    state = u < 0.3 ? state : u < 0.55 ? 'CONTACT' : me ? 'WIDE' : 'DEFEND';
  } else side = me ? 0.38 : 0;
  return { side, close, state };
}
/** Read-only presentation adapter. Never advances RNG, issues orders or scores results. */
export function presentRace(
  r: RaceState,
  geometry: Track2DGeometry,
  referenceLap: number,
  phase = 0,
  /** Optional glide from the previous lap's gaps. Display only: order and `gap` stay exact. */
  blend?: { gaps: Record<string, number>; t: number },
) {
  const order = raceOrder(r),
    lead = order[0]?.elapsed ?? 0;
  const still = r.paused || r.status === 'FINISHED' || r.control === 'RED',
    activePhase = still ? 0 : Math.max(0, Math.min(0.999, phase));
  const activeBattles = Object.values(r.battles ?? {}).filter(
    (b) => b.lastLap >= r.lap && r.control === 'GREEN',
  );
  const script = r.status === 'RUNNING' ? duelScript(r) : new Map<string, Part>(),
    // The move plays over the first two sectors after the engine resolved the lap.
    u = Math.min(1, (r.sector - 1 + activePhase) / 2),
    lapT = (r.sector - 1 + activePhase) / 3;
  const gaps = new Map<string, number>(),
    shownGap = new Map<string, number>();
  for (const car of order) {
    const gap = Math.max(0, car.elapsed - lead),
      from = blend?.gaps[car.id];
    gaps.set(car.id, gap);
    shownGap.set(
      car.id,
      from === undefined || Math.abs(gap - from) > 3
        ? gap
        : from + (gap - from) * Math.max(0, Math.min(1, blend!.t)),
    );
  }
  return order.map((car, index) => {
    const gap = gaps.get(car.id)!,
      part = script.get(car.id),
      pose = part ? duelPose(part.outcome, part.role, u) : undefined;
    let shown = shownGap.get(car.id)!;
    // A failed move still closes right up to the car ahead before dropping back.
    if (part && pose && part.role === 'attacker' && pose.close > 0) {
      const target = shownGap.get(part.other)! + 0.14;
      if (shown > target && shown - target < 1.5) shown += (target - shown) * pose.close;
    }
    let progress = r.lap + lapT - shown / Math.max(1, referenceLap);
    // Retirement location uses immutable car telemetry, never the moving leader's time.
    if (car.status !== 'RUNNING') progress = car.elapsed / Math.max(1, referenceLap);
    const tangent = geometry.at(progress + 0.0003),
      base = geometry.at(progress);
    let angle = (Math.atan2(tangent.y - base.y, tangent.x - base.x) * 180) / Math.PI,
      point = { ...base };
    const battle = activeBattles.find((b) => b.attacker === car.id || b.defender === car.id);
    let duel: Duel | undefined;
    if (part && pose && car.status === 'RUNNING' && car.pitPhase !== 'EXIT') {
      // Inside or outside of the next corner: a braking move dives inside, the rest alternate.
      const ahead = geometry.at(progress + 0.02),
        beyond = geometry.at(progress + 0.0203),
        turn =
          Math.atan2(beyond.y - ahead.y, beyond.x - ahead.x) -
          Math.atan2(tangent.y - base.y, tangent.x - base.x),
        inside = Math.sin(turn) >= 0 ? 1 : -1,
        attacker = part.role === 'attacker' ? car.id : part.other,
        line: Duel['line'] =
          r.commands[attacker]?.kind === 'BRAKING_ATTACK' ||
          (r.seed + r.lap * 7 + attacker.length + attacker.charCodeAt(0)) % 2 === 0
            ? 'inside'
            : 'outside';
      duel = {
        role: part.role,
        other: part.other,
        state: pose.state,
        line,
        side: pose.side * (line === 'inside' ? inside : -inside),
      };
    }
    let pitStage: 'TRACK' | 'ENTRY' | 'STOP' | 'EXIT' = 'TRACK';
    if (car.pitPhase === 'EXIT' && car.status === 'RUNNING') {
      const t = lapT;
      const queue = r.events.some(
        (e) => e.driverId === car.id && e.lap === r.lap && /double.stack/.test(e.type),
      );
      const stopEnd = queue ? 0.72 : 0.58;
      const laneT =
        t < 0.3
          ? (t / 0.3) * 0.48
          : t < stopEnd
            ? 0.48
            : 0.48 + ((t - stopEnd) / (1 - stopEnd)) * 0.52;
      pitStage = t < 0.3 ? 'ENTRY' : t < stopEnd ? 'STOP' : 'EXIT';
      // Cars pitting together queue nose to tail instead of sitting on one point.
      const pitting = order.filter((o) => o.pitPhase === 'EXIT' && o.status === 'RUNNING'),
        slot = laneT - pitting.indexOf(car) * Math.min(0.022, 0.46 / pitting.length),
        // A slot behind the lane entry is still on the track, on the way in.
        spot = (t: number) =>
          t >= 0
            ? lanePoint(geometry.pitLane, Math.min(1, t))
            : geometry.at(geometry.pitEntry + t * 0.19);
      point = spot(slot);
      const next = spot(slot + 0.01);
      angle = (Math.atan2(next.y - point.y, next.x - point.x) * 180) / Math.PI;
    }
    return {
      id: car.id,
      position: index + 1,
      gap,
      interval: index ? Math.max(0, car.elapsed - order[index - 1].elapsed) : 0,
      progress,
      lapProgress: wrapProgress(progress),
      point,
      angle,
      pitStage,
      battle: !!battle,
      duel,
      incident: raceIncidentPose(r.events, car.id, car.status, r.lap, lapT),
      car,
    };
  });
}
// Lane order per group size: consecutive positions land as far apart as the lanes allow.
export const LANES: Record<number, number[]> = {
  2: [0, 1],
  3: [1, 0, 2],
  4: [1, 3, 0, 2],
  5: [2, 4, 1, 3, 0],
  6: [2, 5, 0, 3, 1, 4],
  7: [0, 3, 6, 2, 5, 1, 4],
  8: [0, 3, 6, 1, 4, 7, 2, 5],
};
/**
 * Presentation-only fan-out for crowded portraits: when 3+ markers sit closer than one
 * diameter they are pushed sideways, perpendicular to the track, into lanes, and a very dense
 * group is drawn slightly smaller. Returns display offsets and scale keyed by driver;
 * RaceState, classification and the true track point are untouched.
 */
export function spreadMarkers(
  cars: Pick<
    ReturnType<typeof presentRace>[number],
    'id' | 'position' | 'point' | 'angle' | 'lapProgress' | 'pitStage' | 'car'
  >[],
  diameter: number,
  minScale = 0.75,
) {
  const out: Record<string, TrackPoint & { scale: number; lanes: number }> = {};
  const pack = cars
      .filter((c) => c.pitStage === 'TRACK' && c.car.status === 'RUNNING')
      .sort((a, b) => b.lapProgress - a.lapProgress),
    n = pack.length,
    reach = diameter * 0.9;
  if (n < 3 || !(diameter > 0)) return out;
  const gap = (i: number) => {
    const a = pack[i % n].point,
      b = pack[(i + 1) % n].point;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  // Start right after a break so a group straddling the start/finish line stays whole.
  let start = 0;
  for (let i = 0; i < n; i++)
    if (gap(i) >= reach) {
      start = i + 1;
      break;
    }
  for (let k = 0; k < n;) {
    let size = 1,
      length = 0;
    while (k + size < n && gap(start + k + size - 1) < reach) {
      length += gap(start + k + size - 1);
      size++;
    }
    const lanes =
        size < 3
          ? 1
          : Math.min(8, Math.ceil((diameter * 0.85 * (size - 1)) / Math.max(length, 0.001))),
      // Past two lanes the faces also shrink a little, never below `minScale`.
      scale = Math.max(minScale, 0.75, 1 - Math.max(0, lanes - 2) * 0.065),
      pitch = diameter * scale * (lanes > 6 ? 0.8 : lanes > 3 ? 0.92 : 0.84);
    if (lanes > 1)
      for (let j = 0; j < size; j++) {
        const c = pack[(start + k + j) % n],
          // Lane follows race position, so neighbours alternate and an overtake swaps sides.
          side = (LANES[lanes][(c.position - 1) % lanes] - (lanes - 1) / 2) * pitch,
          a = (c.angle * Math.PI) / 180;
        out[c.id] = { x: -Math.sin(a) * side, y: Math.cos(a) * side, scale, lanes };
      }
    k += size;
  }
  return out;
}
export function raceHighlights(r: Pick<RaceState, 'events' | 'laps'>) {
  return r.events.filter(
    (e) =>
      e.lap <= 1 ||
      e.lap >= r.laps - 1 ||
      /overtake|pit|collision|contact|retirement|safety|flag|SC/i.test(e.type),
  );
}
