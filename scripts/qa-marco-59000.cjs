const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const race=read('src/features/live-race.tsx'),hud=read('src/features/race-control.tsx'),css=read('src/app/globals.css'),manifest=JSON.parse(read('public/manifest.webmanifest'));
const checks=[
 ['HUD integrated into the real race',race.includes('import { RaceControl }') && race.includes('race={r}')],
 ['Race panels are all present',['MOMENTO','GAP','PNEUS','VOLTAS','POSIÇÕES','ESTRATÉGIA','CLIMA','TELEMETRIA'].every(x=>hud.includes(x))],
 ['HUD reads simulation frames/events',hud.includes('race.events') && hud.includes('race.frames.at(-1)') && hud.includes('race.cars')],
 ['HUD never writes simulation state',!hud.includes('tickLive') && !hud.includes('cloneState')],
 ['No fake speed values',hud.includes('Velocidade instantânea') && hud.includes('Não disponível')],
 ['Mobile touch tabs and expandable panel',css.includes('min-height:44px') && hud.includes('aria-expanded={open}')],
 ['PWA metadata',manifest.display==='standalone'&&manifest.start_url==='/'&&manifest.icons.length===2],
 ['Service worker source',read('public/sw.js').includes('f1-universe-static-59000') && !read('public/sw.js').includes('POST')],
 ['Slow pace controls',race.includes('0.5, 0.75, 1, 2, 4, 8, 16')],
 ['Graphics preservation',race.includes("selectView('iso')") && race.includes("selectView('babylon')") && race.includes("selectView('2d')")],
];for(const [name,pass] of checks){console.log((pass?'PASS':'FAIL')+' '+name);assert(pass,name)}console.log('MARCO_59000_STATIC_CHECKS_OK',checks.length);
