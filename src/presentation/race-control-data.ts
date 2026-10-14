import type { RaceCar, RaceState } from '../domain/gameplay/types';
import type { Compound } from '../domain/simulation/types';

export type GapView = 'full' | 'near' | 'compare';

/** Filters the official classification; it never recomputes sporting positions. */
export function gapRows(order: RaceCar[], focusId: string | null, view: GapView, compareId: string | null): RaceCar[] {
  if (view === 'full') return order;
  const index = order.findIndex(car => car.id === focusId);
  if (view === 'near') return index < 0 ? order.slice(0, 5) : order.slice(Math.max(0, index - 2), index + 3);
  return order.filter(car => car.id === focusId || car.id === compareId);
}

/** Only stored lap snapshots qualify as history. */
export function lapHistory(race: RaceState, driverId: string): { lap: number; seconds: number }[] {
  return race.frames.flatMap(frame => {
    const car = frame.cars.find(item => item.id === driverId);
    return car && typeof car.lastLap === 'number' && Number.isFinite(car.lastLap) && car.lastLap > 0
      ? [{ lap: frame.lap, seconds: car.lastLap }]
      : [];
  });
}

/** Compounds are listed only if actual snapshots captured them. */
export function tyreHistory(race: RaceState, driverId: string): Compound[] {
  if (!race.frames.length) return [];
  const result: Compound[] = [];
  for (const frame of race.frames) {
    const compound = frame.cars.find(car => car.id === driverId)?.tyre;
    if (compound && result.at(-1) !== compound) result.push(compound);
  }
  const current = race.cars.find(car => car.id === driverId)?.tyre.compound;
  if (current && result.at(-1) !== current) result.push(current);
  return result;
}

/** Positive means places gained since the prior stored snapshot. */
export function positionChange(race: RaceState, driverId: string): number | null {
  if (race.frames.length < 2) return null;
  const prior = race.frames.at(-2)?.cars.find(car => car.id === driverId)?.position;
  const current = race.frames.at(-1)?.cars.find(car => car.id === driverId)?.position;
  return typeof prior === 'number' && typeof current === 'number' ? prior - current : null;
}
