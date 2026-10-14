import type { Save } from '../types';
import { cloneState } from '../simulation/world';
import { clamp, rng, seedFor } from '../simulation/random';
import { moveDriver, canManage } from './market';
import { addNews, transact } from '../simulation/management';

export type SeatAssessment = {
  driverId:string; teamId:string; starts:number;
  lastFive:number; teammateLastFive:number;
  gap:number; meanFinish:number; teammateMeanFinish:number;
  danger:'safe'|'watch'|'critical'; reasons:string[];
};

/** No comparison before five shared race weekends. Points of a displaced driver remain historical. */
export function assessSeat(save: Save, id: string): SeatAssessment|null {
  const driver=save.game.drivers.find((d)=>d.id===id);
  if(!driver) return null;
  const mate=save.game.drivers.find((d)=>d.teamId===driver.teamId&&d.id!==id);
  if(!mate) return null;
  const shared=save.weekends.filter((w)=>w.results.GP?.some((r)=>r.driverId===id)&&w.results.GP?.some((r)=>r.driverId===mate.id))
    .sort((a,b)=>a.round-b.round).slice(-5);
  let ownPoints=0,matePoints=0,ownFinishes=0,mateFinishes=0;
  for(const w of shared){
    const a=w.results.GP!.find((r)=>r.driverId===id)!;
    const b=w.results.GP!.find((r)=>r.driverId===mate.id)!;
    ownPoints+=a.points;matePoints+=b.points;
    ownFinishes+=a.status==='DNF'||a.status==='DSQ'?save.game.drivers.length:a.position;
    mateFinishes+=b.status==='DNF'||b.status==='DSQ'?save.game.drivers.length:b.position;
  }
  const count=shared.length, meanFinish=count?ownFinishes/count:0,teammateMeanFinish=count?mateFinishes/count:0;
  const gap=matePoints-ownPoints;
  const reasons:string[]=[];
  if(count>=5&&gap>=28) reasons.push(`${gap} pontos atrás do companheiro nos últimos ${count} GPs`);
  if(count>=5&&meanFinish-teammateMeanFinish>=6) reasons.push('posição média de chegada significativamente pior');
  if(count>=5&&ownPoints===0&&matePoints>=16) reasons.push('sem pontos recentes apesar dos resultados do outro carro');
  const danger=count>=5&&reasons.length>=2?'critical':count>=5&&reasons.length>0?'watch':'safe';
  return {driverId:id,teamId:driver.teamId,starts:count,lastFive:ownPoints,teammateLastFive:matePoints,
    gap,meanFinish,teammateMeanFinish,danger,reasons};
}

export function eligibleReplacements(save:Save, teamId:string){
  return save.world.pool.filter((d)=>{
    const meta=save.world.people[d.id];
    return !!meta && d.teamId===teamId && meta.status==='RESERVE' &&
      meta.licensePoints>=save.world.league.licenseThreshold &&
      meta.injuryUntil<save.round && meta.suspendedUntil<save.round;
  }).sort((a,b)=>b.rating-a.rating||b.potential-a.potential||a.id.localeCompare(b.id));
}

/** Accept roster changes only between complete weekends, not during an active qualifying or race. */
export function seatChangeWindow(save:Save):boolean {
  if(save.race?.status==='RUNNING'||save.game.phase!=='season'||save.world.offseason) return false;
  const weekend=save.weekends.find((w)=>w.round===save.round);
  return !weekend || (!Object.keys(weekend.results).length || !!weekend.results.GP?.length);
}

/** Management-initiated permanent seat changes, with a cash severance/sign-on cost. */
export function replaceDriverSeat(save:Save, outgoingId:string, incomingId:string, ai=false):Save {
  if(!seatChangeWindow(save)) return save;
  const outgoing=save.game.drivers.find((d)=>d.id===outgoingId);
  if(!outgoing || (!ai&&!canManage(save,outgoing.teamId))) return save;
  if(ai&&(outgoing.teamId===save.managedTeam&&save.career.mode==='constructor'||outgoing.id===save.career.driverId)) return save;
  const incoming=eligibleReplacements(save,outgoing.teamId).find((d)=>d.id===incomingId);
  if(!incoming || save.world.substitutions.some((x)=>x.teamId===outgoing.teamId)) return save;
  const assessment=assessSeat(save,outgoingId);
  if(ai&&(!assessment||assessment.danger!=='critical'||assessment.starts<5))return save;
  const cost=Math.max(1,Math.round(((outgoing.salary??2)*.4+(incoming.salary??1)*.25)*10)/10);
  if((save.game.finances[outgoing.teamId]?.cash??0)<cost)return save;
  const next=cloneState(save);
  if(!transact(next,outgoing.teamId,-cost,'buyout',`Rescisão de ${outgoing.name} e promoção de ${incoming.name}`))return save;
  const salary=Math.max(1,Math.round((incoming.salary??1.5)*10)/10);
  if(!moveDriver(next,incoming.id,outgoing.id,outgoing.teamId,2,salary,undefined,
      ai?'Mudança após avaliação de desempenho':'Decisão do chefe de equipe')) return save;
  next.world.people[outgoing.id].motivation=clamp(next.world.people[outgoing.id].motivation-15);
  addNews(next,'CONFIRMED',`${incoming.name} substitui ${outgoing.name}`,
    `${next.game.teams.find((t)=>t.id===outgoing.teamId)?.name}: troca permanente na etapa ${save.round}; `+
    `custo contratual US$ ${cost.toFixed(1)}M. Pontos e resultados anteriores permanecem atribuídos aos respectivos pilotos.`);
  return next;
}

/** Deterministic, limited AI review every four races after round 8. Never fire the player or override their constructor career. */
export function reviewAISeats(save:Save):Save {
  if(save.round<8||save.round%4!==0||!seatChangeWindow(save))return save;
  let current=save;
  for(const team of save.game.teams){
    if(team.id===save.managedTeam&&save.career.mode==='constructor') continue;
    if(current.world.transfers.some((t)=>t.to===team.id&&t.season===save.season&&t.round>=save.round-4))continue;
    const candidates=current.game.drivers.filter((d)=>d.teamId===team.id&&d.id!==save.career.driverId)
      .map((d)=>({d,a:assessSeat(current,d.id)}))
      .filter((x)=>x.a?.danger==='critical')
      .sort((a,b)=>(b.a?.gap??0)-(a.a?.gap??0));
    const worst=candidates[0];if(!worst)continue;
    const reserve=eligibleReplacements(current,team.id).find((d)=>d.rating>=worst.d.rating-10);
    if(!reserve)continue;
    const confidence=current.world.organizations[team.id]?.confidence??65;
    const probability=clamp(.15+(80-confidence)/200, .08,.40);
    if(rng(seedFor(current.seed,current.season,current.round,team.id,'performance-seat'))()>=probability)continue;
    current=replaceDriverSeat(current,worst.d.id,reserve.id,true);
  }
  return current;
}
