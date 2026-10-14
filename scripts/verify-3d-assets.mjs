/** No dependencies: validates the GLB archives and their mapping to the game assets. */
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),asset=path.join(root,'public/assets/f1-3d');
const teamIds=['mclaren','ferrari','mercedes','redbull','williams','haas','audi','alpine','aston','cadillac','hyundai','kia','byd','porsche','jaguar','bugatti'];
function checkGlb(filename){let b=fs.readFileSync(filename);if(b.toString('ascii',0,4)!=='glTF')throw Error('GLB inválido '+filename);if(b.readUInt32LE(8)!==b.length)throw Error('Tamanho GLB inválido '+filename);}
let count=0;
for(const team of teamIds)for(const level of ['mobile','high']){checkGlb(path.join(asset,'cars',`${team}_${level}.glb`));count++}
for(let i=1;i<=35;i++){let name=`gp-${i}`;checkGlb(path.join(asset,'tracks',name+'.glb'));const map=JSON.parse(fs.readFileSync(path.join(root,'tools/circuit-maps',name+'.json')));if(map.geometryStatus!=='provisional'||map.widthFactor!==1.15||map.points.length<200)throw Error('Invalid map '+name);count++}
console.log(`3D_ASSETS_OK glb=${count} teams=${teamIds.length} circuits=35 visualWidthFactor=1.15`);
