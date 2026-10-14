import { regulations, sessions } from '../data/regulations';
import type { Result, Save, Session, Weekend } from './types';
import { cloneState } from './simulation/world';
import { seedFor } from './simulation/random';
import { simulateSession, createRaceState, stepRaceLap, finishRace } from './simulation/race';
import { learnPractice } from './simulation/mechanics';
import { applyConsequences } from './simulation/consequences';
import { updateBoard, makeOffers } from './gameplay/career';
import type { RaceTape } from './simulation/types';
import { runTeamAI } from './simulation/management';
import { openOffseason, announceRegulation } from './universe/seasons';
import { prepareParticipation, restoreSubstitutes, maintainPersonnel } from './universe/operations';
import { autoSpeed, settingsOf } from './gameplay/settings';
import { reviewAISeats } from './universe/driver-seats';
import { controlledIds } from './gameplay/career';
export { rng } from './simulation/random';
export { invertSprintGrid } from './legacy/simulation';
import { invertSprintGrid } from './legacy/simulation';
export function scoreRace(results: Result[], session: 'GP' | 'Sprint'): Result[] {
  const eligible = results.filter((r) => !r.status || r.status === 'FINISHED');
  const bestGain = Math.max(0, ...eligible.map((r) => r.gain));
  return results.map((r, i) => ({
    ...r,
    points:
      r.status && r.status !== 'FINISHED'
        ? 0
        : session === 'GP'
          ? (regulations.gpPoints[i] ?? 0) + (r.fastestLap ? 1 : 0)
          : (regulations.sprintPoints[i] ?? 0) + (bestGain > 0 && r.gain === bestGain ? 1 : 0),
  }));
}
export function getWeekend(save: Save): Weekend {
  return (
    save.weekends.find((w) => w.round === save.round) ?? {
      round: save.round,
      results: {},
      qualifyingGrid: [],
      sprintGrid: [],
      tapes: {},
      seeds: {},
    }
  );
}
export function nextSession(save: Save): Session | null {
  if (save.round > save.game.circuits.length || save.game.phase === 'postseason') return null;
  return sessions.find((s) => !getWeekend(save).results[s]) ?? null;
}
function entrants(next: Save, session: Session) {
  const w = getWeekend(next);
  return session === 'Q2'
    ? w.results.Q1!.slice(0, 20).map((r) => r.driverId)
    : session === 'Q3'
      ? w.results.Q2!.slice(0, 10).map((r) => r.driverId)
      : session === 'Sprint'
        ? w.sprintGrid
        : session === 'GP'
          ? w.qualifyingGrid
          : next.game.drivers.map((d) => d.id);
}
function recordSession(next: Save, session: Session, results: Result[], tape: RaceTape) {
  let w = next.weekends.find((w) => w.round === next.round);
  if (!w) {
    w = getWeekend(next);
    next.weekends.push(w);
  }
  if (session.startsWith('TL'))
    learnPractice(
      next,
      results.map((r) => r.driverId),
      next.game.circuits[next.round - 1],
    );
  if (session === 'Sprint' || session === 'GP') results = scoreRace(results, session);
  if (session === 'Q3') {
    results[0].points = 2;
    w.qualifyingGrid = [
      ...results.map((r) => r.driverId),
      ...w.results.Q2!.slice(10).map((r) => r.driverId),
      ...w.results.Q1!.slice(20).map((r) => r.driverId),
    ];
    w.sprintGrid = invertSprintGrid(w.qualifyingGrid);
    const original = [...w.qualifyingGrid];
    w.qualifyingGrid.sort(
      (a, b) =>
        original.indexOf(a) +
        (next.game.gridPenalties[a] ?? 0) -
        (original.indexOf(b) + (next.game.gridPenalties[b] ?? 0)),
    );
    next.game.gridPenalties = {};
  }
  w.results[session] = results;
  w.tapes = { ...w.tapes, [session]: tape };
  w.seeds = {
    ...w.seeds,
    [session]: seedFor(next.game.seasonSeed, next.season, next.round, session, 'race'),
  };
  applyConsequences(next, session, results);
  if (session === 'TL1') restoreSubstitutes(next, true);

  if (session === 'GP') {
    maintainPersonnel(next);
    updateBoard(next);
    makeOffers(next);
    announceRegulation(next);
    if (next.game.phase === 'postseason') openOffseason(next);
  }
}
export function runNextSession(save: Save): Save {
  if (save.race?.status === 'RUNNING') return save;
  const session = nextSession(save);
  if (!session) return save;
  const next = cloneState(save);
  prepareParticipation(next, session);
  const output = simulateSession(next, session, entrants(next, session));
  recordSession(next, session, output.results, output.tape);
  return next;
}
export function beginLiveSession(save: Save): Save {
  if (save.race?.status === 'RUNNING') return save;
  const session = nextSession(save);
  if (!session) return save;
  const n = cloneState(save);
  prepareParticipation(n, session);
  n.race = createRaceState(n, session, entrants(n, session));
  // Career settings choose how the session opens; the race itself is the same engine either way.
  const st = settingsOf(n);
  n.race.autoEvents = st.assists.autoPauseEvents ? 'pause' : 'slow';
  if (st.speed === 0) n.race.auto = 8;
  else n.race.speed = st.speed;
  return n;
}
/** How the next session is taken, from the career's participation settings. */
export function participation(save: Save, session: Session) {
  const p = settingsOf(save).sessions;
  if (session.startsWith('TL'))
    return p.practice === 'watch' ? 'live' : p.practice === 'auto' ? 'auto' : 'instant';
  if (session.startsWith('Q')) return p.qualifying === 'play' ? 'live' : 'instant';
  if (session === 'Sprint') return p.sprint === 'play' ? 'live' : 'instant';
  return p.gp === 'play' ? 'live' : p.gp;
}
/**
 * Starts the next session the way the career asks: live, fast-forwarded, highlights or an
 * instant result. Every path runs the one RaceEngine; only how much of it is shown changes.
 */
export function playNextSession(save: Save): Save {
  const session = nextSession(save);
  if (!session || save.race?.status === 'RUNNING') return save;
  const how = participation(save, session);
  if (how === 'instant') return runNextSession(save);
  if (how === 'auto') {
    let next = save;
    while (nextSession(next)?.startsWith('TL')) next = runNextSession(next);
    return next;
  }
  const next = beginLiveSession(save);
  if (!next.race) return next;
  if (how === 'simulate') Object.assign(next.race, { speed: 16, autoEvents: 'off', paused: false });
  if (how === 'simulate') delete next.race.auto;
  if (how === 'highlights') next.race.auto = 16;
  return next;
}
export function tickLive(save: Save, force = false): Save {
  if (!save.race || save.race.status !== 'RUNNING' || (save.race.paused && !force)) return save;
  const n = cloneState(save),
    r = n.race!;
  if (r.sector < 3) {
    r.sector = (r.sector + 1) as 2 | 3;
    return n;
  }
  const before = r.events.length,
    water = r.weather.water,
    control = r.control;
  stepRaceLap(n, r);
  if (r.control === 'RED') r.paused = true;
  // Each assist decides whether its kind of moment slows or pauses the race. All on = as before.
  const assists = settingsOf(n).assists,
    fresh = r.events.slice(before),
    has = (...types: string[]) => fresh.some((e) => types.includes(e.type));
  const critical =
    (assists.autoSlowPit && has('pit')) ||
    (assists.autoSlowBattle &&
      has('contact', 'collision', 'overtake', 'braking lock-up', 'team order')) ||
    has('mechanical failure', 'puncture', 'retirement') ||
    (assists.autoSlowSafetyCar && r.control !== control) ||
    (assists.autoSlowRain && Math.abs(r.weather.water - water) > 0.12);
  if (r.auto && r.status === 'RUNNING') r.speed = autoSpeed(n, r, controlledIds(n), r.auto);
  if (critical) {
    if (r.autoEvents === 'pause') r.paused = true;
    else if (r.autoEvents === 'slow') r.speed = 1;
  }
  if (r.status === 'FINISHED') {
    const output = finishRace(n, r);
    recordSession(n, r.session, output.results, output.tape);
    r.paused = true;
  }
  return n;
}
export function sessionStatus(
  save: Save,
  session: Session,
): 'LOCKED' | 'AVAILABLE' | 'RUNNING' | 'COMPLETED' {
  if (getWeekend(save).results[session]) return 'COMPLETED';
  if (save.race?.status === 'RUNNING' && save.race.session === session) return 'RUNNING';
  return nextSession(save) === session ? 'AVAILABLE' : 'LOCKED';
}
export function advanceRound(save: Save): Save {
  if (save.race?.status === 'RUNNING') return save;
  if (!getWeekend(save).results.GP || save.round > save.game.circuits.length) return save;
  if (save.round === save.game.circuits.length) {
    const n = cloneState(save);
    restoreSubstitutes(n);
    return { ...n, round: save.game.circuits.length + 1, race: null };
  }
  const restored = cloneState(save);
  restoreSubstitutes(restored);
  const next = reviewAISeats(runTeamAI(restored));
  next.round++;
  next.race = null;
  for (const setup of Object.values(next.game.setups)) {
    setup.confidence = 20;
    setup.setsUsed = 0;
  }
  return next;
}
