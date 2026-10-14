import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const entries = JSON.parse(await fs.readFile('assets/photos/discovery.json', 'utf8'));
await fs.mkdir('assets/photos/originals', { recursive: true });
for (const e of entries.filter((e: any) => e.imageUrl)) {
  const target = path.join('assets/photos/originals', e.personId + '.source');
  try {
    await fs.access(target);
  } catch {
    const response = await fetch(e.imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      console.log('FAILED', e.personId, response.status);
      continue;
    }
    await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
  try {
    const meta = await sharp(target).metadata();
    console.log(e.personId, meta.width, meta.height);
    if (['lando-norris', 'nikola-tsolov', 'alex-palou'].includes(e.personId))
      await sharp(target)
        .resize({ width: 450 })
        .png()
        .toFile(`assets/photos/cache/${e.personId}-preview.png`);
  } catch (err) {
    console.log('INVALID', e.personId, String(err));
  }
}
