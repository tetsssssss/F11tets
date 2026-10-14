/** Seeded race-engine smoke test, deliberately not a real-world balance calibration. */
import { performance } from 'node:perf_hooks';
import { createSave } from '../src/domain/save';
import { createRaceState, stepRaceLap, finishRace } from '../src/domain/simulation/race';
import { scoreRace } from '../src/domain/simulation';
const races = Math.max(1, Math.min(2000, Number(process.argv[2] || 160) || 160));
const laps = Math.max(2, Math.min(160, Number(process.argv[3] || 8) || 8));
const start = performance.now();
const wins = new Map<string, number>();
let dnfs=0, dsqs=0, overtakeEvents=0;
for (let i=0; i<races; i++) {
  const game=createSave(2029+i);
  game.round=1+i%game.game.circuits.length;
  const state=createRaceState(game,'GP',game.game.drivers.map(d=>d.id));
  state.laps=laps;
  let attempts=0;
  while (state.status==='RUNNING' && attempts++<laps+2) stepRaceLap(game,state);
  if (state.status!=='FINISHED') throw Error(`GP ${i} didn't finish`);
  const result=finishRace(game,state);
  const rows=scoreRace(result.results,'GP');
  if (rows.length!==32 || new Set(rows.map(r=>r.driverId)).size!==32) throw Error(`Invalid field at GP ${i}`);
  if (rows.some(r=>!Number.isFinite(r.time) || r.points<0 || r.position<1 || r.position>32)) throw Error(`Invalid result at GP ${i}`);
  if (rows.filter(r=>r.status==='FINISHED').length + rows.filter(r=>r.status==='DNF'||r.status==='DSQ').length!==32) throw Error(`Invalid statuses at GP ${i}`);
  wins.set(rows[0].driverId,(wins.get(rows[0].driverId)||0)+1);
  dnfs += rows.filter(r=>r.status==='DNF').length;
  dsqs += rows.filter(r=>r.status==='DSQ').length;
  overtakeEvents += result.tape.events.filter(e=>e.type==='overtake').length;
  if (i===0) {
    const twin=createSave(2029);
    const twinState=createRaceState(twin,'GP',twin.game.drivers.map(d=>d.id));twinState.laps=laps;
    while(twinState.status==='RUNNING')stepRaceLap(twin,twinState);
    if(JSON.stringify(finishRace(twin,twinState).results)!==JSON.stringify(result.results)) throw Error('Seed replay not deterministic');
  }
}
console.log(JSON.stringify({races,laps,seconds:+((performance.now()-start)/1000).toFixed(2),distinctWinners:wins.size,topWinners:[...wins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),dnfs,dsqs,overtakeEvents,avgOvertakesPerRace:+(overtakeEvents/races).toFixed(2),dnfsPer100Races:+(dnfs/races*100).toFixed(2),winnerConcentration:+(Math.max(...wins.values())/races).toFixed(3),provenance:`synthetic shortened ${laps}-lap GP smoke test, NOT full-distance season simulation`},null,2));
