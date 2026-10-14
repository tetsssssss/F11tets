import type { RaceCar } from '../gameplay/types';
import type { RaceControl, RaceEvent } from './types';

/**
 * Classifies *verified* on-track passes independently of strategy and retirement.
 * The simulator updates elapsed times once per lap; a position change alone is not
 * sufficient evidence of a wheel-to-wheel overtake. The scoring and ranking of the
 * cars are intentionally untouched.
 */
export function confirmedOnTrackPasses(
  previous: readonly RaceCar[],
  ranked: readonly RaceCar[],
  pittedDrivers: ReadonlySet<string>,
  lap: number,
  control: RaceControl,
  overtakingDifficulty: number,
): RaceEvent[] {
  if (control !== 'GREEN' || lap <= 0) return [];
  const oldPosition = new Map(previous.map((car, index) => [car.id, index]));
  const newPosition = new Map(ranked.map((car, index) => [car.id, index]));
  const oldCars = new Map(previous.map((car) => [car.id, car]));
  // On lap-level timing, a gap bigger than this at the start of the lap means
  // that a pace differential / error may have created the gain. It is not
  // evidence of an actual close battle. Circuit difficulty only changes the
  // recognition window, not the sporting finishing order.
  const maximumBattleGap = Math.max(0.8, Math.min(2.5, 0.7 + overtakingDifficulty * 0.017));
  const events: RaceEvent[] = [];
  const seen = new Set<string>();
  for (const car of ranked) {
    if (car.status !== 'RUNNING' || pittedDrivers.has(car.id)) continue;
    const priorIndex = oldPosition.get(car.id);
    const currentIndex = newPosition.get(car.id);
    const oldCar = oldCars.get(car.id);
    if (priorIndex === undefined || currentIndex === undefined || !oldCar || priorIndex <= currentIndex) continue;
    for (const competitor of previous.slice(0, priorIndex)) {
      const competitorIndex = newPosition.get(competitor.id);
      if (competitor.status !== 'RUNNING' || competitorIndex === undefined || competitorIndex <= currentIndex) continue;
      if (ranked[competitorIndex]?.status !== 'RUNNING' || pittedDrivers.has(competitor.id)) continue;
      const gap = oldCar.elapsed - competitor.elapsed;
      // A timing-line position reversal caused by a slow lap is not automatically
      // recorded as a genuine on-track pass. Never fabricate an opponent event.
      if (!Number.isFinite(gap) || gap < 0 || gap > maximumBattleGap) continue;
      const key = `${car.id}:${competitor.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        lap,
        driverId: car.id,
        otherId: competitor.id,
        type: 'overtake',
        detail: 'Ganho de posição em disputa próxima, sem paradas ou abandonos.',
      });
    }
  }
  return events;
}
