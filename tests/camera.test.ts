import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { createRaceState } from '../src/domain/simulation/race';
import { circuitGeometry, trackBounds } from '../src/presentation/circuit-geometry';
import { presentRace } from '../src/presentation/race-presentation';
import { battles, frameShot, pickShot, SHOT_HOLD_MS } from '../src/presentation/race-camera';
function fixture() {
  const s = createSave(),
    r = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    ),
    g = circuitGeometry(s.game.circuits[0]);
  r.paused = false;
  // Spread the field so nothing is a battle unless a test makes one.
  r.cars.forEach((c, i) => (c.elapsed = 100 + i * 5));
  return { s, r, g, cars: () => presentRace(r, g, 90) };
}
const base = { own: ['lando-norris'], selected: null as string | null, now: 0 };
test('fit-to-track bounds follow each circuit instead of one fixed box', () => {
  const s = createSave(),
    sizes = new Set<string>();
  for (const c of s.game.circuits) {
    const g = circuitGeometry(c),
      b = trackBounds(g, 30);
    sizes.add(b.w.toFixed(0) + 'x' + b.h.toFixed(0));
    for (const p of g.points.concat(g.pitLane)) {
      assert.ok(p.x >= b.x + 30 - 1e-6 && p.x <= b.x + b.w - 30 + 1e-6);
      assert.ok(p.y >= b.y + 30 - 1e-6 && p.y <= b.y + b.h - 30 + 1e-6);
    }
    assert.ok(b.w < 800 && b.h < 480);
  }
  assert.ok(sizes.size > 20);
});
test('manual cameras: full track never moves, follow modes track the right car', () => {
  const { r, g, cars } = fixture();
  r.lap = 5;
  const list = cars(),
    bounds = trackBounds(g),
    view = { w: bounds.w, h: bounds.h };
  const full = pickShot('FULL TRACK', { ...base, r, cars: list });
  assert.equal(full.kind, 'full');
  assert.deepEqual(frameShot(full, { r, cars: list, geometry: g, bounds, view }), {
    x: bounds.cx,
    y: bounds.cy,
    z: 1,
  });
  assert.equal(pickShot('FOLLOW LEADER', { ...base, r, cars: list }).ids[0], list[0].id);
  assert.equal(pickShot('FOLLOW DRIVER', { ...base, r, cars: list }).ids[0], 'lando-norris');
  const chosen = list[7].id,
    follow = pickShot('FOLLOW DRIVER', { ...base, selected: chosen, r, cars: list });
  assert.equal(follow.ids[0], chosen);
  const frame = frameShot(follow, { r, cars: list, geometry: g, bounds, view });
  assert.ok(frame.z >= 1.3 && frame.z <= 2.9);
  assert.equal(pickShot('BATTLE', { ...base, r, cars: list }).kind, 'full');
});
test('battle camera needs a real fight and reports attacker and defender', () => {
  const { r, cars } = fixture();
  r.lap = 5;
  assert.equal(battles(r, cars()).length, 0);
  const order = cars(),
    defender = order[3],
    attacker = order[4];
  r.cars.find((c) => c.id === attacker.id)!.elapsed = defender.car.elapsed + 0.4;
  const fights = battles(r, cars());
  assert.equal(fights.length, 1);
  assert.equal(fights[0].attacker.id, attacker.id);
  assert.equal(fights[0].defender.id, defender.id);
  const shot = pickShot('BATTLE', { ...base, r, cars: cars() });
  assert.deepEqual(shot.ids, [attacker.id, defender.id]);
  r.control = 'SC';
  assert.equal(battles(r, cars()).length, 0);
});
test('auto camera: wide start, priorities, cooldown and final laps; never mutates the race', () => {
  const { r, cars } = fixture();
  const frozen = () => JSON.stringify(r);
  let before = frozen();
  assert.equal(pickShot('AUTO', { ...base, r, cars: cars() }).kind, 'start');
  r.lap = 1;
  assert.equal(pickShot('AUTO', { ...base, r, cars: cars() }).kind, 'start');
  r.lap = 6;
  before = frozen();
  // Nothing happening: the player's car.
  let shot = pickShot('AUTO', { ...base, r, cars: cars() });
  assert.equal(shot.label, 'Seu piloto');
  // A midfield fight starts: it is better than the player shot, but the hold applies first.
  const order = cars();
  r.cars.find((c) => c.id === order[9].id)!.elapsed = order[8].car.elapsed + 0.3;
  before = frozen();
  const held = pickShot('AUTO', { ...base, r, cars: cars(), now: 1000, previous: shot });
  assert.equal(held.key, shot.key);
  shot = pickShot('AUTO', { ...base, r, cars: cars(), now: SHOT_HOLD_MS + 1, previous: shot });
  assert.equal(shot.kind, 'battle');
  assert.equal(shot.since, SHOT_HOLD_MS + 1);
  // An accident is urgent: it cuts in before the hold ends, but not instantly.
  r.events.push({ lap: r.lap, driverId: order[20].id, type: 'collision', detail: 'test' });
  before = frozen();
  const tooSoon = pickShot('AUTO', {
    ...base,
    r,
    cars: cars(),
    now: shot.since + 500,
    previous: shot,
  });
  assert.equal(tooSoon.key, shot.key);
  const cut = pickShot('AUTO', {
    ...base,
    r,
    cars: cars(),
    now: shot.since + 2000,
    previous: shot,
  });
  assert.equal(cut.kind, 'accident');
  assert.equal(cut.ids[0], order[20].id);
  // Same shot again keeps its start time, so the cooldown is not reset every frame.
  assert.equal(
    pickShot('AUTO', { ...base, r, cars: cars(), now: cut.since + 900, previous: cut }).since,
    cut.since,
  );
  // Final laps: the fight for the lead outranks everything but an accident.
  r.events.length = 0;
  r.lap = r.laps - 2;
  r.cars.find((c) => c.id === order[1].id)!.elapsed = order[0].car.elapsed + 0.2;
  before = frozen();
  const finale = pickShot('AUTO', { ...base, r, cars: cars() });
  assert.equal(finale.label, 'Disputa pela liderança');
  assert.equal(frozen(), before);
});
