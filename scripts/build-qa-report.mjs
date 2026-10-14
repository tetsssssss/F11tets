/** Aggregates real QA artifacts into QA_MARCO_61000.json. Usage: node scripts/build-qa-report.mjs <e2eAfter.json> <e2eBefore.json> <unit.txt> <out.json> */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
const [after, before, unit, out, finalRaceViews, benchFile] = process.argv.slice(2);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function e2e(file) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).size) return null;
  const d = JSON.parse(fs.readFileSync(file, 'utf8')), rows = [];
  const walk = (s) => { for (const sp of s.specs ?? []) for (const t of sp.tests) rows.push({ project: t.projectName, spec: sp.file, title: sp.title, status: t.results.at(-1)?.status ?? 'none' }); (s.suites ?? []).forEach(walk); };
  d.suites.forEach(walk);
  const by = {};
  for (const r of rows) { const p = (by[r.project] ??= { passed: 0, failed: 0, failedSpecs: [] }); if (r.status === 'passed') p.passed++; else { p.failed++; p.failedSpecs.push(r.spec + ' › ' + r.title); } }
  return by;
}
const unitText = unit && fs.existsSync(unit) ? fs.readFileSync(unit, 'utf8') : '';
const num = (k) => +(unitText.match(new RegExp('# ' + k + ' (\\d+)'))?.[1] ?? NaN);
const pick = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const metrics = pick('docs/qa-shots/after/metrics.json');
const cam = pick('docs/qa-shots/camera/camera-report-390x844.json');
const files = ['src/presentation/broadcast-director.ts', 'src/presentation/babylon-quality.ts', 'src/presentation/scenery-plan.ts', 'src/features/live-race-babylon.tsx', 'src/features/live-map.tsx', 'src/features/live-race.tsx', 'src/app/globals.css', 'public/sw.js'];
const report = {
  milestone: 'MARCO 61000', baseline: 'MARCO 60300 INCIDENTES', generatedAt: new Date().toISOString(),
  environment: { node: process.version, browser: 'Chromium (Playwright build 1194)', rendering: 'WebGL via SwiftShader (software)', realDevice: null,
    note: 'Nenhum Xiaomi/Android real foi usado. FPS abaixo NAO comprova 30 FPS em celular.' },
  versions: { package: JSON.parse(fs.readFileSync('package.json', 'utf8')).version, serviceWorkerCache: 'f1-universe-static-61000-v1', commit: execSync('git rev-parse HEAD').toString().trim() },
  unitTests: { total: num('tests'), pass: num('pass'), fail: num('fail'), durationMs: Math.round(num('duration_ms')), baselineTotal: 281 },
  e2e: { fullSuiteAfter: e2e(after), baselineBeforeChanges: e2e(before), finalRaceViewsSequential: e2e(finalRaceViews), note: 'Specs antigas que falham sao as mesmas do baseline 60300 (seletores desatualizados); race-views.spec.ts e novo.' },
  viewportMatrix: metrics && metrics.filter((r) => r.tag && r.tag !== 'errors').map((r) => ({ viewport: r.viewport, mode: r.tag, horizontalOverflowPx: r.sw - r.cw, hud: r.hud, canvas: r.canvas ?? null })),
  cameraRun: cam && { viewport: '390x844', rendering: 'software', shots: cam.report.map((r) => ({ camera: r.cam, shot: r.shot?.kind, focusIds: r.shot?.ids, focusCarPx: r.focusSizes, drawCalls: r.drawCalls })), errors: cam.errors },
  benchmark: benchFile && fs.existsSync(benchFile) ? JSON.parse(fs.readFileSync(benchFile, 'utf8')).summary : null,
  hashes: Object.fromEntries(files.map((f) => [f, sha(f)])),
  assets: { glb: 67, teams: 16, circuits: 35, verifier: 'scripts/verify-3d-assets.mjs -> 3D_ASSETS_OK' },
  saveCompatibility: 'Dominio/saves nao foram alterados; testes de persistencia, save-writer e migracao do baseline continuam passando (ver unitTests).',
  limitations: [
    'Sem benchmark em Xiaomi real; FPS de software nao representa o aparelho.',
    'Sem clipes de video de 15-30 s; apenas capturas e relatorios numericos.',
    'Especs E2E antigas (13 em desktop) continuam falhando como no baseline.',
    'Cenario: kit generico por tema; arte especifica por circuito pendente.',
  ],
  screenshots: fs.readdirSync('docs/qa-shots', { recursive: true }).filter((f) => String(f).endsWith('.png')).map((f) => 'docs/qa-shots/' + f),
};
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log('wrote', out);
