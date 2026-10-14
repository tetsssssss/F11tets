/**
 * Alternative static build for disconnected environments. This is NOT a Vite build.
 * Uses a previously working F1 static package as vendor/asset base and transpiles
 * every current source module with global TypeScript, preserving unchanged photos.
 * Usage: F1_BASELINE_STATIC=/path/previous-netlify.zip node scripts/build-offline.mjs /path/output
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
let ts;
try{ts=require(process.env.TYPESCRIPT_PATH || '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');}
catch{ts=require('typescript');}
const root=path.resolve(import.meta.dirname,'..');
const destination=path.resolve(process.argv[2] || path.join(root,'dist-offline'));
const baseline=process.env.F1_BASELINE_STATIC;
if(!baseline || !fs.existsSync(baseline))throw Error('Specify F1_BASELINE_STATIC pointing to a proven static ZIP');
if(path.relative(root,destination)==='' || destination===root)throw Error('Output cannot overwrite source');
fs.mkdirSync(destination,{recursive:true});
const unzip=spawnSync('unzip',['-oq',baseline,'-d',destination],{encoding:'utf8'});
if(unzip.status!==0)throw Error('Unable to unpack baseline: '+unzip.stderr);
const modules={};
function walk(abs){
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
    const full=path.join(abs,entry.name);
    if(entry.isDirectory())walk(full);
    else if(/\.tsx?$/.test(full)){
      const rel=path.relative(root,full).replaceAll('\\','/');
      const compiled=ts.transpileModule(fs.readFileSync(full,'utf8'),{
        fileName:rel,reportDiagnostics:true,
        compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}
      });
      if(compiled.diagnostics?.length)throw Error('Compiler diagnostics for '+rel+': '+compiled.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(','));
      modules[rel]=compiled.outputText;
    } else if(full.endsWith('.json')){
      const rel=path.relative(root,full).replaceAll('\\','/');
      modules[rel]='module.exports='+fs.readFileSync(full,'utf8')+';';
    }
  }
}
walk(path.join(root,'src'));walk(path.join(root,'netlify'));
const loader=`\nconst __cache=Object.create(null);
function __resolve(from,id){
 if(id==='react')return '@react'; if(id==='react/jsx-runtime')return '@jsx'; if(id==='react-dom/client')return '@dom'; if(id==='lucide-react')return '@lucide';
 if(id==='next/link')return 'netlify/link.tsx';if(id==='next/navigation')return 'netlify/navigation.ts';if(id==='next/dynamic')return 'netlify/dynamic.tsx';
 if(id.endsWith('.css')||id.startsWith('@fontsource/'))return '@css';
 if(!id.startsWith('.'))throw new Error('Modulo nao suportado: '+id+' importado por '+from);
 let base=new URL(id,'https://local/'+from), p=decodeURI(base.pathname).slice(1);
 for(const candidate of [p,p+'.ts',p+'.tsx',p+'.js',p+'.json',p+'/index.ts',p+'/index.tsx'])if(Object.hasOwn(__sources,candidate))return candidate;
 throw new Error('Modulo indisponivel: '+id+' de '+from+' -> '+p);
}
function __load(id){
 if(id==='@react')return globalThis.__F1React; if(id==='@jsx')return globalThis.__F1JSX; if(id==='@dom')return globalThis.__F1ReactDom; if(id==='@lucide')return globalThis.__F1Lucide; if(id==='@css')return {};
 if(__cache[id])return __cache[id].exports; let factory=__sources[id];if(!factory)throw Error('Modulo ausente: '+id);
 let mod={exports:{}};__cache[id]=mod;try{factory((name)=>__load(__resolve(id,name)),mod,mod.exports)}catch(e){delete __cache[id];throw e;}return mod.exports;
}
try{__load('netlify/main.tsx')}catch(error){console.error('F1 boot error',error);document.getElementById('root').innerHTML='<div style="padding:40px;font:16px Arial;color:white"><h2>Erro na inicializacao</h2><pre style="white-space:pre-wrap"></pre></div>';document.querySelector('#root pre').textContent=error.stack||String(error);}
`;
const text=['// Alternative disconnected build: source from MARCO 50000; vendor from MARCO 13000.',
 'const __sources={',...Object.entries(modules).map(([id,js])=>JSON.stringify(id)+':function(require,module,exports){\n'+js+'\n},'),'};',loader].join('\n');
const assets=path.join(destination,'assets');
for(const f of ['latest-app.js','vendor-runtime.js','index-fixed-1edc24a1.css']){
  if(!fs.existsSync(path.join(assets,f)))throw Error('Missing baseline asset: '+f);
}
fs.writeFileSync(path.join(assets,'latest-app.js'),text);
const css=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import\s+['"]tailwindcss['"];?\s*/m,'');
fs.writeFileSync(path.join(assets,'source-updates.css'),css);
const html=fs.readFileSync(path.join(destination,'index.html'),'utf8').replace('Marco 50.000','Marco 50.000 · Sonoplastia').replace('Marco 13.000','Marco 50.000 · Sonoplastia');
fs.writeFileSync(path.join(destination,'index.html'),html);
fs.writeFileSync(path.join(destination,'BUILD_INFO_50000.md'),`# F1 Universe Marco 50.000 - Sonoplastia\n\nOffline alternative compile of ${Object.keys(modules).length} source modules. Uses vendor runtime/styles and media from Marco 13.000. Not an official Vite/Next build.\n`);
const check=spawnSync(process.execPath,['--check',path.join(assets,'latest-app.js')],{encoding:'utf8'});
if(check.status!==0)throw Error('Built script failed syntax: '+check.stderr);
console.log(`OFFLINE_BUILD_OK modules=${Object.keys(modules).length} bytes=${Buffer.byteLength(text)} directory=${destination}`);
