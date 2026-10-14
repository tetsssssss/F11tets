/** Session benchmark: 32 cars, AUTO camera, 2D<->3D switching, a pit call. Records frame-time p50/p95, heap, draw calls.
 * Usage: node scripts/qa-babylon-bench.mjs <out.json> [baseUrl] ; env W,H,SECS,QUALITY,CHROME
 * Works on any Chromium (set CHROME); on a real phone use remote debugging with the same script. */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2] || 'bench.json', base = process.argv[3] || 'http://127.0.0.1:4173';
const W = +(process.env.W || 390), H = +(process.env.H || 844), SECS = +(process.env.SECS || 120), Q = process.env.QUALITY || 'baixo';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { window.__frames = []; let last = performance.now(); const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await page.goto(base + '/corrida-rapida');
await page.getByLabel(/Espectador/).uncheck();
await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
await page.waitForSelector('.live-car');
const view = (n) => page.getByRole('button', { name: n, exact: true }).locator('visible=true').first().click();
await view('3D BABYLON'); await page.waitForTimeout(3000);
await page.getByLabel('Qualidade Babylon').selectOption(Q);
await page.getByRole('button', { name: /RETOMAR/ }).first().click();
await page.getByLabel(/Velocidade da corrida no celular/).selectOption('4').catch(() => {});
const t0 = Date.now(), events = [];
const stats = async (tag) => page.evaluate((tag) => { const f = window.__frames.slice(); window.__frames.length = 0; f.sort((a, b) => a - b);
  const q = (p) => f.length ? +f[Math.min(f.length - 1, Math.floor(p * f.length))].toFixed(1) : null; const d = window.__f1Babylon || {};
  return { tag, frames: f.length, p50ms: q(.5), p95ms: q(.95), fps: f.length ? +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1) : 0,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, drawCalls: d.drawCalls ?? null, renderMs: d.renderMs ?? null, shot: d.shot?.kind ?? null, lap: document.querySelector('.hud-lap b')?.textContent }; }, tag);
const marks = [0.25, 0.5, 0.75];
let next = 0;
while ((Date.now() - t0) / 1000 < SECS) {
  await page.waitForTimeout(5000);
  events.push(await stats('3d'));
  const frac = (Date.now() - t0) / 1000 / SECS;
  if (next < marks.length && frac >= marks[next]) {
    next++;
    if (next === 1) { await page.locator('.five-commands button', { hasText: 'PIT' }).first().click(); await page.getByRole('button', { name: 'BOX NOW' }).click().catch(() => {}); events.push({ tag: 'pit-call' }); }
    if (next === 2) { await view('2D TÁTICO'); await page.waitForTimeout(4000); events.push(await stats('2d')); await view('3D BABYLON'); await page.waitForTimeout(3000); events.push({ tag: 'switched-back-to-3d' }); }
  }
}
const all = events.filter(e => e.p50ms != null && e.tag === '3d');
const mean = (k) => +(all.reduce((s, e) => s + e[k], 0) / Math.max(1, all.length)).toFixed(1);
const res = { env: { viewport: W + 'x' + H, quality: Q, rendering: 'SwiftShader software', userAgent: await page.evaluate(() => navigator.userAgent), seconds: SECS },
  summary: { samples: all.length, meanP50ms: mean('p50ms'), meanP95ms: mean('p95ms'), meanFps: mean('fps'), maxHeapMB: Math.max(...all.map(e => e.heapMB ?? 0)), errors }, events };
fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res.summary));
await browser.close();
