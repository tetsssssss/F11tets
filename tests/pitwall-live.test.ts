import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave } from '../src/domain/save';
import { createRaceState } from '../src/domain/simulation/race';
import { pitwallLive } from '../src/presentation/pitwall-live';

test('pitwall shows only measured alerts and never changes sporting state', () => {
 const save=createSave(2029), ids=save.game.drivers.map(d=>d.id);
 save.race=createRaceState(save,'GP',ids);
 const id=ids[0];
 save.race.cars[0].tyre.wear=83;
 save.game.cars[id].battery=12;
 save.race.pitCalls[id]={lap:8,compound:'M'};
 const before=JSON.stringify(save);
 const alerts=pitwallLive(save,id,10);
 assert.ok(alerts.some(s=>s.title==='Desgaste crítico'));
 assert.ok(alerts.some(s=>s.title==='Energia baixa'));
 assert.ok(alerts.some(s=>s.title==='Box confirmado'));
 assert.equal(JSON.stringify(save),before);
});
test('rain mismatches and safety control come only from current weather and control', () => {
 const save=createSave(), ids=save.game.drivers.map(d=>d.id);
 save.race=createRaceState(save,'GP',ids);
 save.race.control='SC';
 save.race.weather.water=0.6;
 save.race.cars[0].tyre.compound='S';
 const titles=pitwallLive(save,ids[0],8).map(a=>a.title);
 assert.ok(titles.includes('Direção de prova'));
 assert.ok(titles.includes('Pneus fora da janela'));
 assert.deepEqual(pitwallLive(save,'absent'),[]);
 assert.deepEqual(pitwallLive({...save,race:null},ids[0]),[]);
});
test('retired car does not receive fictitious pit advice', () => {
 const save=createSave(), ids=save.game.drivers.map(d=>d.id);
 save.race=createRaceState(save,'GP',ids);
 save.race.cars[0].status='DNF';
 assert.deepEqual(pitwallLive(save,ids[0]).map(s=>s.title),['Carro fora da disputa']);
});
test('pitwall does not call a lapped car a close battle from elapsed values alone', () => {
 const save=createSave(), ids=save.game.drivers.map(d=>d.id);
 save.race=createRaceState(save,'GP',ids);
 const leader=save.race.cars[0], lapped=save.race.cars[1];
 leader.lap=8; leader.elapsed=700;
 lapped.lap=7; lapped.elapsed=701;
 assert.ok(!pitwallLive(save,lapped.id,8).some(s=>s.title==='Disputa próxima'));
});
