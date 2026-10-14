import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hardwareScaling, lowerQuality, FpsGovernor } from '../src/presentation/babylon-quality';

test('hardware scaling is monotonic by profile and never below native', () => {
  for (const dpr of [1, 1.5, 2.75, 3]) {
    const s = (['baixo', 'medio', 'alto', 'ultra'] as const).map((q) => hardwareScaling(q, dpr));
    assert.ok(s.every((v) => v >= 1));
    for (let i = 1; i < s.length; i++) assert.ok(s[i] <= s[i - 1]);
  }
  assert.equal(hardwareScaling('baixo', 2.75), 2.75);
  assert.equal(hardwareScaling('ultra', 1), 1);
  assert.equal(hardwareScaling('medio', NaN), 1);
});
test('quality steps down one level at a time', () => {
  assert.equal(lowerQuality('ultra'), 'alto');
  assert.equal(lowerQuality('medio'), 'baixo');
  assert.equal(lowerQuality('baixo'), null);
});
test('governor downgrades only after sustained low FPS and then cools down', () => {
  const g = new FpsGovernor(24, 6000, 15000);
  assert.equal(g.sample(10, 3000), false);
  assert.equal(g.sample(60, 1200), false, 'recovery resets the window');
  assert.equal(g.sample(10, 3000), false);
  assert.equal(g.sample(12, 3000), true);
  assert.equal(g.sample(5, 6000), false, 'cooldown');
  assert.equal(g.sample(5, 10000), false, 'cooldown ends but the window restarts');
  assert.equal(g.sample(5, 6000), true);
});
