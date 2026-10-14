import type { RaceCar } from '../domain/gameplay/types';

type TimingCar = Pick<RaceCar, 'id' | 'lap' | 'elapsed' | 'status'>;

/** A lap deficit is not an elapsed-time interval. This formats recorded race state only. */
export function formatRaceGap(car: TimingCar, reference?: TimingCar): string {
  if (car.status !== 'RUNNING') return car.status;
  if (!reference || reference.status !== 'RUNNING') return '—';
  if (car.id === reference.id) return 'LÍDER';
  const lapsBehind = reference.lap - car.lap;
  if (!Number.isFinite(lapsBehind) || lapsBehind < 0) return '—';
  if (lapsBehind > 0) return `+${lapsBehind}V`;
  const seconds = car.elapsed - reference.elapsed;
  return Number.isFinite(seconds) && seconds >= 0 ? `+${seconds.toFixed(1)}s` : '—';
}
