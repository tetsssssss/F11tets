// Visual QA for the 2D race: opens the dev fixtures and the Race Theater on several screens,
// saves screenshots and prints how much of the screen the circuit really uses.
// Usage: F1_ENABLE_DEV=1 npm run start   (in another terminal)
//        node scripts/qa-2d.mjs <output-dir> [screen,screen] [scenario,scenario]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2] || 'test-results/qa-2d';
fs.mkdirSync(out, { recursive: true });
const base = process.env.F1_TEST_URL || 'http://127.0.0.1:3029';
const screens = {
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  notebook: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true },
  mobile: {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
};
const allScenarios = [
  '32-car-start',
  'close-battle',
  'rain',
  'safety-car',
  'double-stack',
  'crash',
  'last-lap',
];
const pick = (arg, all) => (arg ? arg.split(',') : all);
const browser = await chromium.launch();
let failures = 0;
for (const name of pick(process.argv[3], Object.keys(screens))) {
  const context = await browser.newContext(screens[name]),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const scenario of pick(process.argv[4], allScenarios)) {
    await page.goto(base + '/dev/race-2d');
    await page.getByRole('button', { name: scenario, exact: true }).click();
    await page.locator('.live-car').first().waitFor();
    await page.getByRole('button', { name: 'FOTOS', exact: true }).click();
    await page.getByRole('button', { name: 'AMPLIAR CORRIDA' }).click();
    const theater = page.getByRole('dialog', { name: 'Race Theater' });
    await theater.locator('.live-car image').first().waitFor();
    await page.waitForTimeout(900);
    const use = await page.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect(),
        canvas = box('.race-theater .race-canvas'),
        track = box('.race-theater .race-canvas [data-track]'),
        modal = box('.race-theater'),
        commands = [...document.querySelectorAll('.race-theater .five-commands button')];
      return {
        canvasOfScreen: +((canvas.width * canvas.height) / (innerWidth * innerHeight)).toFixed(2),
        canvasOfTheater: +((canvas.width * canvas.height) / (modal.width * modal.height)).toFixed(
          2,
        ),
        trackWidthOfCanvas: +(track.width / canvas.width).toFixed(2),
        trackHeightOfCanvas: +(track.height / canvas.height).toFixed(2),
        cars: document.querySelectorAll('.race-theater .live-car').length,
        commands: commands.length,
        commandsOnScreen: commands.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.bottom <= innerHeight + 1 && r.top >= 0;
        }).length,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    const camera = process.env.QA_CAMERA;
    if (camera) {
      // Camera check: the shot on the paused fixture, then how often AUTO cuts while running.
      await theater.getByLabel('Câmera 2D').selectOption(camera);
      await page.waitForTimeout(1200);
      use.shot = await theater
        .locator('.shot-chip')
        .innerText()
        .catch(() => '(none)');
      use.duel = (await theater.locator('.battle-card').count())
        ? (await theater.locator('.battle-card').innerText()).replace(/\s+/g, ' ')
        : undefined;
      await page.screenshot({ path: `${out}/${name}-${scenario}-${camera.replace(' ', '-')}.png` });
      await theater.getByRole('button', { name: '8×', exact: true }).click();
      await theater.getByRole('button', { name: 'RETOMAR', exact: true }).click();
      const seen = [];
      for (let i = 0; i < 40; i++) {
        const label = await theater
          .locator('.shot-chip')
          .innerText()
          .catch(() => '(full)');
        if (seen.at(-1) !== label) seen.push(label);
        await page.waitForTimeout(250);
      }
      use.cutsIn10s = seen.length - 1;
      use.shots = seen;
      use.lap = await theater.locator('.theater-status strong').innerText();
    }
    await page.screenshot({ path: `${out}/${name}-${scenario}.png` });
    console.log(name, scenario, JSON.stringify(use), errors.length ? 'ERRORS ' + errors[0] : '');
    failures += errors.length;
    errors.length = 0;
  }
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
