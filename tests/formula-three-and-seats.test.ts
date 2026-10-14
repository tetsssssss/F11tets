import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSave,parseSave} from '../src/domain/save';
import {formulaThree,formulaThreeEntrants,formulaThreeCalendar} from '../src/domain/universe/formula-three';
import {formulaTwo} from '../src/domain/universe/formula-two';
import {advanceOffseason} from '../src/domain/universe/seasons';
import {seedFor,rng} from '../src/domain/simulation/random';
import {prepareNextSeason} from '../src/domain/simulation/management';
import {assessSeat,eligibleReplacements,replaceDriverSeat,seatChangeWindow,reviewAISeats} from '../src/domain/universe/driver-seats';

const gp=(s:ReturnType<typeof createSave>, round:number)=>({round,qualifyingGrid:[],sprintGrid:[],results:{
  GP:s.game.drivers.map((d,i)=>({driverId:d.id,position:i+1,points:i===0?25:0,time:90,fastestLap:false,gain:0,teamId:d.teamId,status:'FINISHED' as const}))
}});

test('F3: entrants have unique identities, attributes and a separate ten-round calendar',()=>{
 const s=createSave();const e=formulaThreeEntrants(s);const c=formulaThreeCalendar(s);
 assert.ok(e.length>=8&&e.length<=30);assert.equal(new Set(e.map((d)=>d.id)).size,e.length);
 assert.ok(e.every((d)=>s.world.people[d.id]?.category==='F3'&&d.potential>=0&&Object.keys(d.attributes).length===20));
 assert.equal(c.length,10);assert.equal(new Set(c.map((x)=>x.round)).size,10);
 assert.ok(c.every((x)=>s.game.circuits[x.round-1].id===x.circuitId));
});
test('F3: no spoilers, completed GPs only, and F1 points unchanged',()=>{
 const s=createSave(),calendar=formulaThreeCalendar(s),before=JSON.stringify(s);
 assert.equal(formulaThree(s).completed,0);assert.equal(JSON.stringify(s),before);
 s.weekends.push(gp(s,calendar[0].round));
 const points=JSON.stringify(s.driverPoints);const f=formulaThree(s);
 assert.equal(f.completed,1);assert.ok(f.events[0].sprint.length);assert.ok(f.events[0].feature.length);
 assert.ok(f.standings.some((d)=>d.points>0));assert.equal(JSON.stringify(s.driverPoints),points);
 assert.deepEqual(f,formulaThree(s));
});
test('F3: F2 unchanged by reading F3 (independent sessions and results)',()=>{
 const s=createSave(),before=formulaTwo(s,35);const f3=formulaThree(s,35);
 assert.ok(f3.finished);assert.equal(f3.events.length,10);assert.deepEqual(formulaTwo(s,35),before);
});
test('F3: offseason archives race results and graduates top three into F2',()=>{
 const s=createSave(),f=formulaThree(s,35);s.game.phase='postseason';const n=advanceOffseason(s);
 const archive=n.world.feederHistory.find((h)=>h.category==='F3');assert.ok(archive);
 assert.deepEqual(archive!.standings,f.standings.map((x)=>({id:x.id,points:x.points,position:x.position})));
 for(const row of archive!.standings.slice(0,3)) assert.equal(n.world.people[row.id].category,'F2');
 assert.ok(n.game.news.some((x)=>x.title.includes('campeão da F3')));
 assert.deepEqual(formulaThree(n,n.game.circuits.length).standings.map((x)=>x.id),f.standings.map((x)=>x.id),
   'post-season must keep the complete F3 classification visible after top-three promotion');
});
test('F3: save roundtrip for archived championship',()=>{
 const s=createSave();s.game.phase='postseason';const n=advanceOffseason(s);
 const valid=createSave();valid.world.feederHistory=n.world.feederHistory;
 const saved=parseSave(JSON.stringify(valid));
 assert.ok(saved,'archived F3 standings must remain compatible with v4 saves');
});
test('F1 seats: opening weekend may change seats; mid-session cannot',()=>{
 const s=createSave();assert.ok(seatChangeWindow(s));
 s.weekends.push({round:1,results:{TL1:[]},qualifyingGrid:[],sprintGrid:[]});
 assert.equal(seatChangeWindow(s),false);
});
test('F1 seats: only licensed reserve from same team is eligible',()=>{
 const s=createSave(),team=s.managedTeam;const pool=eligibleReplacements(s,team);
 assert.ok(pool.every((d)=>d.teamId===team&&s.world.people[d.id].licensePoints>=40));
 for(const d of pool)s.world.people[d.id].licensePoints=0;
 assert.equal(eligibleReplacements(s,team).length,0);
});
test('F1 seats: manual replacement preserves points, original photos and transfer record',()=>{
 const s=createSave();s.career.mode='constructor';s.managedTeam=s.game.drivers[0].teamId;
 const outgoing=s.game.drivers[0],incoming=eligibleReplacements(s,outgoing.teamId)[0];assert.ok(incoming);

 const n=replaceDriverSeat(s,outgoing.id,incoming.id);
 assert.ok(n!==s);assert.equal(s.game.drivers[0].id,outgoing.id);
 assert.equal(n.game.drivers.find((d)=>d.teamId===outgoing.teamId&&d.id===incoming.id)?.id,incoming.id);
 assert.ok(n.world.pool.some((d)=>d.id===outgoing.id));assert.equal(n.driverPoints[outgoing.id],s.driverPoints[outgoing.id]);
 assert.equal(n.world.people[incoming.id].status,'ACTIVE');assert.equal(n.world.people[outgoing.id].status,'FREE AGENT');
 assert.equal(n.world.transfers.at(-1)?.personId,incoming.id);
 assert.ok(n.game.contracts.find((c)=>c.personId===incoming.id)?.teamId===outgoing.teamId);
 assert.ok(parseSave(JSON.stringify(n)), 'replacement must preserve valid save schema');
});
test('F1 seats: unauthorized management, missing licence and active race reject without mutation',()=>{
 const s=createSave(),d=s.game.drivers[0],pool=eligibleReplacements(s,d.teamId)[0];assert.ok(pool);s.career.mode='driver';
 const raw=JSON.stringify(s);assert.ok(replaceDriverSeat(s,d.id,pool.id) === s);assert.equal(JSON.stringify(s),raw);
 s.career.mode='constructor';s.managedTeam=d.teamId;s.world.people[pool.id].licensePoints=0;
 assert.ok(replaceDriverSeat(s,d.id,pool.id) === s);
 s.world.people[pool.id].licensePoints=40;s.race={status:'RUNNING'} as typeof s.race;
 assert.ok(replaceDriverSeat(s,d.id,pool.id) === s);
});
test('F1 seats: poor form is computed from completed shared races only',()=>{
 const s=createSave(),team=s.game.drivers[0].teamId,[a,b]=s.game.drivers.filter((d)=>d.teamId===team);
 assert.equal(assessSeat(s,a.id)?.danger,'safe');
 for(let round=1;round<=5;round++){
   const w=gp(s,round);w.results.GP=w.results.GP.map((r)=>r.driverId===a.id?{...r,position:30,points:0}:r.driverId===b.id?{...r,position:1,points:25}:r);
   s.weekends.push(w);
 }
 const review=assessSeat(s,a.id)!;
 assert.equal(review.danger,'critical');assert.equal(review.starts,5);
 assert.equal(review.lastFive,0);assert.equal(review.teammateLastFive,125);
});
test('F1 seats: AI never replaces the human-managed constructor or player pilot',()=>{
 const s=createSave();s.career.mode='constructor';s.round=8;
 for(let round=1;round<=8;round++)s.weekends.push(gp(s,round));
 const before=JSON.stringify(s);const result=reviewAISeats(s);
 assert.deepEqual(result.game.drivers.filter((d)=>d.teamId===s.managedTeam),s.game.drivers.filter((d)=>d.teamId===s.managedTeam));
 assert.equal(JSON.stringify(s),before);
});

test('F1 seats: eligible AI team can really replace a critically underperforming driver',()=>{
 const s=createSave();s.career.mode='constructor';s.round=8;
 const team=s.game.teams.find((x)=>x.id!==s.managedTeam)!;
 const [worst,mate]=s.game.drivers.filter((x)=>x.teamId===team.id);
 worst.rating=60;
 const reserve=eligibleReplacements(s,team.id)[0];assert.ok(reserve);
 const finance=s.game.finances[team.id];finance.cash=100;
 for(let round=1;round<=8;round++){
   const w=gp(s,round);
   w.results.GP=w.results.GP.map((x)=>x.driverId===worst.id?{...x,position:30,points:0}:
     x.driverId===mate.id?{...x,position:1,points:25}:x);
   s.weekends.push(w);
 }
 assert.equal(assessSeat(s,worst.id)?.danger,'critical');
 let candidateSeed=s.seed;
 for(let seed=1;seed<10000;seed++){
   if(rng(seedFor(seed,s.season,s.round,team.id,'performance-seat'))()<.40){candidateSeed=seed;break;}
 }
 s.seed=candidateSeed;s.world.organizations[team.id].confidence=0;
 const result=reviewAISeats(s);
 assert.ok(result!==s,'at least one controlled non-player team should replace an underperformer');
 assert.equal(result.game.drivers.some((x)=>x.id===worst.id),false);
 assert.equal(result.game.drivers.some((x)=>x.id===reserve.id),true);
 assert.ok(result.game.news.some((n)=>n.title.includes('substitui')));
});

test('F3: newly completed seasons continuously replenish juniors without duplicate ids',()=>{
 const s=createSave();s.game.phase='postseason';
 let n=advanceOffseason(s);n=advanceOffseason(n);n=advanceOffseason(n);
 const f3= n.world.pool.filter((d)=>n.world.people[d.id]?.category==='F3' && d.age<=25);
 assert.ok(f3.length>=24,'new F3 youth should replace graduates');
 assert.equal(new Set([...n.game.drivers,...n.world.pool].map((d)=>d.id)).size,n.game.drivers.length+n.world.pool.length);
 const youth=f3.filter((d)=>d.id.startsWith('junior-2030-'));
 assert.ok(youth.every((d)=>n.world.people[d.id].provenance==='PROCEDURAL'));
});

test('F3/F2: repeated offseason processing archives each category once and advances youth pool',()=>{
 const s=createSave();s.game.phase='postseason';let n=advanceOffseason(s);
 const original=n.world.feederHistory.length;
 const second=advanceOffseason(n);
 assert.equal(second.world.feederHistory.length,original);
 assert.equal(new Set(n.world.feederHistory.filter((h)=>h.season===2029).map((h)=>h.category)).size,6);
 const f3=n.world.feederHistory.find((h)=>h.category==='F3')!;
 const f2=n.world.feederHistory.find((h)=>h.category==='F2')!;
 assert.ok(f3.standings.length>=10);assert.ok(f2.standings.length>=15);
});

test('F3: synthetic ten-year advancement keeps an eligible junior grid and archived annual championships',()=>{
 let s=createSave();
 for(let season=2029;season<2039;season++){
   s.game.phase='postseason';
   const finished=prepareNextSeason(s);
   assert.ok(finished.world.feederHistory.some((h)=>h.category==='F3'&&h.season===season));
   assert.ok(finished.world.feederHistory.some((h)=>h.category==='F2'&&h.season===season));
   const participants=formulaThreeEntrants(finished);
   assert.ok(participants.length>=20,`year ${season}: F3 too small`);
   const ids=[...finished.game.drivers,...finished.world.pool].map((d)=>d.id);
   assert.equal(new Set(ids).size,ids.length);
   s=finished;
 }
});
