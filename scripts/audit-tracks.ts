import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSave} from '../src/domain/save';
import {circuitGeometry} from '../src/presentation/circuit-geometry';
const tracks=createSave().game.circuits.map(c=>({c,g:circuitGeometry(c)}));
if(new Set(tracks.map(t=>t.g.path)).size!==35)throw Error('Track duplication');
await fs.writeFile('TRACK_2D_AUDIT.md','# TRACK 2D AUDIT\n\n06/10/2026. 35 geometrias distintas, todas provisórias. Nenhuma é um mapa oficial medido.\n\nCenterline, linha de largada, três setores, entrada/saída/box, zonas de freada e ultrapassagem presentes. Sem DRS. O adaptador retorna coordenadas novas e não altera a geometria. Substituir por paths medidos mantendo o contrato Track2DGeometry.\n\n| ID | Circuito | Status | Assinatura do path |\n|---|---|---|---|\n'+tracks.map(({c,g})=>`| ${c.id} | ${c.name} | ${g.geometryStatus} | ${createHash('sha256').update(g.path).digest('hex').slice(0,12)} |`).join('\n')+'\n');
console.log('35/35 unique provisional tracks');
