import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CINEMATIC_PRESETS,nextCinematicYaw} from '../src/presentation/cinematic-camera';

test('sprint 51: the camera tour advances at a controlled degree-per-second rate',()=>{
  assert.ok(Math.abs(nextCinematicYaw(0,1000)-2.8)<1e-8);
});
test('sprint 52: large time gaps are clamped to avoid motion jumps',()=>{
  assert.ok(Math.abs(nextCinematicYaw(0,100000)-2.8)<1e-8);
});
test('sprint 53: negative elapsed intervals never reverse camera movement',()=>{
  assert.equal(nextCinematicYaw(10,-100),10);
});
test('sprint 54: yaw wraps smoothly at 180 degrees',()=>{
  assert.ok(Math.abs(nextCinematicYaw(179,200)-(-178.2))<1e-6);
});
test('sprint 55: nonfinite camera readings safely reset instead of poisoning the render',()=>{
  assert.equal(nextCinematicYaw(NaN,100),0);
  assert.equal(nextCinematicYaw(10,Infinity),0);
});
test('sprint 56: cinematic angle presets remain within visible camera limits',()=>{
  assert.ok(Object.values(CINEMATIC_PRESETS).every((preset)=>preset.pitch>=35 && preset.pitch<=90));
  assert.notDeepEqual(CINEMATIC_PRESETS.overhead,CINEMATIC_PRESETS.low);
});
