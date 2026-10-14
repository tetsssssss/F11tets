import type { RaceState } from '../domain/gameplay/types';
import type { Track2DGeometry, TrackPoint } from './circuit-geometry';
import type { presentRace } from './race-presentation';
export const CAMERA_MODES = [
  'FULL TRACK',
  'FOLLOW DRIVER',
  'FOLLOW LEADER',
  'BATTLE',
  'AUTO',
] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
type Car = ReturnType<typeof presentRace>[number];
export type ShotKind =
  'full' | 'start' | 'driver' | 'leader' | 'battle' | 'accident' | 'overtake' | 'pit';
export type Shot = {
  kind: ShotKind;
  /** Cars the frame must contain; the first one is the subject. */
  ids: string[];
  label: string;
  /** 1 is the most important. Only AUTO compares priorities. */
  priority: number;
  key: string;
  /** Clock time this shot went on air, for the AUTO cooldown. */
  since: number;
};
/** AUTO keeps a shot at least this long unless something far more important happens. */
export const SHOT_HOLD_MS = 6000;
const URGENT_AFTER_MS = 1500;
const ACCIDENT = /collision|contact|retirement|puncture|mechanical failure|unsafe release/;
const onTrack = (c: Car) => c.car.status === 'RUNNING' && c.pitStage === 'TRACK';
/** Closest running rivals around a car, so a follow shot shows who it is racing. */
function neighbours(cars: Car[], subject: Car, within: number) {
  const i = cars.indexOf(subject),
    ids = [subject.id];
  const ahead = cars[i - 1],
    behind = cars[i + 1];
  if (ahead && onTrack(ahead) && subject.interval < within) ids.push(ahead.id);
  if (behind && onTrack(behind) && behind.interval < within) ids.push(behind.id);
  return ids;
}
/** Real fights only: an engine battle that is still live, else two cars within a second. */
export function battles(r: RaceState, cars: Car[]) {
  const byId = new Map(cars.map((c) => [c.id, c]));
  const pairs: { attacker: Car; defender: Car; engine: boolean }[] = [];
  if (r.control === 'GREEN')
    for (const b of Object.values(r.battles ?? {})) {
      const attacker = byId.get(b.attacker),
        defender = byId.get(b.defender);
      if (b.lastLap >= r.lap && attacker && defender && onTrack(attacker) && onTrack(defender))
        pairs.push({ attacker, defender, engine: true });
    }
  if (r.control === 'GREEN' && r.lap > 0)
    for (let i = 1; i < cars.length; i++) {
      const attacker = cars[i],
        defender = cars[i - 1];
      if (
        attacker.interval < 1 &&
        attacker.car.lap === defender.car.lap &&
        onTrack(attacker) &&
        onTrack(defender) &&
        !pairs.some((p) => p.attacker.id === attacker.id || p.defender.id === attacker.id)
      )
        pairs.push({ attacker, defender, engine: false });
    }
  // The fight for the best position comes first.
  return pairs.sort(
    (a, b) =>
      Math.min(a.attacker.position, a.defender.position) -
      Math.min(b.attacker.position, b.defender.position),
  );
}
const shot = (kind: ShotKind, ids: string[], label: string, priority: number): Shot => ({
  kind,
  ids,
  label,
  priority,
  key: kind + ':' + [...ids].sort().join('+'),
  since: 0,
});
/**
 * Picks what the camera looks at. Reads RaceState and existing RaceEvents only; it never writes
 * to them, so the race is identical whatever the camera does.
 */
export function pickShot(
  mode: CameraMode,
  input: {
    r: RaceState;
    cars: Car[];
    own: string[];
    selected: string | null;
    now: number;
    previous?: Shot;
  },
): Shot {
  const { r, cars, own, selected, now, previous } = input;
  const byId = new Map(cars.map((c) => [c.id, c])),
    leader = cars[0],
    full = shot('full', [], 'Circuito completo', 9),
    fights = battles(r, cars);
  const stamp = (next: Shot): Shot => ({
    ...next,
    since: previous && previous.key === next.key ? previous.since : now,
  });
  if (mode === 'FULL TRACK' || !leader) return stamp(full);
  if (mode === 'FOLLOW DRIVER') {
    const subject = byId.get(selected ?? '') ?? byId.get(own[0]) ?? leader;
    return stamp(shot('driver', neighbours(cars, subject, 1.5), 'Seguindo piloto', 6));
  }
  if (mode === 'FOLLOW LEADER')
    return stamp(shot('leader', neighbours(cars, leader, 1.5), 'Líder', 7));
  if (mode === 'BATTLE') {
    const fight = fights[0];
    return stamp(
      fight
        ? shot('battle', [fight.attacker.id, fight.defender.id], 'Disputa de posição', 4)
        : { ...full, label: 'Sem disputa no momento' },
    );
  }
  // AUTO. The grid and the first lap get a wide view that closes in as the field spreads.
  if (r.lap === 0) return stamp({ ...full, kind: 'start', key: 'start', label: 'Largada' });
  const finale = r.lap >= r.laps - 3,
    recent = r.events.filter((e) => e.lap === r.lap),
    candidates: Shot[] = [];
  const accident = recent.findLast((e) => ACCIDENT.test(e.type) && byId.has(e.driverId));
  // A first-lap incident still beats the opening wide shot.
  // The whole field belongs in the frame, so the opening closes in on the pack, not one car.
  if (r.lap === 1 && r.control === 'GREEN' && !accident)
    return stamp(
      shot(
        'start',
        [leader.id, ...cars.filter((c) => c !== leader && onTrack(c)).map((c) => c.id)],
        'Primeira volta',
        1,
      ),
    );
  if (accident)
    candidates.push(
      shot(
        'accident',
        [accident.driverId, accident.otherId ?? ''].filter((id) => byId.has(id)),
        'Incidente',
        1,
      ),
    );
  for (const fight of fights) {
    const best = Math.min(fight.attacker.position, fight.defender.position),
      ids = [fight.attacker.id, fight.defender.id],
      mine = ids.some((id) => own.includes(id));
    if (best === 1) candidates.push(shot('battle', ids, 'Disputa pela liderança', 2));
    else if (finale && best <= 3) candidates.push(shot('battle', ids, 'Briga pelo pódio', 2));
    else if (finale && mine) candidates.push(shot('battle', ids, 'Sua disputa', 3));
    else candidates.push(shot('battle', ids, `Disputa pelo P${best}`, finale ? 5 : 4));
  }
  const pass = recent.findLast((e) => e.type === 'overtake' && byId.has(e.driverId));
  if (pass)
    candidates.push(
      shot(
        'overtake',
        [pass.driverId, pass.otherId ?? ''].filter((id) => byId.has(id)),
        'Ultrapassagem',
        3,
      ),
    );
  const stop = cars.find(
    (c) =>
      c.pitStage !== 'TRACK' &&
      c.car.status === 'RUNNING' &&
      (c.position <= 10 || own.includes(c.id)),
  );
  if (stop && !finale) candidates.push(shot('pit', [stop.id], 'Pit stop', 5));
  const player = byId.get(own[0]);
  if (player && player.car.status === 'RUNNING')
    candidates.push(shot('driver', neighbours(cars, player, 1.5), 'Seu piloto', finale ? 4 : 6));
  candidates.push(shot('leader', neighbours(cars, leader, 1.5), 'Líder', finale ? 3 : 7));
  candidates.sort((a, b) => a.priority - b.priority);
  const best = candidates[0];
  // Cooldown: keep what is on air unless it ended, its time is up, or something urgent happens.
  if (previous && previous.kind !== 'full' && previous.kind !== 'start') {
    const age = now - previous.since,
      alive = candidates.find((c) => c.key === previous.key);
    if (alive && best.key !== alive.key) {
      const urgent = best.priority <= alive.priority - 2 && age >= URGENT_AFTER_MS;
      if (age < SHOT_HOLD_MS && !urgent) return { ...alive, since: previous.since };
      // After the hold a change still needs a better shot, not an equal one.
      if (best.priority >= alive.priority) return { ...alive, since: previous.since };
    }
    if (!alive && age < URGENT_AFTER_MS && best.priority > 1)
      return { ...previous, ids: previous.ids.filter((id) => byId.has(id)) };
  }
  return stamp(best);
}
/** Where the camera should sit for a shot: centre in track units and zoom relative to fit. */
export function frameShot(
  s: Shot,
  input: {
    r: Pick<RaceState, 'sector'>;
    /** 0 to 1 through the current lap, so the opening shot closes in without steps. */
    lapT?: number;
    cars: Car[];
    geometry: Pick<Track2DGeometry, 'at'>;
    bounds: { cx: number; cy: number };
    /** Size of the fit-to-track view in track units. */
    view: { w: number; h: number };
  },
): { x: number; y: number; z: number } {
  const { cars, geometry, bounds, view } = input,
    focus = s.ids.map((id) => cars.find((c) => c.id === id)).filter((c): c is Car => !!c);
  if (!focus.length) return { x: bounds.cx, y: bounds.cy, z: 1 };
  const points: TrackPoint[] = focus.map((c) => c.point),
    subject = focus[0];
  // Look ahead: the next stretch of track belongs in the frame, not only where the car is.
  if (subject.pitStage === 'TRACK' && subject.car.status === 'RUNNING')
    points.push(geometry.at(subject.progress + 0.03));
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - Math.min(...ys),
    margin = 85;
  let z = Math.min(view.w / (w + margin * 2), view.h / (h + margin * 2));
  z = Math.max(1.3, Math.min(s.kind === 'pit' || s.kind === 'accident' ? 2.4 : 2.9, z));
  // First lap: start wide on the whole field and close in little by little.
  if (s.kind === 'start') {
    const t = input.lapT ?? (input.r.sector - 1) / 3,
      pack = Math.min(view.w / (w + margin), view.h / (h + margin));
    z = Math.max(1, Math.min(pack * (1 + 0.5 * t), 1.05 + 1.1 * t, 2.2));
  }
  return {
    x: (Math.max(...xs) + Math.min(...xs)) / 2,
    y: (Math.max(...ys) + Math.min(...ys)) / 2,
    z,
  };
}
