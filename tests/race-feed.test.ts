import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceFeed } from '../src/presentation/race-feed';
import type { RaceEvent } from '../src/domain/simulation/types';
const make = (lap:number, type:string, driverId='lando-norris', otherId?:string):RaceEvent => ({lap,type,driverId,otherId,detail:`Lap ${lap}: ${type}`});
test('TV focuses on verified incidents and preserves raw event log', () => {
  const events = [make(2,'progress'),make(3,'attack'),make(4,'overtake'),make(4,'overtake'),make(5,'pit'),make(6,'weather'),make(7,'contact','oscar-piastri')];
  const before = JSON.stringify(events);
  const result = raceFeed(events,'TV');
  assert.deepEqual(result.map(row=>row.event.type),['contact','weather','pit','overtake']);
  assert.equal(result.at(-1)?.repeats, 2);
  assert.equal(JSON.stringify(events), before);
});
test('events with distinct opponents and laps remain distinct', () => {
  const events = [make(5,'overtake','a','b'),make(5,'overtake','a','c'),make(6,'overtake','a','b')];
  assert.equal(raceFeed(events).length, 3);
});
test('minimal preserves key incidents; technical provides a complete chronological slice', () => {
  const events = [make(2,'progress'),make(3,'attack'),make(4,'puncture'),make(5,'pit'),make(6,'overtake')];
  assert.deepEqual(raceFeed(events,'MINIMAL').map(item=>item.event.type),['overtake','puncture']);
  assert.deepEqual(raceFeed(events,'TECHNICAL',3).map(item=>item.event.type),['overtake','pit','puncture']);
  assert.deepEqual(raceFeed(events,'TV',0), []);
});
test('large technical log is bounded and display has no fabricated actions', () => {
  const events=Array.from({length:2000}, (_,i)=>make(i+1,'pit','d'+i));
  const view=raceFeed(events,'TECHNICAL',12);
  assert.equal(view.length,12);
  assert.equal(view[0].event.lap,2000);
  assert.ok(view.every(({event})=>events.includes(event)));
});
