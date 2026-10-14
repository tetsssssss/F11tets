import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutRaceTags, TAG_H, TAG_W } from '../src/presentation/race-tag-layout';

test('isometric tags stay in frame and never overlap in 32-car traffic', () => {
  const cars = Array.from({ length: 32 }, (_, i) => ({
    id: `driver-${i}`, x: 400 + i % 5, y: 300 + Math.floor(i / 5) % 3,
    position: i + 1, priority: i === 17 ? 0 : i < 5 ? 2 : 3,
  }));
  const result = layoutRaceTags(cars, 820, 610, 12);
  assert.ok(result['driver-17'], 'selected driver must be tagged first');
  assert.ok(Object.keys(result).length <= 12);
  assert.deepEqual(result, layoutRaceTags([...cars].reverse(), 820, 610, 12));
  const placed = Object.values(result);
  for (const a of placed) {
    assert.ok(a.x >= 5 && a.y >= 5 && a.x + TAG_W <= 815 && a.y + TAG_H <= 605);
    for (const b of placed) {
      if (a === b) continue;
      assert.ok(
        a.x + TAG_W + 4 <= b.x || b.x + TAG_W + 4 <= a.x ||
          a.y + TAG_H + 4 <= b.y || b.y + TAG_H + 4 <= a.y,
        `collision: ${JSON.stringify(a)} / ${JSON.stringify(b)}`,
      );
    }
  }
});

test('isometric tags also fit on narrow mobile screens without changing car state', () => {
  const cars = Array.from({ length: 32 }, (_, i) => ({
    id: `car-${i}`, x: 190, y: 170, position: i + 1, priority: i ? 3 : 0,
  }));
  const unchanged = JSON.stringify(cars);
  const tags = layoutRaceTags(cars, 390, 390);
  assert.ok(tags['car-0']);
  assert.ok(Object.values(tags).every(({ x, y }) => x >= 5 && x + TAG_W <= 385 && y >= 5 && y + TAG_H <= 385));
  assert.equal(JSON.stringify(cars), unchanged);
  assert.deepEqual(layoutRaceTags([], 390, 390), {});
});
