import { test, expect } from '@playwright/test';
test('real portraits load and broken primary falls back without broken-image icon', async ({
  page,
}, info) => {
  await page.goto('/pilotos');
  await expect(page.locator('.driver-portrait img')).toHaveCount(32);
  await page
    .locator('.driver-portrait img')
    .evaluateAll((images) => images.forEach((img) => img.setAttribute('loading', 'eager')));
  await expect
    .poll(() =>
      page
        .locator('.driver-portrait img')
        .evaluateAll(
          (images) =>
            images.filter(
              (img) =>
                (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ).length,
        ),
    )
    .toBe(32);
  await page.route('**/lando-norris_card.webp', (route) => route.abort());
  await page.goto('/pilotos/lando-norris');
  const portrait = page.locator('.driver-id .person-portrait img');
  await expect(portrait).toHaveAttribute('src', /lando-norris_master/);
  await expect
    .poll(() => portrait.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.route('**/lando-norris_master.webp', (route) => route.abort());
  await page.reload();
  await expect(page.locator('.driver-id .person-portrait img')).toHaveAttribute(
    'src',
    /placeholder/,
  );
  await expect
    .poll(() =>
      page
        .locator('.driver-id .person-portrait img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.unrouteAll();
  await page.reload();
  await page.screenshot({
    path: `docs/screenshots/netlify-portrait-${info.project.name}.png`,
    fullPage: true,
  });
});
test('Netlify SPA deep links, camera, selected driver and 16x playback work without errors', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/corrida-rapida');
  await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
  await expect(page.locator('.live-car')).toHaveCount(32);
  const car = page.locator('.live-car[data-driver="lando-norris"]');
  await car.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.selected-driver-panel')).toContainText('Lando Norris');
  await expect(page.getByRole('button', { name: 'RETOMAR', exact: true })).toBeVisible();
  await page.getByLabel('Câmera 2D').selectOption('FOLLOW LEADER');
  const before = await page.locator('.race-canvas').getAttribute('viewBox');
  await page.getByRole('button', { name: 'Aproximar mapa' }).click();
  await page.getByRole('button', { name: 'Aproximar mapa' }).click();
  await page.getByRole('button', { name: 'Aproximar mapa' }).click();
  expect(await page.locator('.race-canvas').getAttribute('viewBox')).not.toBe(before);
  await page.getByRole('button', { name: 'Reset câmera' }).click();
  await page.getByLabel('Eventos críticos').selectOption('off');
  await page.getByRole('button', { name: '16×', exact: true }).click();
  await page.getByRole('button', { name: 'RETOMAR', exact: true }).click();
  const timing = await page.evaluate(
    () =>
      new Promise<{ frames: number; p95: number }>((resolve) => {
        const samples: number[] = [];
        let last = performance.now(),
          start = last;
        const frame = (now: number) => {
          samples.push(now - last);
          last = now;
          if (now - start < 3000) requestAnimationFrame(frame);
          else {
            samples.sort((a, b) => a - b);
            resolve({ frames: samples.length, p95: samples[Math.floor(samples.length * 0.95)] });
          }
        };
        requestAnimationFrame(frame);
      }),
  );
  await test.info().attach('16x-frame-sampling', {
    body: JSON.stringify(timing),
    contentType: 'application/json',
  });
  expect(timing.frames).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'PAUSAR', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: `docs/screenshots/netlify-race-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/academias');
  await page.reload();
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/dev/race-2d');
  await expect(page.locator('h1')).toContainText('Esta página não está no grid');
  expect(errors).toEqual([]);
});
