import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createSave,parseSave} from '../src/domain/save';
import {formulaTwo,feederCalendar,feederAcademyStandings} from '../src/domain/universe/formula-two';
import {feederDriverDuels,feederGridMovement,feederTalentShortlist,feederAcademyRival,feederStandingsEvolution} from '../src/presentation/feeder-rivalry';

const race=(s: ReturnType<typeof createSave>,round:number)=>s.weekends.push({round,qualifyingGrid:[],sprintGrid:[],results:{GP:[{
  driverId:s.game.drivers[0].id,position:1,time:100,points:25,fastestLap:false,gain:0,teamId:s.game.drivers[0].teamId,status:'FINISHED' as const,
}]}});

test('sprint 76: cannot compare a driver with themself',()=>{
  const f=formulaTwo(createSave(),35);
  assert.equal(feederDriverDuels(f,f.standings[0].id,f.standings[0].id),null);
});
test('sprint 77: cannot compare non-entered pilots in an F2 race',()=>{
  const f=formulaTwo(createSave(),35);
  assert.equal(feederDriverDuels(f,f.standings[0].id,'unknown'),null);
});
test('sprint 78: fresh F2 rivalry does not claim future race outcomes',()=>{
  const f=formulaTwo(createSave());
  const duel=feederDriverDuels(f,f.standings[0].id,f.standings[1].id)!;
  assert.equal(duel.compared,0);assert.equal(duel.ownWins,0);assert.equal(duel.rivalWins,0);
});
test('sprint 79: two F2 weekends yield exactly four head-to-head session results',()=>{
  const s=createSave();const cal=feederCalendar(s);race(s,cal[0].round);race(s,cal[1].round);
  const f=formulaTwo(s);const duel=feederDriverDuels(f,f.standings[0].id,f.standings[1].id)!;
  assert.equal(duel.compared,4);assert.equal(duel.rounds.length,4);
});
test('sprint 80: all compared race outcomes reconcile incl. double DNF',()=>{
  const f=formulaTwo(createSave(),35);
  const d=feederDriverDuels(f,f.standings[0].id,f.standings[1].id)!;
  assert.equal(d.compared,d.ownWins+d.rivalWins+d.doubleDnfs);
});
test('sprint 81: duplicate event computation never changes rivalry totals',()=>{
  const s=createSave();const f=formulaTwo(s,35);
  assert.deepEqual(feederDriverDuels(f,f.standings[0].id,f.standings[1].id),feederDriverDuels(formulaTwo(s,35),f.standings[0].id,f.standings[1].id));
});
test('sprint 82: grid movement zero is represented as unchanged',()=>{
  const r=feederGridMovement([{driverId:'a',grid:4,position:4,points:8,dnf:false}]);
  assert.equal(r[0].resultLabel,'0');assert.equal(r[0].positionsGained,0);
});
test('sprint 83: positive grid movement is derived exactly from grid and finish',()=>{
  const r=feederGridMovement([{driverId:'a',grid:11,position:2,points:18,dnf:false}]);
  assert.equal(r[0].resultLabel,'+9');assert.equal(r[0].positionsGained,9);
});
test('sprint 84: negative grid movement displays positions lost',()=>{
  const r=feederGridMovement([{driverId:'a',grid:1,position:8,points:4,dnf:false}]);
  assert.equal(r[0].resultLabel,'-7');assert.equal(r[0].positionsGained,-7);
});
test('sprint 85: a DNF is never misleadingly described as overtaking',()=>{
  const r=feederGridMovement([{driverId:'a',grid:1,position:24,points:0,dnf:true}]);
  assert.equal(r[0].resultLabel,'DNF');assert.equal(r[0].positionsGained,null);
});
test('sprint 86: talent shortlist uses only actually entered existing young drivers',()=>{
  const s=createSave();const f=formulaTwo(s);
  const shortlist=feederTalentShortlist(s,f);
  assert.ok(shortlist.length>0);
  assert.ok(shortlist.every((p)=>f.entrants.some((d)=>d.id===p.id)));
  assert.ok(shortlist.every((p)=>!s.game.drivers.some((d)=>d.id===p.id)));
});
test('sprint 87: talent shortlist obeys requested maximum',()=>{
  const s=createSave();const f=formulaTwo(s);
  assert.equal(feederTalentShortlist(s,f,2).length,2);
  assert.ok(feederTalentShortlist(s,f,100).length<=f.entrants.length);
});
test('sprint 88: shortlist rejects invalid or unbounded negative requested limits',()=>{
  const s=createSave();const f=formulaTwo(s);
  assert.deepEqual(feederTalentShortlist(s,f,0),[]);
  assert.deepEqual(feederTalentShortlist(s,f,-5),[]);
  assert.deepEqual(feederTalentShortlist(s,f,2.3),[]);
});
test('sprint 89: shortlist licenses are grounded in saved records and current league threshold',()=>{
  const s=createSave();const f=formulaTwo(s);
  for(const row of feederTalentShortlist(s,f)){
    assert.equal(row.licensePoints,s.world.people[row.id].licensePoints);
    assert.equal(row.licensed,row.licensePoints>=s.world.league.licenseThreshold);
  }
});
test('sprint 90: scouting shortlist never edits contracts, finances or save state',()=>{
  const s=createSave();const before=JSON.stringify(s);
  feederTalentShortlist(s,formulaTwo(s),100);
  assert.equal(JSON.stringify(s),before);
});
test('sprint 91: academy duel requires at least one entered driver from given academy',()=>{
  const f=formulaTwo(createSave(),35);
  assert.equal(feederAcademyRival(f,'nonexistent'),null);
});
test('sprint 92: academy rival is one of the two nearest positions in team championship',()=>{
  const f=formulaTwo(createSave(),35);const board=feederAcademyStandings(f);
  const own=board[2];const duel=feederAcademyRival(f,own.academy)!;
  assert.equal(duel.ours.academy,own.academy);
  assert.ok([board[1].academy,board[3].academy].includes(duel.rival.academy));
});
test('sprint 93: academy duel gap is signed and based on real total points',()=>{
  const f=formulaTwo(createSave(),35);const board=feederAcademyStandings(f);
  const duel=feederAcademyRival(f,board[0].academy)!;
  assert.equal(duel.difference,duel.ours.points-duel.rival.points);
});
test('sprint 94: a rookie with no completed F2 GP has no fake season evolution',()=>{
  const f=formulaTwo(createSave());
  assert.deepEqual(feederStandingsEvolution(f,f.standings[0].id),[]);
});
test('sprint 95: completed round graph has exactly one point per completed F2 race weekend',()=>{
  const s=createSave();const c=feederCalendar(s);race(s,c[0].round);race(s,c[1].round);
  const f=formulaTwo(s);
  assert.equal(feederStandingsEvolution(f,f.standings[0].id).length,f.completed);
});
test('sprint 96: championship cumulative points can never decrease',()=>{
  const f=formulaTwo(createSave(),35);
  for(const p of feederStandingsEvolution(f,f.standings[0].id)) assert.ok(p.points>=0);
  const scores=feederStandingsEvolution(f,f.standings[0].id).map((x)=>x.points);
  assert.ok(scores.every((v,i)=>!i || v>=scores[i-1]));
});
test('sprint 97: points gap to current F2 championship leader never becomes negative',()=>{
  const f=formulaTwo(createSave(),35);
  assert.ok(feederStandingsEvolution(f,f.standings[3].id).every((row)=>row.gap>=0));
});
test('sprint 98: final cumulative F2 chart agrees with standings exactly',()=>{
  const f=formulaTwo(createSave(),35);
  for(const d of f.standings.slice(0,5)){
    const evolution=feederStandingsEvolution(f,d.id);
    assert.equal(evolution.at(-1)?.points,d.points);
    assert.equal(evolution.at(-1)?.position,d.position);
  }
});
test('sprint 99: graph dates are ordered and never repeat the same round',()=>{
  const f=formulaTwo(createSave(),35);
  const evolution=feederStandingsEvolution(f,f.standings[0].id);
  assert.deepEqual(evolution.map((p)=>p.round),f.events.map((e)=>e.round));
});
test('sprint 100: F2 shortlist, duels, and chart remain deterministic after a validated JSON save roundtrip',()=>{
  const s=createSave(10100);
  const restored=parseSave(JSON.stringify(s));assert.ok(restored);
  const fa=formulaTwo(s,35),fb=formulaTwo(restored!,35);
  assert.deepEqual(feederTalentShortlist(s,fa),feederTalentShortlist(restored!,fb));
  assert.deepEqual(feederDriverDuels(fa,fa.standings[0].id,fa.standings[1].id),feederDriverDuels(fb,fb.standings[0].id,fb.standings[1].id));
  assert.deepEqual(feederStandingsEvolution(fa,fa.standings[0].id),feederStandingsEvolution(fb,fb.standings[0].id));
});
