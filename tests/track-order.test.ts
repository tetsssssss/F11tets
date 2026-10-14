import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceTrackOrder } from '../src/domain/simulation/track-order';
const x = (id:string,elapsed:number,last=90,status:'RUNNING'|'DNF'='RUNNING')=>({id,elapsed,last,status});
test('fast lap without a successful pass stays in traffic and charges realistic elapsed time',()=>{
  const prev=[x('a',100),x('b',100.5),x('c',101)];
  const cars=[x('a',190),x('b',189),x('c',188)];
  enforceTrackOrder(prev as any,cars as any,new Set(),new Set());
  assert.ok(cars[0].elapsed < cars[1].elapsed && cars[1].elapsed < cars[2].elapsed);
  assert.ok(cars[1].last>90 && cars[2].last>90);
});
test('authorized close battle may reverse two cars without invented pass events',()=>{
  const prev=[x('a',100),x('b',100.5)];
  const cars=[x('a',190),x('b',188)];
  enforceTrackOrder(prev as any,cars as any,new Set(['b:a']),new Set());
  assert.ok(cars[1].elapsed < cars[0].elapsed);
});
test('a pit stop and retirement release the faster car',()=>{
  const prev=[x('a',100),x('b',101),x('c',102)];
  const cars=[x('a',205),x('b',188),x('c',187)];
  enforceTrackOrder(prev as any,cars as any,new Set(),new Set(['a']));
  assert.equal(cars[1].elapsed,188);
  assert.ok(cars[2].elapsed>188);
  cars[1].status='DNF';cars[2].elapsed=185;
  enforceTrackOrder(prev as any,cars as any,new Set(),new Set());
  assert.ok(cars[2].elapsed<=205.1);
});
