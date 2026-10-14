import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSave} from '../src/domain/save';
import {formulaThree} from '../src/domain/universe/formula-three';
import {formulaTwo} from '../src/domain/universe/formula-two';
import {feederReplay} from '../src/presentation/feeder-replay';
for(const category of ['F2','F3'] as const){
  for(const session of ['sprint','feature'] as const){
    test(`${category} ${session}: replay is deterministic, preserves classification, and never mutates save`,()=>{
      const s=createSave();
      const f=category==='F2'?formulaTwo(s,35):formulaThree(s,35);
      const event=f.events[0];assert.ok(event);
      const before=JSON.stringify(s);
      const frames=feederReplay(event,session,s.seed,s.season,category);
      assert.equal(frames.length,session==='sprint'?15:25);
      assert.deepEqual(frames,feederReplay(event,session,s.seed,s.season,category));
      assert.equal(JSON.stringify(s),before);
      assert.deepEqual(frames[0].running.map((d)=>d.driverId),event[session].slice().sort((a,b)=>a.grid-b.grid).map((d)=>d.driverId));
      const end=frames.at(-1)!;
      assert.deepEqual([...end.running,...end.retired].map((d)=>d.driverId),event[session].slice().sort((a,b)=>a.position-b.position).map((d)=>d.driverId));
      assert.deepEqual(end.retired.map((r)=>r.driverId),event[session].filter((r)=>r.dnf).sort((a,b)=>a.position-b.position).map((r)=>r.driverId));
      assert.equal(end.running.length+end.retired.length,event[session].length);
      for(let i=1;i<frames.length;i++) for(const retired of frames[i-1].retired){
        assert.ok(frames[i].retired.some((d)=>d.driverId===retired.driverId),'retiree cannot rejoin');
      }
    });
  }
}
test('replay never projects future races into a career',()=>{
  const s=createSave();assert.equal(formulaTwo(s).events.length,0);assert.equal(formulaThree(s).events.length,0);
});
test('replay validates laps and duplicate competitor IDs',()=>{
  const s=createSave(),event=formulaThree(s,35).events[0];
  assert.throws(()=>feederReplay(event,'feature',s.seed,s.season,'F3',1),RangeError);
  assert.throws(()=>feederReplay({...event,feature:[event.feature[0],event.feature[0]]},'feature',s.seed,s.season,'F3'));
});
