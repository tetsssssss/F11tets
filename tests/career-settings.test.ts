import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, parseSave } from '../src/domain/save';
import { configureCareer, updateCareerSettings } from '../src/domain/gameplay/career';
import {
  applyProfile,
  autoSpeed,
  defaultSettings,
  normalizeSettings,
  presetSettings,
  raceModifiers,
  shown,
} from '../src/domain/gameplay/settings';
import {
  beginLiveSession,
  getWeekend,
  nextSession,
  participation,
  playNextSession,
  runNextSession,
  tickLive,
} from '../src/domain/simulation';
import { createRaceState } from '../src/domain/simulation/race';
import type { Save } from '../src/domain/types';
const career = (settings = defaultSettings()) =>
  configureCareer(createSave(2029), 'driver', 'lando-norris', settings);
/** Runs the weekend up to the GP with whatever participation the career asks for. */
function toGp(save: Save) {
  let s = save;
  while (nextSession(s) && nextSession(s) !== 'GP') s = runNextSession(s);
  return s;
}
function finishLive(save: Save) {
  let s = save,
    guard = 0;
  while (s.race?.status === 'RUNNING' && guard++ < 2000) s = tickLive(s, true);
  return s;
}
const gp = (s: Save) => getWeekend(s).results.GP!;
test('NORMAL at 100% is the engine untouched: every modifier is neutral and results match', () => {
  const m = raceModifiers(career());
  for (const key of [
    'distance',
    'wear',
    'errors',
    'failures',
    'incidents',
    'safetyCar',
    'damage',
    'weather',
    'energy',
    'aggression',
  ] as const)
    assert.equal(m[key], 1, key);
  assert.equal(m.strategy, 0);
  assert.equal(m.hesitation, 0);
  assert.equal(m.sharpness, 0);
  // A save from before settings existed races exactly like a NORMAL career.
  const legacy = career();
  delete (legacy.career as { settings?: unknown }).settings;
  assert.deepEqual(gp(runNextSession(toGp(legacy))), gp(runNextSession(toGp(career()))));
});
test('presets move frequencies and AI decisions, never ratings', () => {
  const normal = career(),
    casual = raceModifiers(career(presetSettings('CASUAL'))),
    sim = raceModifiers(career(presetSettings('SIMULATION')));
  assert.ok(casual.errors < 1 && casual.failures < 1 && casual.wear < 1 && casual.damage < 1);
  assert.ok(casual.hesitation > 0 && casual.strategy < 0);
  assert.ok(sim.failures > 1 && sim.wear > 1 && sim.damage > 1 && sim.strategy > 0);
  assert.ok(sim.sharpness > 0 && sim.hesitation === 0);
  for (const settings of [
    presetSettings('CASUAL'),
    presetSettings('PRO'),
    presetSettings('SIMULATION'),
  ]) {
    const s = career(settings);
    assert.deepEqual(
      s.game.drivers.map((d) => [d.id, d.rating, d.attributes]),
      normal.game.drivers.map((d) => [d.id, d.rating, d.attributes]),
    );
    assert.deepEqual(
      s.game.teams.map((t) => t.attributes),
      normal.game.teams.map((t) => t.attributes),
    );
  }
  // Even the extremes stay bounded: no lottery.
  const wild = defaultSettings();
  for (const key of Object.keys(wild.sliders) as (keyof typeof wild.sliders)[])
    wild.sliders[key] = 999;
  const max = raceModifiers(career(normalizeSettings(wild)));
  assert.ok(max.failures <= 1.6 && max.errors <= 1.5 && max.safetyCar <= 1.5 && max.wear <= 1.5);
});
test('race distance shortens the race and rescales tyre wear instead of just cutting laps', () => {
  const laps = (distance: 25 | 50 | 75 | 100) => {
    const s = toGp(career({ ...defaultSettings(), distance }));
    return createRaceState(s, 'GP', getWeekend(s).qualifyingGrid).laps;
  };
  const full = laps(100);
  assert.equal(laps(50), Math.round(full * 0.5));
  assert.equal(laps(25), Math.max(5, Math.round(full * 0.25)));
  assert.ok(laps(75) < full && laps(75) > laps(50));
  const half = raceModifiers(career({ ...defaultSettings(), distance: 50 }));
  assert.ok(half.wear > 1.7 && half.wear < 2);
  // Practice and qualifying are not shortened.
  assert.equal(raceModifiers(career({ ...defaultSettings(), distance: 25 }), 'Q1').distance, 1);
});
for (const [name, settings] of [
  ['NORMAL 100%', defaultSettings()],
  ['CASUAL 50%', { ...presetSettings('CASUAL'), distance: 50 as const }],
  ['SIMULATION 100%', presetSettings('SIMULATION')],
  [
    'CUSTOM 25%',
    normalizeSettings({
      ...defaultSettings(),
      preset: 'CUSTOM',
      custom: true,
      distance: 25,
      sliders: { ...defaultSettings().sliders, tyreWear: 140, incidents: 90, aiAggression: 85 },
    }),
  ],
] as const)
  test(`career ${name}: a full GP runs, scores once, is deterministic and survives save/load`, () => {
    const ready = toGp(career(settings));
    const instant = runNextSession(ready),
      again = runNextSession(toGp(career(settings)));
    const results = gp(instant);
    assert.equal(results.length, 32);
    assert.deepEqual(results, gp(again));
    assert.ok(results.filter((r) => r.status === 'FINISHED').length >= 16, 'most cars finish');
    assert.equal(
      results[0].laps,
      Math.max(5, Math.round(ready.game.circuits[0].laps * (settings.distance / 100))),
    );
    // Played live, tick by tick, the same engine gives the same result as the instant one.
    const live = finishLive(beginLiveSession(ready));
    assert.deepEqual(gp(live), results);
    const reopened = parseSave(JSON.stringify(instant))!;
    assert.ok(reopened, 'save is valid');
    assert.deepEqual(reopened.career.settings, instant.career.settings);
    assert.equal(reopened.career.settings.preset, settings.preset);
    assert.deepEqual(gp(reopened), results);
  });
test('settings can change mid-career, mark the save CUSTOM-aware and are migrated on old saves', () => {
  const s = career();
  const next = updateCareerSettings(s, { ...presetSettings('PRO'), custom: true });
  assert.equal(next.career.settings.preset, 'PRO');
  assert.equal(next.career.settings.custom, true);
  assert.equal(next.world.settings.autoPit, false);
  assert.equal(s.career.settings.preset, 'NORMAL', 'original save untouched');
  const old = JSON.parse(JSON.stringify(s));
  delete old.career.settings;
  const migrated = parseSave(JSON.stringify(old))!;
  assert.ok(migrated, 'save without settings still loads');
  assert.deepEqual(migrated.career.settings, defaultSettings());
  const broken = JSON.parse(JSON.stringify(s));
  broken.career.settings = { preset: 'GOD', distance: 33, sliders: { tyreWear: 9000 }, speed: 3 };
  const repaired = parseSave(JSON.stringify(broken))!.career.settings;
  assert.equal(repaired.preset, 'NORMAL');
  assert.equal(repaired.distance, 100);
  assert.equal(repaired.sliders.tyreWear, 150);
  assert.equal(repaired.speed, 1);
});
test('session participation: simulate, auto practice, play, highlights and instant result', () => {
  // Default career: each practice and qualifying click is one instant result, races are live.
  let d = playNextSession(career());
  assert.equal(d.race, null);
  assert.equal(nextSession(d), 'TL2');
  while (nextSession(d) !== 'Sprint') d = playNextSession(d);
  assert.equal(playNextSession(d).race?.session, 'Sprint');
  const manage = career(applyProfile(defaultSettings(), 'manage'));
  assert.equal(participation(manage, 'TL1'), 'auto');
  let s = playNextSession(manage);
  assert.equal(nextSession(s), 'Q1', 'all three practices simulated in one go');
  s = playNextSession(playNextSession(playNextSession(s)));
  assert.equal(nextSession(s), 'Sprint');
  s = playNextSession(s);
  assert.equal(s.race, null, 'sprint simulated');
  s = playNextSession(s);
  assert.equal(s.race, null);
  assert.equal(gp(s).length, 32, 'instant GP result');

  const watch = career(applyProfile(defaultSettings(), 'watch'));
  const tl = playNextSession(watch);
  assert.equal(tl.race?.session, 'TL1');
  assert.equal(tl.race?.paused, true);

  const moments = toGp(career(applyProfile(defaultSettings(), 'moments')));
  const highlights = playNextSession(moments);
  assert.equal(highlights.race?.auto, 16);
  // Highlights and instant are the same race.
  assert.deepEqual(gp(finishLive(highlights)), gp(runNextSession(moments)));

  const fast = playNextSession(
    toGp(
      career({ ...defaultSettings(), sessions: { ...defaultSettings().sessions, gp: 'simulate' } }),
    ),
  );
  assert.equal(fast.race?.speed, 16);
  assert.equal(fast.race?.paused, false);
  assert.equal(fast.race?.autoEvents, 'off');
});
test('auto speed slows for the start, the finish and the player, and cruises in between', () => {
  const s = beginLiveSession(toGp(career({ ...defaultSettings(), speed: 0 })));
  const r = s.race!;
  assert.equal(r.auto, 8);
  assert.equal(autoSpeed(s, r, ['lando-norris'], 8), 1, 'start');
  r.lap = 20;
  r.events.length = 0;
  r.cars.forEach((c, i) => {
    c.lap = 20;
    c.elapsed = 1000 + i * 6;
  });
  assert.equal(autoSpeed(s, r, ['lando-norris'], 8), 8, 'quiet');
  assert.equal(autoSpeed(s, r, ['lando-norris'], 16), 16, 'highlights cruise');
  const me = r.cars.find((c) => c.id === 'lando-norris')!,
    ahead = [...r.cars].sort((a, b) => a.elapsed - b.elapsed)[0];
  if (ahead.id !== me.id) me.elapsed = ahead.elapsed + 0.4;
  else r.cars.find((c) => c.id !== me.id)!.elapsed = me.elapsed + 0.4;
  assert.equal(autoSpeed(s, r, ['lando-norris'], 8), 1, 'player in a fight');
  r.cars.forEach((c, i) => (c.elapsed = 1000 + i * 6));
  r.control = 'SC';
  assert.equal(autoSpeed(s, r, ['lando-norris'], 8), 4, 'safety car');
  r.control = 'GREEN';
  r.lap = r.laps - 1;
  assert.equal(autoSpeed(s, r, ['lando-norris'], 8), 1, 'last lap');
});
test('information: exact numbers on CASUAL, a range that contains the truth on SIMULATION', () => {
  const casual = career(presetSettings('CASUAL')),
    sim = career(presetSettings('SIMULATION'));
  assert.equal(shown(casual, 53.2, 'tyre'), '53%');
  for (const value of [3, 27.4, 53, 88.8, 99]) {
    const text = shown(sim, value, 'tyre'),
      [low, high] = text.replace('%', '').split('–').map(Number);
    assert.ok(low <= value && high >= value && high - low >= 4 && high - low <= 15, text);
    assert.equal(shown(sim, value, 'tyre'), text, 'stable, not flickering');
  }
});
