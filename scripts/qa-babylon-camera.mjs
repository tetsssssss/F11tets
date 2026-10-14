/** Babylon camera QA: runs a real 32-car race, cycles cameras, records shots + projected car sizes.
 * Usage: node scripts/qa-babylon-camera.mjs <outDir> [baseUrl] ; env W,H,SECS,SPEED,CAMS */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2] || 'docs/qa-shots/camera', base = process.argv[3] || 'http://127.0.0.1:4173';
const FRAMES = +(process.env.FRAMES || 1);
const W = +(process.env.W || 390), H = +(process.env.H || 844), SECS = +(process.env.SECS || 25), SPEED = process.env.SPEED || '16';
const cams = (process.env.CAMS || 'auto,tv,duelo,seguir,aerea,pit,onboard').split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 1000, isMobile: W < 1000 });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '/corrida-rapida');
await page.getByLabel(/Espectador/).uncheck();
if (process.env.CIRCUIT) await page.locator('select').first().selectOption(process.env.CIRCUIT);
await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
await page.waitForSelector('.live-car');
await page.getByRole('button', { name: '3D BABYLON' }).first().click();
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /RETOMAR/ }).first().click();
await page.getByLabel(/Velocidade da corrida no celular|Velocidade/).first().selectOption(SPEED).catch(()=>{});
const report = [];
for (const cam of cams) {
  await page.getByLabel('Câmera Babylon').selectOption(cam);
  await page.waitForTimeout(SECS * 1000 / cams.length);
  for (let f = 1; f < FRAMES; f++) { await page.locator('.race-babylon canvas').screenshot({ path: `${out}/${W}x${H}-${cam}-canvas-f${f}.png` }).catch(() => {}); await page.waitForTimeout(3000); }
  const dbg = await page.evaluate(() => JSON.parse(JSON.stringify(window.__f1Babylon || null)));
  const lap = await page.locator('.hud-lap b').first().textContent();
  await page.screenshot({ path: `${out}/${W}x${H}-${cam}.png` });
  await page.locator('.race-babylon canvas').screenshot({ path: `${out}/${W}x${H}-${cam}-canvas.png` }).catch(() => {});
  const sizes = dbg ? Object.values(dbg.cars).map(r => Math.max(r.w, r.h)) : [];
  report.push({ cam, lap, shot: dbg?.shot, fps: dbg?.fps, drawCalls: dbg?.drawCalls, cars: sizes.length, maxCarPx: Math.max(0, ...sizes), focusSizes: dbg?.shot?.ids?.map(id => dbg.cars[id]) });
}
fs.writeFileSync(`${out}/camera-report-${W}x${H}.json`, JSON.stringify({ report, errors }, null, 1));
console.log(JSON.stringify({ report, errors: errors.slice(0, 5) }, null, 1));
await browser.close();
