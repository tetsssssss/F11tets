import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
await mkdir('docs/screenshots', { recursive: true });
const report = [];
for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
  [768, 1024],
  [390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:3029/');
  await page.locator('.save-status').filter({ hasText: 'PRÉ-TEMPORADA' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/screenshots/home-${width}x${height}.png` });
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  report.push({ width, height, page: 'home', noOverflow, errors });
  if (width === 390) {
    await page
      .locator('.home-news .news-card')
      .last()
      .screenshot({ path: 'docs/screenshots/news-mobile.png' });
  }
  if (!noOverflow || errors.length)
    throw new Error(`Visual smoke check failed at ${width}x${height}`);
  await page.close();
}
await browser.close();
await writeFile('docs/visual-qa.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
