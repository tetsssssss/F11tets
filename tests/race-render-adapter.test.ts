import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateCars, renderFrameFromFeeder, renderFrameFromRace, type RenderCar } from '../src/presentation/race-render-adapter';
const sample:RenderCar={id:'one',name:'Driver',code:'DRV',color:'#abcdef',x:0,y:10,angle:350,position:3,running:true,pit:false};
test('renderer interpolation never changes official classification, pit or running flags',()=>{
 const next={...sample,x:20,y:40,angle:10,position:2,pit:true,running:false};
 const result=interpolateCars([sample],[next],.5)[0];
 assert.equal(result.x,10);assert.equal(result.y,25);assert.equal(result.angle,360);
 assert.equal(result.position,2);assert.equal(result.pit,true);assert.equal(result.running,false);
});
test('renderer interpolation does not mutate authoritative snapshots',()=>{
 const next={...sample,x:12};const previous=structuredClone(sample);
 interpolateCars([sample],[next],.2);
 assert.deepEqual(sample,previous);assert.equal(next.x,12);
});
test('render feeder is explicit visualization of the provided real roster',()=>{
 const roster=[{id:'a',name:'Piloto A',short:'PA',rating:80},{id:'b',name:'Piloto B',short:'PB',rating:85}];
 const track={at:(n:number)=>({x:n*100,y:n*30})};
 const view=renderFrameFromFeeder(roster,track,3,36,['#112233','#445566']);
 assert.equal(view.length,2);assert.deepEqual(view.map(v=>v.id),['a','b']);
 assert.deepEqual(view.map(v=>v.position),[1,2]);
 assert.equal(view[1].color,'#445566');assert.equal(view[0].pit,false);
});
test('render race uses authoritative order and driver IDs without inventing cars',()=>{
 const race=[{id:'known',position:7,angle:42,point:{x:20,y:30},car:{status:'RUNNING'},pitStage:'TRACK'},
 {id:'missing',position:8,angle:8,point:{x:5,y:10},car:{status:'RUNNING'},pitStage:'TRACK'}];
 const roster=[{id:'known',name:'Known Driver',short:'KN',teamId:'t'}];
 const list=renderFrameFromRace(race as any,roster as any,()=>'#111111');
 assert.equal(list.length,1);assert.equal(list[0].id,'known');assert.equal(list[0].position,7);
 assert.equal(list[0].angle,42);assert.equal(list[0].x,20);assert.equal(list[0].color,'#111111');
});
