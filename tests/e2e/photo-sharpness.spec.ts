import { test, expect, type Page } from '@playwright/test';
// One driver from each of eight teams.
const five = [
  'lando-norris',
  'max-verstappen',
  'lewis-hamilton',
  'fernando-alonso',
  'george-russell',
  'carlos-sainz',
  'pierre-gasly',
  'gabriel-bortoleto',
];
const screens = [
  { name: '1366x768', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: '1920x1080', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  { name: '1440x900@2x', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  {
    name: '412x915@2.6x',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
];
/** Source pixels per device pixel for every portrait on the map: below 1 means upscaling. */
const markerDensity = (page: Page) =>
  page.locator('.live-car image').evaluateAll((nodes) =>
    Promise.all(
      nodes.map(
        (node) =>
          new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () =>
              resolve(img.naturalWidth / (node.getBoundingClientRect().width * devicePixelRatio));
            img.onerror = () => resolve(0);
            img.src = node.getAttribute('href')!;
          }),
      ),
    ),
  );
for (const screen of screens)
  test(`FOTOS stays sharp for five drivers of different teams at ${screen.name}`, async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'this test sets its own screens');
    const { name, ...options } = screen;
    const context = await browser.newContext({ ...options, baseURL: info.project.use.baseURL });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/corrida-rapida');
    await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
    await expect(page.locator('.live-car')).toHaveCount(32);
    await page.getByRole('button', { name: 'FOTOS', exact: true }).click();
    await expect(page.locator('.live-car image')).toHaveCount(32);
    // Small map: the 512px card is allowed, as long as nothing is stretched.
    for (const density of await markerDensity(page)) expect(density).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: 'AMPLIAR CORRIDA' }).click();
    const theater = page.getByRole('dialog', { name: 'Race Theater' });
    await expect(theater.locator('.live-car image')).toHaveCount(32);
    for (const id of five) {
      const car = theater.locator(`.live-car[data-driver="${id}"]`);
      await car.focus();
      await page.keyboard.press('Enter');
      // Enlarged selection prefers the master, on the map and in the panel.
      await expect(car.locator('image')).toHaveAttribute('href', new RegExp(id + '_master'));
      const portrait = theater.locator('.selected-driver-panel .person-portrait img');
      await expect
        .poll(() => portrait.evaluate((img: HTMLImageElement) => img.currentSrc))
        .toContain(id + '_master');
      await expect
        .poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      const shown = await car.evaluate((node) => {
        const photo = node.querySelector('image')!.getBoundingClientRect(),
          face = node.querySelector('.photo-marker circle[r="10"]')!.getBoundingClientRect(),
          img = document.querySelector<HTMLImageElement>(
            '.selected-driver-panel .person-portrait img',
          )!,
          frame = img.parentElement!.getBoundingClientRect();
        return {
          face: face.width,
          zoom: photo.width / face.width,
          panelDensity: img.naturalWidth / (img.getBoundingClientRect().width * devicePixelRatio),
          panelZoom: img.getBoundingClientRect().width / frame.width,
        };
      });
      // The face fills the frame (the photo is a bust) and is large enough to read.
      expect(shown.face).toBeGreaterThanOrEqual(17);
      expect(shown.zoom).toBeGreaterThan(1.4);
      expect(shown.panelZoom).toBeGreaterThan(1.4);
      expect(shown.panelDensity).toBeGreaterThanOrEqual(1);
      await page.waitForTimeout(500);
      await car.screenshot({ path: info.outputPath(`${name}-${id}.png`) });
    }
    for (const density of await markerDensity(page)) expect(density).toBeGreaterThanOrEqual(1);
    // No swapped photos: every marker shows the file of its own driver.
    const owners = await theater
      .locator('.live-car')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.getAttribute('data-driver'),
          n.querySelector('image')!.getAttribute('href'),
        ]),
      );
    expect(owners).toHaveLength(32);
    for (const [id, href] of owners) expect(href).toContain('/' + id + '_');
    const timing = await theater
      .locator('.theater-timing .person-portrait img')
      .evaluateAll((images: HTMLImageElement[]) =>
        images.map(
          (img) => img.naturalWidth / (img.getBoundingClientRect().width * devicePixelRatio),
        ),
      );
    expect(timing).toHaveLength(32);
    for (const density of timing) expect(density).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
    await context.close();
  });
