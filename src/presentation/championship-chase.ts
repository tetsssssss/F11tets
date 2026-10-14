import type { Save } from '../domain/types';

/** The nearest championship competitor to the managed driver/team, based only on saved points. */
export function championshipChase(save: Save) {
  if (!save.weekends.some((w) => w.results.GP?.length)) return null;
  const driverMode = save.career.mode === 'driver' && Boolean(save.career.driverId);
  const managedId = driverMode ? save.career.driverId! : save.managedTeam;
  const contenders = driverMode ? save.game.drivers : save.game.teams;
  const points = driverMode ? save.driverPoints : save.game.teamPoints;
  const table = [...contenders].sort((a, b) =>
    (Number(points[b.id]) || 0) - (Number(points[a.id]) || 0) || a.name.localeCompare(b.name),
  );
  const index = table.findIndex((person) => person.id === managedId);
  if (index < 0 || table.length < 2) return null;
  const rival = table[index === 0 ? 1 : index - 1];
  const myPoints = Number(points[managedId]) || 0;
  const rivalPoints = Number(points[rival.id]) || 0;
  // In team mode, compare each team's best classified car. Only finished cars
  // count toward head-to-head; a DNF should not be presented as a clean defeat.
  const driverTeams = new Map(save.game.drivers.map((driver) => [driver.id, driver.teamId]));
  const finishes = (rows: NonNullable<(typeof save.weekends)[number]['results']['GP']>, id: string) =>
    rows.filter((r) => (driverMode ? r.driverId : (r.teamId ?? driverTeams.get(r.driverId))) === id &&
      r.status !== 'DNF' && r.status !== 'DSQ' && Number.isInteger(r.position) && r.position > 0)
      .reduce((best, r) => Math.min(best, r.position), Infinity);
  const duels = save.weekends
    .filter((weekend) => weekend.results.GP?.length)
    .map((weekend) => {
      const mine = finishes(weekend.results.GP!, managedId);
      const theirs = finishes(weekend.results.GP!, rival.id);
      if (!Number.isFinite(mine) || !Number.isFinite(theirs)) return null;
      return { round: weekend.round, outcome: mine < theirs ? 'win' : mine > theirs ? 'loss' : 'tie' } as const;
    })
    .filter((duel): duel is { round: number; outcome: 'win' | 'loss' | 'tie' } => duel !== null);
  return {
    mode: driverMode ? 'driver' : 'team',
    name: rival.name,
    id: rival.id,
    position: (index === 0 ? 1 : index - 1) + 1,
    points: rivalPoints,
    gap: Math.abs(myPoints - rivalPoints),
    direction: rivalPoints > myPoints ? 'ahead' : rivalPoints < myPoints ? 'behind' : 'tied',
    duels: duels.slice(-5),
  };
}