import { test, expect } from '@playwright/test';
test('career hub, presets, participation and highlights persist in the save', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/novo-jogo?modo=piloto');
  await page.getByLabel('Slot do novo jogo').selectOption('2');
  const presets = page.getByRole('group', { name: 'Preset de dificuldade' });
  await presets.getByRole('button', { name: 'CASUAL', exact: true }).click();
  await page
    .getByRole('group', { name: 'Distância da corrida' })
    .getByRole('button', { name: '50%', exact: true })
    .click();
  await page.getByRole('button', { name: 'Quero gerenciar e simular mais' }).click();
  await page.getByRole('button', { name: 'INICIAR CARREIRA 2029', exact: true }).click();
  await expect(page).toHaveURL(/temporada/);

  // The hub is the career's front page: identity, standing and the one main action.
  const hub = page.getByRole('region', { name: 'Central da carreira' });
  await expect(hub).toContainText('Lando Norris');
  await expect(hub).toContainText('ROUND 01/35');
  await expect(hub).toContainText('SIMULAR TREINOS');
  await expect(hub.getByRole('link', { name: /INICIAR FIM DE SEMANA/ })).toBeVisible();
  await expect(hub.locator('.hub-faces img')).toHaveCount(1);
  await expect(
    hub.getByRole('navigation', { name: 'Menu da carreira' }).getByRole('link'),
  ).toHaveCount(9);
  await page.screenshot({ path: info.outputPath('career-hub.png'), fullPage: false });

  await hub.getByRole('link', { name: /Configurações da carreira/ }).click();
  await expect(page).toHaveURL(/carreira/);
  await expect(presets.getByRole('button', { name: 'CASUAL', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Participação: GP').selectOption('highlights');
  await page.getByLabel('Desgaste dos pneus').fill('120');
  await expect(presets.getByRole('button', { name: 'CUSTOM', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('CARREIRA PERSONALIZADA · SALVO')).toBeVisible();
  await page.screenshot({ path: info.outputPath('career-settings.png'), fullPage: true });
  await page.reload();
  await expect(page.getByLabel('Participação: GP')).toHaveValue('highlights');
  await expect(page.getByLabel('Desgaste dos pneus')).toHaveValue('120');
  await expect(
    page.getByRole('group', { name: 'Distância da corrida' }).getByRole('button', { name: '50%' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Estatísticas da carreira')).toBeVisible();

  // One click simulates the three practices; qualifying and the sprint are instant results.
  await page.goto('/fim-de-semana');
  await page.getByRole('button', { name: 'INICIAR SESSÃO · TL1', exact: true }).click();
  for (const s of ['Q1', 'Q2', 'Q3', 'Sprint'])
    await page.getByRole('button', { name: 'INICIAR SESSÃO · ' + s, exact: true }).click();
  await page.getByRole('button', { name: 'INICIAR SESSÃO · GP', exact: true }).click();
  // Highlights: the real race, shown at automatic pace, half distance.
  await expect(page.locator('.live-car')).toHaveCount(32);
  await expect(
    page.getByRole('button', { name: 'HIGHLIGHTS', exact: true }).first(),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.live-header')).toContainText('/29');
  await expect(page.getByLabel('Recomendação do engenheiro')).toBeVisible();
  await page.getByLabel('Eventos críticos').selectOption('off');
  await page.getByRole('button', { name: 'RETOMAR', exact: true }).click();
  await page.getByRole('button', { name: 'Ver resultado e continuar' }).click({ timeout: 120000 });
  await page.goto('/temporada');
  await expect(hub).toContainText('FECHAR FIM DE SEMANA');
  await expect(hub.locator('.hub-form span')).toHaveCount(1);
  expect(errors).toEqual([]);
});
