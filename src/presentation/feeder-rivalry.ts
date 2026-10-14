import type { Save } from '../domain/types';
import type { FeederChampionship, FeederFinish } from '../domain/universe/formula-two';
import { feederAcademyStandings, feederProspectScore } from '../domain/universe/formula-two';

/** Head-to-head comparisons are derived from classified race results, not generated overtakes. */
export function feederDriverDuels(series: FeederChampionship, ownId: string, rivalId: string) {
  if (ownId === rivalId || !series.standings.some((row) => row.id === ownId) ||
    !series.standings.some((row) => row.id === rivalId)) return null;
  let ownWins = 0, rivalWins = 0, doubleDnfs = 0;
  const rounds: { round: number; ownFinish: number | null; rivalFinish: number | null; winner: string | null }[] = [];
  for (const event of series.events) {
    for (const session of ['sprint', 'feature'] as const) {
      const own = event[session].find((row) => row.driverId === ownId);
      const rival = event[session].find((row) => row.driverId === rivalId);
      if (!own || !rival) continue;
      const outcome = own.dnf && rival.dnf ? null : own.dnf ? rivalId : rival.dnf ? ownId :
        own.position < rival.position ? ownId : rivalId;
      if (outcome === ownId) ownWins++;
      else if (outcome === rivalId) rivalWins++;
      else doubleDnfs++;
      rounds.push({ round: event.round, ownFinish: own.dnf ? null : own.position,
        rivalFinish: rival.dnf ? null : rival.position, winner: outcome });
    }
  }
  return { ownId, rivalId, ownWins, rivalWins, doubleDnfs, compared: rounds.length, rounds };
}

export function feederGridMovement(rows: FeederFinish[]) {
  return rows.map((finish) => ({...finish, positionsGained: finish.dnf ? null : finish.grid - finish.position,
    resultLabel: finish.dnf ? 'DNF' : finish.grid === finish.position ? '0' :
      finish.grid > finish.position ? `+${finish.grid - finish.position}` : String(finish.grid - finish.position),
  }));
}

/** Only existing fictional juniors, without inventing a driver or contract. */
export function feederTalentShortlist(save: Save, series: FeederChampionship, max = 5) {
  if (!Number.isInteger(max) || max < 1) return [];
  return series.standings.map((row) => {
    const pilot = series.entrants.find((driver) => driver.id === row.id);
    const record = save.world.people[row.id];
    const score = feederProspectScore(save, row.id, series);
    if (!pilot || !record || !score) return null;
    const licensed = record.licensePoints >= save.world.league.licenseThreshold;
    return {
      id: row.id, name: row.name, academy: row.academy, points: row.points,
      position: row.position, potential: pilot.potential, rating: pilot.rating,
      licensePoints: record.licensePoints, licensed, scouting: record.scouting,
      marketValue: record.marketValue, score: score.opportunity,
    };
  }).filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score || b.potential - a.potential || a.position - b.position)
    .slice(0, max);
}

export function feederAcademyRival(series: FeederChampionship, academyId: string) {
  const standings = feederAcademyStandings(series);
  const index = standings.findIndex((row) => row.academy === academyId);
  if (index < 0 || standings.length < 2) return null;
  const ours = standings[index];
  const contenders = [standings[index - 1], standings[index + 1]].filter(Boolean);
  const rival = contenders.sort((a, b) => Math.abs(a.points - ours.points) - Math.abs(b.points - ours.points) || a.academy.localeCompare(b.academy))[0];
  return { ours, rival, difference: ours.points - rival.points };
}

/** Running season leader positions for the completed rounds only. */
export function feederStandingsEvolution(series: FeederChampionship, driverId: string) {
  if (!series.standings.some((row) => row.id === driverId)) return [];
  const tallies = new Map(series.standings.map((row) => [row.id, 0]));
  const wins = new Map(series.standings.map((row) => [row.id, 0]));
  const podiums = new Map(series.standings.map((row) => [row.id, 0]));
  const evolution: {round: number; position: number; points: number; gap: number}[] = [];
  for (const event of series.events) {
    for (const row of [...event.sprint, ...event.feature])
      if (tallies.has(row.driverId)) tallies.set(row.driverId, tallies.get(row.driverId)! + row.points);
    for (const row of event.feature) {
      if (row.dnf || !wins.has(row.driverId)) continue;
      if (row.position === 1) wins.set(row.driverId, wins.get(row.driverId)! + 1);
      if (row.position <= 3) podiums.set(row.driverId, podiums.get(row.driverId)! + 1);
    }
    // Use the championship's actual tie-break rules for the position history.
    const board = [...tallies.entries()].sort((a, b) =>
      b[1] - a[1] || wins.get(b[0])! - wins.get(a[0])! ||
      podiums.get(b[0])! - podiums.get(a[0])! || a[0].localeCompare(b[0]));
    const position = board.findIndex(([id]) => id === driverId) + 1;
    evolution.push({ round: event.round, position, points: tallies.get(driverId)!,
      gap: board[0][1] - tallies.get(driverId)! });
  }
  return evolution;
}
