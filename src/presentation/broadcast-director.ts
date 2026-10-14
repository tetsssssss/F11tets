/**
 * Pure TV-broadcast camera planning for the Babylon.js renderer.
 * Reads presentation snapshots only: it never touches RaceState, RNG, timing or saves.
 * Coordinates here are the Babylon scene units (x/z ground plane, y up); angles are radians
 * measured like the 2D map (dx = cos, dz = sin).
 */
import type { Shot, ShotKind } from './race-camera';

export type BabylonShotKind = 'tv' | 'duelo' | 'seguir' | 'aerea' | 'pit' | 'onboard';
export type BabylonCameraChoice = BabylonShotKind | 'auto';
export const BABYLON_CAMERA_CHOICES: readonly BabylonCameraChoice[] = ['auto', 'tv', 'duelo', 'seguir', 'aerea', 'pit', 'onboard'];
export const BABYLON_CAMERA_LABELS: Record<BabylonCameraChoice, string> = {
  auto: 'Auto (TV)', tv: 'TV', duelo: 'Disputa', seguir: 'Seguir piloto', aerea: 'Estratégica', pit: 'Box', onboard: 'Onboard',
};
/** A battle frame never holds more than this many cars; extra cars dilute readability. */
export const MAX_GROUP = 4;

export type FocusPoint = { x: number; z: number; angle: number };
export type CameraPlan = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** Vertical field of view in radians. */
  fov: number;
  /** Time constants in seconds for position and look-at target. */
  tau: number;
  targetTau: number;
  /** Direction of travel the shot is built around; lets a blocked anchor mirror across the track. */
  heading?: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Frame-rate independent exponential smoothing factor: identical result at 30, 60 or 144 FPS. */
export function smoothingAlpha(dt: number, tau: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  if (!Number.isFinite(tau) || tau <= 0) return 1;
  return 1 - Math.exp(-dt / tau);
}

/** Shortest-arc blend between two angles. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** Maps what the AUTO director chose, or what the viewer picked, to a Babylon shot. */
export function babylonShotFor(
  choice: BabylonCameraChoice,
  input: {
    auto: Pick<Shot, 'kind' | 'ids' | 'label'>;
    follow: Pick<Shot, 'ids'>;
    battleIds: readonly string[] | null;
    cars: readonly { id: string; pitStage: string; car: { status: string } }[];
    selected: string | null;
    own: readonly string[];
  },
): { kind: BabylonShotKind; ids: string[]; label: string } {
  const { auto, follow, battleIds, cars, selected, own } = input;
  const known = new Set(cars.map((c) => c.id));
  const valid = (ids: readonly string[]) => ids.filter((id) => known.has(id));
  const subject = valid(follow.ids)[0] ?? (selected && known.has(selected) ? selected : undefined) ?? valid(own)[0] ?? cars[0]?.id;
  const inPit = cars.find((c) => c.pitStage !== 'TRACK' && c.car.status === 'RUNNING' && (c.id === subject || own.includes(c.id) || c.id === selected))
    ?? cars.find((c) => c.pitStage !== 'TRACK' && c.car.status === 'RUNNING');
  const group = (ids: readonly string[]) => valid(ids).slice(0, MAX_GROUP);
  const tv = () => ({ kind: 'tv' as const, ids: group(follow.ids.length ? follow.ids : subject ? [subject] : []).slice(0, 3), label: 'TV' });
  if (choice === 'auto') {
    const map: Record<ShotKind, BabylonShotKind> = { full: 'aerea', start: 'tv', driver: 'tv', leader: 'tv', battle: 'duelo', accident: 'duelo', overtake: 'duelo', pit: 'pit' };
    const kind = map[auto.kind];
    if (kind === 'aerea') return { kind, ids: [], label: auto.label };
    if (kind === 'pit') return inPit ? { kind, ids: [inPit.id], label: auto.label } : { ...tv(), label: auto.label };
    const ids = group(auto.ids);
    if (!ids.length) return { ...tv(), label: auto.label };
    return { kind, ids, label: auto.label };
  }
  if (choice === 'tv') return tv();
  if (choice === 'seguir') return { kind: 'seguir', ids: subject ? [subject] : [], label: 'Seguindo piloto' };
  if (choice === 'onboard') return { kind: 'onboard', ids: subject ? [subject] : [], label: 'Onboard' };
  if (choice === 'aerea') return { kind: 'aerea', ids: [], label: 'Estratégica' };
  if (choice === 'pit') return inPit ? { kind: 'pit', ids: [inPit.id], label: 'Box' } : tv();
  // duelo
  const pair = battleIds ? group(battleIds) : [];
  return pair.length >= 2 ? { kind: 'duelo', ids: pair, label: 'Disputa' } : tv();
}

type Preset = { back: number; side: number; height: number; look: number; fov: number; tau: number; targetTau: number };
const PRESETS: Record<'tv' | 'duelo' | 'seguir' | 'pit' | 'onboard', { compact: Preset; wide: Preset }> = {
  tv: {
    compact: { back: 7, side: 2.7, height: 3.5, look: 2.6, fov: rad(54), tau: 0.34, targetTau: 0.22 },
    wide: { back: 10, side: 5, height: 5.2, look: 4, fov: rad(46), tau: 0.38, targetTau: 0.24 },
  },
  duelo: {
    compact: { back: 7.6, side: 3.3, height: 4.3, look: -1.2, fov: rad(56), tau: 0.3, targetTau: 0.2 },
    wide: { back: 10.5, side: 5.6, height: 6.4, look: -0.5, fov: rad(50), tau: 0.32, targetTau: 0.22 },
  },
  seguir: {
    compact: { back: 5.2, side: 1.5, height: 2.7, look: 3.2, fov: rad(60), tau: 0.26, targetTau: 0.16 },
    wide: { back: 7.5, side: 2.4, height: 3.6, look: 4, fov: rad(52), tau: 0.28, targetTau: 0.18 },
  },
  pit: {
    compact: { back: 4.5, side: 5.5, height: 3.6, look: 0, fov: rad(56), tau: 0.55, targetTau: 0.35 },
    wide: { back: 6, side: 7, height: 4.6, look: 0, fov: rad(48), tau: 0.55, targetTau: 0.35 },
  },
  onboard: {
    compact: { back: 0.28, side: 0, height: 1.3, look: 14, fov: rad(72), tau: 0.1, targetTau: 0.06 },
    wide: { back: 0.28, side: 0, height: 1.3, look: 14, fov: rad(68), tau: 0.1, targetTau: 0.06 },
  },
};
export const AERIAL_PLAN: CameraPlan = {
  position: { x: 0, y: 78, z: -0.01 }, target: { x: 0, y: 0, z: 0 }, fov: rad(48), tau: 0.5, targetTau: 0.4,
};

/** Centre and radius of the cars the frame has to hold. */
export function groupFrame(points: readonly { x: number; z: number }[]) {
  if (!points.length) return { cx: 0, cz: 0, spread: 0 };
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;
  const spread = Math.max(...points.map((p) => Math.hypot(p.x - cx, p.z - cz)));
  return { cx, cz, spread };
}

/**
 * Where the camera sits for one shot. `ahead` is a point further along the track so that the
 * lens anticipates the corner instead of staring down the current tangent.
 */
export function planCamera(
  kind: BabylonShotKind,
  input: { points: readonly FocusPoint[]; compact: boolean; ahead?: { x: number; z: number } | null; pitAnchor?: { x: number; z: number; nx: number; nz: number } | null },
): CameraPlan {
  if (kind === 'aerea' || !input.points.length) return AERIAL_PLAN;
  const preset = PRESETS[kind][input.compact ? 'compact' : 'wide'];
  const subject = input.points[0];
  const { cx, cz, spread } = groupFrame(input.points);
  let heading = subject.angle;
  if (input.ahead && kind !== 'onboard') {
    const chord = Math.atan2(input.ahead.z - subject.z, input.ahead.x - subject.x);
    heading = lerpAngle(subject.angle, chord, 0.45);
  }
  const dx = Math.cos(heading), dz = Math.sin(heading), nx = -dz, nz = dx;
  if (kind === 'onboard') {
    return {
      position: { x: subject.x - dx * 0.28, y: preset.height, z: subject.z - dz * 0.28 },
      target: { x: subject.x + dx * preset.look, y: 0.8, z: subject.z + dz * preset.look },
      fov: preset.fov, tau: preset.tau, targetTau: preset.targetTau,
    };
  }
  if (kind === 'pit' && input.pitAnchor) {
    const a = input.pitAnchor;
    return {
      position: { x: a.x + a.nx * preset.side - dx * preset.back, y: preset.height, z: a.z + a.nz * preset.side - dz * preset.back },
      target: { x: subject.x, y: 0.6, z: subject.z },
      fov: preset.fov, tau: preset.tau, targetTau: preset.targetTau,
    };
  }
  const widen = clamp(spread, 0, 14);
  const back = preset.back + widen * 0.9;
  const height = preset.height + widen * 0.35;
  const fov = preset.fov + rad(Math.min(6, widen * 0.5));
  const look = preset.look + widen * 0.2;
  const mirror = kind === 'duelo' ? 1.2 : 1;
  return {
    position: { x: cx - dx * back + nx * preset.side * mirror, y: height * (kind === 'duelo' ? 1.1 : 1), z: cz - dz * back + nz * preset.side * mirror },
    target: { x: cx + dx * look, y: 0.65, z: cz + dz * look },
    fov, tau: preset.tau, targetTau: preset.targetTau, heading,
  };
}

/** Candidate anchors tried in order when the first one is hidden behind scenery. */
export function alternateAnchors(plan: CameraPlan): CameraPlan[] {
  const heading = plan.heading ?? 0;
  const dx = Math.cos(heading), dz = Math.sin(heading), nx = -dz, nz = dx;
  const rx = plan.position.x - plan.target.x, rz = plan.position.z - plan.target.z;
  const along = rx * dx + rz * dz, lateral = rx * nx + rz * nz;
  const mirrored: CameraPlan = {
    ...plan,
    position: { x: plan.target.x + dx * along - nx * lateral, y: plan.position.y, z: plan.target.z + dz * along - nz * lateral },
  };
  return [
    plan,
    mirrored,
    { ...plan, position: { ...plan.position, y: plan.position.y * 1.6 } },
    { ...plan, position: { x: plan.position.x * 0.6 + plan.target.x * 0.4, y: plan.position.y * 1.25, z: plan.position.z * 0.6 + plan.target.z * 0.4 } },
  ];
}

export function pickClearAnchor(plan: CameraPlan, blocked: (candidate: CameraPlan) => boolean): CameraPlan {
  for (const candidate of alternateAnchors(plan)) if (!blocked(candidate)) return candidate;
  return plan;
}

/** A jump this large reads better as a cut than as a fly-through across the circuit. */
export const CUT_DISTANCE = 24;
export function needsCut(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, kindChanged: boolean): boolean {
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  return d > CUT_DISTANCE || (kindChanged && d > CUT_DISTANCE * 0.45);
}

/** Black dip used by a cut. Reduced motion jumps instantly with no fade. */
export class CutFade {
  private phase: 'idle' | 'out' | 'in' = 'idle';
  private t = 0;
  static readonly OUT = 0.09;
  static readonly IN = 0.16;
  constructor(private readonly reduced = false) {}
  /** Returns true when the fade starts; `step` tells the caller when to teleport. */
  start(): boolean {
    if (this.reduced || this.phase !== 'idle') return false;
    this.phase = 'out'; this.t = 0;
    return true;
  }
  get active() { return this.phase !== 'idle'; }
  step(dt: number): { alpha: number; jump: boolean } {
    if (this.phase === 'idle') return { alpha: 0, jump: false };
    this.t += Math.max(0, dt);
    if (this.phase === 'out') {
      if (this.t >= CutFade.OUT) { this.phase = 'in'; this.t = 0; return { alpha: 1, jump: true }; }
      return { alpha: this.t / CutFade.OUT, jump: false };
    }
    if (this.t >= CutFade.IN) { this.phase = 'idle'; return { alpha: 0, jump: false }; }
    return { alpha: 1 - this.t / CutFade.IN, jump: false };
  }
}

/** Visual-only wheel motion derived from interpolated travel; independent of race results. */
export const WHEEL_RADIUS = 0.28;
export function wheelSpin(travel: number, radius = WHEEL_RADIUS): number {
  return Number.isFinite(travel) && radius > 0 ? travel / radius : 0;
}
/** Front wheel steer from path curvature, capped at ±18° as the visual limit. */
export const MAX_STEER = rad(18);
export function steerAngle(headingDelta: number, travel: number, wheelBase = 1.7): number {
  if (!Number.isFinite(headingDelta) || !Number.isFinite(travel) || Math.abs(travel) < 1e-4) return 0;
  const curvature = headingDelta / travel;
  return clamp(Math.atan(curvature * wheelBase), -MAX_STEER, MAX_STEER);
}
