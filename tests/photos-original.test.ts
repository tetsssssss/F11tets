import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { drivers } from '../src/data/drivers';
import manifest from '../src/data/photo-manifest.json';

test('all 32 original starters have distinct real WebP photographs (card and master)', () => {
  const images = manifest as Record<string, { status: string; card: string; master: string }>;
  assert.equal(drivers.length, 32);
  const hashes = new Set<string>();
  for (const d of drivers) {
    const image = images[d.id];
    assert.ok(image, `No portrait for ${d.name}`);
    assert.equal(image.status, 'verified');
    for (const key of ['card', 'master'] as const) {
      const bytes = readFileSync(`public${image[key]}`);
      assert.ok(bytes.length > 10000, `${d.name} ${key} is suspiciously small`);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      if (key === 'card') {
        const hash = createHash('sha256').update(bytes).digest('hex');
        assert.ok(!hashes.has(hash), `Duplicate portrait: ${d.name}`);
        hashes.add(hash);
      }
    }
  }
  assert.equal(hashes.size, 32);
});
