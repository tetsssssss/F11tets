import type { Save } from '../domain/types';

/** A read-only season snapshot. No generated stories or extra state in the save. */
export function seasonPulse(save: Save) {
  const completedRounds = new Set(
    save.weekends.filter((weekend) => Array.isArray(weekend.results.GP) && weekend.results.GP!.length > 0).map((weekend) => weekend.round),
  );
  const total = save.game.circuits.length;
  const completed = completedRounds.size;
  const recentRace = [...save.weekends]
    .reverse()
    .find((weekend) => Array.isArray(weekend.results.GP) && weekend.results.GP!.length);
  const winnerId = recentRace?.results.GP?.find((result) => result.position === 1)?.driverId;
  const lastWinner = winnerId ? save.game.drivers.find((driver) => driver.id === winnerId) : undefined;
  const standings = completed
    ? [...save.game.drivers]
        .sort((a, b) => (save.driverPoints[b.id] ?? 0) - (save.driverPoints[a.id] ?? 0) || a.name.localeCompare(b.name))
        .slice(0, 3)
        .map((driver, index) => ({
          id: driver.id,
          name: driver.name,
          position: index + 1,
          points: save.driverPoints[driver.id] ?? 0,
        }))
    : [];
  // In a finished weekend the next event is the next unplayed GP, never the already-finished one.
  const upcoming = save.game.circuits
    .filter((circuit) => circuit.round >= save.round && !completedRounds.has(circuit.round))
    .slice(0, 3)
    .map((circuit) => ({ id: circuit.id, round: circuit.round, name: circuit.name, country: circuit.country }));
  const news = save.game.news
    .filter((item) => item.season === save.season)
    .slice(-3)
    .reverse()
    .map(({ id, category, title, round }) => ({ id, category, title, round }));
  return { total, completed, standings, upcoming, news, lastWinner: lastWinner?.name ?? null };
}
