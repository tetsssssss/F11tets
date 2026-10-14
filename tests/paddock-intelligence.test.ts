import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { paddockIntelligence } from '../src/presentation/paddock-intelligence';
import type { Save } from '../src/domain/types';

const signal = (s: Save, id: string) => paddockIntelligence(s).signals.find((item) => item.id === id);
const gp = (round: number, s: Save, points = 25) => ({
  round, qualifyingGrid: [], sprintGrid: [], results: { GP: [
    { driverId: s.game.drivers[0].id, teamId: s.game.drivers[0].teamId, position: 1, time: 0, points, fastestLap: false, gain: 0 },
  ] },
});

test('sprint 4: a fresh game does not invent competitors or completed GPs', () => {
  const save = createSave();
  const report = paddockIntelligence(save);
  assert.equal(report.lastRound, null);
  assert.equal(signal(save, 'rival'), undefined);
  assert.equal(signal(save, 'pace'), undefined);
  assert.equal(report.season, save.season);
});
test('sprint 5: championship opponent comes only from finished GP results and saved points', () => {
  const s = createSave();
  s.weekends.push(gp(1, s));
  s.game.teamPoints[s.managedTeam] = 25;
  assert.match(signal(s, 'rival')?.description ?? '', /pontos de diferença/);
});
test('sprint 6: next circuit uses circuit reference, without claiming a live forecast', () => {
  const s = createSave();
  const c = s.game.circuits[0];
  assert.ok(signal(s, 'next-track')?.description.includes(c.name));
  assert.ok(signal(s, 'next-track')?.description.includes('não é uma previsão ao vivo'));
  s.round = s.game.circuits.length + 1;
  assert.equal(signal(s, 'next-track'), undefined);
});
test('sprint 7: real injury outranks high fatigue and points to academy', () => {
  const s = createSave();
  const driver = s.game.drivers.find((d) => d.teamId === s.managedTeam)!;
  s.world.people[driver.id].fatigue = 88;
  assert.equal(signal(s, 'fitness')?.priority, 'attention');
  s.world.people[driver.id].injuryUntil = s.round;
  assert.equal(signal(s, 'fitness')?.priority, 'urgent');
  assert.equal(signal(s, 'fitness')?.href, '/academias');
});
test('sprint 8: excess engine allocation is surfaced with driver identification', () => {
  const s = createSave();
  const driver = s.game.drivers.find((d) => d.teamId === s.managedTeam)!;
  s.world.components[driver.id].engine = s.world.league.componentAllocation + 1;
  assert.match(signal(s, 'components')?.description ?? '', new RegExp(driver.name));
  assert.equal(signal(s, 'components')?.priority, 'urgent');
});
test('sprint 9: rested pit crew does not raise a false alert; tired crew does', () => {
  const s = createSave();
  assert.equal(signal(s, 'pit-crew'), undefined);
  s.world.organizations[s.managedTeam].crew.fatigue = 70;
  assert.equal(signal(s, 'pit-crew')?.value, '70%');
});
test('sprint 10: low liquidity includes the real saved balance', () => {
  const s = createSave();
  s.game.finances[s.managedTeam].cash = 7.5;
  assert.match(signal(s, 'liquidity')?.description ?? '', /7\.5/);
  assert.equal(signal(s, 'liquidity')?.href, '/organizacao');
});
test('sprint 11: cap warning uses the actual active regulation limit', () => {
  const s = createSave();
  const o = s.world.organizations[s.managedTeam];
  o.accounts.capSpent = 220;
  assert.equal(signal(s, 'cost-cap')?.priority, 'attention');
  o.accounts.capSpent = 240;
  assert.equal(signal(s, 'cost-cap')?.priority, 'urgent');
});
test('sprint 12: only managed-team active development appears', () => {
  const s = createSave();
  s.game.development.push({ id:'demo', projectId:'aero',teamId:s.managedTeam,start:1,due:2,cost:2,expected:0.1,actual:null,status:'active',progress:30 });
  s.game.development.push({ id:'old', projectId:'aero',teamId:s.managedTeam,start:1,due:1,cost:2,expected:0.1,actual:0.1,status:'delivered',progress:100 });
  assert.equal(signal(s, 'development')?.value, '1');
  assert.match(signal(s, 'development')?.description ?? '', /round 2/);
});
test('sprint 13: expiring contracts never include contracts of other teams', () => {
  const s = createSave();
  s.game.contracts.find((c) => c.teamId === s.managedTeam)!.until = s.season;
  assert.ok(signal(s, 'contracts'));
  const other = s.game.contracts.find((c) => c.teamId !== s.managedTeam)!;
  other.until = s.season;
  assert.equal(signal(s, 'contracts')?.value, '1');
});
test('sprint 14: board uses the real objective and confidence', () => {
  const s = createSave();
  const o = s.world.organizations[s.managedTeam];
  o.confidence = 25;
  assert.equal(signal(s, 'board')?.priority, 'urgent');
  assert.match(signal(s, 'board')?.description ?? '', /Confiança atual: 25\/100/);
});
test('sprint 15: rookie requirement is sourced from league setting', () => {
  const s = createSave();
  s.world.league.rookiePracticeTarget = 3;
  s.world.organizations[s.managedTeam].rookieRuns = 1;
  assert.equal(signal(s, 'rookies')?.value, '2 restante(s)');
  s.world.organizations[s.managedTeam].rookieRuns = 3;
  assert.equal(signal(s, 'rookies'), undefined);
});
test('sprint 16: only countered or accepted offers of managed team request action', () => {
  const s = createSave();
  const contract = s.game.contracts[0];
  const terms = s.world.terms[contract.personId];
  s.world.negotiations.push({id:'a',personId:contract.personId,replaceId:contract.personId,teamId:s.managedTeam,kind:'driver',salary:5,years:2,start:s.season,terms,status:'counter',response:'',counter:null});
  assert.equal(signal(s, 'offers')?.value, '1');
  s.world.negotiations[0].status = 'signed';
  assert.equal(signal(s, 'offers'), undefined);
});
test('sprint 17: transfer timeline is ordered chronologically and never includes future seasons', () => {
  const s = createSave();
  const entry = {id:'old',season:2029,round:5,personId:s.game.drivers[0].id,from:'a',to:'b',kind:'driver' as const,detail:'Assinatura confirmada'};
  s.world.transfers.push({...entry, id:'newer',round:6,detail:'Movimento mais recente'});
  s.world.transfers.push({...entry, id:'future',season:2030,detail:'Evento futuro'});
  assert.match(signal(s, 'transfers')?.description ?? '', /Movimento mais recente/);
});
test('sprint 18: urgent unread mail is an action; read mail is not', () => {
  const s = createSave();
  s.world.inbox.push({id:'a',season:s.season,round:1,type:'ACTION REQUIRED',title:'Contrato',body:'',read:false,href:'/mercado'});
  assert.equal(signal(s,'inbox')?.priority, 'urgent');
  s.world.inbox[0].read = true;
  assert.equal(signal(s,'inbox'), undefined);
});
test('sprint 19: regulation and feeder reports rely on actual data only', () => {
  const s = createSave();
  assert.equal(signal(s, 'regulation'), undefined);
  assert.equal(signal(s, 'feeder'), undefined);
  s.world.regulations.push({id:'future',name:'Era de eficiência',announced:2029,effective:2030,area:'energy',costCap:230,engineCap:null,minWeight:null,description:''});
  s.world.feederHistory.push({season:2029,category:'F2',standings:[{id:'prospect-a',points:120,position:1}]});
  assert.equal(signal(s, 'regulation')?.priority, 'attention');
  assert.match(signal(s, 'feeder')?.description ?? '', /120 pontos/);
});
test('sprint 20: report is stable, prioritised, and cannot mutate save', () => {
  const s = createSave();
  s.world.inbox.push({id:'a',season:s.season,round:1,type:'URGENT',title:'!',body:'',read:false,href:'/caixa-de-entrada'});
  s.world.organizations[s.managedTeam].crew.fatigue = 75;
  const before = JSON.stringify(s);
  const a = paddockIntelligence(s), b = paddockIntelligence(s);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(a, b);
  assert.equal(a.signals[0].priority, 'urgent');
  assert.equal(new Set(a.signals.map((item) => item.id)).size, a.signals.length);
  assert.ok(a.attention >= 2);
});
