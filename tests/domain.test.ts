import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drivers } from '../src/data/drivers';
import { teams } from '../src/data/teams';
import { engineers } from '../src/data/engineers';
import { circuits } from '../src/data/circuits';
import { engines, batteries, tires } from '../src/data/suppliers';
import { regulations } from '../src/data/regulations';
import { createSave, parseSave } from '../src/domain/save';
import {
  runNextSession,
  nextSession,
  getWeekend,
  invertSprintGrid,
  advanceRound,
  scoreRace,
} from '../src/domain/simulation';
import { teamPoints, powerScore } from '../src/domain/selectors';
import { exportUniverse } from '../src/domain/export';
import type { Result } from '../src/domain/types';
test('grid has 16 independent teams, 32 unique drivers and one engineer per driver', () => {
  assert.equal(teams.length, 16);
  assert.equal(drivers.length, 32);
  assert.equal(engineers.length, 32);
  assert.equal(new Set(drivers.map((d) => d.id)).size, 32);
  assert.equal(new Set(drivers.map((d) => d.number)).size, 32);
  for (const t of teams) {
    assert.equal(drivers.filter((d) => d.teamId === t.id).length, 2);
    assert.equal(engineers.filter((e) => e.teamId === t.id).length, 2);
  }
  for (const d of drivers) assert.equal(engineers.filter((e) => e.driverId === d.id).length, 1);
  assert.equal(teams.find((t) => t.id === 'bugatti')?.engine, 'Citroën/Peugeot');
  assert.deepEqual(
    drivers.filter((d) => d.teamId === 'ferrari').map((d) => d.name),
    ['Andrea Kimi Antonelli', 'Alex Palou'],
  );
});
test('all required ratings are complete and bounded; identities are marked fictional', () => {
  for (const d of drivers) {
    assert.equal(Object.keys(d.attributes).length, 20);
    assert.equal(d.dynamics.length, 12);
    assert.equal(Object.keys(d.circuitAttributes).length, 8);
    assert.ok(Object.values(d.attributes).every((v) => v >= 0 && v <= 100));
  }
  for (const t of teams) {
    assert.equal(Object.keys(t.attributes).length, 20);
    assert.equal(t.dynamics.length, 12);
  }
  for (const e of engineers) {
    assert.equal(Object.keys(e.attributes).length, 10);
    assert.equal(e.dynamics.length, 6);
    assert.equal(e.fictional, true);
  }
});
test('suppliers and 35-round calendar meet the brief', () => {
  assert.equal(engines.length, 16);
  assert.equal(new Set(engines.map((e) => e.name)).size, 16);
  assert.equal(batteries.length, 5);
  assert.ok(batteries.every((b) => Object.keys(b.attributes).length === 8));
  assert.equal(tires.length, 4);
  assert.equal(circuits.length, 35);
  assert.deepEqual(
    circuits.map((c) => c.round),
    Array.from({ length: 35 }, (_, i) => i + 1),
  );
  assert.ok(circuits.every((c) => c.date.startsWith('2029')));
});
test('first save contains no points, no sessions and no invented 2029 results', () => {
  const s = createSave();
  assert.equal(s.round, 1);
  assert.deepEqual(s.weekends, []);
  assert.ok(Object.values(s.driverPoints).every((v) => v === 0));
  assert.equal(nextSession(s), 'TL1');
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
});
test('practice produces 32 unique drivers without awarding points', () => {
  let s = createSave();
  for (let i = 0; i < 3; i++) s = runNextSession(s);
  assert.equal(nextSession(s), 'Q1');
  assert.equal(getWeekend(s).results.TL1?.length, 32);
  assert.equal(new Set(getWeekend(s).results.TL1?.map((r) => r.driverId)).size, 32);
  assert.ok(Object.values(s.driverPoints).every((v) => v === 0));
});
test('Q1 and Q2 cut the field; Q3 assembles complete Sunday grid and awards pole once', () => {
  let s = createSave();
  for (let i = 0; i < 6; i++) s = runNextSession(s);
  const w = getWeekend(s);
  assert.equal(w.results.Q1?.length, 32);
  assert.equal(w.results.Q2?.length, 20);
  assert.equal(w.results.Q3?.length, 10);
  assert.equal(w.qualifyingGrid.length, 32);
  assert.equal(new Set(w.qualifyingGrid).size, 32);
  assert.deepEqual(
    w.qualifyingGrid.slice(20),
    w.results.Q1!.slice(20).map((r) => r.driverId),
  );
  assert.deepEqual(
    w.qualifyingGrid.slice(10, 20),
    w.results.Q2!.slice(10).map((r) => r.driverId),
  );
  assert.equal(
    Object.values(s.driverPoints).reduce((a, b) => a + b, 0),
    2,
  );
  assert.equal(s.driverPoints[w.qualifyingGrid[0]], 2);
});
test('Sprint reverses blocks 1–10, 11–20 and 21–32, with no input mutation', () => {
  const original = drivers.map((d) => d.id);
  const snapshot = [...original];
  const grid = invertSprintGrid(original);
  assert.deepEqual(original, snapshot);
  assert.equal(grid[0], original[9]);
  assert.equal(grid[9], original[0]);
  assert.equal(grid[10], original[19]);
  assert.equal(grid[19], original[10]);
  assert.equal(grid[20], original[31]);
  assert.equal(grid[31], original[20]);
  assert.equal(new Set(grid).size, 32);
  assert.throws(() => invertSprintGrid(original.slice(0, 31)));
});
test('Sprint results do not change the Sunday grid', () => {
  let s = createSave();
  for (let i = 0; i < 6; i++) s = runNextSession(s);
  const grid = [...getWeekend(s).qualifyingGrid];
  s = runNextSession(s);
  assert.deepEqual(getWeekend(s).qualifyingGrid, grid);
  assert.equal(nextSession(s), 'GP');
  assert.equal(getWeekend(s).results.Sprint?.length, 32);
});
test('GP awards the exact top-13 table and one fastest-lap bonus, including outside the points', () => {
  const results: Result[] = drivers.map((d, i) => ({
    driverId: d.id,
    position: i + 1,
    time: 80 + i,
    points: 0,
    fastestLap: i === 31,
    gain: 0,
  }));
  const scored = scoreRace(results, 'GP');
  assert.deepEqual(
    scored.slice(0, 13).map((r) => r.points),
    regulations.gpPoints,
  );
  assert.equal(scored[13].points, 0);
  assert.equal(scored[31].points, 1);
  assert.equal(
    scored.reduce((s, r) => s + r.points, 0),
    189,
  );
  assert.ok(results.every((r) => r.points === 0));
});
test('Sprint gain bonus handles positive ties and excludes zero gains', () => {
  const r: Result[] = drivers.map((d, i) => ({
    driverId: d.id,
    position: i + 1,
    time: 80 + i,
    points: 0,
    fastestLap: false,
    gain: i === 14 || i === 15 ? 5 : 0,
  }));
  const scored = scoreRace(r, 'Sprint');
  assert.deepEqual(
    scored.slice(0, 10).map((r) => r.points),
    regulations.sprintPoints,
  );
  assert.equal(scored[14].points, 1);
  assert.equal(scored[15].points, 1);
  const zero = scoreRace(
    r.map((x) => ({ ...x, gain: 0 })),
    'Sprint',
  );
  assert.equal(
    zero.reduce((s, r) => s + r.points, 0),
    58,
  );
});
test('simulation is deterministic and nonmutating; different seeds can yield different outcomes', () => {
  const s = createSave();
  const snapshot = JSON.stringify(s);
  assert.deepEqual(runNextSession(s), runNextSession(s));
  assert.equal(JSON.stringify(s), snapshot);
  assert.notDeepEqual(runNextSession(s).weekends, runNextSession(createSave(123)).weekends);
});
test('completed sessions cannot be replayed for extra points, and early round advance is blocked', () => {
  let s = createSave();
  assert.equal(advanceRound(s), s);
  for (let i = 0; i < 8; i++) s = runNextSession(s);
  assert.equal(nextSession(s), null);
  const once = JSON.stringify(s);
  assert.equal(JSON.stringify(runNextSession(s)), once);
  assert.equal(advanceRound(s).round, 2);
});
test('save round trip verifies actual sporting state and rejects tampering', () => {
  let s = createSave();
  for (let i = 0; i < 8; i++) s = runNextSession(s);
  s = advanceRound(s);
  s = runNextSession(s);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  const tampered = structuredClone(s);
  tampered.driverPoints['lando-norris'] += 99;
  assert.equal(parseSave(JSON.stringify(tampered)), null);
  assert.equal(parseSave('{invalid'), null);
  assert.equal(parseSave(JSON.stringify({ ...s, version: 99 })), null);
  assert.equal(parseSave(JSON.stringify({ ...s, managedTeam: 'unknown' })), null);
  assert.equal(parseSave(JSON.stringify({ ...s, game: { ...s.game, drivers: [] } })), null);
});
test('constructor points include the separate weekend bonus', () => {
  let s = createSave();
  for (let i = 0; i < 8; i++) s = runNextSession(s);
  assert.equal(
    teams.reduce((sum, t) => sum + teamPoints(s, t.id), 0),
    Object.values(s.driverPoints).reduce((a, b) => a + b, 0) + 2,
  );
});
test('all 35 rounds can be played and restored without extra sessions after completion', () => {
  let s = createSave();
  for (let round = 1; round <= 35; round++) {
    for (let i = 0; i < 8; i++) s = runNextSession(s);
    s = advanceRound(s);
  }
  assert.equal(s.round, 36);
  assert.equal(s.weekends.length, 35);
  assert.equal(nextSession(s), null);
  assert.equal(runNextSession(s), s);
  assert.equal(advanceRound(s), s);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
});
test('integration export is JSON serializable and keeps provenance and save', () => {
  const s = runNextSession(createSave());
  const parsed = JSON.parse(JSON.stringify(exportUniverse(s)));
  assert.equal(parsed.drivers.length, 32);
  assert.equal(parsed.teams.length, 16);
  assert.equal(parsed.schemaVersion, 4);
  assert.equal(parsed.provenance.ratings, 'EDITORIAL_FIXTURE');
  assert.deepEqual(parsed.championship, s);
  assert.ok(teams.every((t) => powerScore(t).power > 0 && powerScore(t).power <= 100));
});
