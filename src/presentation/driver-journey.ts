import type {Save} from '../domain/types';

export type JourneyEvent={
  season:number;
  kind:'feeder'|'f1'|'transfer'|'milestone';
  label:string;
};
export type DriverJourney={
  id:string;
  events:JourneyEvent[];
  feederTitles:number;
  careerStarts:number;
  careerWins:number;
  careerPodiums:number;
  careerPoints:number;
};
/** Verified career timeline, derived exclusively from completed results and archives. */
export function driverJourney(save:Save,id:string):DriverJourney{
  const events:JourneyEvent[]=[];
  let starts=0,wins=0,podiums=0,points=0,feederTitles=0;
  const past=save.game.history.map((h)=>({season:h.season,weekends:h.weekends}));
  for(const row of [...past,{season:save.season,weekends:save.weekends}]){
    const gp=row.weekends.flatMap((w)=>w.results.GP??[]).filter((r)=>r.driverId===id);
    if(gp.length){
      starts+=gp.length;
      wins+=gp.filter((r)=>r.position===1&&r.status!=='DNF'&&r.status!=='DSQ').length;
      podiums+=gp.filter((r)=>r.position<=3&&r.status!=='DNF'&&r.status!=='DSQ').length;
      points+=gp.reduce((sum,r)=>sum+r.points,0);
      events.push({season:row.season,kind:'f1',label:`F1: ${gp.length} largadas, ${gp.reduce((n,r)=>n+r.points,0)} pontos, ${gp.filter((r)=>r.position<=3&&r.status!=='DNF'&&r.status!=='DSQ').length} pódios`});
    }
  }
  for(const h of save.world.feederHistory){
    const row=h.standings.find((r)=>r.id===id);
    if(!row)continue;
    if(row.position===1&&['F2','F3'].includes(h.category))feederTitles++;
    events.push({season:h.season,kind:'feeder',label:`${h.category}: P${row.position} · ${row.points} pontos${row.position===1?' · campeão':''}`});
  }
  for(const t of save.world.transfers){
    if(t.personId!==id||t.kind!=='driver')continue;
    const to=save.game.teams.find((team)=>team.id===t.to)?.name??t.to;
    events.push({season:t.season,kind:'transfer',label:`Transferência: ${to} · GP ${t.round} · ${t.detail}`});
  }
  const driver=[...save.game.drivers,...save.world.pool].find((d)=>d.id===id);
  for(const c of save.game.champions){
    const recorded=save.game.history.some((h)=>h.season===c.season)||
      (c.season===save.season && save.game.phase==='postseason');
    if(recorded && (c.driver===id || (driver && c.driver===driver.name)))
      events.push({season:c.season,kind:'milestone',label:'Campeão mundial de F1'});
  }
  const precedence={feeder:0,transfer:1,f1:2,milestone:3};
  events.sort((a,b)=>a.season-b.season||precedence[a.kind]-precedence[b.kind]||a.label.localeCompare(b.label));
  return {id,events,feederTitles,careerStarts:starts,careerWins:wins,careerPodiums:podiums,careerPoints:points};
}
