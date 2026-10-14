import { test, expect } from '@playwright/test';
test('race theater and CARROS/FOTOS markers share the running race', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/novo-jogo?modo=piloto');
  await page.getByLabel('Slot do novo jogo').selectOption('3');
  await page.getByRole('button', { name: 'INICIAR CARREIRA 2029', exact: true }).click();
  await expect(page).toHaveURL(/temporada/);
  await page.goto('/fim-de-semana');
  for (const s of ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3'])
    await page.getByRole('button', { name: 'INICIAR SESSÃO · ' + s, exact: true }).click();
  await page.getByRole('button', { name: 'INICIAR SESSÃO · Sprint', exact: true }).click();
  await expect(page.locator('.live-car')).toHaveCount(32);
  await expect(page.locator('.live-car image')).toHaveCount(0);
  const truePositions = () =>
    page
      .locator('.live-car')
      .evaluateAll((nodes) =>
        Object.fromEntries(
          nodes.map((n) => [n.getAttribute('data-driver'), n.getAttribute('transform')]),
        ),
      );
  const classification = () =>
    page
      .locator('.live-timing tbody tr td:nth-child(2)')
      .evaluateAll((cells) => cells.map((c) => c.textContent));
  const carPositions = await truePositions(),
    order = await classification();
  expect(order).toHaveLength(32);

  await page.getByRole('button', { name: 'FOTOS', exact: true }).click();
  await expect(page.locator('.live-car image')).toHaveCount(32);
  // Packed 32-car grid: portraits fan out for display, real positions and order stay put.
  expect(await truePositions()).toEqual(carPositions);
  expect(await classification()).toEqual(order);
  await page.waitForTimeout(700);
  const pack = await page.locator('.live-car').evaluateAll((nodes) =>
    nodes.map((n) => {
      const anchor = (n as SVGGElement).getScreenCTM()!,
        face = n.querySelector('.photo-marker circle[r="10"]')!.getBoundingClientRect(),
        x = face.x + face.width / 2,
        y = face.y + face.height / 2;
      return {
        label: n.getAttribute('aria-label')!,
        x,
        y,
        size: face.width,
        moved: Math.hypot(x - anchor.e, y - anchor.f),
      };
    }),
  );
  const apart = pack.flatMap((a, i) =>
    pack.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y) / a.size),
  );
  // No face sits on top of another: centres stay well over half a portrait apart.
  expect(Math.min(...apart)).toBeGreaterThan(0.5);
  expect(pack.filter((m) => m.moved > m.size * 0.3).length).toBeGreaterThanOrEqual(20);
  expect(Math.min(...pack.map((m) => m.size))).toBeGreaterThan(13.9);
  for (let i = 0; i < 32; i++)
    expect(pack.filter((m) => m.label.endsWith(', P' + (i + 1)))).toHaveLength(1);
  await page.locator('.live-map').screenshot({ path: info.outputPath('start-32-photos.png') });
  const loaded = await page.locator('.live-car image').evaluateAll((nodes) =>
    Promise.all(
      nodes.map(
        (n) =>
          new Promise<boolean>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth > 0);
            img.onerror = () => resolve(false);
            img.src = n.getAttribute('href')!;
          }),
      ),
    ).then((all) => all.filter(Boolean).length),
  );
  expect(loaded).toBe(32);

  await page.getByRole('button', { name: 'Tela cheia do mapa' }).click();
  const theater = page.getByRole('dialog', { name: 'Race Theater' });
  await expect(theater).toBeVisible();
  await expect(page.locator('.live-map')).toHaveCount(1);
  await expect(theater.locator('.live-car image')).toHaveCount(32);
  // Phones open with the timing folded so the circuit takes the screen.
  const timingToggle = theater.getByRole('button', { name: 'TIMING', exact: true });
  if ((await timingToggle.getAttribute('aria-pressed')) === 'false') {
    await expect(theater.locator('.theater-timing')).toBeHidden();
    await timingToggle.click();
  }
  await theater.getByRole('button', { name: 'TODOS', exact: true }).click();
  await expect(theater.locator('.theater-timing li')).toHaveCount(32);
  await expect(theater.locator('.five-commands button')).toHaveCount(5);
  await theater.getByRole('button', { name: 'VER 3D', exact: true }).click();
  await expect(theater.locator('[data-testid="race-scene-3d"]')).toBeVisible();
  await expect(theater.locator('.race-3d-car')).toHaveCount(32);
  const roadBefore = await theater.locator('.race-3d-canvas path').nth(2).getAttribute('d');
  await theater.getByRole('button', { name: 'Girar câmera à direita' }).click();
  await expect.poll(() => theater.locator('.race-3d-canvas path').nth(2).getAttribute('d')).not.toBe(roadBefore);
  await theater.getByRole('button', { name: 'Elevar câmera' }).click();
  await theater.locator('.race-3d').screenshot({ path: info.outputPath('theater-3d.png') });
  await theater.getByRole('button', { name: 'VOLTAR 2D', exact: true }).click();
  const map = (await theater.locator('.race-canvas').boundingBox())!,
    view = page.viewportSize()!;
  // The drawn circuit (not just the canvas) must dominate: fit-to-track uses the real bounds.
  const track = (await theater.locator('.race-canvas [data-track]').boundingBox())!;
  if (view.width > 900) {
    expect(map.width * map.height).toBeGreaterThan(view.width * view.height * 0.6);
    expect(Math.max(track.width / map.width, track.height / map.height)).toBeGreaterThan(0.75);
  } else {
    expect(map.width).toBeGreaterThan(view.width * 0.95);
    expect(Math.max(track.width / map.width, track.height / map.height)).toBeGreaterThan(0.75);
  }
  for (const label of ['ATAQUE', 'DEFESA', 'FREADA', 'PIT', 'RÁDIO'])
    await expect(theater.getByRole('button', { name: label, exact: true })).toBeVisible();
  expect(map.width).toBeLessThanOrEqual(view.width);

  // The visual layer must not break the controls: every speed and a command, from the Theater.
  for (const speed of ['2×', '4×', '8×', '16×', '1×']) {
    const button = theater.getByRole('button', { name: speed, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await theater.getByRole('button', { name: 'ATAQUE', exact: true }).click();
  await expect(theater.locator('.command-card .micro').first()).toContainText('ATTACK');
  await theater.locator('.five-commands').getByRole('button', { name: 'RÁDIO', exact: true }).click();
  await expect(theater.locator('.radio-options button').first()).toBeVisible();
  await theater.locator('.five-commands').getByRole('button', { name: 'RÁDIO', exact: true }).click();
  await theater.getByRole('button', { name: 'RETOMAR', exact: true }).click();
  await theater.getByRole('button', { name: 'CARROS', exact: true }).click();
  await expect(theater.locator('.live-car image')).toHaveCount(0);
  await expect(theater.locator('.live-car')).toHaveCount(32);
  await theater.getByRole('button', { name: 'FOTOS', exact: true }).click();
  await expect(theater.getByRole('button', { name: 'PAUSAR', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('theater-photos.png') });

  await page.keyboard.press('Escape');
  await expect(theater).toHaveCount(0);
  await expect(page.locator('.live-car image')).toHaveCount(32);
  await page.getByRole('button', { name: 'Tela cheia do mapa' }).click();
  await page.getByRole('button', { name: 'Fechar Race Theater' }).click();
  await expect(theater).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.live-car image')).toHaveCount(32);
  expect(errors).toEqual([]);
});
