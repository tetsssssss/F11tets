const fs = require('fs'); const path = require('path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root=process.argv[2],output=process.argv[3]; fs.mkdirSync(output,{recursive:true});
const moduleCache=new Map();
function load(rel){if(moduleCache.has(rel))return moduleCache.get(rel);
 const source=fs.readFileSync(path.join(root,rel),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const obj={exports:{}};moduleCache.set(rel,obj.exports);
 const req=(name)=>{
  let p=path.posix.normalize(path.posix.join(path.posix.dirname(rel),name)); if(!p.endsWith('.ts'))p+='.ts';
  return load(p);
 };
 new Function('exports','require','module',code)(obj.exports,req,obj);moduleCache.set(rel,obj.exports);return obj.exports;
}
const {circuits}=load('src/data/circuits.ts');const {circuitGeometry,trackBounds}=load('src/presentation/circuit-geometry.ts');
const all=[];
for(const c of circuits){const geo=circuitGeometry(c);const b=trackBounds(geo,30);const data={id:c.id,name:c.name,country:c.country,city:c.city,geometryStatus:geo.geometryStatus,widthFactor:1.15,source:'src/presentation/circuit-geometry.ts',bounds:{cx:b.cx,cy:b.cy},points:geo.points.map(p=>[Number(((p.x-b.cx)*.105).toFixed(5)), Number(((p.y-b.cy)*.105).toFixed(5))]),pitLane:geo.pitLane.map(p=>[Number(((p.x-b.cx)*.105).toFixed(5)), Number(((p.y-b.cy)*.105).toFixed(5))])};fs.writeFileSync(path.join(output,c.id+'.json'),JSON.stringify(data));all.push({id:c.id,name:c.name,geometryStatus:data.geometryStatus,points:data.points.length})};
fs.writeFileSync(path.join(output,'index.json'),JSON.stringify(all,null,2));console.log('EXPORTED_MAPS',all.length);
