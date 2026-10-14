import { mkdir, writeFile } from 'node:fs/promises';
import { exportUniverse } from '../src/domain/export';
const universe = exportUniverse();
await mkdir('exports/unreal', { recursive: true });
for (const [name, data] of Object.entries(universe))
  await writeFile(`exports/unreal/${name}.json`, JSON.stringify(data, null, 2) + '\n');
console.log(`Exported ${Object.keys(universe).length} JSON files to exports/unreal/`);
