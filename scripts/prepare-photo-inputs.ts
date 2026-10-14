import fs from 'node:fs/promises';
const entries = JSON.parse(await fs.readFile('assets/photos/discovery.json', 'utf8'));
for (const id of ['jack-doohan', 'felipe-drugovich', 'pato-oward', 'alex-palou']) {
  const h = await fs.readFile(`assets/photos/cache/${id}-extra.html`, 'utf8');
  const imgs = [...h.matchAll(/<img\b[^>]*>/gs)].map((m) => m[0]);
  const img =
    id === 'jack-doohan'
      ? imgs.find((x) => x.includes('gd1_7644'))
      : id === 'felipe-drugovich'
        ? imgs.find((x) => x.includes('Felipe Drugovich Driver Profile'))
        : id === 'pato-oward'
          ? imgs.find((x) => /PATO O.WARD|PATO O&#39;WARD|Pato O.Ward/i.test(x))
          : imgs.find((x) => /Palou/i.test(x) && !x.includes('Signature'));
  const source = entries.find((e: any) => e.personId === id);
  const src = img?.match(/\bsrc="([^"]+)"/)?.[1];
  console.log(id, img?.slice(0, 1300) ?? imgs.slice(0, 15));
  if (src) {
    source.sourceUrl =
      id === 'jack-doohan'
        ? 'https://www.haasf1team.com/season/team/jack-doohan'
        : id === 'felipe-drugovich'
          ? 'https://www.fiaformulae.com/en/drivers/felipe-drugovich'
          : id === 'pato-oward'
            ? 'https://www.mclaren.com/racing/team/pato-oward/'
            : 'https://www.chipganassiracing.com/drivers/apalou';
    source.imageUrl = new URL(src.replaceAll('&amp;', '&'), source.sourceUrl).href;
    source.title = h.match(/<title>(.*?)<\/title>/s)?.[1];
    source.sourceName = new URL(source.sourceUrl).hostname;
    source.status = 200;
  }
}
for (const e of entries)
  if (e.imageUrl?.includes('/common/f'))
    e.imageUrl = e.imageUrl
      .replace(/\/image\/upload\/.*?(\/v\d+\/)/, '/image/upload$1')
      .replace(/\/prod-f2f3\/.*?(\/v\d+\/)/, '/prod-f2f3$1');
await fs.writeFile('assets/photos/inputs.json', JSON.stringify(entries, null, 2) + '\n');
const h = await fs.readFile('assets/photos/cache/yuki-tsunoda-extra.html', 'utf8');
console.log(
  'YUKI URLs',
  [...new Set(h.match(/https[^"<>\s]+/g))]
    .filter((x) => /image|img|cloud|media/.test(x))
    .slice(0, 20),
);
