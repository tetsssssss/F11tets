import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const drivers = JSON.parse(await readFile('exports/unreal/drivers.json', 'utf8'));
const teams = JSON.parse(await readFile('exports/unreal/teams.json', 'utf8'));
const engineers = JSON.parse(await readFile('exports/unreal/engineers.json', 'utf8'));
const routes = [
  '/',
  '/temporada',
  '/fim-de-semana',
  '/pilotos',
  '/equipes',
  '/construtores',
  '/engenheiros',
  '/desenvolvimento',
  '/mercado',
  '/classificacao',
  '/calendario',
  '/estatisticas',
  '/regulamento',
  '/configuracoes',
  '/novo-jogo',
  '/dev',
  ...drivers.map((d) => '/pilotos/' + d.id),
  ...teams.map((t) => '/equipes/' + t.id),
  ...engineers.map((e) => '/engenheiros/' + e.id),
];
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const checked = [];
page.on('pageerror', (e) => errors.push({ url: page.url(), error: e.message }));
for (const route of routes) {
  const response = await page.goto('http://127.0.0.1:3029' + route);
  await page.locator('h1').waitFor();
  checked.push({ route, status: response.status() });
  if (response.status() !== 200) errors.push({ route, status: response.status() });
}
await browser.close();
const report = { date: new Date().toISOString(), routes: checked.length, errors, checked };
await writeFile('docs/final-route-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ routes: checked.length, errors }));
if (errors.length) process.exitCode = 1;
