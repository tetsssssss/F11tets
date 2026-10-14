import fs from 'node:fs/promises';
const rows = JSON.parse(await fs.readFile('assets/photos/inputs.json', 'utf8'));
function set(id: string, sourceUrl: string, imageUrl: string, name: string) {
  Object.assign(
    rows.find((r: any) => r.personId === id),
    { sourceUrl, imageUrl, sourceName: name, status: 200 },
  );
}
const p = await fs.readFile('assets/photos/cache/pato-oward-extra.html', 'utf8');
set(
  'pato-oward',
  'https://www.mclaren.com/racing/team/pato-oward/',
  p.match(/https[^"<> ]+Website_Pato_Web\.jpg/)![0],
  'McLaren Racing',
);
set(
  'alex-palou',
  'https://www.chipganassiracing.com/drivers/apalou',
  'https://www.chipganassiracing.com/assets/img/drivers/bio/apalou2025.jpg',
  'Chip Ganassi Racing',
);
for (const [id, title] of [
  ['zhou-guanyu', 'Zhou_Guanyu'],
  ['yuki-tsunoda', 'Yuki_Tsunoda'],
]) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=${title}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = await response.json();
    const page: any = Object.values(json.query.pages)[0];
    console.log(id, page.original);
    if (page.original)
      set(
        id,
        `https://en.wikipedia.org/wiki/${title}`,
        page.original.source,
        'Wikipedia / Wikimedia Commons',
      );
  } catch (e) {
    console.log(id, String(e));
  }
}
await fs.writeFile('assets/photos/inputs.json', JSON.stringify(rows, null, 2) + '\n');
