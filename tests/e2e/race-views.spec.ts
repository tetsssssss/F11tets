import { test, expect, type Page } from '@playwright/test';

async function startRace(page: Page) {
  await page.goto('/corrida-rapida');
  await page.getByLabel(/Espectador/).uncheck();
  await page.getByRole('button', { name: 'Iniciar corrida rápida', exact: true }).click();
  await expect(page.locator('.live-car')).toHaveCount(32);
}
const classification = (page: Page) =>
  page.locator('.live-timing tbody tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).innerText.replace(/\s+/g, ' ')));
const lapText = (page: Page) => page.locator('.hud-lap b').first().innerText();
async function view(page: Page, name: '2D TÁTICO' | '2.5D' | '3D BABYLON') {
  // The same view buttons exist in the phone strip and the map toolbar; either one switches the renderer.
  await page.getByRole('button', { name, exact: true }).locator('visible=true').first().click();
}

test('2D → 2.5D → 3D → 2D shows the same paused race and never scrolls horizontally', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRace(page);
  const pause = page.getByRole('button', { name: 'PAUSAR', exact: true });
  if (await pause.count()) await pause.first().click();
  await expect(page.getByRole('button', { name: 'RETOMAR', exact: true }).first()).toBeVisible();
  // Race starts paused in a quick race; step one sector so the order is not the trivial grid.
  const step = page.getByRole('button', { name: 'Próximo setor' });
  if (await step.isEnabled()) await step.click();
  const order = await classification(page);
  const lap = await lapText(page);
  expect(order).toHaveLength(32);
  for (const name of ['2.5D', '3D BABYLON', '2D TÁTICO'] as const) {
    await view(page, name);
    await page.waitForTimeout(name === '3D BABYLON' ? 4000 : 600);
    expect(await classification(page), 'classification after ' + name).toEqual(order);
    expect(await lapText(page)).toBe(lap);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal scroll in ' + name).toBeLessThanOrEqual(0);
  }
  await page.screenshot({ path: info.outputPath('views-parity.png') });
  expect(errors).toEqual([]);
});

test('driver controls (PIT) and Race Control stay reachable with the 3D stage on screen', async ({ page }, info) => {
  test.setTimeout(120000);
  await startRace(page);
  await view(page, '3D BABYLON');
  await page.waitForTimeout(3500);
  const vp = page.viewportSize()!;
  const pit = page.locator('.five-commands button', { hasText: 'PIT' }).first();
  await expect(pit).toBeVisible();
  const box = (await pit.boundingBox())!;
  // Phones (portrait or landscape) must show the whole cockpit on one screen; desktop pages may scroll.
  if (vp.width <= 1000) {
    expect(box.y + box.height, 'PIT button inside the viewport').toBeLessThanOrEqual(vp.height + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  }
  const canvas = (await page.locator('.race-babylon canvas').boundingBox())!;
  expect(canvas.height, 'stage keeps a usable height').toBeGreaterThan(vp.height > vp.width ? 300 : 170);
  // Race Control expands without removing the stage from the screen.
  const toggle = page.getByRole('button', { name: /Ver dados da corrida|Recolher dados/ }).first();
  if (/Ver dados/.test((await toggle.innerText()))) await toggle.click();
  await page.waitForTimeout(400);
  const after = (await page.locator('.race-babylon canvas').boundingBox())!;
  expect(after.height).toBeGreaterThan(120);
  await page.screenshot({ path: info.outputPath('pit-race-control.png') });
});

test('every Babylon camera can be chosen and a manual choice survives until AUTO is picked again', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startRace(page);
  await view(page, '3D BABYLON');
  const select = page.getByLabel('Câmera Babylon');
  await expect(select).toHaveValue('auto');
  await expect.poll(() => page.evaluate(() => !!(window as any).__f1Babylon), { timeout: 30000 }).toBe(true);
  for (const cam of ['tv', 'duelo', 'seguir', 'aerea', 'pit', 'onboard']) {
    await select.selectOption(cam);
    await expect(select).toHaveValue(cam);
    await expect.poll(() => page.evaluate(() => (window as any).__f1Babylon?.camera), { timeout: 15000 }).toBe(cam);
  }
  await select.selectOption('auto');
  await expect(select).toHaveValue('auto');
  expect(errors).toEqual([]);
});

test('without WebGL the race keeps running in 2D with a notice', async ({ browser }) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
      if (/webgl/i.test(type)) return null;
      return (original as any).call(this, type, ...rest);
    } as any;
  });
  const page = await context.newPage();
  await startRace(page);
  const order = await classification(page);
  await view(page, '3D BABYLON');
  await expect(page.locator('.race-graphics-notice')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.live-car').first()).toBeVisible();
  expect(await classification(page)).toEqual(order);
  await context.close();
});
