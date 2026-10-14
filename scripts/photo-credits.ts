import fs from 'node:fs/promises';
const inputs = JSON.parse(await fs.readFile('assets/photos/inputs.json', 'utf8'));
const palou = await fetch(
  'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=original&titles=%C3%81lex_Palou',
).then((r) => r.json());
const page: any = Object.values(palou.query.pages)[0];
if (page.original?.source) {
  const e = inputs.find((x: any) => x.personId === 'alex-palou');
  Object.assign(e, {
    sourceUrl: 'https://en.wikipedia.org/wiki/Alex_Palou',
    sourceName: 'Wikimedia Commons via Wikipedia',
    imageUrl: page.original.source,
    title: page.title,
  });
}
for (const e of inputs.filter((x: any) => x.imageUrl.includes('wikimedia.org'))) {
  const title = 'File:' + decodeURIComponent(new URL(e.imageUrl).pathname.split('/').at(-1)!);
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&titles=' +
    encodeURIComponent(title);
  try {
    const result = await fetch(url).then((r) => r.json());
    const p: any = Object.values(result.query.pages)[0];
    const info = p.imageinfo[0];
    e.license = info.extmetadata.LicenseShortName?.value || '';
    e.licenseUrl = info.extmetadata.LicenseUrl?.value || '';
    e.author = info.extmetadata.Artist?.value || '';
    e.commonsUrl = info.descriptionurl;
    console.log(e.personId, e.license);
  } catch (error) {
    console.log(e.personId, String(error));
  }
}
await fs.writeFile('assets/photos/inputs.json', JSON.stringify(inputs, null, 2));
