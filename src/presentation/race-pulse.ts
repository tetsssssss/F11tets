import type { RaceState } from '../domain/gameplay/types';

/** Live race TV statistics: all numbers derive from actual state or event log. */
export function racePulse(state: RaceState) {
  const active = state.cars.filter((car) => car.status === 'RUNNING');
  const pits = state.cars.reduce((sum, car) => sum + car.pits, 0);
  const passes = state.cars.reduce((sum, car) => sum + car.overtakes, 0);
  const retirements = state.cars.filter((car) => car.status === 'DNF' || car.status === 'DSQ').length;
  const incidents = state.events.filter((event) =>
    /contact|collision|mechanical failure|retirement|puncture|red flag|spin/i.test(event.type),
  ).length;
  const mostActive = [...state.cars].sort((a, b) => b.overtakes - a.overtakes || a.id.localeCompare(b.id))[0];
  return {
    active: active.length,
    field: state.cars.length,
    pits,
    passes,
    retirements,
    incidents,
    mostActiveId: mostActive?.overtakes ? mostActive.id : null,
    mostActiveCount: mostActive?.overtakes ?? 0,
  };
}
