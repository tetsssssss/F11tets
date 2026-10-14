/** Offline domain test runner. Requires only a global TypeScript compiler and Node 22.
 * Runs the project's real node:test suites from a temporary CommonJS transpilation;
 * does not bundle Next.js or replace E2E/browser tests. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const tsPath = process.env.TYPESCRIPT_PATH || '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript';
let ts;
try { ts = require(tsPath); }
catch { try { ts = require('typescript'); } catch { throw new Error('Requires TypeScript installed globally or TYPESCRIPT_PATH'); } }
const root = path.resolve(import.meta.dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-qa-'));
const selected = process.argv.slice(2);
function collect(rel) {
  const src = path.join(root, rel), stat = fs.statSync(src);
  if (stat.isDirectory()) return fs.readdirSync(src).flatMap(name => collect(path.join(rel, name)));
  if (!/\.(tsx?|json)$/.test(rel)) return [];
  const dest = path.join(output, rel.replace(/\.tsx?$/, '.js'));
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  if (rel.endsWith('.json')) fs.copyFileSync(src, dest);
  else {
    const contents=fs.readFileSync(src,'utf8');
    const compiled = ts.transpileModule(contents, {fileName: rel, compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true, resolveJsonModule:true}});
    fs.writeFileSync(dest, compiled.outputText);
  }
  return [dest];
}
try {
  collect('src');
  try { fs.symlinkSync(path.join(root, 'public'), path.join(output, 'public'), 'dir'); }
  catch { fs.cpSync(path.join(root, 'public'), path.join(output, 'public'), {recursive:true}); }
  const files = collect('tests').filter(f => f.endsWith('.test.js'));
  const tests = selected.length ? files.filter(f => selected.some(s => path.basename(f).includes(s))) : files;
  if (!tests.length) throw Error('No matching tests');
  // Some suites exercise React browser components and require npm; these are not domain tests.
  const proc=spawnSync(process.execPath,['--test',...tests],{cwd:output,encoding:'utf8',maxBuffer:12*1024*1024, timeout:process.env.QA_TIMEOUT?Number(process.env.QA_TIMEOUT):180000});
  process.stdout.write(proc.stdout || '');process.stderr.write(proc.stderr || '');
  if (proc.error) console.error(proc.error.message);
  process.exitCode = proc.status ?? 1;
} finally {fs.rmSync(output, {recursive:true,force:true});}
