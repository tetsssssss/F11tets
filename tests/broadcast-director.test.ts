import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  smoothingAlpha, planCamera, babylonShotFor, groupFrame, needsCut, CutFade, pickClearAnchor, alternateAnchors,
  wheelSpin, steerAngle, MAX_STEER, CUT_DISTANCE, lerpAngle, MAX_GROUP, type CameraPlan,
} from '../src/presentation/broadcast-director';

/** Runs the same exponential smoothing at a given frame rate for `seconds` and returns the value. */
function follow(fps: number, tau: number, seconds: number) {
  let v = 0;
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(fps * seconds); i++) v += (1 - v) * smoothingAlpha(dt, tau);
  return v;
}
test('camera smoothing is frame-rate independent (30 vs 60 vs 144 FPS)', () => {
  const a = follow(30, 0.3, 0.5), b = follow(60, 0.3, 0.5), c = follow(144, 0.3, 0.5);
  assert.ok(Math.abs(a - b) < 1e-6 && Math.abs(b - c) < 1e-3, `${a} ${b} ${c}`);
  assert.ok(Math.abs(a - (1 - Math.exp(-0.5 / 0.3))) < 1e-6);
});
test('smoothingAlpha is safe for degenerate input', () => {
  assert.equal(smoothingAlpha(0, 0.3), 0);
  assert.equal(smoothingAlpha(-1, 0.3), 0);
  assert.equal(smoothingAlpha(0.016, 0), 1);
  assert.equal(smoothingAlpha(NaN, 0.3), 0);
  assert.ok(smoothingAlpha(10, 0.3) <= 1);
});
test('lerpAngle takes the short arc across ±π', () => {
  const v = lerpAngle(3.0, -3.0, 0.5);
  assert.ok(Math.abs(Math.abs(v) - Math.PI) < 0.2);
});
const cars = (n: number, pit = -1) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, pitStage: i === pit ? 'BOX' : 'TRACK', car: { status: 'RUNNING' } }));
const base = (over = {}) => ({ auto: { kind: 'leader' as const, ids: ['c0', 'c1'], label: 'Líder' }, follow: { ids: ['c0', 'c1'] }, battleIds: ['c3', 'c4'], cars: cars(8), selected: null, own: ['c2'], ...over });
test('AUTO maps director shots to Babylon shots and caps groups at four cars', () => {
  assert.equal(babylonShotFor('auto', base({ auto: { kind: 'full', ids: [], label: 'x' } })).kind, 'aerea');
  assert.equal(babylonShotFor('auto', base({ auto: { kind: 'battle', ids: ['c3', 'c4'], label: 'x' } })).kind, 'duelo');
  assert.equal(babylonShotFor('auto', base({ auto: { kind: 'accident', ids: ['c3'], label: 'x' } })).kind, 'duelo');
  const start = babylonShotFor('auto', base({ auto: { kind: 'start', ids: cars(8).map((c) => c.id), label: 'x' } }));
  assert.equal(start.kind, 'tv');
  assert.equal(start.ids.length, MAX_GROUP);
});
test('manual camera ignores the AUTO shot entirely', () => {
  const battle = { auto: { kind: 'battle' as const, ids: ['c3', 'c4'], label: 'x' } };
  assert.equal(babylonShotFor('tv', base(battle)).kind, 'tv');
  assert.equal(babylonShotFor('seguir', base(battle)).ids.length, 1);
  assert.equal(babylonShotFor('aerea', base(battle)).kind, 'aerea');
  assert.deepEqual(babylonShotFor('duelo', base(battle)).ids, ['c3', 'c4']);
});
test('duel without a live battle falls back to TV; pit without a stop falls back to TV', () => {
  assert.equal(babylonShotFor('duelo', base({ battleIds: null })).kind, 'tv');
  assert.equal(babylonShotFor('pit', base()).kind, 'tv');
  const withStop = babylonShotFor('pit', base({ cars: cars(8, 5) }));
  assert.deepEqual([withStop.kind, withStop.ids], ['pit', ['c5']]);
  assert.equal(babylonShotFor('auto', base({ cars: cars(8, 5), auto: { kind: 'pit', ids: ['c5'], label: 'Pit' } })).kind, 'pit');
});
test('shots never include unknown or retired cars', () => {
  const s = babylonShotFor('auto', base({ auto: { kind: 'battle', ids: ['ghost', 'c1', 'c2'], label: 'x' } }));
  assert.deepEqual(s.ids, ['c1', 'c2']);
});
const pt = (x: number, z: number, angle = 0) => ({ x, z, angle });
test('TV frame sits behind the car looking ahead and widens for a group', () => {
  const solo = planCamera('tv', { points: [pt(0, 0)], compact: true });
  assert.ok(solo.position.x < 0, 'behind a car heading +x');
  assert.ok(solo.target.x > 0);
  assert.ok(solo.position.y >= 3 && solo.position.y <= 7);
  const group = planCamera('tv', { points: [pt(0, 0), pt(-6, 3), pt(-9, -3)], compact: true });
  assert.ok(group.position.y > solo.position.y);
  assert.ok(group.fov >= solo.fov);
  assert.ok(groupFrame([pt(0, 0), pt(10, 0)]).spread === 5);
});
test('presets stay within the documented experimental ranges', () => {
  for (const compact of [true, false]) {
    const tv = planCamera('tv', { points: [pt(0, 0)], compact });
    const deg = (tv.fov * 180) / Math.PI;
    assert.ok(deg >= 42 && deg <= 58, String(deg));
    const follow = planCamera('seguir', { points: [pt(0, 0)], compact });
    assert.ok((follow.fov * 180) / Math.PI >= 50 && (follow.fov * 180) / Math.PI <= 62);
    assert.ok(follow.position.y >= 2.5 && follow.position.y <= 5.5);
  }
});
test('corner anticipation turns the heading toward the track ahead', () => {
  const straight = planCamera('tv', { points: [pt(0, 0, 0)], compact: true });
  const corner = planCamera('tv', { points: [pt(0, 0, 0)], compact: true, ahead: { x: 3, z: 6 } });
  assert.ok(corner.target.z > straight.target.z);
});
test('aerial plan is fixed overhead; pit plan uses the pit anchor', () => {
  assert.equal(planCamera('aerea', { points: [pt(1, 1)], compact: true }).position.y, 78);
  const plan = planCamera('pit', { points: [pt(0, 0)], compact: true, pitAnchor: { x: 20, z: 5, nx: 0, nz: 1 } });
  assert.ok(Math.abs(plan.position.x - 20) < 6 && plan.position.z > 5);
  assert.deepEqual([plan.target.x, plan.target.z], [0, 0]);
});
test('cuts are used only for big jumps; reduced motion skips the fade', () => {
  assert.equal(needsCut({ x: 0, y: 4, z: 0 }, { x: 5, y: 4, z: 0 }, false), false);
  assert.equal(needsCut({ x: 0, y: 4, z: 0 }, { x: CUT_DISTANCE + 1, y: 4, z: 0 }, false), true);
  assert.equal(needsCut({ x: 0, y: 4, z: 0 }, { x: CUT_DISTANCE * 0.6, y: 4, z: 0 }, true), true);
  const reduced = new CutFade(true);
  assert.equal(reduced.start(), false);
  const fade = new CutFade();
  assert.equal(fade.start(), true);
  assert.equal(fade.start(), false, 'cannot restart mid-cut');
  let jumped = 0, peak = 0, steps = 0;
  while (fade.active && steps++ < 200) { const s = fade.step(1 / 60); if (s.jump) jumped++; peak = Math.max(peak, s.alpha); }
  assert.equal(jumped, 1);
  assert.equal(peak, 1);
  assert.equal(fade.active, false);
});
test('blocked anchors are replaced by the first clear alternative', () => {
  const plan: CameraPlan = { position: { x: -8, y: 4, z: 3 }, target: { x: 0, y: 0.6, z: 0 }, fov: 1, tau: 0.3, targetTau: 0.2, heading: 0 };
  assert.equal(pickClearAnchor(plan, () => false), plan);
  const alt = alternateAnchors(plan);
  let calls = 0;
  const picked = pickClearAnchor(plan, () => ++calls <= 2);
  assert.deepEqual(picked, alt[2]);
  assert.equal(pickClearAnchor(plan, () => true), plan);
  assert.ok(alt[1].position.z < 0, 'mirror lands on the other side of the track');
});
test('wheel spin follows travel and steering is capped at 18 degrees', () => {
  assert.ok(Math.abs(wheelSpin(0.56) - 2) < 1e-9);
  assert.equal(wheelSpin(NaN), 0);
  assert.equal(steerAngle(0, 1), 0);
  assert.equal(steerAngle(0.3, 0), 0);
  assert.ok(Math.abs(steerAngle(2, 0.5)) <= MAX_STEER + 1e-12);
  assert.ok(steerAngle(0.05, 1) > 0 && steerAngle(-0.05, 1) < 0);
});
