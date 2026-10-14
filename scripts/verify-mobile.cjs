/* Static contract checks for mobile navigation and race cockpit; no browser required. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const race=read('src/features/live-race.tsx');
const map=read('src/features/live-map.tsx');
const shell=read('src/components/shell.tsx');
const css=read('src/app/globals.css');
const checks=[
 ['mobile race render switches',/race-mobile-views/.test(race)&&/selectView\('2d'\)/.test(race)&&/selectView\('iso'\)/.test(race)&&/selectView\('babylon'\)/.test(race)],
 ['speed remains tied to existing simulation pace',/mobile-speed-control/.test(race)&&/pace\(event.target.value/.test(race)],
 ['mobile touch bottom navigation',/mobile-quick-nav/.test(shell)&&/Abrir menu completo/.test(shell)],
 ['bottom menu excluded from races',/main-shell:has\(\.race-hud\) \.mobile-quick-nav/.test(css)],
 ['default mobile performance profile',/setBabylonQuality\('baixo'\)/.test(map)],
 ['responsive touch target',/min-height: 43px/.test(css)&&/race-mobile-views/.test(css)],
 ['non-destructive 3D fallback',/graphicsFallback/.test(race)&&/writeRaceViewMode\('2d'\)/.test(race)],
 ];
for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);assert.ok(ok,name)}
console.log('MOBILE_STATIC_CHECKS_OK',checks.length);
