import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { circuitGeometry, trackBounds } from '../src/presentation/circuit-geometry';
import { sceneryPlan, countByKind, themeFor, MIN_CLEARANCE, CIRCUIT_PROFILE, PILOT_CIRCUITS, footprint, groundSize, profileFor, type ScenerySceneQuality } from '../src/presentation/scenery-plan';

function plan(circuitIndex: number, quality: ScenerySceneQuality) {
  const s = createSave(), c = s.game.circuits[circuitIndex], g = circuitGeometry(c);
  const b = trackBounds(g, 30);
  const k = 0.105, to = (p: { x: number; y: number }) => ({ x: (p.x - b.cx) * k, z: (p.y - b.cy) * k });
  const track = g.points.map(to), pit = g.pitLane.map(to);
  const ground = groundSize(b, c.id);
  const half = { x: ground.width / 2 - 1, z: ground.height / 2 - 1 };
  return { items: sceneryPlan(track, { circuitId: c.id, quality, pitLane: pit, half }), track, pit, half, id: c.id };
}
test('every one of the 35 circuits gets a deterministic, bounded plan on all profiles', () => {
  for (let i = 0; i < 35; i++) for (const q of ['baixo', 'ultra'] as const) {
    const a = plan(i, q), b = plan(i, q);
    assert.deepEqual(a.items, b.items, 'deterministic ' + a.id);
    assert.ok(a.items.length > 0, 'something is built for ' + a.id);
    for (const it of a.items) assert.ok(Math.abs(it.x) <= a.half.x && Math.abs(it.z) <= a.half.z);
  }
});
test('nothing is ever placed on, or against, the racing surface or the pit lane', () => {
  for (const i of [0, 14, 28, 4, 24, 33, 21, 9, 2, 32]) {
    const { items, track, pit } = plan(i, 'ultra');
    for (const it of items) {
      const d = Math.min(...[...track, ...pit].map((p) => Math.hypot(p.x - it.x, p.z - it.z)));
      assert.ok(d >= MIN_CLEARANCE[it.kind] + footprint(it) - 1e-6 || it.kind === 'yacht', `${it.kind} ${d.toFixed(2)} too close`);
    }
  }
});
test('quality profiles scale the budget and the pilots look different', () => {
  const low = countByKind(plan(0, 'baixo').items), high = countByKind(plan(0, 'ultra').items);
  assert.ok(high.tree > low.tree);
  const park = countByKind(plan(0, 'alto').items), urban = countByKind(plan(28, 'alto').items);
  assert.deepEqual(PILOT_CIRCUITS, ['gp-1', 'gp-29']);
  assert.equal(themeFor('gp-1'), 'park');
  assert.equal(themeFor('gp-29'), 'urban');
  assert.ok(park.tree > park.building * 4, 'park is a tree-lined circuit');
  assert.ok(urban.building > urban.tree * 2, 'urban circuit is lined with buildings');
});
test('profiles cover every circuit id and nothing else, with a varied set of looks', () => {
  const ids = new Set(createSave().game.circuits.map((c) => c.id));
  assert.equal(ids.size, 35);
  for (const id of Object.keys(CIRCUIT_PROFILE)) assert.ok(ids.has(id), id);
  for (const id of ids) assert.ok(CIRCUIT_PROFILE[id], 'missing profile ' + id);
  const looks = new Set([...ids].map((id) => themeFor(id)));
  assert.ok(looks.size >= 9, 'varied looks: ' + [...looks].join(','));
  const signatures = new Set([...ids].map((id) => JSON.stringify(Object.keys(profileFor(id).mix).sort())));
  assert.ok(signatures.size >= 20, 'distinct prop mixes: ' + signatures.size);
});
test('real circuits carry recognisable landmarks and signature props', () => {
  const by = (i: number) => countByKind(plan(i, 'alto').items);
  assert.ok(by(33).peak >= 1, 'Fuji has its mountain');
  assert.ok(by(2).ferris >= 1, 'Suzuka has its wheel');
  assert.ok(by(32).ferris >= 1, 'Las Vegas has its observation wheel');
  const monaco = by(14);
  assert.ok(monaco.house > 40 && monaco.water >= 1 && monaco.yacht >= 4, 'Monaco: dense houses, harbour, yachts');
  const spa = by(21);
  assert.ok(spa.pine > spa.tree + 100, 'Spa is a dense pine forest');
  assert.ok(by(18).peak >= 1, 'Red Bull Ring has alpine peaks');
  assert.ok(by(4).dune > 20, 'Bahrain is dune country');
  assert.ok(by(23).dune > 20, 'Zandvoort has dunes');
  assert.ok(by(31).tower >= 1, 'COTA has its tower');
  assert.ok(by(24).tree > 100, 'Monza is a tree-filled park');
  assert.ok(by(18).hill >= 1 && by(9).hill >= 1);
});
test('created (wide) circuits get a larger ground and broader open land', () => {
  const wide = ['gp-4', 'gp-8', 'gp-11', 'gp-13', 'gp-28', 'gp-31'];
  for (const id of wide) assert.ok(profileFor(id).wide, id);
  assert.ok(!profileFor('gp-15').wide);
  const b = { w: 670, h: 470 };
  assert.ok(groundSize(b, 'gp-4').width > groundSize(b, 'gp-15').width * 1.5);
  const reach = (i: number) => {
    const { items, track } = plan(i, 'alto');
    return Math.max(...items.filter((it) => ['tree', 'pine', 'palm', 'hill', 'dune', 'hangar'].includes(it.kind)).map((it) => Math.min(...track.map((p) => Math.hypot(p.x - it.x, p.z - it.z)))));
  };
  assert.ok(reach(3) > 18 && reach(30) > 18, 'wide land is spread out');
});
test('counts stay inside a draw-call friendly budget on every profile', () => {
  for (let i = 0; i < 35; i++) {
    const total = plan(i, 'ultra').items.length;
    assert.ok(total <= 700, `${i}: ${total} items`);
    const kinds = Object.values(countByKind(plan(i, 'baixo').items)).filter((v) => v > 0).length;
    assert.ok(kinds <= 9, `${i}: ${kinds} kinds`);
  }
});
test('planning leaves the shared geometry untouched', () => {
  const s = createSave(), g = circuitGeometry(s.game.circuits[0]);
  const before = JSON.stringify(g.points);
  sceneryPlan(g.points.map((p) => ({ x: p.x * 0.1, z: p.y * 0.1 })), { circuitId: 'gp-1', quality: 'alto', half: { x: 60, z: 46 } });
  assert.equal(JSON.stringify(g.points), before);
});
