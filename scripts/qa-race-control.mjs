import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.F1_TEST_URL || 'http://127.0.0.1:3031/';
const screenshotDir = resolve(process.env.F1_SCREENSHOT_DIR || 'screenshots');
mkdirSync(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const width of [1365, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 850 } });
    const page = await context.newPage();
    const errors = [];
    const glbResponses = [];
    const graphicsWarnings = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().endsWith('.glb')) glbResponses.push(response.status()); });
    page.on('console', message => { if (message.type() === 'warning' && /GLB|Circuito|Modelo/.test(message.text())) graphicsWarnings.push(message.text()); });
    await page.goto(base);
    await page.locator('a[href="/corrida-rapida"]').last().evaluate(link => link.click());
    await page.getByRole('button', { name: 'Iniciar corrida rápida' }).click();
    const hud = page.getByLabel('Central da corrida');
    await hud.waitFor();
    if (width < 600) await hud.getByRole('button', { name: /Ver dados da corrida/ }).click();
    assert.equal(await hud.getByRole('tabpanel').getAttribute('aria-label'), 'MOMENTO');
    await hud.getByRole('tab', { name: 'GAP' }).click();
    const rows = hud.getByRole('tabpanel').locator('tbody tr');
    assert.equal(await rows.count(), 32);
    await rows.nth(10).locator('button').click();
    await hud.getByRole('button', { name: 'Próximos' }).click();
    assert.equal(await rows.count(), 5);
    await hud.getByRole('button', { name: 'Comparar' }).click();
    await hud.getByLabel('Comparar com piloto').selectOption({ index: 2 });
    assert.equal(await rows.count(), 2);
    for (const tab of ['PNEUS', 'VOLTAS', 'POSIÇÕES', 'ESTRATÉGIA', 'CLIMA', 'TELEMETRIA', 'MOMENTO']) {
      await hud.getByRole('tab', { name: tab }).click();
      assert.equal(await hud.getByRole('tabpanel').getAttribute('aria-label'), tab);
      if (tab === 'VOLTAS') assert.ok(!(await hud.innerText()).includes('1000000000'));
    }
    await page.getByRole('button', { name: 'RETOMAR' }).click();
    if (width < 600) {
      const speed = page.getByLabel('Velocidade da corrida no celular');
      await speed.selectOption('0.5');
      await speed.selectOption('0.75');
      await speed.selectOption('16');
    } else {
      for (const label of ['0,50×', '0,75×', '16×']) await page.locator('.hud-pace').getByRole('button', { name: label }).click();
    }
    const before = await page.locator('.hud-lap b').first().innerText();
    await page.waitForTimeout(1800);
    const after = await page.locator('.hud-lap b').first().innerText();
    assert.notEqual(before, after, 'a simulação continua após trocar abas');
    await page.getByRole('button', { name: 'PAUSAR' }).click();
    const frozenLap = await page.locator('.hud-lap b').first().innerText();
    for (const mode of ['2.5D', '3D BABYLON', '2D TÁTICO']) {
      await page.locator('button:visible').filter({ hasText: new RegExp(`^${mode}$`) }).first().click();
      assert.equal(await page.locator('.hud-lap b').first().innerText(), frozenLap, 'trocar o renderizador não reinicia nem avança a corrida pausada');
      if (mode === '2.5D') {
        const scene = page.locator('[data-testid="race-scene-3d"]');
        assert.equal(await scene.locator('.race-3d-car').count(), 32);
        const battleButton = scene.getByRole('button', { name: 'Focar disputa real' });
        await battleButton.waitFor();
        if (width < 600) {
          const settings = scene.getByRole('button', { name: 'Ajustes câmera 2.5D' });
          assert.equal(await settings.count(), 1);
          assert.equal(await settings.getAttribute('aria-expanded'), 'false');
          await settings.click();
          assert.equal(await settings.getAttribute('aria-expanded'), 'true');
          const rotateVisible = await scene.getByRole('button', { name: 'Girar câmera à esquerda' }).evaluate(button => {
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit === button || button.contains(hit);
          });
          assert.ok(rotateVisible, 'controle de câmera 2.5D precisa ficar tocável sobre o mapa mobile');
          await settings.click();
          assert.equal(await settings.getAttribute('aria-expanded'), 'false');
        }
        if (await battleButton.isEnabled()) {
          await battleButton.click();
          assert.equal(await scene.getAttribute('data-camera-view'), 'battle');
          assert.equal(await scene.locator('.iso-battle-ring').count(), 2);
          assert.ok((await scene.locator('.race-3d-tag').count()) <= 3, 'o foco não deve empilhar etiquetas de outros carros');
          const cameraCodes = await scene.locator('.iso-battle-ring').evaluateAll(nodes => nodes.map(node => node.closest('[data-driver]')?.querySelector('title')?.textContent?.split(' · ')[0]));
          const battleCard = await page.locator('.battle-card').innerText();
          assert.ok(cameraCodes.every(code => code && battleCard.includes(code)), 'o cartão de disputa deve identificar os carros enquadrados');
        }
        await page.screenshot({ path: resolve(screenshotDir, `race-60000-iso-${width}.png`) });
        await scene.getByRole('button', { name: 'Mostrar circuito inteiro' }).click();
        assert.equal(await scene.getAttribute('data-camera-view'), 'track');
      }
      if (mode === '3D BABYLON') {
        await page.waitForTimeout(6500);
        await page.screenshot({ path: resolve(screenshotDir, `race-60000-3d-${width}.png`) });
        const camera = page.getByLabel('Câmera Babylon');
        await camera.selectOption('duelo');
        assert.equal(await camera.inputValue(), 'duelo');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: resolve(screenshotDir, `race-60000-duelo-${width}.png`) });
      }
    }
    await page.screenshot({ path: resolve(screenshotDir, `race-60000-2d-${width}.png`) });
    assert.deepEqual(errors, []);
    assert.ok(glbResponses.length > 0 && glbResponses.every(status => status === 200), 'GLB de carros e pista devem responder HTTP 200');
    assert.equal(graphicsWarnings.length, 0, `GLB carregados não devem cair no fallback: ${graphicsWarnings[0] || ''}`);
    console.log(`${width}px: GAP 3 filtros, 8 abas, velocidades e 3 modos; volta ${before} → ${after}; GLB ${glbResponses.length} respostas (${glbResponses.filter(status => status === 200).length} HTTP 200), avisos gráficos ${graphicsWarnings.length}; sem erro JS`);
    await context.close();
  }
} finally {
  await browser.close();
}
