import { test, expect, type Page } from '@playwright/test';
import { createSave } from '../../src/domain/save';
import { runNextSession, advanceRound } from '../../src/domain/simulation';
async function read(page: Page, summary = false) {
  return page.evaluate(async (summary) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('f1-universe-career', 1);
      r.onsuccess = () => resolve(r.result);
    });
    let raw: any = await new Promise((resolve) => {
      const r = db.transaction('saves').objectStore('saves').get('active');
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    if (raw?.encoding === 'gzip-json-v1')
      raw = await new Response(
        raw.data.stream().pipeThrough(new DecompressionStream('gzip')),
      ).text();
    const state = raw ? JSON.parse(raw) : null;
    return summary && state
      ? {
          season: state.season,
          game: { phase: state.game.phase },
          weekends: state.weekends.map((w: any) => ({
            results: { TL1: w.results.TL1?.map(() => 0) },
          })),
        }
      : state;
  }, summary);
}
test('race decisions survive reload and a practice produces inspectable telemetry', async ({
  page,
}, info) => {
  await page.goto('/fim-de-semana');
  await page.getByLabel('Energia', { exact: true }).selectOption('Save');
  await page.getByLabel('Mapa V8', { exact: true }).selectOption('Economy');
  await page.getByLabel('Regeneração', { exact: true }).selectOption('4');
  await expect.poll(async () => (await read(page))?.game.decisions['lando-norris'].regen).toBe(4);
  await page.reload();
  await expect(page.getByLabel('Energia', { exact: true })).toHaveValue('Save');
  await page.getByRole('button', { name: 'INICIAR SESSÃO · TL1', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar aprendizado dos treinos' }).click();
  await expect
    .poll(async () => (await read(page))?.game.setups['lando-norris'].setsUsed)
    .toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Corrida 2D' }).click();
  await expect(page.getByText(/REPLAY DA SIMULAÇÃO · TL1/)).toBeVisible();
  await expect(page.locator('.race-timing tbody tr')).toHaveCount(32);
  await page.getByLabel('Volta do replay').fill('3');
  await expect(page.locator('.race-laps strong')).toContainText('04');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: `docs/screenshots/career-plan-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
});
test('real contracts, supplier purchase and per-team development persist', async ({
  page,
}, info) => {
  await page.goto('/mercado');
  await page.getByLabel('Salário proposto').fill('100');
  await page.getByRole('button', { name: 'Enviar proposta' }).click();
  await expect(page.getByRole('status')).toContainText('Contrato assinado');
  await expect
    .poll(
      async () =>
        (await read(page))?.game.contracts.filter(
          (c: any) => c.teamId === 'mclaren' && c.salary === 100,
        ).length,
    )
    .toBe(1);
  await page.getByLabel('Fornecedor de Bateria').selectOption('SK On');
  await expect
    .poll(async () => (await read(page))?.game.teams.find((t: any) => t.id === 'mclaren').battery)
    .toBe('SK On');
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: `docs/screenshots/career-market-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.goto('/desenvolvimento');
  const project = page.locator('.development-card').first();
  await project.getByRole('button', { name: 'Iniciar projeto' }).click();
  await expect.poll(async () => (await read(page))?.game.development.length).toBe(1);
  const snapshot = await read(page);
  expect(snapshot.game.finances.mclaren.expenses).toBeGreaterThan(3);
  await page.goto('/configuracoes');
  await page.getByLabel('Equipe em foco').selectOption('bugatti');
  await expect.poll(async () => (await read(page))?.managedTeam).toBe('bugatti');
  await page.goto('/desenvolvimento');
  await expect(
    page.locator('.development-card').first().getByRole('button', { name: 'Iniciar projeto' }),
  ).toBeEnabled();
});
test('interviews affect career state and cannot be answered twice', async ({ page }) => {
  await page.goto('/fim-de-semana');
  for (const session of ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3'])
    await page.getByRole('button', { name: `INICIAR SESSÃO · ${session}`, exact: true }).click();
  await expect.poll(async () => (await read(page))?.game.interviews.length).toBe(1);
  const before = await read(page);
  await page.goto('/temporada');
  await page.getByRole('button', { name: 'Valorizar a equipe' }).click();
  await expect.poll(async () => (await read(page))?.game.interviews[0].answered).toBe(true);
  await expect(page.getByRole('button', { name: 'Valorizar a equipe' })).toHaveCount(0);
  const after = await read(page);
  expect(after.game.reputation['lando-norris']).toBeGreaterThan(
    before.game.reputation['lando-norris'],
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Valorizar a equipe' })).toHaveCount(0);
});
test('full-season save imports, declares champions and opens 2030 with archive', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  let save = createSave(87);
  for (let round = 1; round <= 35; round++) {
    for (let session = 0; session < 8; session++) save = runNextSession(save);
    if (round < 35) save = advanceRound(save);
  }
  await page.goto('/configuracoes');
  await expect(page.getByLabel('Equipe em foco')).toBeEnabled();
  await page.locator('input[type=file]').setInputFiles({
    name: 'complete-2029.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(save)),
  });
  await expect(page.getByRole('status')).toContainText('Save importado');
  await expect.poll(async () => (await read(page, true))?.game.phase).toBe('postseason');
  await page.goto('/temporada');
  await expect(page.getByRole('button', { name: 'Preparar temporada 2030' })).toBeVisible();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: `docs/screenshots/champions-${info.project.name}.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Preparar temporada 2030' }).click();
  await expect.poll(async () => (await read(page, true))?.season).toBe(2030);
  await expect(page.getByText('Arquivo da carreira', { exact: true })).toBeVisible();
  await page.goto('/fim-de-semana');
  await expect(
    page.getByRole('button', { name: 'INICIAR SESSÃO · TL1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'INICIAR SESSÃO · TL1', exact: true }).click();
  await expect
    .poll(async () => (await read(page, true))?.weekends[0]?.results.TL1?.length)
    .toBe(32);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'INICIAR SESSÃO · TL2', exact: true }),
  ).toBeVisible();
});
