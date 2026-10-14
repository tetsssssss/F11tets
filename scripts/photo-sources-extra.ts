import fs from 'node:fs/promises';
const sources: Record<string, string> = {
  'jack-doohan': 'https://www.haasf1team.com/season/team/jack-doohan',
  'yuki-tsunoda': 'https://www.redbull.com/jp-ja/athlete/yuki-tsunoda',
  'felipe-drugovich': 'https://www.fiaformulae.com/en/drivers/felipe-drugovich',
  'zhou-guanyu': 'https://www.cadillacf1team.com/',
  'pato-oward': 'https://www.mclaren.com/racing/team/pato-oward/',
  'alex-palou': 'https://www.chipganassiracing.com/drivers/apalou',
};
for (const [id, url] of Object.entries(sources)) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const h = await r.text();
    await fs.writeFile(`assets/photos/cache/${id}-extra.html`, h);
    console.log(id, r.status, h.match(/<title>(.*?)<\/title>/s)?.[1]);
    console.log(
      [...h.matchAll(/<img\b[^>]*>|<meta[^>]*property="og:image"[^>]*>/gs)]
        .map((m) => m[0])
        .filter((m) => !m.includes('logo') && !m.includes('Logo'))
        .slice(0, 22)
        .map((m) => m.slice(0, 400)),
    );
  } catch (e) {
    console.log(id, String(e));
  }
}
