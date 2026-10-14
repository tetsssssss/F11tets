import { test, expect, type Page } from '@playwright/test';
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('f1-universe-career', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    let raw: any = await new Promise((resolve, reject) => {
      const r = db.transaction('saves').objectStore('saves').get('active');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    if (raw?.encoding === 'gzip-json-v1')
      raw = await new Response(
        raw.data.stream().pipeThrough(new DecompressionStream('gzip')),
      ).text();
    return raw ? JSON.parse(raw) : null;
  });
}
test('home, all top-level pages and responsive shell are usable', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Central da temporada', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('PRÉ-TEMPORADA', { exact: true })).toBeVisible();
  await expect(page.locator('.standings-table .points')).toHaveText(Array(10).fill('0'));
  for (const card of await page.locator('.home-news .news-card').all()) {
    const outer = await card.boundingBox();
    const copy = await card.locator('.news-copy').boundingBox();
    if (outer && copy) expect(copy.y + copy.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    scale: 'css',
    path: `docs/screenshots/home-${info.project.name}.png`,
    fullPage: true,
  });
  for (const route of [
    'temporada',
    'pilotos',
    'equipes',
    'construtores',
    'engenheiros',
    'desenvolvimento',
    'mercado',
    'classificacao',
    'calendario',
    'estatisticas',
    'regulamento',
    'configuracoes',
    'fim-de-semana',
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `overflow at ${route}`,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('driver search, filters and dossiers expose every attribute group', async ({ page }, info) => {
  await page.goto('/pilotos');
  await page.getByLabel('Buscar pilotos').fill('verstappen');
  await expect(page.locator('.driver-card')).toHaveCount(1);
  await page.locator('.driver-card').click();
  await expect(
    page.getByRole('heading', { name: 'Max Verstappen', exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('.attribute-groups details')).toHaveCount(5);
  await page.locator('summary').filter({ hasText: 'TÉCNICA' }).click();
  await expect(page.getByText('Feedback técnico', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    scale: 'css',
    path: `docs/screenshots/driver-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Neste circuito' }).click();
  await expect(page.getByText('Uma página em branco')).toBeVisible();
  await page.getByRole('tab', { name: 'Relacionamentos' }).click();
  await expect(page.locator('.relationship-card')).toHaveCount(3);
  await expect(page.locator('.relationship-values>div')).toHaveCount(30);
  await page.goto('/pilotos');
  await page.getByLabel('Buscar pilotos').fill('doesnotexist');
  await expect(page.getByText('Nenhum resultado')).toBeVisible();
});
test('showroom hotspots and engineer profiles are connected', async ({ page }, info) => {
  await page.goto('/equipes/bugatti');
  await expect(page.getByText('Citroën/Peugeot', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bateria', exact: true }).first().click();
  await expect(page.locator('.technical-note')).toContainText('Armazenamento híbrido');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    scale: 'css',
    path: `docs/screenshots/team-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Dupla de pilotos' }).click();
  await expect(page.locator('.driver-card')).toHaveCount(2);
  await page.goto('/engenheiros/eng-max-verstappen');
  await expect(page.getByRole('heading', { name: 'Lukas Weber', exact: true })).toBeVisible();
  await expect(page.locator('.dynamic-row')).toHaveCount(6);
});
test('entire weekend scores once, persists, inverts Sprint and advances', async ({
  page,
}, info) => {
  await page.goto('/fim-de-semana');
  for (const session of ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3']) {
    await page.getByRole('button', { name: `INICIAR SESSÃO · ${session}`, exact: true }).click();
  }
  await expect(page.locator('.session-table tbody tr')).toHaveCount(10);
  await expect.poll(async () => (await stored(page))?.weekends[0]?.qualifyingGrid.length).toBe(32);
  const grid = (await stored(page)).weekends[0].qualifyingGrid;
  await page.getByRole('tab', { name: 'Grid invertido da Sprint' }).click();
  await expect(page.locator('.sprint-pair')).toHaveCount(32);
  await expect(page.locator('.sprint-pair').first()).toContainText('P10');
  await page.getByRole('tab', { name: 'Sessões & resultados' }).click();
  test.setTimeout(90000);
  for (const session of ['Sprint', 'GP']) {
    await page.getByRole('button', { name: 'INICIAR SESSÃO · ' + session, exact: true }).click();
    await page.getByLabel('Eventos críticos').selectOption('off');
    await page.getByRole('button', { name: '16×', exact: true }).click();
    await page.getByRole('button', { name: 'RETOMAR', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resultado e continuar' }).click({ timeout: 45000 });
  }
  await expect(page.locator('.session-table tbody tr')).toHaveCount(32);
  await expect.poll(async () => (await stored(page))?.weekends[0]?.results.GP?.length).toBe(32);
  const state = await stored(page);
  expect(state.weekends[0].qualifyingGrid).toEqual(grid);
  expect(Object.values(state.driverPoints).reduce((a: any, b: any) => a + b, 0)).toBeGreaterThan(
    249,
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Avançar para o próximo GP' })).toBeVisible();
  const after = await stored(page);
  expect(after.driverPoints).toEqual(state.driverPoints);
  await page.getByRole('tab', { name: 'Corrida 2D' }).click();
  await expect(page.locator('.race-car-dot')).toHaveCount(32);
  await page.getByRole('button', { name: 'Reproduzir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    scale: 'css',
    path: `docs/screenshots/race-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Sessões & resultados' }).click();
  await page.getByRole('button', { name: 'Avançar para o próximo GP' }).click();
  await expect(page.getByRole('heading', { name: 'GP • China', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'INICIAR SESSÃO · TL1', exact: true }),
  ).toBeVisible();
});
test('R&D reserves investment once and settings persist preferences', async ({ page }) => {
  await page.goto('/desenvolvimento');
  const card = page
    .locator('.development-card')
    .filter({ has: page.getByRole('heading', { name: 'Asa traseira', exact: true }) });
  await card.getByRole('button', { name: 'Iniciar projeto' }).click();
  await expect(card.getByRole('button', { name: 'Em desenvolvimento' })).toBeDisabled();
  await page.reload();
  await expect(card.getByRole('button', { name: 'Em desenvolvimento' })).toBeDisabled();
  await page.goto('/configuracoes');
  await page.getByLabel('Equipe em foco').selectOption('bugatti');
  await page.getByLabel('Reduzir animações').check();
  await page.getByLabel('Tabelas compactas').check();
  await page.reload();
  await expect(page.getByLabel('Equipe em foco')).toHaveValue('bugatti');
  await expect(page.getByLabel('Reduzir animações')).toBeChecked();
  await expect(page.getByLabel('Tabelas compactas')).toBeChecked();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar save', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('f1-universe-save-2029.json');
  await page.getByRole('button', { name: 'Reiniciar save', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByLabel('Equipe em foco')).toHaveValue('bugatti');
});
test('invalid save import leaves current state intact, valid save restores and reset clears', async ({
  page,
}) => {
  await page.goto('/configuracoes');
  await page.getByLabel('Equipe em foco').selectOption('ferrari');
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole('status')).toContainText('Arquivo inválido');
  await expect(page.getByLabel('Equipe em foco')).toHaveValue('ferrari');
  const raw = JSON.stringify(await stored(page));
  await page.getByLabel('Equipe em foco').selectOption('audi');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.getByRole('status')).toContainText('Save importado');
  await expect(page.getByLabel('Equipe em foco')).toHaveValue('ferrari');
  await page.getByRole('button', { name: 'Reiniciar save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar reinício', exact: true }).click();
  await page.goto('/classificacao');
  await expect(page.locator('.points')).toHaveText(Array(32).fill('0'));
});
test('suppliers expand, calendar selection works, unknown route is safe', async ({ page }) => {
  await page.goto('/mercado');
  await expect(page.locator('.supplier-card')).toHaveCount(16);
  await page.getByRole('tab', { name: 'Baterias · 5' }).click();
  await expect(page.locator('.supplier-card')).toHaveCount(5);
  await page.locator('.supplier-card summary').first().click();
  await expect(page.locator('.supplier-card').first().locator('.rating-row')).toHaveCount(8);
  await page.getByRole('tab', { name: 'Pneus · 4' }).click();
  await expect(page.locator('.tire-supplier')).toHaveCount(4);
  await page.goto('/calendario');
  await expect(page.locator('.calendar-card')).toHaveCount(35);
  await page
    .locator('.calendar-card')
    .filter({ has: page.getByRole('heading', { name: 'Bélgica', exact: true }) })
    .click();
  await expect(page.locator('.calendar-feature')).toContainText('Spa-Francorchamps');
  await page.goto('/pilotos/unknown');
  await expect(page.getByRole('heading', { name: 'Esta página não está no grid.' })).toBeVisible();
});
test('responsive navigation supports destinations and keyboard dismissal', async ({
  page,
}, info) => {
  await page.goto('/');
  if (info.project.name === 'android') {
    await page.getByRole('button', { name: 'Abrir navegação' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeFocused();
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
    await page.getByRole('button', { name: 'Abrir navegação' }).click();
  }
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Pilotos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Os protagonistas.' })).toBeVisible();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
