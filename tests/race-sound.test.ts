import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampAudio, sanitiseSound, eventAudioCue, selectEventCues, engineAudioFrame, DEFAULT_SOUND } from '../src/audio/race-sound';
import type { RaceState } from '../src/domain/gameplay/types';
import type { RaceEvent } from '../src/domain/simulation/types';
const event = (type: string, driverId='lando-norris'):RaceEvent => ({ lap: 4, type, driverId, detail: type });
const race = (patch: Partial<RaceState> = {}):RaceState => ({
  seed: 17, session: 'GP', version: 1, round: 1, rngState: 19, ids: ['lando-norris'], laps: 50,
  lap: 2, sector: 2, status: 'RUNNING', paused: false, speed: 1, autoEvents: 'off',
  weather: { condition: 'dry', air: 24, track: 33, wind: 4, humidity: 30, intensity: 0, water: 0, grip: 100, forecast: 0 },
  control: 'GREEN', neutralLaps: 0,
  cars: [{ id: 'lando-norris', elapsed: 120, best: 90, lap: 2, tyre: { compound: 'M', wear: 12, temperature: 88, graining: 0, overheating: 0, life: 100, punctureRisk: 0 },
    tyreAge: 2, pits: 0, status: 'RUNNING', penalty: 0, overtakes: 1, last: 90, pitPhase: 'TRACK' }],
  decisions: {} as RaceState['decisions'], baseDecisions: {} as RaceState['baseDecisions'],
  commands: { 'lando-norris': { kind: 'NORMAL', remaining: 0, acknowledged: true, noAttack: false, yieldTo: null, holdUntil: 0 } },
  pitCalls: {}, events: [], frames: [], radio: [], commandSequence: 0, forcedRain: null, dev: false,
  ...patch,
});
test('sonoplastia: categories are attached only to real event types', () => {
  assert.equal(eventAudioCue('collision'),'impact');
  assert.equal(eventAudioCue('pit'),'pit');
  assert.equal(eventAudioCue('overtake'),'pass');
  assert.equal(eventAudioCue('braking lock-up'),'lockup');
  assert.equal(eventAudioCue('unknown'),'null' === 'null' ? null : 'flag');
});
test('sonoplastia: critical incidents win when many events appear in the same sector', () => {
  const list = [event('overtake'), event('pit'), event('collision','rival'), event('mechanical failure')];
  assert.deepEqual(selectEventCues(list,'lando-norris',2),['failure','impact']);
  assert.deepEqual(selectEventCues(list,'lando-norris',1),['failure']);
});
test('sonoplastia: no events means silence, never fabricate sound cues', () => {
  assert.deepEqual(selectEventCues([],null),[]);
  assert.deepEqual(selectEventCues([event('progress'),event('unknown')],'lando-norris'),[]);
});
test('sonoplastia: volume settings have safe bounds and a predictable fallback', () => {
  assert.equal(clampAudio(-20),0); assert.equal(clampAudio(500),100);
  assert.equal(clampAudio(Number.NaN),0);
  assert.deepEqual(sanitiseSound(null),DEFAULT_SOUND);
  assert.deepEqual(sanitiseSound({volume:999,engine:-4,mix:'not-real'}),{...DEFAULT_SOUND,volume:100,engine:0,mix:'broadcast'});
});
test('sonoplastia: paused, red flag and finished session silence the motor', () => {
  assert.equal(engineAudioFrame(race(),'lando-norris').active,true);
  assert.equal(engineAudioFrame(race({paused:true}),'lando-norris').active,false);
  assert.equal(engineAudioFrame(race({control:'RED'}),'lando-norris').active,false);
  assert.equal(engineAudioFrame(race({status:'FINISHED'}),'lando-norris').active,false);
});
test('sonoplastia: attack, safety car, pit lane and rain modify presentation only', () => {
  const normal = race();
  const attack = race({commands:{ 'lando-norris':{...normal.commands['lando-norris'],kind:'ATTACK'}}});
  const safe = race({control:'SC'});
  const pit = race({cars:[{...normal.cars[0],pitPhase:'EXIT'}]});
  const wet = race({weather:{...normal.weather,water:.8}});
  assert.ok(engineAudioFrame(attack,'lando-norris').pitch > engineAudioFrame(normal,'lando-norris').pitch);
  assert.ok(engineAudioFrame(safe,'lando-norris').pitch < engineAudioFrame(normal,'lando-norris').pitch);
  assert.ok(engineAudioFrame(pit,'lando-norris').pitch < engineAudioFrame(normal,'lando-norris').pitch);
  assert.ok(engineAudioFrame(wet,'lando-norris').rain > engineAudioFrame(normal,'lando-norris').rain);
  assert.deepEqual(normal.commands['lando-norris'].kind, 'NORMAL');
});
test('sonoplastia: no dependency on wall clock or RNG for deterministic sound mapping', () => {
  const snapshot = race();
  const original = JSON.stringify(snapshot);
  assert.deepEqual(engineAudioFrame(snapshot,'lando-norris'),engineAudioFrame(snapshot,'lando-norris'));
  assert.equal(JSON.stringify(snapshot),original);
});
