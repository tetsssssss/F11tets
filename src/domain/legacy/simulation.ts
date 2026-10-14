import { drivers, driverById } from '../../data/drivers';
import { teamById } from '../../data/teams';
import { regulations, sessions } from '../../data/regulations';
import type { Result, Save, Session, SimulationEngine, Weekend } from './types';
export function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function invertSprintGrid(grid: string[]): string[] {
  if (grid.length !== 32 || new Set(grid).size !== 32)
    throw new Error('O grid deve conter 32 pilotos únicos.');
  return [
    ...grid.slice(0, 10).reverse(),
    ...grid.slice(10, 20).reverse(),
    ...grid.slice(20, 32).reverse(),
  ];
}
export const prototypeEngine: SimulationEngine = {
  run(session, ids, seed, round) {
    const random = rng(seed + round * 997 + sessions.indexOf(session) * 53);
    const ranked = ids
      .map((id) => {
        const d = driverById[id];
        return { id, score: d.rating * 0.52 + teamById[d.teamId].rating * 0.48 + random() * 16 };
      })
      .sort((a, b) => b.score - a.score);
    const fastest = session === 'GP' ? Math.floor(random() * Math.min(20, ids.length)) : -1;
    const baseTime = 77 + random() * 4;
    return ranked.map((entry, index) => ({
      driverId: entry.id,
      position: index + 1,
      time: Math.round((baseTime + (ranked[0].score - entry.score) * 0.12) * 1000) / 1000,
      points: 0,
      fastestLap: index === fastest,
      gain: ids.indexOf(entry.id) - index,
    }));
  },
};
export function scoreRace(results: Result[], session: 'GP' | 'Sprint'): Result[] {
  const bestGain = Math.max(...results.map((r) => r.gain));
  return results.map((r, i) => ({
    ...r,
    points:
      session === 'GP'
        ? (regulations.gpPoints[i] ?? 0) + (r.fastestLap ? regulations.fastestLapBonus : 0)
        : (regulations.sprintPoints[i] ?? 0) +
          (bestGain > 0 && r.gain === bestGain ? regulations.sprintGainBonus : 0),
  }));
}
export function getWeekend(save: Save): Weekend {
  return (
    save.weekends.find((w) => w.round === save.round) ?? {
      round: save.round,
      results: {},
      qualifyingGrid: [],
      sprintGrid: [],
    }
  );
}
export function nextSession(save: Save): Session | null {
  if (save.round > 35) return null;
  const weekend = getWeekend(save);
  return sessions.find((s) => !weekend.results[s]) ?? null;
}
export function runNextSession(save: Save, engine: SimulationEngine = prototypeEngine): Save {
  const session = nextSession(save);
  if (!session) return save;
  // Copy only the active weekend. Full-season restores must not clone 35 rounds for every session.
  const next: Save = {
    ...save,
    driverPoints: { ...save.driverPoints },
    weekends: save.weekends.map((w) =>
      w.round === save.round ? { ...w, results: { ...w.results } } : w,
    ),
  };
  let weekend = next.weekends.find((w) => w.round === next.round);
  if (!weekend) {
    weekend = getWeekend(next);
    next.weekends.push(weekend);
  }
  const allIds = drivers.map((d) => d.id);
  const ids =
    session === 'Q2'
      ? weekend.results.Q1!.slice(0, 20).map((r) => r.driverId)
      : session === 'Q3'
        ? weekend.results.Q2!.slice(0, 10).map((r) => r.driverId)
        : session === 'Sprint'
          ? weekend.sprintGrid
          : session === 'GP'
            ? weekend.qualifyingGrid
            : allIds;
  let results = engine.run(session, ids, save.seed, save.round);
  if (session === 'GP' || session === 'Sprint') results = scoreRace(results, session);
  if (session === 'Q3') {
    results[0].points = regulations.poleBonus;
    weekend.qualifyingGrid = [
      ...results.map((r) => r.driverId),
      ...weekend.results.Q2!.slice(10).map((r) => r.driverId),
      ...weekend.results.Q1!.slice(20).map((r) => r.driverId),
    ];
    weekend.sprintGrid = invertSprintGrid(weekend.qualifyingGrid);
  }
  weekend.results[session] = results;
  for (const r of results) next.driverPoints[r.driverId] += r.points;
  return next;
}
export function advanceRound(save: Save): Save {
  return getWeekend(save).results.GP && save.round <= 35
    ? { ...save, round: save.round + 1 }
    : save;
}
