/** Renders a fixed oblique overview of each requested circuit's scenery (QA only).
 * Usage: node scripts/qa-scenery-overview.mjs <outDir> gp-15,gp-34 [alto] */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [out, list = 'gp-1', quality = 'alto'] = process.argv.slice(2), base = process.env.BASE || 'http://127.0.0.1:4173';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const report = {};
for (const id of list.split(',')) {
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  await page.goto(base + '/corrida-rapida');
  await page.locator('select').first().selectOption(id);
  await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
  await page.waitForSelector('.live-car');
  await page.getByRole('button', { name: '3D BABYLON' }).first().click();
  await page.waitForTimeout(3500);
  await page.getByLabel('Qualidade Babylon').selectOption(quality);
  await page.waitForTimeout(4000);
  report[id] = await page.evaluate(() => {
    const sc = window.__f1BabylonScene, C = sc.activeCamera.constructor, V = sc.activeCamera.position.constructor;
    const cam = new C('qa-overview', new V(0, 62, -84), sc); cam.setTarget(new V(0, 0, 4)); cam.fov = 0.95; cam.maxZ = 800; sc.activeCamera = cam;
    return { scenery: window.__f1Babylon?.scenery, drawCalls: window.__f1Babylon?.drawCalls };
  });
  await page.waitForTimeout(3500);
  await page.locator('.race-babylon canvas').screenshot({ path: `${out}/${id}-overview.png` });
  await page.close();
}
fs.writeFileSync(`${out}/overview-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
await browser.close();
