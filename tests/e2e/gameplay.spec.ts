import { test, expect, type Page } from '@playwright/test';
async function state(page: Page, slot?: number) {
  return page.evaluate(async (slot) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('f1-universe-career', 1);
      r.onsuccess = () => resolve(r.result);
    });
    let raw: any = await new Promise((resolve) => {
      const r = db
        .transaction('saves')
        .objectStore('saves')
        .get(slot ? 'slot-' + slot : 'active');
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    if (raw?.encoding === 'gzip-json-v1')
      raw = await new Response(
        raw.data.stream().pipeThrough(new DecompressionStream('gzip')),
      ).text();
    return raw ? JSON.parse(raw) : null;
  }, slot);
}
async function start(page: Page, mode: string, slot = 2) {
  await page.goto('/novo-jogo?modo=' + mode);
  await page.getByLabel('Slot do novo jogo').selectOption(String(slot));
  await page.getByRole('button', { name: 'INICIAR CARREIRA 2029', exact: true }).click();
  await expect(page).toHaveURL(/temporada/);
  await page.goto('/fim-de-semana');
  for (const s of ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3'])
    await page.getByRole('button', { name: 'INICIAR SESSÃO · ' + s, exact: true }).click();
  await page.getByRole('button', { name: 'INICIAR SESSÃO · Sprint', exact: true }).click();
  await expect(page.locator('.live-car')).toHaveCount(32);
}
async function finish(page: Page) {
  await page.getByLabel('Eventos críticos').selectOption('off');
  await page.getByRole('button', { name: '16×', exact: true }).click();
  await page.getByRole('button', { name: 'RETOMAR', exact: true }).click();
  await page.getByRole('button', { name: 'Ver resultado e continuar' }).click({ timeout: 60000 });
}
for (const mode of ['piloto', 'construtor'])
  test(
    mode + ' plays a full weekend with commands, radio, pit, reload and persistent points',
    async ({ page }, info) => {
      test.setTimeout(120000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, mode);
      await expect(page.locator('.command-card')).toHaveCount(mode === 'piloto' ? 1 : 2);
      const first = page.locator('.command-card').first();
      await first.getByRole('button', { name: 'ATAQUE', exact: true }).click();
      if (mode === 'construtor')
        await page
          .locator('.command-card')
          .nth(1)
          .getByRole('button', { name: 'DEFESA', exact: true })
          .click();
      await first.getByRole('button', { name: 'RÁDIO', exact: true }).click();
      await first.getByRole('button', { name: 'Como está a bateria?', exact: true }).click();
      await expect(first.locator('.radio-transcript')).toContainText('Carga em');
      await first.getByRole('button', { name: 'PIT', exact: true }).click();
      await first.getByRole('button', { name: 'Próxima volta', exact: true }).click();
      await expect(first).toContainText('Confirmado: volta 2');
      await expect
        .poll(async () => Object.keys((await state(page))?.race?.pitCalls ?? {}).length)
        .toBe(1);
      const before = await state(page);
      await page.reload();
      await expect(page.locator('.live-car')).toHaveCount(32);
      await expect.poll(async () => (await state(page))?.race?.lap).toBe(before.race.lap);
      expect((await state(page)).race.pitCalls).toEqual(before.race.pitCalls);
      await page.getByRole('button', { name: 'Próximo setor', exact: true }).click();
      await page.getByRole('button', { name: 'Próximo setor', exact: true }).click();
      await page.getByRole('button', { name: 'Próximo setor', exact: true }).click();
      await expect.poll(async () => (await state(page))?.race?.lap).toBe(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: 'docs/screenshots/live-' + mode + '-' + info.project.name + '.png',
        fullPage: true,
        scale: 'css',
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await finish(page);
      await expect(
        page.getByRole('button', { name: 'INICIAR SESSÃO · GP', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'INICIAR SESSÃO · GP', exact: true }).click();
      await finish(page);
      await expect.poll(async () => (await state(page))?.weekends[0]?.results.GP?.length).toBe(32);
      const points = (await state(page)).driverPoints;
      await page.reload();
      await expect(page.getByRole('button', { name: 'Avançar para o próximo GP' })).toBeVisible();
      expect((await state(page)).driverPoints).toEqual(points);
      await page.goto('/classificacao');
      await expect(page.locator('h1')).toBeVisible();
      await page.goto('/configuracoes');
      await expect(page.getByLabel('Equipe em foco')).toBeDisabled();
      await expect(page.locator('.save-slots article')).toHaveCount(3);
      await page.getByRole('button', { name: 'Carregar slot 1', exact: true }).click();
      await expect.poll(async () => (await state(page))?.career.started).toBe(false);
      await expect.poll(async () => (await state(page, 2))?.driverPoints).toEqual(points);
      await page.getByRole('button', { name: 'Carregar slot 2', exact: true }).click();
      await expect.poll(async () => (await state(page))?.driverPoints).toEqual(points);
      expect(errors).toEqual([]);
    },
  );
test('braking activates only in a valid battle and developer events stay visible', async ({
  page,
}) => {
  await start(page, 'piloto');
  await expect(page.getByRole('button', { name: 'FREADA', exact: true })).toBeDisabled();
  await page.goto('/dev');
  await page.getByRole('button', { name: 'Criar batalha de freada', exact: true }).click();
  await page.getByRole('link', { name: 'Voltar para a pista' }).click();
  await expect(page.getByRole('button', { name: 'FREADA', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'FREADA', exact: true }).click();
  await expect
    .poll(async () => (await state(page))?.race?.commands['lando-norris'].kind)
    .toBe('BRAKING_ATTACK');
  await page.goto('/dev');
  await page.getByRole('button', { name: 'Safety Car', exact: true }).click();
  await page.getByRole('link', { name: 'Voltar para a pista' }).click();
  await expect(page.getByRole('button', { name: 'FREADA', exact: true })).toBeDisabled();
  await expect(page.locator('.live-header')).toContainText('DEV FIXTURE');
  await page.getByRole('button', { name: '3D LEVE', exact: true }).click();
  await expect(page.locator('.map-perspective .live-car')).toHaveCount(32);
});
