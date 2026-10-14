import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap, finishRace } from '../src/domain/simulation/race';
import { circuitGeometry } from '../src/presentation/circuit-geometry';
import { presentRace, wrapProgress, raceOrder } from '../src/presentation/race-presentation';
import { resolvePersonPhoto } from '../src/presentation/person-photo';
test('32 starters resolve to verified real photographs; fictional and missing fallbacks are distinct', () => {
  const s = createSave();
  for (const d of s.game.drivers) {
    const p = resolvePersonPhoto(d.id);
    assert.equal(p.status, 'verified');
    assert.match(p.card!, /\.webp$/);
  }
  assert.equal(resolvePersonPhoto('unknown').status, 'missing');
  assert.equal(resolvePersonPhoto('junior-2029-0', true).status, 'fictional-generated');
  assert.equal(resolvePersonPhoto('lando-norris', true).status, 'verified');
});
test('35 distinct provisional geometries wrap continuously and return fresh points', () => {
  const s = createSave(),
    paths = new Set();
  for (const c of s.game.circuits) {
    const g = circuitGeometry(c);
    paths.add(g.path);
    assert.equal(g.geometryStatus, 'provisional');
    assert.equal(g.sectors.length, 3);
    assert.ok(g.pitLane.length > 2);
    assert.deepEqual(g.at(0), g.at(1));
    const p = g.at(0.2);
    p.x = 999;
    assert.notEqual(g.at(0.2).x, 999);
    const a = g.at(0.99999),
      b = g.at(0.00001);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1);
  }
  assert.equal(paths.size, 35);
  assert.equal(wrapProgress(-0.25), 0.75);
});
test('renderer does not mutate state, RNG or geometry and leaves engine results identical', () => {
  const s = createSave(),
    other = createSave();
  const r = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    ),
    r2 = createRaceState(
      other,
      'GP',
      other.game.drivers.map((d) => d.id),
    );
  r.laps = r2.laps = 8;
  const g = circuitGeometry(s.game.circuits[0]);
  while (r.status === 'RUNNING') {
    const before = JSON.stringify(r);
    for (const phase of [0, 0.1, 0.5, 0.999]) presentRace(r, g, 90, phase);
    assert.equal(JSON.stringify(r), before);
    stepRaceLap(s, r);
    stepRaceLap(other, r2);
  }
  assert.deepEqual(finishRace(s, r).results, finishRace(other, r2).results);
});
test('retired cars stay fixed, SC preserves order, pit traverses lane with stop, offsets need engine events', () => {
  const s = createSave(),
    r = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    ),
    g = circuitGeometry(s.game.circuits[0]);
  const first = r.cars[0];
  first.status = 'DNF';
  const before = presentRace(r, g, 90, 0.2).find((c) => c.id === first.id)!.point;
  r.lap = 5;
  r.cars[1].elapsed += 200;
  assert.deepEqual(presentRace(r, g, 90, 0.9).find((c) => c.id === first.id)!.point, before);
  r.control = 'SC';
  assert.deepEqual(
    presentRace(r, g, 90).map((c) => c.id),
    raceOrder(r).map((c) => c.id),
  );
  const pit = r.cars[2];
  pit.pitPhase = 'EXIT';
  r.paused = false;
  r.sector = 1;
  assert.equal(presentRace(r, g, 90, 0.2).find((c) => c.id === pit.id)!.pitStage, 'ENTRY');
  r.sector = 2;
  assert.equal(presentRace(r, g, 90, 0.2).find((c) => c.id === pit.id)!.pitStage, 'STOP');
  r.sector = 3;
  assert.equal(presentRace(r, g, 90, 0.9).find((c) => c.id === pit.id)!.pitStage, 'EXIT');
});
test('apresentação expõe pose visual somente para incidente real da volta', () => {
  const s = createSave(), r = createRaceState(s, 'GP', s.game.drivers.map((d) => d.id));
  const g = circuitGeometry(s.game.circuits[0]), car = r.cars[0];
  assert.equal(presentRace(r, g, 90, .5).find((row) => row.id === car.id)!.incident, null);
  r.lap = 4;
  r.events.push({ lap: 4, driverId: car.id, type: 'spin', detail: 'Rodada real.', severity: 'leve' });
  assert.equal(presentRace(r, g, 90, .5).find((row) => row.id === car.id)!.incident?.kind, 'SPIN');
});
test('photo manifest frames every starter face and picks card or master by pixels needed', async () => {
  const { pickPhotoSrc, CARD_PX } = await import('../src/presentation/person-photo');
  for (const d of createSave().game.drivers) {
    const p = resolvePersonPhoto(d.id),
      f = p.face!;
    assert.ok(f.size >= 0.4 && f.size <= 0.75, d.id);
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.size <= 1 && f.y + f.size <= 1, d.id);
    assert.equal(pickPhotoSrc(p, CARD_PX), p.card);
    assert.equal(pickPhotoSrc(p, CARD_PX + 1), p.master);
    assert.equal(pickPhotoSrc(p, CARD_PX / 2 + 1, true), p.master);
    assert.equal(pickPhotoSrc(p, Infinity), p.master);
  }
  const fictional = resolvePersonPhoto('junior-2029-0', true);
  assert.equal(pickPhotoSrc(fictional, 4000), fictional.card);
});
test('32-car start fans crowded portraits sideways without touching order, state or track points', async () => {
  const { spreadMarkers } = await import('../src/presentation/race-presentation');
  const s = createSave(),
    r = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    ),
    g = circuitGeometry(s.game.circuits[0]);
  const before = JSON.stringify(r),
    cars = presentRace(r, g, 90),
    snapshot = JSON.stringify(cars),
    D = 24;
  const offsets = spreadMarkers(cars, D);
  assert.equal(JSON.stringify(r), before);
  assert.equal(JSON.stringify(cars), snapshot);
  assert.equal(cars.length, 32);
  assert.ok(Object.keys(offsets).length >= 3);
  const shown = cars.map((c) => ({
    x: c.point.x + (offsets[c.id]?.x ?? 0),
    y: c.point.y + (offsets[c.id]?.y ?? 0),
  }));
  const closest = (points: { x: number; y: number }[]) =>
    Math.min(
      ...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
    );
  // The grid is far denser than one portrait: lanes must open real space between faces.
  assert.ok(closest(shown) > closest(cars.map((c) => c.point)) * 2);
  assert.ok(closest(shown) > D * 0.5);
  for (const c of cars) {
    const o = offsets[c.id];
    if (!o) continue;
    // Sideways only: perpendicular to the direction of travel, never along it.
    const a = (c.angle * Math.PI) / 180;
    assert.ok(Math.abs(o.x * Math.cos(a) + o.y * Math.sin(a)) < 1e-6);
    assert.ok(Math.hypot(o.x, o.y) <= D * 3 + 1e-6);
    assert.ok(o.scale >= 0.75 && o.scale <= 1);
  }
  assert.deepEqual(spreadMarkers(cars, D), offsets);
  assert.deepEqual(spreadMarkers(cars.slice(0, 2), D), {});
  assert.deepEqual(spreadMarkers(cars, 0.5), {});
});
test('gap glide moves cars between ticks but never changes order, gaps or the settled position', () => {
  const s = createSave(),
    r = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    ),
    g = circuitGeometry(s.game.circuits[0]);
  r.paused = false;
  r.lap = 3;
  const exact = presentRace(r, g, 90, 0.5),
    second = exact[1],
    from = { [second.id]: second.gap + 1 };
  const start = presentRace(r, g, 90, 0.5, { gaps: from, t: 0 }),
    mid = presentRace(r, g, 90, 0.5, { gaps: from, t: 0.5 }),
    end = presentRace(r, g, 90, 0.5, { gaps: from, t: 1 });
  for (const frame of [start, mid, end]) {
    assert.deepEqual(
      frame.map((c) => [c.id, c.position, c.gap]),
      exact.map((c) => [c.id, c.position, c.gap]),
    );
    assert.deepEqual(frame[0].point, exact[0].point);
  }
  assert.ok(start[1].progress < mid[1].progress && mid[1].progress < end[1].progress);
  assert.deepEqual(end[1].point, second.point);
  // A pit-stop sized jump is not a pass: it is shown where it really is.
  const jump = presentRace(r, g, 90, 0.5, { gaps: { [second.id]: second.gap + 20 }, t: 0 });
  assert.deepEqual(jump[1].point, second.point);
});
