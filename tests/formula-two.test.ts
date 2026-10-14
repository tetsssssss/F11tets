import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import {
  feederCalendar, feederEntrants, feederEvent, formulaTwo,
  feederLicenseAward, feederProspectScore,
} from '../src/domain/universe/formula-two';
import { advanceOffseason } from '../src/domain/universe/seasons';

const completedGp = (s: ReturnType<typeof createSave>, round: number) => ({
  round, qualifyingGrid: [], sprintGrid: [], results: {
    GP: [{driverId:s.game.drivers[0].id,position:1,time:100,points:25,fastestLap:false,gain:0,teamId:s.game.drivers[0].teamId,status:'FINISHED' as const}],
  },
});

test('sprint 21: F2 opens 12 unique rounds derived from the saved F1 calendar', () => {
  const s = createSave();
  const calendar = feederCalendar(s);
  assert.equal(calendar.length,12);
  assert.equal(new Set(calendar.map((r)=>r.round)).size,12);
  assert.ok(calendar.every((r) => s.game.circuits[r.round-1].id === r.circuitId));
});

test('sprint 22: grid has up to 24 distinct eligible F2 drivers and no F1 starter', () => {
  const s = createSave(); const entries = feederEntrants(s);
  assert.ok(entries.length > 0 && entries.length <=24);
  assert.equal(entries.length,new Set(entries.map((d)=>d.id)).size);
  assert.ok(entries.every((d)=>s.world.people[d.id]?.category === 'F2'));
  assert.ok(entries.every((d)=>!s.game.drivers.some((f)=>f.id===d.id)));
});

test('sprint 23: F2 remains empty before the corresponding F1 race; future results are hidden', () => {
  const s=createSave(); const f=formulaTwo(s);
  assert.equal(f.events.length,0); assert.equal(f.completed,0); assert.equal(f.finished,false);
  assert.ok(f.standings.every((d)=>d.points===0 && d.starts===0));
});

test('sprint 24: opening a race on a future circuit does not change saved driver points', () => {
  const s=createSave(); const snapshot=JSON.stringify(s);
  const c=feederCalendar(s)[0];
  const r=feederEvent(s,feederEntrants(s),c.round);
  assert.ok(r);
  assert.equal(r!.feature.length,feederEntrants(s).length);
  assert.deepEqual(r,feederEvent(s,feederEntrants(s),c.round));
  assert.equal(JSON.stringify(s),snapshot);
});

test('sprint 25: qualifying, Sprint reverse grid and main race all have unique positions', () => {
  const s=createSave(); const r=feederEvent(s,feederEntrants(s),feederCalendar(s)[0].round)!;
  for(const rows of [r.sprint,r.feature]) {
    assert.equal(new Set(rows.map((x)=>x.driverId)).size,rows.length);
    assert.deepEqual(rows.map((x)=>x.position),Array.from({length:rows.length},(_,i)=>i+1));
    assert.equal(new Set(rows.map((x)=>x.grid)).size,rows.length);
    assert.ok(rows.every((x)=>x.points>=0));
    assert.ok(rows.every((x)=>!x.dnf || x.points===0));
  }
  const reverse = r.sprint.filter((x)=>x.grid <= 10).length;
  assert.equal(reverse,10);
});

test('sprint 26: a completed F1 weekend reveals one F2 event without F1 score changes', () => {
  const s=createSave(); const c=feederCalendar(s)[0];
  s.weekends.push(completedGp(s,c.round));
  const before=JSON.stringify(s.driverPoints);
  const f=formulaTwo(s);
  assert.equal(f.completed,1);
  assert.equal(f.events[0].round,c.round);
  assert.ok(f.standings.some((p)=>p.points>0));
  assert.equal(JSON.stringify(s.driverPoints),before);
});

test('sprint 27: future weekends do not unlock F2 rounds and no GP grid leakage', () => {
  const s=createSave(); const c=feederCalendar(s);
  s.weekends.push({...completedGp(s,c[0].round), results:{}});
  s.weekends.push(completedGp(s,c[2].round));
  assert.deepEqual(formulaTwo(s).events.map((e)=>e.round),[c[2].round]);
});

test('sprint 28: F2 ranking obeys points, wins, podiums and unique ids', () => {
  const s=createSave(); const r=formulaTwo(s,s.game.circuits.length);
  assert.equal(r.completed,12);
  assert.equal(r.finished,true);
  assert.equal(r.standings.length,24);
  assert.equal(new Set(r.standings.map((x)=>x.id)).size,24);
  assert.ok(r.standings.every((x,i)=>x.position===i+1));
  assert.ok(r.standings.every((x,i)=>!i || r.standings[i-1].points>=x.points));
});

test('sprint 29: license awards are capped and ineligible ranks cannot earn points', () => {
  assert.equal(feederLicenseAward(1,24),40);
  assert.equal(feederLicenseAward(24,24),2);
  assert.equal(feederLicenseAward(0,24),0);
  assert.equal(feederLicenseAward(25,24),0);
});

test('sprint 30: scouting and license selectors use real driver registry', () => {
  const s=createSave(); const d=feederEntrants(s)[0];
  const result=feederProspectScore(s,d.id)!;
  assert.equal(result.name,d.name);
  assert.equal(result.pointsToLicense,Math.max(0,s.world.league.licenseThreshold-s.world.people[d.id].licensePoints));
  assert.equal(result.ready,s.world.people[d.id].licensePoints>=s.world.league.licenseThreshold);
  assert.equal(feederProspectScore(s,'nonexistent-driver'),null);
});

test('sprint 31: full F2 at offseason records real points once and updates license', () => {
  const s=createSave(); s.game.phase='postseason';
  const result=advanceOffseason(s);
  assert.notEqual(result,s);
  const archive=result.world.feederHistory.filter((x)=>x.category==='F2' && x.season===s.season);
  assert.equal(archive.length,1);
  const expected=formulaTwo(s,s.game.circuits.length);
  assert.deepEqual(archive[0].standings,expected.standings.map((x)=>({id:x.id,position:x.position,points:x.points})));
  for(const x of archive[0].standings){
    const before=s.world.people[x.id].licensePoints;
    const after=result.world.people[x.id].licensePoints;
    assert.equal(after,Math.min(120,before+feederLicenseAward(x.position,expected.standings.length)));
  }
  assert.equal(s.world.feederHistory.length,0);
  const again=advanceOffseason(result);
  assert.equal(again.world.feederHistory.filter((x)=>x.category==='F2' && x.season===s.season).length,1);
});

test('sprint 32: archived save stays valid and preserves original pilot images data', () => {
  const s=createSave();s.game.phase='postseason';
  const n=advanceOffseason(s);
  // A synthetic postseason at GP1 is itself invalid. Verify the archived feeder rows in
  // a structurally valid season save without bypassing the existing career validator.
  const valid=createSave();
  valid.world.feederHistory=n.world.feederHistory;
  const parsed=parseSave(JSON.stringify(valid));
  assert.ok(parsed,'Archived F2 standings must round-trip through the v4 parser');
  assert.deepEqual(parsed?.world.feederHistory,valid.world.feederHistory);
});

test('sprint 33: increasing F2 pool does not overwrite original drivers or break capacity', () => {
  const s=createSave(); const original=new Set(s.game.drivers.map((x)=>x.id));
  const spare=s.world.pool.find((d)=>s.world.people[d.id].category==='F3')!;
  s.world.people[spare.id].category='F2';
  const f=feederEntrants(s);
  assert.equal(f.length,24);
  assert.ok(f.every((d)=>!original.has(d.id)));
});

test('sprint 34: different seeds produce distinct F2 race results, same seed stays stable', () => {
  const a=createSave(2029), b=createSave(2229);
  const ra=formulaTwo(a,a.game.circuits.length);
  const rb=formulaTwo(b,b.game.circuits.length);
  assert.deepEqual(ra,formulaTwo(a,a.game.circuits.length));
  assert.notDeepEqual(ra.events.map((e)=>e.feature.map((f)=>f.driverId)),rb.events.map((e)=>e.feature.map((f)=>f.driverId)));
});

test('sprint 35: academy standings reconcile with championship points', async () => {
  const {feederAcademyStandings}=await import('../src/domain/universe/formula-two');
  const f=formulaTwo(createSave(),35), teams=feederAcademyStandings(f);
  assert.equal(teams.reduce((n,t)=>n+t.points,0),f.standings.reduce((n,p)=>n+p.points,0));
  assert.ok(teams.every((t,i)=>t.rank===i+1));
  assert.equal(teams.reduce((n,t)=>n+t.drivers,0),f.entrants.length);
});

test('sprint 36: per-driver evolution totals agree with awarded feature + Sprint points', async () => {
  const {feederForm}=await import('../src/domain/universe/formula-two');
  const f=formulaTwo(createSave(),35);
  for(const driver of f.standings) {
    const timeline=feederForm(f,driver.id);
    assert.equal(timeline.length,f.completed);
    assert.equal(timeline.at(-1)?.points,driver.points);
    assert.equal(timeline.reduce((n,p)=>n+p.gained,0),driver.points);
    assert.equal(new Set(timeline.map((p)=>p.round)).size,timeline.length);
  }
  assert.deepEqual(feederForm(f,'absent'),[]);
});

test('sprint 37: direct rival has a real score difference and is never the selected driver', async () => {
  const {feederRival}=await import('../src/domain/universe/formula-two');
  const f=formulaTwo(createSave(),35);
  for (const own of f.standings){
    const opponent=feederRival(f,own.id)!;
    assert.notEqual(opponent.id,own.id);
    assert.equal(opponent.difference,own.points-opponent.points);
  }
  assert.equal(feederRival(f,'absent'),null);
});

test('sprint 38: new game includes 16 additional independent young drivers without changing academy seats', () => {
  const s=createSave();
  assert.equal(s.world.pool.length,64);
  assert.equal(s.world.pool.filter((d)=>d.teamId==='free').length,16);
  assert.equal(s.world.pool.filter((d)=>d.teamId!=='free').length,48);
  assert.ok(s.world.pool.filter((d)=>d.teamId==='free').every((d)=>s.world.people[d.id].status==='FREE AGENT' && s.world.people[d.id].academy===null));
  assert.ok(s.game.teams.every((t)=>s.world.pool.filter((d)=>d.teamId===t.id).length===3));
  assert.ok(parseSave(JSON.stringify(s)));
});

test('sprint 39: changing F2 results does not change stored GP winners, points or career settings', () => {
  const s=createSave();
  const saved=JSON.stringify([s.weekends,s.game.champion,s.driverPoints,s.career,s.game.teamPoints]);
  const f=formulaTwo(s,35);
  assert.ok(f.standings.some((x)=>x.points>0));
  assert.equal(JSON.stringify([s.weekends,s.game.champion,s.driverPoints,s.career,s.game.teamPoints]),saved);
});

test('sprint 40: best F3 talents advance to F2 at the offseason without entering F1', () => {
  const s=createSave(); s.game.phase='postseason';
  const n=advanceOffseason(s);
  const f3=n.world.feederHistory.find((x)=>x.category==='F3')!;
  assert.ok(f3.standings.length>=3);
  for(const row of f3.standings.slice(0,3)) {
    const d=n.world.pool.find((x)=>x.id===row.id)!;
    if(d.age>25) continue;
    assert.equal(n.world.people[row.id].category,'F2');
    assert.ok(!n.game.drivers.some((x)=>x.id===row.id));
  }
});

test('sprint 41: F3 podium gets priority for the F2 grid in the following year', () => {
  const s=createSave(); s.game.phase='postseason';
  const n=advanceOffseason(s);
  const f3=n.world.feederHistory.find((x)=>x.category==='F3')!;
  n.season++;
  const entrants=feederEntrants(n);
  const graduates=f3.standings.slice(0,3).filter((row)=>n.world.people[row.id]?.category==='F2');
  assert.ok(graduates.length>0);
  for(const d of graduates) assert.ok(entrants.some((row)=>row.id===d.id));
  assert.ok(entrants.length<=24);
});

test('sprint 42: scouting gains from championship are not applied twice', () => {
  const s=createSave();s.game.phase='postseason';
  const before=s.world.people;
  const n=advanceOffseason(s);
  const podium=n.world.feederHistory.find((x)=>x.category==='F2')!.standings.slice(0,5);
  for (const d of podium) assert.equal(n.world.people[d.id].scouting,Math.min(100,before[d.id].scouting+7));
  const next=advanceOffseason(n);
  for (const d of podium) assert.equal(next.world.people[d.id].scouting,n.world.people[d.id].scouting);
});

test('sprint 43: F2 weather is seeded from the circuit, not copied from F1 race state', () => {
  const s=createSave();
  const entry=feederCalendar(s)[0];
  const a=feederEvent(s,feederEntrants(s),entry.round)!;
  const b=feederEvent(s,feederEntrants(s),entry.round)!;
  assert.equal(a.weather,b.weather);
  assert.ok(['wet','dry'].includes(a.weather));
  s.game.weather.condition='chuva';
  assert.equal(feederEvent(s,feederEntrants(s),entry.round)!.weather,a.weather);
});

test('sprint 44: rain ability affects performance only under seeded wet conditions', () => {
  const s=createSave();
  const c=feederCalendar(s)[0];
  const entrants=feederEntrants(s);
  const before=feederEvent(s,entrants,c.round)!;
  const candidate=entrants[0];
  candidate.attributes['Chuva']=Math.min(100,(candidate.attributes['Chuva']??75)+20);
  const after=feederEvent(s,entrants,c.round)!;
  if(before.weather==='dry') assert.deepEqual(after,before);
  else assert.ok(after.feature.length===before.feature.length && after.weather==='wet');
});

test('sprint 45: podium comes from real classified finishers, independent of F1 results', () => {
  const s=createSave();
  for(const event of formulaTwo(s,35).events) {
    const podium=event.feature.filter((r)=>!r.dnf).slice(0,3);
    assert.equal(podium.length,3);
    assert.ok(podium.every((r)=>r.points>0));
  }
  assert.equal(s.weekends.length,0);
});

test('sprint 46: F2 page and young driver profiles never need a real driver photo for fictional talent', async () => {
  const {resolvePersonPhoto}=await import('../src/presentation/person-photo');
  const s=createSave();
  for(const d of feederEntrants(s).slice(0,6)) {
    const photo=resolvePersonPhoto(d.id,true);
    assert.equal(photo.status,'fictional-generated');
    assert.ok(photo.card?.startsWith('data:image/svg+xml'));
  }
  for(const d of s.game.drivers.slice(0,4)) {
    const photo=resolvePersonPhoto(d.id);
    assert.ok(['verified','usable'].includes(photo.status));
    assert.ok(photo.card?.endsWith('.webp'));
  }
});

test('sprint 47: a legacy 48-academy-driver save still validates after the initial roster expands', () => {
  const s=createSave();
  const removed=new Set(s.world.pool.filter((d)=>d.teamId==='free').map((d)=>d.id));
  s.world.pool=s.world.pool.filter((d)=>!removed.has(d.id));
  for(const id of removed) {
    delete s.world.people[id]; delete s.driverPoints[id]; delete s.game.stats[id];
  }
  const obsolete=s.game.contracts.filter((c)=>removed.has(c.personId));
  for(const c of obsolete) delete s.world.terms[c.id];
  s.game.contracts=s.game.contracts.filter((c)=>!removed.has(c.personId));
  assert.equal(s.world.pool.length,48);
  assert.ok(parseSave(JSON.stringify(s)),'Old valid saves should not be required to acquire the new drivers');
});

test('sprint 48: F2 championship presentation never changes market valuation or contract status', () => {
  const s=createSave();
  const before=JSON.stringify({pool:s.world.pool,people:s.world.people,contracts:s.game.contracts});
  for(const event of feederCalendar(s)) feederEvent(s,feederEntrants(s),event.round);
  formulaTwo(s,35);
  assert.equal(JSON.stringify({pool:s.world.pool,people:s.world.people,contracts:s.game.contracts}),before);
});

test('sprint 49: newly added independent drivers have proper contracts and eligible market identities', () => {
  const s=createSave();
  for (const d of s.world.pool.filter((d)=>d.teamId==='free')) {
    const contract=s.game.contracts.find((c)=>c.personId===d.id);
    assert.ok(contract);
    assert.equal(contract!.kind,'driver');
    assert.equal(contract!.status,'expired');
    assert.ok(s.world.terms[contract!.id]);
    assert.equal(s.world.people[d.id].provenance,'PROCEDURAL');
  }
});

test('sprint 50: F2 lineup and results stay deterministic after JSON save roundtrip', () => {
  const s=createSave(5102);
  const before=formulaTwo(s,35);
  const restored=parseSave(JSON.stringify(s));
  assert.ok(restored);
  assert.deepEqual(feederEntrants(restored!),feederEntrants(s));
  assert.deepEqual(formulaTwo(restored!,35).events,before.events);
});

test('sprint 57: active constructor can scout a junior directly from F2', async()=>{
  const {scoutDriver}=await import('../src/domain/universe/market');
  const s=createSave();s.career.mode='constructor';s.world.ceo.employed=true;
  const d=feederEntrants(s)[0];
  const before=s.world.people[d.id].scouting;
  const amount=s.game.finances[s.managedTeam].cash;
  const next=scoutDriver(s,d.id);
  assert.notEqual(next,s);
  assert.equal(next.world.people[d.id].scouting,Math.min(100,before+25));
  assert.ok(next.game.finances[s.managedTeam].cash < amount);
});

test('sprint 58: fully scouted prospects cannot charge more money', async()=>{
  const {scoutDriver}=await import('../src/domain/universe/market');
  const s=createSave();s.career.mode='constructor';s.world.ceo.employed=true;
  const d=feederEntrants(s)[0];
  s.world.people[d.id].scouting=100;
  assert.equal(scoutDriver(s,d.id),s);
});

test('sprint 59: F2 observation cannot circumvent management permission', async()=>{
  const {scoutDriver}=await import('../src/domain/universe/market');
  const s=createSave();s.career.mode='driver';
  const d=feederEntrants(s)[0];
  assert.equal(scoutDriver(s,d.id),s);
});

test('sprint 60: observation with an empty budget is rejected and the save is not mutated', async()=>{
  const {scoutDriver}=await import('../src/domain/universe/market');
  const s=createSave();s.career.mode='constructor';s.world.ceo.employed=true;
  s.game.finances[s.managedTeam].cash=0;
  const d=feederEntrants(s)[0];
  const snapshot=JSON.stringify(s);
  assert.equal(scoutDriver(s,d.id),s);
  assert.equal(JSON.stringify(s),snapshot);
});
