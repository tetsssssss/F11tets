import type { Save } from '../domain/types';

/** Read-only recent GP points for the managed driver/team. Never includes qualifying,
 * sprint points, or invented results. Rows are sorted by round, not insertion order.
 */
export function raceMomentum(save: Save, limit = 5) {
  const driverMode = save.career.mode === 'driver' && Boolean(save.career.driverId);
  const target = driverMode ? save.career.driverId! : save.managedTeam;
  const teamByDriver = new Map(save.game.drivers.map((driver) => [driver.id, driver.teamId]));
  const rounds = save.weekends
    .filter((weekend) => Array.isArray(weekend.results.GP) && weekend.results.GP.length > 0)
    .map((weekend) => {
      const seen = new Set<string>();
      const points = weekend.results.GP!.reduce((total, row) => {
        if (seen.has(row.driverId)) return total;
        seen.add(row.driverId);
        const own = driverMode ? row.driverId === target : (row.teamId ?? teamByDriver.get(row.driverId)) === target;
        return own && Number.isFinite(row.points) && row.points > 0 ? total + row.points : total;
      }, 0);
      return { round: weekend.round, points };
    })
    .filter((round) => Number.isInteger(round.round) && round.round > 0)
    .sort((a, b) => a.round - b.round)
    .slice(-Math.max(0, Math.floor(limit)));
  return {
    rounds,
    points: rounds.reduce((total, item) => total + item.points, 0),
    best: rounds.length ? Math.max(...rounds.map((item) => item.points)) : 0,
    delta: rounds.length > 1 ? rounds[rounds.length - 1].points - rounds[rounds.length - 2].points : null,
  };
}
