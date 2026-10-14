import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSave } from '../src/domain/save';
import { createRaceState } from '../src/domain/simulation/race';
import { tickLive } from '../src/domain/simulation';
import type { Save } from '../src/domain/types';
import { circuitGeometry } from '../src/presentation/circuit-geometry';
import { presentRace } from '../src/presentation/race-presentation';
import { pickShot, battles } from '../src/presentation/race-camera';
import { babylonShotFor, planCamera, BABYLON_CAMERA_CHOICES } from '../src/presentation/broadcast-director';
import { visualRacePoint, visualRaceAngle } from '../src/presentation/race-visual-focus';

const hash = (s: Save) => createHash('sha256').update(JSON.stringify({ race: s.race, results: s.weekends?.[0]?.results })).digest('hex');
function fresh(seed = 2031): Save {
  const s = createSave(seed);
  s.race = createRaceState(s, 'GP', s.game.drivers.map((d) => d.id));
  s.race.paused = false;
  return s;
}
/** Exercises every read-only presentation path: three renderers' adapter plus every Babylon camera. */
function presentEverything(s: Save, now: number) {
  const r = s.race!, geometry = circuitGeometry(s.game.circuits[0]);
  const cars = presentRace(r, geometry, 90, 0.37);
  const own: string[] = [s.game.drivers[0].id];
  const auto = pickShot('AUTO', { r, cars, own, selected: null, now });
  const follow = pickShot('FOLLOW DRIVER', { r, cars, own, selected: null, now });
  const fights = battles(r, cars);
  const battleIds = fights[0] ? [fights[0].attacker.id, fights[0].defender.id] : null;
  for (const choice of BABYLON_CAMERA_CHOICES) {
    const shot = babylonShotFor(choice, { auto, follow, battleIds, cars, selected: null, own });
    const points = shot.ids.map((id) => cars.find((c) => c.id === id)!).filter(Boolean).map((c) => {
      const p = visualRacePoint(c);
      return { x: p.x * 0.105, z: p.y * 0.105, angle: (visualRaceAngle(c) * Math.PI) / 180 };
    });
    planCamera(shot.kind, { points, compact: true });
  }
  return cars.map((c) => c.id + ':' + c.position).join(',');
}
test('presentation + every Babylon camera leave the race state byte-identical', () => {
  const s = fresh();
  for (let i = 0; i < 12; i++) {
    const before = hash(s);
    presentEverything(s, i * 1000);
    assert.equal(hash(s), before, 'presentation mutated the race at tick ' + i);
    Object.assign(s, tickLive(s, true));
  }
});
test('switching view/camera between ticks never changes laps, order or results versus a run that never renders', () => {
  const quiet = fresh(), watched = fresh();
  let q: Save = quiet, w: Save = watched;
  const orders: string[] = [];
  for (let i = 0; i < 24 && w.race?.status === 'RUNNING'; i++) {
    orders.push(presentEverything(w, i * 750));
    q = tickLive(q, true);
    w = tickLive(w, true);
    assert.equal(hash(w), hash(q), 'diverged after tick ' + i);
  }
  assert.ok(orders.length >= 12);
  assert.equal(new Set(orders[0].split(',')).size, 32, 'all 32 cars are represented');
});
test('pausing for a view change does not advance time; +SECTOR is the only way forward', () => {
  const s = fresh();
  s.race!.paused = true;
  const before = hash(s);
  const same = tickLive(s, false);
  assert.equal(hash(same), before, 'paused ticks are inert');
  presentEverything(s, 0);
  assert.equal(hash(s), before);
  const forced = tickLive(s, true);
  assert.notEqual(hash(forced), before);
});
