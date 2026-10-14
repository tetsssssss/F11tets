import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { formulaTwo, feederCalendar } from '../src/domain/universe/formula-two';
import { advanceOffseason } from '../src/domain/universe/seasons';
import { academyTalentWatch, feederRaceFacts, feederHallOfFame } from '../src/presentation/feeder-career';

const complete = (s: ReturnType<typeof createSave>, round: number) => {
  s.weekends.push({round, qualifyingGrid: [], sprintGrid: [], results: {
    GP: [{driverId:s.game.drivers[0].id,position:1,time:100,points:25,fastestLap:false,gain:0,teamId:s.game.drivers[0].teamId,status:'FINISHED' as const}],
  }});
};

test('sprint 61: academy watch is read-only and contains no future F2 finishes', () => {
  const s=createSave(); const before=JSON.stringify(s);
  const watch=academyTalentWatch(s);
  assert.equal(watch.completed,0);
  assert.equal(watch.total,12);
  assert.deepEqual(watch.trend,[]);
  assert.equal(watch.leader,null);
  assert.equal(JSON.stringify(s),before);
});

test('sprint 62: academy watch displays only its own enrolled F2 pilots', () => {
  const s=createSave();
  const f=formulaTwo(s,35);
  const watch=academyTalentWatch(s,f);
  const expected=f.standings.filter((driver)=>driver.academy===s.managedTeam);
  assert.equal(watch.academyDrivers,expected.length);
  assert.deepEqual(watch.top,expected[0]??null);
});

test('sprint 63: academy watch takes the next unfinished round from the current calendar', () => {
  const s=createSave(); const cal=feederCalendar(s);
  complete(s,cal[0].round);
  assert.equal(academyTalentWatch(s).next?.round,cal[1].round);
});

test('sprint 64: academy watch reads superlicence eligibility from saved driver record', () => {
  const s=createSave();const watch=academyTalentWatch(s);
  if (watch.top){
    assert.equal(watch.pointsToLicense,Math.max(0,s.world.league.licenseThreshold-s.world.people[watch.top.id].licensePoints));
    assert.equal(watch.scouting,s.world.people[watch.top.id].scouting);
  }
});

test('sprint 65: academy watch trend totals derive exclusively from completed F2 events', () => {
  const s=createSave();const cal=feederCalendar(s);
  complete(s,cal[0].round);complete(s,cal[1].round);
  const w=academyTalentWatch(s);assert.equal(w.completed,2);
  assert.ok(w.trend.length<=2);
  assert.ok(w.trend.every((p)=>p.points>=0 && [cal[0].round,cal[1].round].includes(p.round)));
});

test('sprint 66: F2 race facts do not exist for future/unavailable event', () => {
  const s=createSave();assert.deepEqual(feederRaceFacts(formulaTwo(s),null,'feature'),[]);
});

test('sprint 67: feature race news identifies real winner and pole', () => {
  const s=createSave();const c=feederCalendar(s)[0];complete(s,c.round);
  const f=formulaTwo(s);const facts=feederRaceFacts(f,f.events[0],'feature');
  const r=f.events[0].feature;
  const winner=r.find((p)=>!p.dnf)!;
  const pole=r.find((p)=>p.grid===1)!;
  assert.equal(facts.find((p)=>p.kind==='winner')?.driverId,winner.driverId);
  assert.equal(facts.find((p)=>p.kind==='pole')?.driverId,pole.driverId);
});

test('sprint 68: sprint race news uses Sprint grid rather than Feature grid', () => {
  const s=createSave();const c=feederCalendar(s)[0];complete(s,c.round);
  const f=formulaTwo(s);const facts=feederRaceFacts(f,f.events[0],'sprint');
  const pole=f.events[0].sprint.find((p)=>p.grid===1)!;
  assert.equal(facts.find((p)=>p.kind==='pole')?.driverId,pole.driverId);
});

test('sprint 69: biggest climber is a positive measured gain from grid to finish', () => {
  const s=createSave();const c=feederCalendar(s)[0];complete(s,c.round);
  const f=formulaTwo(s);const facts=feederRaceFacts(f,f.events[0],'feature');
  const gain=facts.find((p)=>p.kind==='climber');
  if (gain){
    const driver=f.events[0].feature.find((p)=>p.driverId===gain.driverId)!;
    assert.ok(driver.grid>driver.position && !driver.dnf);
    assert.match(gain.detail,new RegExp(`\\+${driver.grid-driver.position}\\b`));
  }
});

test('sprint 70: distributed points equal all registered finishers and exclude DNFs', () => {
  const s=createSave();const c=feederCalendar(s)[0];complete(s,c.round);
  const f=formulaTwo(s);const rows=f.events[0].feature;
  const reported=feederRaceFacts(f,f.events[0],'feature').find((p)=>p.kind==='points')!;
  assert.equal(reported.detail,`${rows.reduce((n,r)=>n+r.points,0)} pontos`);
  assert.ok(rows.every((r)=>!r.dnf || r.points===0));
});

test('sprint 71: world news announces the archived F2 champion once at postseason', () => {
  const s=createSave();s.game.phase='postseason';
  const a=advanceOffseason(s);
  const archive=a.world.feederHistory.find((h)=>h.category==='F2')!;
  const champion=archive.standings[0].id;
  const news=a.game.news.filter((n)=>n.title.includes('título da F2'));
  assert.equal(news.length,1);
  assert.ok(news[0].body.includes(String(archive.standings[0].points)));
  assert.equal(a.world.feederHistory.find((h)=>h.category==='F2')!.standings[0].id,champion);
  const b=advanceOffseason(a);
  assert.equal(b.game.news.filter((n)=>n.title.includes('título da F2')).length,1);
});

test('sprint 72: off-season F2 news does not insert the junior champion in F1 grid', () => {
  const s=createSave();s.game.phase='postseason';
  const before=s.game.drivers.map((d)=>d.id);
  const a=advanceOffseason(s);
  assert.deepEqual(a.game.drivers.map((d)=>d.id),before);
});

test('sprint 73: F2 hall of fame is empty in newly created save', () => {
  const s=createSave();assert.deepEqual(feederHallOfFame(s),[]);
});

test('sprint 74: F2 hall of fame resolves real archived champions without synthetic historic events', () => {
  const s=createSave();s.game.phase='postseason';
  const a=advanceOffseason(s);const h=feederHallOfFame(a);
  assert.equal(h.length,1);
  assert.equal(h[0].season,s.season);
  assert.equal(h[0].id,a.world.feederHistory.find((x)=>x.category==='F2')?.standings[0].id);
});

test('sprint 75: archived F2 hall of fame survives save JSON roundtrip', () => {
  const s=createSave();s.game.phase='postseason';
  const a=advanceOffseason(s);const v=createSave();v.world.feederHistory=a.world.feederHistory;
  const parsed=parseSave(JSON.stringify(v));assert.ok(parsed);
  assert.deepEqual(feederHallOfFame(parsed!),feederHallOfFame(v));
});
