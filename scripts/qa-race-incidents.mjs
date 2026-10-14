import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.F1_TEST_URL || 'http://127.0.0.1:3033/';
const output = resolve(process.env.F1_SCREENSHOT_DIR || '/workspace/deliverables');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('dev/race-2d', base).href);
  for (const scenario of ['spin', 'wide', 'crash']) {
    await page.getByRole('button', { name: scenario, exact: true }).click();
    await page.getByRole('button', { name: 'RETOMAR' }).click();
    await page.waitForTimeout(scenario === 'crash' ? 600 : 900);
    assert.ok(await page.locator('.map-incident-effects').count(), `${scenario}: efeito 2D ausente`);
    await page.locator('button:visible').filter({ hasText: /^2.5D$/ }).first().click();
    assert.ok(await page.locator('.incident-dust,.incident-smoke,.incident-sparks').count(), `${scenario}: efeito 2.5D ausente`);
    await page.screenshot({ path: resolve(output, `race-60300-${scenario}-2.5d.png`) });
    await page.locator('button:visible').filter({ hasText: /^3D BABYLON$/ }).first().click();
    await page.locator('[data-testid="race-babylon-webgl"] canvas').waitFor();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: resolve(output, `race-60300-${scenario}-3d.png`) });
  }
  assert.deepEqual(errors, []);
  console.log('spin, wide e crash renderizados em 2D, 2.5D e Babylon 3D; sem erro JavaScript');
} finally {
  await browser.close();
}
