import type { FeederEvent, FeederFinish } from '../domain/universe/formula-two';
import { seedFor, rng } from '../domain/simulation/random';

/**
 * A presentation-only reconstruction of an already finished F2/F3 event.
 * This is deliberately NOT historical lap telemetry and must never affect the
 * save, championship, points or qualifying grid. The finish always matches
 * the simulator's recorded result exactly.
 */
export type FeederReplayEntry = {
  driverId: string;
  position: number;
  grid: number;
  dnf: boolean;
  moved: number;
};
export type FeederReplayFrame = {
  lap: number;
  totalLaps: number;
  running: FeederReplayEntry[];
  retired: FeederReplayEntry[];
  leader: string | null;
  changes: string[];
};

export function feederReplay(
  event: FeederEvent,
  session: 'sprint' | 'feature',
  seed: number,
  season: number,
  category: 'F2' | 'F3',
  lapCount = session === 'sprint' ? 14 : 24,
): FeederReplayFrame[] {
  if (!Number.isInteger(lapCount) || lapCount < 2 || lapCount > 200) throw new RangeError('Invalid replay length');
  const results = event[session];
  if (!results.length) return [];
  if (new Set(results.map((r) => r.driverId)).size !== results.length ||
      results.some((r) => !Number.isInteger(r.grid) || r.grid < 1 || !Number.isInteger(r.position) || r.position < 1)) {
    throw new Error('Invalid feeder race classification');
  }
  const final = [...results].sort((a,b) => a.position-b.position || a.driverId.localeCompare(b.driverId));
  const grid = [...results].sort((a,b) => a.grid-b.grid || a.driverId.localeCompare(b.driverId));
  const startIndex = new Map(grid.map((d,index)=>[d.driverId,index]));
  const finishIndex = new Map(final.map((d,index)=>[d.driverId,index]));
  const retireAt = new Map(results.filter((r)=>r.dnf).map((r)=>{
    const random = rng(seedFor(seed,season,category,event.round,session,r.driverId,'replay-retire'))();
    return [r.driverId,Math.max(1,Math.min(lapCount-1,Math.floor(lapCount*(.2+random*.68))))] as const;
  }));
  const frames: FeederReplayFrame[] = [];
  for(let lap=0;lap<=lapCount;lap++){
    const finished = lap===lapCount;
    const progress = lap/lapCount;
    const active = grid.filter((r)=>!retireAt.has(r.driverId) || lap < retireAt.get(r.driverId)!);
    const retired = grid.filter((r)=>retireAt.has(r.driverId) && lap>=retireAt.get(r.driverId)!);
    // Position interpolation is narrative reconstruction, not measured speed or an F2/F3 engine.
    const sorted = finished ? final.filter((r)=>!r.dnf) : active.sort((a,b)=>{
      const weight = progress*progress*(3-2*progress);
      const score=(d:FeederFinish)=>{
        const random=rng(seedFor(seed,season,category,event.round,session,d.driverId,'replay-lap',lap))();
        const noise=lap===0?0:(random-.5)*Math.min(.58, (1-progress)*.7);
        return startIndex.get(d.driverId)!*(1-weight)+finishIndex.get(d.driverId)!*weight+noise;
      };
      return score(a)-score(b)||a.driverId.localeCompare(b.driverId);
    });
    const toEntry=(r:FeederFinish,index:number):FeederReplayEntry=>({
      driverId:r.driverId,position:index+1,grid:r.grid,dnf:r.dnf,moved:r.grid-(index+1),
    });
    const running = sorted.map(toEntry);
    const retiredEntries = (finished ? final.filter((r)=>r.dnf) : retired)
      .sort((a,b)=>finished?a.position-b.position||a.driverId.localeCompare(b.driverId)
        :(retireAt.get(a.driverId)!-retireAt.get(b.driverId)! || a.grid-b.grid))
      .map((r,i)=>toEntry(r,running.length+i));
    const prior=frames.at(-1);
    const changes:string[]=[];
    if(lap===0) changes.push('Grid de largada reproduzido a partir da classificação.');
    if(prior){
      for(const r of retiredEntries.filter((d)=>!prior.retired.some((p)=>p.driverId===d.driverId))){
        changes.push(`${r.driverId} abandona a corrida (volta reconstruída).`);
      }
      const previous=new Map(prior.running.map((d)=>[d.driverId,d.position]));
      const improvements=running.filter((d)=>(previous.get(d.driverId)??0)>d.position)
        .sort((a,b)=>((previous.get(b.driverId)??0)-b.position)-((previous.get(a.driverId)??0)-a.position));
      if(improvements[0])changes.push(`${improvements[0].driverId} avança no pelotão (reconstrução).`);
      if(prior.leader!==running[0]?.driverId && running[0])changes.push(`Nova liderança: ${running[0].driverId}.`);
    }
    if(finished)changes.push('Bandeirada: posições idênticas à classificação registrada.');
    frames.push({lap,totalLaps:lapCount,running,retired:retiredEntries,leader:running[0]?.driverId??null,changes});
  }
  return frames;
}
