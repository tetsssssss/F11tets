import test from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { configureCareer } from '../src/domain/gameplay/career';
import { defaultSettings, normalizeSettings } from '../src/domain/gameplay/settings';
import { beginLiveSession, nextSession, runNextSession, tickLive } from '../src/domain/simulation';
import { validRaceState } from '../src/domain/gameplay/validation';
import type { Save } from '../src/domain/types';

function readyGP(speed: 0.5 | 0.75): Save {
  let save = configureCareer(createSave(2029), 'driver', 'lando-norris', {...defaultSettings(), speed});
  while(nextSession(save) && nextSession(save) !== 'GP') save = runNextSession(save);
  return beginLiveSession(save);
}

for(const speed of [0.5, 0.75] as const) {
  test(`55.000: ${speed}x is valid, survives persistence and leaves race calculations unchanged`, () => {
    const s = readyGP(speed);
    assert.equal(s.race?.speed, speed);
    assert.equal(normalizeSettings({...defaultSettings(),speed}).speed, speed);
    assert.equal(validRaceState(s), true);
    const restored = parseSave(JSON.stringify(s));
    assert.ok(restored);
    assert.equal(restored.race?.speed, speed);
    const next = tickLive(s, true);
    assert.equal(next.race?.speed, speed);
    assert.equal(next.race?.lap, s.race?.lap);
    assert.equal(next.race?.sector, (s.race?.sector ?? 0) + 1);
  });
}

test('55.000: unexpected speeds stay invalid; existing 1x setting remains untouched', () => {
  assert.equal(normalizeSettings({...defaultSettings(), speed: 3 as never}).speed, 1);
  const s = readyGP(0.5);
  s.race!.speed = 0.25 as never;
  assert.equal(validRaceState(s), false);
});
