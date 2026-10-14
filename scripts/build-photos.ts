import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const inputs = JSON.parse(await fs.readFile('assets/photos/inputs.json', 'utf8'));
await fs.mkdir('assets/photos/high-resolution', { recursive: true });
await fs.mkdir('assets/photos/previews', { recursive: true });
const output = [];
for (const e of inputs) {
  const hash = createHash('sha256').update(e.imageUrl).digest('hex').slice(0, 12);
  const original = `assets/photos/high-resolution/${e.personId}-${hash}.source`;
  try {
    try {
      await fs.access(original);
    } catch {
      const r = await fetch(e.imageUrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      await fs.writeFile(original, Buffer.from(await r.arrayBuffer()));
    }
    const m = await sharp(original).metadata();
    await sharp(original)
      .resize({ width: 480, withoutEnlargement: true })
      .png()
      .toFile(`assets/photos/previews/${e.personId}.png`);
    output.push({ ...e, original, width: m.width, height: m.height });
    console.log(e.personId, m.width, m.height);
  } catch (error) {
    output.push({ ...e, error: String(error) });
    console.log(e.personId, String(error));
  }
}
await fs.writeFile('assets/photos/prepared.json', JSON.stringify(output, null, 2));
