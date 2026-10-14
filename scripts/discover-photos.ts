import fs from 'node:fs/promises';
import path from 'node:path';
import { drivers } from '../src/data/drivers';
const dir = 'assets/photos/cache';
await fs.mkdir(dir, { recursive: true });
const f2 = new Set([
  'nikola-tsolov',
  'rafael-camara',
  'mari-boya',
  'colton-herta',
  'dino-beganovic',
]);
const indy: Record<string, string> = { 'alex-palou': 'Alex-Palou', 'pato-oward': 'Pato-OWard' };
const aliases: Record<string, string> = {
  'kimi-antonelli': 'kimi-antonelli',
  'alexander-albon': 'alexander-albon',
};
const entries = [];
for (const d of drivers) {
  const sourceUrl = indy[d.id]
    ? `https://www.indycar.com/Drivers/${indy[d.id]}`
    : f2.has(d.id)
      ? `https://www.fiaformula2.com/en/drivers/${d.id}`
      : `https://www.formula1.com/en/drivers/${aliases[d.id] ?? d.id}`;
  const cache = path.join(dir, d.id + '.html');
  let html = '';
  let status = 200;
  try {
    html = await fs.readFile(cache, 'utf8');
  } catch {
    try {
      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000) });
      status = response.status;
      html = await response.text();
      await fs.writeFile(cache, html);
    } catch (e) {
      status = 0;
    }
  }
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
  const images = [...html.matchAll(/<img\b[^>]*>/gs)].map((m) => m[0]);
  const hero = indy[d.id]
    ? images.find((i) => /driver-detail-standing-image/.test(i))
    : images.find((i) => /common\/(f1|f2)\//.test(i) && /right\.webp/.test(i));
  const src = hero?.match(/\bsrc="([^"]+)"/)?.[1];
  const imageUrl = src ? new URL(src.replaceAll('&amp;', '&'), sourceUrl).href : null;
  entries.push({
    personId: d.id,
    personName: d.name,
    sourceUrl,
    title,
    status,
    imageUrl,
    sourceName: indy[d.id] ? 'INDYCAR' : f2.has(d.id) ? 'FIA Formula 2' : 'Formula 1',
  });
  console.log(d.id, status, title.slice(0, 65), imageUrl ?? 'MISSING');
}
await fs.writeFile('assets/photos/discovery.json', JSON.stringify(entries, null, 2) + '\n');
for (const e of entries.filter((e) => !e.imageUrl && e.status === 200)) {
  const h = await fs.readFile(path.join(dir, e.personId + '.html'), 'utf8');
  console.log(
    'CANDIDATES',
    e.personId,
    [...h.matchAll(/<img\b[^>]*>/gs)]
      .map((m) => m[0])
      .filter((i) =>
        /Headshot|DriverMain|Drugovich|Doohan|Tsunoda|Zhou|Palou|OWard|O.Ward/i.test(i),
      )
      .slice(0, 12),
  );
}
