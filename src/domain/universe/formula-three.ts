import type { Save, Driver } from '../types';
import { seedFor } from '../simulation/random';
import { feederEvent, type FeederChampionship, type FeederStanding } from './formula-two';

/** Fictional 2029 F3. Uses existing academy/independent candidates without creating duplicate people. */
export function formulaThreeEntrants(save: Save): Driver[] {
  return save.world.pool.filter((d) => {
    const p = save.world.people[d.id];
    return p?.category === 'F3' && p.status !== 'RETIRED' && d.age <= 25;
  }).sort((a,b) => b.rating - a.rating ||
    seedFor(save.seed,save.season,a.id,'f3-seat')-seedFor(save.seed,save.season,b.id,'f3-seat') ||
    a.id.localeCompare(b.id)).slice(0,30);
}

/** Ten rounds paired with existing F1 races, distinct from the F2 calendar. */
export function formulaThreeCalendar(save: Save): FeederChampionship['calendar'] {
  const circuits = save.game.circuits;
  const count = Math.min(10,circuits.length);
  if (!count) return [];
  return Array.from({length:count},(_,i) => {
    const index = Math.max(0,Math.min(circuits.length-1,Math.floor((i+.55)*circuits.length/count)));
    return {round:index+1,circuitId:circuits[index].id,circuitName:circuits[index].name};
  });
}

/** Read-only championship; completing an F1 GP unlocks its corresponding F3 round. */
export function formulaThree(save: Save, throughRound?: number): FeederChampionship {
  // After awarding the title, the podium may move to F2. Keep the finished F3
  // grid visible until the season advances; the official save archive is the source of truth.
  const archived = save.world.feederHistory.find((h)=>h.category==='F3'&&h.season===save.season);
  const entrants = archived
    ? archived.standings.map((r)=>save.world.pool.find((d)=>d.id===r.id)).filter((d):d is Driver=>!!d)
    : formulaThreeEntrants(save);
  const calendar = formulaThreeCalendar(save);
  const completed = new Set(save.weekends.filter((w)=>w.results.GP?.length).map((w)=>w.round));
  const events = calendar.filter((r)=>throughRound === undefined ? completed.has(r.round) : r.round<=throughRound)
    .map((r)=>feederEvent(save,entrants,r.round,'F3'))
    .filter((r):r is NonNullable<typeof r>=>r!==null);
  const standings: FeederStanding[] = entrants.map((d)=>{
    const finishes=events.flatMap((r)=>[...r.sprint,...r.feature].filter((x)=>x.driverId===d.id));
    return {
      id:d.id,name:d.name,academy:save.world.people[d.id]?.academy??null,
      points:finishes.reduce((n,x)=>n+x.points,0),position:0,
      wins:events.filter((r)=>r.feature.some((x)=>x.driverId===d.id&&x.position===1&&!x.dnf)).length,
      podiums:events.reduce((n,r)=>n+r.feature.filter((x)=>x.driverId===d.id&&x.position<=3&&!x.dnf).length,0),
      sprintWins:events.filter((r)=>r.sprint.some((x)=>x.driverId===d.id&&x.position===1&&!x.dnf)).length,
      finished:finishes.filter((x)=>!x.dnf).length,starts:finishes.length,
    };
  });
  standings.sort((a,b)=>b.points-a.points||b.wins-a.wins||b.podiums-a.podiums||a.id.localeCompare(b.id));
  standings.forEach((d,i)=>{d.position=i+1;});
  return {season:save.season,entrants,calendar,events,standings,
    completed:events.length,finished:calendar.length>0&&events.length===calendar.length};
}
