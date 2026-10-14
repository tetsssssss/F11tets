import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { circuitGeometry, trackBounds } from '../src/presentation/circuit-geometry';
import { sceneryPlan, countByKind, themeFor, MIN_CLEARANCE, CIRCUIT_THEME, PILOT_CIRCUITS, type ScenerySceneQuality } from '../src/presentation/scenery-plan';

function plan(circuitIndex: number, quality: ScenerySceneQuality) {
  const s = createSave(), c = s.game.circuits[circuitIndex], g = circuitGeometry(c);
  const b = trackBounds(g, 30);
  const k = 0.105, to = (p: { x: number; y: number }) => ({ x: (p.x - b.cx) * k, z: (p.y - b.cy) * k });
  const track = g.points.map(to), pit = g.pitLane.map(to);
  const half = { x: Math.max(120, b.w * 0.2) / 2 - 1, z: Math.max(92, b.h * 0.2) / 2 - 1 };
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
  for (const i of [0, 14, 28, 4, 24]) {
    const { items, track, pit } = plan(i, 'ultra');
    for (const it of items) {
      const d = Math.min(...[...track, ...pit].map((p) => Math.hypot(p.x - it.x, p.z - it.z)));
      assert.ok(d >= MIN_CLEARANCE[it.kind] - 1e-6, `${it.kind} ${d.toFixed(2)} too close`);
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
test('theme map covers every circuit id and nothing else', () => {
  const ids = new Set(createSave().game.circuits.map((c) => c.id));
  for (const id of Object.keys(CIRCUIT_THEME)) assert.ok(ids.has(id), id);
  for (const id of ids) assert.ok(['park', 'urban', 'desert'].includes(themeFor(id)));
});
test('planning leaves the shared geometry untouched', () => {
  const s = createSave(), g = circuitGeometry(s.game.circuits[0]);
  const before = JSON.stringify(g.points);
  sceneryPlan(g.points.map((p) => ({ x: p.x * 0.1, z: p.y * 0.1 })), { circuitId: 'gp-1', quality: 'alto', half: { x: 60, z: 46 } });
  assert.equal(JSON.stringify(g.points), before);
});
