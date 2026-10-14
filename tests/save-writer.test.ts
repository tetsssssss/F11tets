import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveWriter } from '../src/domain/save-writer';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
test('race updates merge into latest record and keep correct slot',async()=>{
  const writes:Array<[number,number]>=[];
  const w=new SaveWriter<number>(async(v,slot)=>{writes.push([v,slot])},()=>{},()=>{},20);
  for(let i=0;i<25;i++) w.schedule(i,2);
  await w.drain();
  assert.deepEqual(writes,[[24,2]]);
  w.close();
});
test('updates in a continuous rapid race are periodically persisted',async()=>{
  const writes:number[]=[];
  const w=new SaveWriter<number>(async(v)=>{writes.push(v)},()=>{},()=>{},15);
  w.schedule(1,1);await sleep(24);
  w.schedule(2,1);await sleep(24);
  await w.drain();
  assert.deepEqual(writes,[1,2]);w.close();
});
test('critical finish writes immediately and sequential writes preserve order',async()=>{
  const writes:number[]=[];
  const w=new SaveWriter<number>(async(v)=>{await sleep(4);writes.push(v)},()=>{},()=>{},1000);
  w.schedule(4,1);w.schedule(5,1,true);
  w.schedule(6,1,true);
  await w.drain();
  assert.deepEqual(writes,[5,6]);w.close();
});
test('writer reports failures without blocking subsequent saves',async()=>{
  const done:number[]=[],errors:unknown[]=[],status:boolean[]=[];
  const w=new SaveWriter<number>(async(v)=>{if(v===1)throw Error('quota');done.push(v)},b=>status.push(b),e=>errors.push(e),30);
  w.schedule(1,1,true);await assert.rejects(w.drain(), /quota/);
  w.schedule(2,1,true);await w.drain();
  assert.deepEqual(done,[2]);assert.equal(errors.length,1);assert.equal(status.at(-1),false);
  w.close();
});

test('slow writes have backpressure and do not build an unlimited queue',async()=>{
  const writes:number[]=[];
  const w=new SaveWriter<number>(async(v)=>{writes.push(v);await sleep(50)},()=>{},()=>{},5);
  w.schedule(0,1,true);
  for(let i=1;i<90;i++) {w.schedule(i,1); await sleep(1);}
  await w.drain();
  assert.equal(writes[0],0);
  assert.equal(writes.at(-1),89);
  assert.ok(writes.length<15,`writes=${writes.length}`);
  w.close();
});

test('failed storage write blocks slot drain until a later successful write',async()=>{
  const records:Array<[number,number]>=[];
  let fail=true;
  const w=new SaveWriter<number>(async(v,slot)=>{if(fail) throw Error('IndexedDB unavailable');records.push([v,slot]);},()=>{},()=>{},5);
  w.schedule(12,1,true);
  await assert.rejects(w.drain(),/IndexedDB unavailable/);
  assert.deepEqual(records,[]);
  fail=false;
  w.schedule(12,1,true);
  await w.drain();
  w.schedule(99,2,true);
  await w.drain();
  assert.deepEqual(records,[[12,1],[99,2]]);
  w.close();
});
