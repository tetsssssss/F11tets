import type { RaceCar } from '../gameplay/types';

/**
 * Lap-time simulations need a traffic model: being faster than a car ahead is
 * not proof of passing it. Only a successful close-range racing move (or a
 * pit/retirement) may reverse on-track order. This models lost time in traffic
 * without touching the race clock of a legitimately leading car.
 *
 * Cars are visited in their *previous* running order, so a blocked driver
 * cannot teleport past a train of cars. No random draws are consumed here.
 */
export function enforceTrackOrder(
  previous: readonly RaceCar[],
  active: readonly RaceCar[],
  successfulMoves: ReadonlySet<string>,
  pittedDrivers: ReadonlySet<string>,
): number {
  const current = new Map(active.map(car => [car.id, car]));
  let held = 0;
  const ahead: RaceCar[] = [];
  for (const old of previous) {
    const car = current.get(old.id);
    if (!car || car.status !== 'RUNNING') continue;
    if (!pittedDrivers.has(car.id)) {
      for (const other of ahead) {
        if (pittedDrivers.has(other.id) || successfulMoves.has(`${car.id}:${other.id}`)) continue;
        // Tiny order separation is enough. The driver had less free-air pace,
        // so the lost time is charged to this lap, including fastest-lap data.
        const necessary = other.elapsed + 0.06;
        if (car.elapsed < necessary) {
          const delay = necessary - car.elapsed;
          car.elapsed = necessary;
          car.last += delay;
          held++;
        }
      }
    }
    ahead.push(car);
  }
  return held;
}
