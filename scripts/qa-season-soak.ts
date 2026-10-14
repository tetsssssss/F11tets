/** Genuine season transitions with the existing motor, no UI or fabricated standings. */
import { performance } from 'node:perf_hooks';
import { createSave, parseSave } from '../src/domain/save';
import { runNextSession, nextSession, advanceRound } from '../src/domain/simulation';
import { prepareNextSeason } from '../src/domain/simulation/management';
const seasons=Math.max(1,Math.min(10,Number(process.argv[2]||1)||1));
let s=createSave(2029);
s.world.settings.telemetry='summary';
const start=performance.now();
let sessions=0,gps=0;
for(let year=0;year<seasons;year++){
  const started=s.season;
  for(let round=1;round<=s.game.circuits.length;round++){
    if(s.round!==round) throw Error(`Round mismatch ${s.round} vs ${round}`);
    let count=0;
    while(nextSession(s)){
      const prior=s;
      s=runNextSession(s);sessions++;count++;
      if(prior===s||count>8) throw Error(`Stalled session at ${started} GP${round}`);
    }
    if(!s.weekends.find(w=>w.round===round)?.results.GP)throw Error(`Missing GP ${started}:${round}`);
    gps++;s=advanceRound(s);
  }
  if(s.game.phase!=='postseason')throw Error(`Missing postseason ${started}`);
  s=prepareNextSeason(s);
  if(s.season!==started+1||s.game.history.length!==year+1)throw Error(`Season transition failed ${started}`);
  const json=JSON.stringify(s);
  const restored=parseSave(json);
  if(!restored)throw Error(`Save failed roundtrip after season ${started} (${json.length} characters)`);
  s=restored;
  console.log(`SEASON_OK=${started} sessions=${sessions} gps=${gps} archive=${s.game.history.length} size_bytes=${Buffer.byteLength(json)}`);
}
console.log(`FINISHED seasons=${seasons} sessions=${sessions} gps=${gps} years_archived=${s.game.history.length} seconds=${((performance.now()-start)/1000).toFixed(2)}`);
