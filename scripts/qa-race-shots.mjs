/** Captures race screenshots + layout metrics per viewport. Usage: node scripts/qa-race-shots.mjs <outDir> [baseUrl] */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2] || 'docs/qa-shots', base = process.argv[3] || 'http://127.0.0.1:4173';
fs.mkdirSync(out, { recursive: true });
const sizes = [[360,800],[390,844],[412,915],[430,932],[800,360],[915,412],[1366,900]];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
const report = [];
for (const [w,h] of sizes) {
  if (only && !only.includes(w+'x'+h)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1000, isMobile: w < 1000 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/corrida-rapida');
  if (process.env.DRIVER) await page.getByLabel(/Espectador/).uncheck();
  await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
  await page.waitForSelector('.live-car', { timeout: 20000 });
  const metrics = async (tag) => {
    const m = await page.evaluate(() => {
      const q = s => document.querySelector(s)?.getBoundingClientRect();
      const r = e => e && { x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.width), h: Math.round(e.height) };
      const btns = [...document.querySelectorAll('button')].filter(b => /pit/i.test(b.textContent || '')).map(b => r(b.getBoundingClientRect()));
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight,
        hud: r(q('.race-hud')), map: r(q('.live-map')), canvas: r(q('.race-babylon canvas')), pitButtons: btns.slice(0,4) };
    });
    report.push({ viewport: w+'x'+h, tag, ...m });
    await page.screenshot({ path: `${out}/${w}x${h}-${tag}.png` });
  };
  await page.waitForTimeout(1500); await metrics('2d');
  for (const [label, tag] of [['3D BABYLON','babylon']]) {
    const b = page.getByRole('button', { name: label });
    if (await b.count()) { await b.first().click().catch(()=>{}); await page.waitForTimeout(6000); await metrics(tag); }
  }
  report.push({ viewport: w+'x'+h, tag: 'errors', errors });
  await ctx.close();
}
fs.writeFileSync(`${out}/metrics.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log(JSON.stringify(report.map(r => ({ v: r.viewport, t: r.tag, sw: r.sw, cw: r.cw, hud: r.hud, canvas: r.canvas, e: r.errors })), null, 0));
