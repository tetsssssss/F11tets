/** Formula 2 companion series. Deterministic, independent from the F1 race engine.
 * The current season is derived from the save; final standings are archived by feederSeason.
 * No historical event results are invented for seasons recorded by the older abstract model.
 */
import type { Save, Driver } from '../types';
import { rng, seedFor, clamp } from '../simulation/random';

export type FeederFinish = {
  driverId: string;
  position: number;
  grid: number;
  points: number;
  dnf: boolean;
};
export type FeederEvent = {
  round: number;
  circuitId: string;
  circuitName: string;
  weather: 'dry' | 'wet';
  sprint: FeederFinish[];
  feature: FeederFinish[];
};
export type FeederStanding = {
  id: string;
  name: string;
  academy: string | null;
  points: number;
  position: number;
  wins: number;
  podiums: number;
  sprintWins: number;
  finished: number;
  starts: number;
};
export type FeederChampionship = {
  season: number;
  entrants: Driver[];
  calendar: { round: number; circuitId: string; circuitName: string }[];
  events: FeederEvent[];
  standings: FeederStanding[];
  completed: number;
  /** Before F1's last GP, this is an in-progress series and not a season-final result. */
  finished: boolean;
};

const FEATURE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;
const SPRINT_POINTS = [10, 8, 6, 5, 4, 3, 2, 1] as const;

/** Twelve double-header dates on the current official-in-universe F1 calendar. */
export function feederCalendar(save: Save) {
  const c = save.game.circuits;
  if (!c.length) return [];
  const count = Math.min(12, c.length);
  return Array.from({ length: count }, (_, i) => {
    const index = Math.min(c.length - 1, Math.floor(((i + 1) * c.length) / count) - 1);
    return { round: index + 1, circuitId: c[index].id, circuitName: c[index].name };
  });
}

/** Entrants are fictional youth/reserve drivers, never F1 starters or retired drivers. */
export function feederEntrants(save: Save): Driver[] {
  const eligible = save.world.pool
    .filter((d) => {
      const p = save.world.people[d.id];
      return p && p.category === 'F2' && p.status !== 'RETIRED';
    })
    .sort((a, b) =>
      b.rating - a.rating ||
      seedFor(save.seed, save.season, a.id, 'f2-seat') - seedFor(save.seed, save.season, b.id, 'f2-seat') ||
      a.id.localeCompare(b.id),
    );
  // Genuine progression: the previous F3 podium receives three protected seats
  // provided they are still eligible. This guarantee does not alter F1 grid seats.
  const graduates = new Set(save.world.feederHistory
    .find((h) => h.season === save.season - 1 && h.category === 'F3')
    ?.standings.filter((d) => d.position <= 3).map((d) => d.id) ?? []);
  const prioritized = eligible.filter((d) => graduates.has(d.id));
  return [...prioritized, ...eligible.filter((d) => !graduates.has(d.id))].slice(0, 24);
}

function raceOrder(
  save: Save,
  entrants: Driver[],
  circuitId: string,
  eventRound: number,
  session: 'qualifying' | 'sprint' | 'feature',
  grid: string[] = [],
  weather: 'dry' | 'wet' = 'dry',
  category: 'F2' | 'F3' = 'F2',
) {
  const gridPosition = new Map(grid.map((id, index) => [id, index]));
  const scores = entrants.map((d) => {
    const p = save.world.people[d.id];
    const random = rng(seedFor(save.seed, save.season, circuitId, eventRound, category === 'F2' ? session : `f3-${session}`, d.id));
    const circuitTrait = d.circuitAttributes[circuitId] ?? d.rating;
    const base = d.rating * (weather === 'wet' ? 0.64 : 0.77) + circuitTrait * 0.12 +
      (p?.motivation ?? 75) * 0.08 + d.potential * 0.03 +
      (weather === 'wet' ? (d.attributes['Chuva'] ?? d.rating) * 0.13 : 0);
    const qualifyingEdge = session === 'qualifying' ? 0 : (entrants.length - (gridPosition.get(d.id) ?? entrants.length)) * 0.35;
    const risk = session === 'qualifying' ? 0 : random() < (weather === 'wet' ? 0.068 : 0.035) ? 1 : 0;
    return { id: d.id, score: base + qualifyingEdge + (random() - 0.5) * (weather === 'wet' ? 26 : 21), dnf: !!risk };
  });
  return scores.sort((a, b) => Number(a.dnf) - Number(b.dnf) || b.score - a.score || a.id.localeCompare(b.id));
}

export function feederEvent(save: Save, entrants: Driver[], round: number, category: 'F2' | 'F3' = 'F2'): FeederEvent | null {
  const c = save.game.circuits[round - 1];
  if (!c || !entrants.length) return null;
  const weather: 'dry' | 'wet' = rng(seedFor(save.seed, save.season, round, c.id, category === 'F2' ? 'f2-weather' : 'f3-weather'))() <
    clamp(c.rain / 100, 0, 1) ? 'wet' : 'dry';
  const qualifying = raceOrder(save, entrants, c.id, round, 'qualifying', [], weather, category).map((d) => d.id);
  const sprintGrid = [...qualifying.slice(0, 10).reverse(), ...qualifying.slice(10)];
  const finish = (session: 'sprint' | 'feature', grid: string[], points: readonly number[]) => {
    const order = raceOrder(save, entrants, c.id, round, session, grid, weather, category);
    return order.map((result, index) => ({
      driverId: result.id,
      position: index + 1,
      grid: grid.indexOf(result.id) + 1,
      dnf: result.dnf,
      points: result.dnf ? 0 : (points[index] ?? 0),
    }));
  };
  return {
    round,
    circuitId: c.id,
    circuitName: c.name,
    weather,
    sprint: finish('sprint', sprintGrid, SPRINT_POINTS),
    feature: finish('feature', qualifying, FEATURE_POINTS),
  };
}

/** Completed F1 GPs serve as the temporal gate for F2 weekends. No future spoilers. */
export function formulaTwo(save: Save, throughRound?: number): FeederChampionship {
  const entrants = feederEntrants(save);
  const calendar = feederCalendar(save);
  const completedF1 = new Set(
    save.weekends.filter((w) => w.results.GP?.length).map((w) => w.round),
  );
  const results = calendar
    .filter((c) => (throughRound === undefined ? completedF1.has(c.round) : c.round <= throughRound))
    .map((c) => feederEvent(save, entrants, c.round))
    .filter((event): event is FeederEvent => event !== null);
  const standings = entrants.map((d) => {
    const rows = results.flatMap((e) => [e.sprint, e.feature]);
    const finishes = rows.flatMap((r) => r.filter((v) => v.driverId === d.id));
    return {
      id: d.id,
      name: d.name,
      academy: save.world.people[d.id]?.academy ?? null,
      points: finishes.reduce((n, r) => n + r.points, 0),
      position: 0,
      wins: results.filter((r) => r.feature.some((f) => f.driverId === d.id && f.position === 1 && !f.dnf)).length,
      podiums: results.reduce((n, r) => n + r.feature.filter((f) => f.driverId === d.id && f.position <= 3 && !f.dnf).length, 0),
      sprintWins: results.filter((r) => r.sprint.some((f) => f.driverId === d.id && f.position === 1 && !f.dnf)).length,
      finished: finishes.filter((r) => !r.dnf).length,
      starts: finishes.length,
    };
  });
  standings.sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.id.localeCompare(b.id));
  standings.forEach((d, index) => { d.position = index + 1; });
  return {
    season: save.season,
    entrants,
    calendar,
    events: results,
    standings,
    completed: results.length,
    finished: calendar.length > 0 && results.length === calendar.length,
  };
}

/** Promotion qualification matters, but should never bypass the configured superlicence threshold. */
export function feederLicenseAward(position: number, total: number) {
  if (!Number.isInteger(position) || position < 1 || total < position) return 0;
  return clamp(40 - (position - 1) * 5, 2, 40);
}

export function feederProspectScore(save: Save, id: string, championship: FeederChampionship = formulaTwo(save)) {
  const d = [...save.world.pool, ...save.game.drivers].find((d) => d.id === id);
  const p = save.world.people[id];
  if (!d || !p) return null;
  const standing = championship.standings.find((x) => x.id === id);
  return {
    name: d.name,
    ready: p.licensePoints >= save.world.league.licenseThreshold,
    pointsToLicense: Math.max(0, save.world.league.licenseThreshold - p.licensePoints),
    potential: d.potential,
    observed: p.scouting,
    academy: p.academy,
    rank: standing?.position ?? null,
    seasonPoints: standing?.points ?? null,
    opportunity: clamp(
      d.potential * 0.4 + d.rating * 0.35 + p.motivation * 0.1 + p.scouting * 0.15,
    ),
  };
}


export type FeederAcademyStanding = {
  academy: string;
  points: number;
  victories: number;
  podiums: number;
  drivers: number;
  rank: number;
};
/** Academy table is separate from the F1 constructors' championship. */
export function feederAcademyStandings(championship: FeederChampionship): FeederAcademyStanding[] {
  const byTeam = new Map<string, Omit<FeederAcademyStanding, 'rank'>>();
  for (const d of championship.standings) {
    const academy = d.academy ?? 'free';
    const entry = byTeam.get(academy) ?? {academy,points:0,victories:0,podiums:0,drivers:0};
    entry.points += d.points;
    entry.victories += d.wins;
    entry.podiums += d.podiums;
    entry.drivers++;
    byTeam.set(academy,entry);
  }
  return [...byTeam.values()]
    .sort((a,b)=>b.points-a.points || b.victories-a.victories || a.academy.localeCompare(b.academy))
    .map((row,index)=>({...row,rank:index+1}));
}

export type FeederFormPoint = { round: number; points: number; gained: number; position: number; topThree: boolean };
/** A driver's real per-weekend points evolution; no extrapolation beyond completed events. */
export function feederForm(championship: FeederChampionship, driverId: string): FeederFormPoint[] {
  if (!championship.entrants.some((d)=>d.id===driverId)) return [];
  let total = 0;
  return championship.events.map((event)=>{
    const rows = [...event.sprint,...event.feature].filter((row)=>row.driverId===driverId);
    const gained = rows.reduce((n,r)=>n+r.points,0);
    total += gained;
    return {
      round:event.round,
      points:total,
      gained,
      position:event.feature.find((r)=>r.driverId===driverId)?.position ?? 0,
      topThree:event.feature.some((r)=>r.driverId===driverId && r.position<=3 && !r.dnf),
    };
  });
}

export function feederRival(championship: FeederChampionship, driverId: string) {
  const index = championship.standings.findIndex((row)=>row.id===driverId);
  if (index===-1 || championship.standings.length<2) return null;
  const own=championship.standings[index];
  const rivals=[championship.standings[index-1],championship.standings[index+1]].filter(Boolean);
  const nearest=rivals.sort((a,b)=>Math.abs(a.points-own.points)-Math.abs(b.points-own.points) || a.id.localeCompare(b.id))[0];
  return { ...nearest, difference:own.points-nearest.points };
}
