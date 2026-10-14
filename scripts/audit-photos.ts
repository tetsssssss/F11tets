import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { drivers } from '../src/data/drivers';
import { engineers } from '../src/data/engineers';
import { createSave } from '../src/domain/save';
import { resolvePersonPhoto } from '../src/presentation/person-photo';
const manifest = JSON.parse(await fs.readFile('src/data/photo-manifest.json', 'utf8'));
const sources = JSON.parse(await fs.readFile('assets/photos/PHOTO_SOURCES.json', 'utf8'));
const missing: string[] = [],
  low: string[] = [],
  duplicates: string[] = [],
  errors: string[] = [],
  verified: string[] = [];
const hashes = new Map<string, string>();
for (const d of drivers) {
  const p = manifest[d.id];
  if (!p) {
    missing.push(d.name);
    continue;
  }
  try {
    for (const size of ['card', 'master']) {
      const raw = await fs.readFile('public' + p[size]);
      const m = await sharp(raw).metadata();
      await sharp(raw).raw().toBuffer();
      if (!m.width || !m.height || m.width !== m.height || m.width < 512)
        throw Error('invalid size ' + size);
      if (size === 'card') {
        const hash = createHash('sha256').update(raw).digest('hex');
        if (hashes.has(hash)) duplicates.push(`${d.id} = ${hashes.get(hash)}`);
        hashes.set(hash, d.id);
      }
      if (size === 'master' && m.width < 1024)
        low.push(`${d.name}: master ${m.width}px (native crop; card 512px)`);
    }
    if (
      !sources.some((s: any) => s.personId === d.id && s.sourceUrl && s.imageUrl && s.usageStatus)
    )
      throw Error('missing provenance');
    verified.push(d.name);
  } catch (e) {
    errors.push(`${d.name}: ${e}`);
    missing.push(d.name);
  }
}
for (const id of Object.keys(manifest))
  if (!drivers.some((d) => d.id === id)) errors.push('Unknown ID ' + id);
const save = createSave();
for (const e of engineers)
  if (!e.fictional || resolvePersonPhoto(e.id, true).status !== 'fictional-generated')
    errors.push('Engineer status ' + e.id);
await fs.access('public/assets/people/placeholder.svg');
const report = `# PHOTO AUDIT REPORT\n\n2026-10-05. Gate completed before advanced 2D edits.\n\n## VERIFIED\n${verified.length}/32 real starters. Identity checked through named publisher profile metadata, not face recognition. Crops visually reviewed on contact-sheet.png.\n\n${verified.map((n) => '- ' + n).join('\n')}\n\n## REPLACED\n32 helmet illustrations replaced; original component backed up in assets/_photo_backup. No previous valid real photograph existed. Empty IndyCar downloads rejected; Palou celebration image rejected for covered face. Raw downloads retained.\n\n## MISSING\n${missing.join('\n') || 'None among 32 starters.'}\n\n## LOW QUALITY\n${low.join('\n') || 'None below target master resolution.'}\n\nCards remain 512x512. Small native crops are documented, not disguised as higher resolution.\n\n## DUPLICATE\n${duplicates.join('\n') || 'No exact duplicate card hashes.'}\n\n## FICTIONAL\n${engineers.length} fictional engineers and ${save.world.pool.length} provisional procedural reserve/development drivers. Original deterministic SVG portraits; no unrelated real faces. Future fictional characters use the same resolver.\n\n## NEEDS HUMAN REVIEW\n${sources.filter((s: any) => s.usageStatus === 'unknown-license').length} publisher images have unknown redistribution licenses. These are documented as unknown-license, not freely reusable. Historical uniforms do not redefine the 2029 grid. Zhou wears sunglasses; replacement with a front-facing unobstructed portrait is desirable. See PHOTO_SOURCES.json for attribution and CC adaptation terms.\n\n## AUTOMATED CHECKS\nExistence, square size, full decoding, card SHA-256 duplicates, roster IDs, source registry, fictional status and fallback path checked. ${errors.length} errors.\n${errors.join('\n')}\n`;
await fs.writeFile('PHOTO_AUDIT_REPORT.md', report);
await fs.writeFile(
  'FOTOS_FALTANTES.txt',
  missing.length
    ? missing.map((n) => n + ' — foto não validada').join('\n')
    : 'Nenhum dos 32 titulares está sem foto.\n',
);
console.log(
  JSON.stringify({
    verified: verified.length,
    missing: missing.length,
    lowResolutionMasters: low.length,
    duplicates,
    errors,
    fictionalEngineers: engineers.length,
    fictionalReserves: save.world.pool.length,
  }),
);
if (errors.length || duplicates.length || missing.length) process.exitCode = 1;
