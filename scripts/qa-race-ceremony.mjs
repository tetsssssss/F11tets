import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.F1_TEST_URL || 'http://127.0.0.1:3032/');
  await page.locator('a[href="/corrida-rapida"]').last().evaluate(link => link.click());
  await page.getByRole('button', { name: 'Iniciar corrida rápida' }).click();
  await page.getByLabel('Eventos críticos').selectOption('off');
  await page.getByRole('button', { name: 'RETOMAR' }).click();
  await page.locator('.hud-pace').getByRole('button', { name: '16×' }).click();
  await page.locator('button:visible').filter({ hasText: /^2.5D$/ }).first().click();
  const seen = { safetyCar: false, pitCrew: false };
  let finished = false;
  const start = Date.now();
  while (Date.now() - start < 120000) {
    seen.safetyCar ||= await page.locator('[data-testid="iso-safety-car"]').count() > 0;
    seen.pitCrew ||= await page.locator('[data-testid^="iso-pit-crew-"]').count() > 0;
    if (await page.locator('.podium-ceremony').count()) { finished = true; break; }
    if (await page.getByRole('button', { name: 'RETOMAR' }).count()) await page.getByRole('button', { name: 'RETOMAR' }).click();
    await page.waitForTimeout(300);
  }
  const state = { ...seen, finished, lap: await page.locator('.hud-lap').first().innerText() };
  assert.equal(state.finished, true, 'a corrida rápida deve chegar ao pódio');
  const places = await page.locator('.podium-contender strong').allInnerTexts();
  assert.deepEqual(places.map(text => text.slice(0, 2)), ['P2', 'P1', 'P3']);
  await page.screenshot({ path: process.env.F1_PODIUM_SCREENSHOT || '/workspace/deliverables/race-60200-podium-1365.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...state, places, errors }));
} finally {
  await browser.close();
}
