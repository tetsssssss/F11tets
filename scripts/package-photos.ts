import fs from 'node:fs/promises';
import sharp from 'sharp';
const entries = JSON.parse(await fs.readFile('assets/photos/prepared.json', 'utf8'));
const corrections: Record<string, number[]> = {
  'alex-palou': [70, 65, 300, 300],
  'pato-oward': [80, 0, 300, 270],
  'jack-doohan': [150, 8, 180, 180],
  'felipe-drugovich': [130, 8, 215, 215],
};
// Face boxes are hand-reviewed framing metadata; keep them when photos are repackaged.
const previous = JSON.parse(
  await fs.readFile('src/data/photo-manifest.json', 'utf8').catch(() => '{}'),
);
const manifest: Record<string, unknown> = {},
  sources = [];
await fs.mkdir('public/assets/people/drivers', { recursive: true });
await fs.mkdir('assets/_photo_backup', { recursive: true });
try {
  await fs.copyFile(
    'src/components/visuals.tsx',
    'assets/_photo_backup/visuals-before-real-photos.tsx.txt',
    1,
  );
} catch {}
for (const e of entries) {
  if (e.error) {
    manifest[e.personId] = { status: 'missing', name: e.personName };
    continue;
  }
  const standard = ['Formula 1', 'FIA Formula 2'].includes(e.sourceName);
  let crop = { left: 0, top: 0, width: e.width, height: e.height };
  if (standard)
    crop = {
      left: Math.round(e.width * 0.1),
      top: 0,
      width: Math.round(e.width * 0.8),
      height: Math.round(e.width * 0.8),
    };
  if (corrections[e.personId]) {
    const [x, y, w, h] = corrections[e.personId],
      s = e.width / 480;
    crop = {
      left: Math.round(x * s),
      top: Math.round(y * s),
      width: Math.round(w * s),
      height: Math.round(h * s),
    };
  }
  const base = `/assets/people/drivers/${e.personId}`;
  const masterSize = Math.min(1024, Math.max(crop.width, crop.height));
  for (const [suffix, size] of [
    ['master', masterSize],
    ['card', 512],
  ] as const) {
    await sharp(e.original)
      .extract(crop)
      .resize(size, size, { fit: 'contain', background: '#17212c' })
      .webp({ quality: 90 })
      .toFile(`public${base}_${suffix}.webp`);
  }
  manifest[e.personId] = {
    name: e.personName,
    master: `${base}_master.webp`,
    card: `${base}_card.webp`,
    status: 'verified',
    sourceUrl: e.commonsUrl || e.sourceUrl,
    masterSize,
    crop,
    ...(previous[e.personId]?.face ? { face: previous[e.personId].face } : {}),
  };
  sources.push({
    personId: e.personId,
    personName: e.personName,
    sourceUrl: e.commonsUrl || e.sourceUrl,
    profileUrl: e.sourceUrl,
    sourceName: e.sourceName,
    imageUrl: e.imageUrl,
    license: e.license || '',
    licenseUrl: e.licenseUrl || '',
    author: e.author || '',
    usageStatus: e.license ? 'reusable' : 'unknown-license',
    downloadDate: '2026-10-05',
    notes: `Identity from named publisher profile; original preserved at ${e.original}. Head/shoulder crop; resized with aspect ratio preserved. ${masterSize < 1024 ? 'Native crop below 1024; no artificial master upscale. ' : ''}${e.license === 'CC BY-SA 4.0' ? 'Cropped adaptation under same CC BY-SA 4.0; attribution retained.' : 'No redistribution permission inferred.'}`,
  });
}
await fs.writeFile('src/data/photo-manifest.json', JSON.stringify(manifest, null, 2));
await fs.writeFile('assets/photos/PHOTO_SOURCES.json', JSON.stringify(sources, null, 2));
await fs.copyFile('assets/photos/PHOTO_SOURCES.json', 'public/assets/people/PHOTO_SOURCES.json');
const tiles = [];
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  if (e.error) continue;
  const pic = await sharp(`public/assets/people/drivers/${e.personId}_card.webp`)
    .resize(160, 160)
    .toBuffer();
  const label = Buffer.from(
    `<svg width="160" height="24"><rect width="160" height="24" fill="#10161e"/><text x="6" y="16" fill="white" font-size="11">${e.personName.replaceAll('&', '&amp;')}</text></svg>`,
  );
  tiles.push(
    { input: pic, left: (i % 8) * 160, top: Math.floor(i / 8) * 184 },
    { input: label, left: (i % 8) * 160, top: Math.floor(i / 8) * 184 + 160 },
  );
}
await sharp({ create: { width: 1280, height: 736, channels: 3, background: '#17212c' } })
  .composite(tiles)
  .png()
  .toFile('assets/photos/contact-sheet.png');
console.log(`Packaged ${sources.length} real driver photographs.`);
