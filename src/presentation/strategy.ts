import type { Save } from '../domain/types';
import type { Compound } from '../domain/simulation/types';
import { compoundModel } from '../domain/simulation/mechanics';
import { rng, seedFor } from '../domain/simulation/random';
import { pitEstimate } from '../domain/gameplay/commands';
import { raceModifiers, settingsOf } from '../domain/gameplay/settings';
/** How exact the pit wall's numbers are: Casual reads them straight, Simulation gets ranges. */
export type Precision = 'exact' | 'approx' | 'range';
export const COMPOUND_NAMES: Record<Compound, string> = {
  S: 'Macio',
  M: 'Médio',
  H: 'Duro',
  I: 'Intermediário',
  W: 'Chuva',
};
export function strategyPrecision(save: Pick<Save, 'career'>): Precision {
  const s = settingsOf(save);
  if (s.information === 'estimated' || !s.assists.strategyAssist) return 'range';
  return s.preset === 'CASUAL' ? 'exact' : 'approx';
}
/**
 * Everything the strategy panel shows, derived from the running race. Read-only: it calls the
 * same pit estimate the engineer already uses and never issues a pit call or touches the RNG.
 */
export function strategyBrief(save: Save, id: string) {
  const r = save.race!,
    car = r.cars.find((c) => c.id === id)!,
    circuit = save.game.circuits[r.round - 1],
    precision = strategyPrecision(save),
    est = pitEstimate(save, id),
    left = Math.max(0, r.laps - r.lap);
  // A range hides the true figure off-centre, and holds still while the value barely moves.
  const range = (value: number, spread: number, key: string, min = 0, max = Infinity) => {
      const random = rng(seedFor(save.seed, 'strategy', id, key, Math.round(value / spread)));
      return [
        Math.max(min, Math.round(value - spread * (0.5 + random()))),
        Math.min(max, Math.round(value + spread * (0.5 + random()))),
      ] as const;
    },
    show = (value: number, spread: number, key: string, unit = '', digits = 0, max = Infinity) => {
      if (precision === 'exact') return value.toFixed(digits) + unit;
      if (precision === 'approx') return '~' + Math.round(value) + unit;
      const [low, high] = range(value, spread, key, 0, max);
      return low === high ? `${low}${unit}` : `${low}–${high}${unit}`;
    };
  const order = [...r.cars]
      .filter((c) => c.status === 'RUNNING')
      .sort((a, b) => b.lap - a.lap || a.elapsed - b.elapsed),
    index = order.indexOf(car),
    ahead = order[index - 1],
    behind = order[index + 1],
    // Where the car would rejoin if it stopped now: everyone within the pit loss gets by.
    rejoin = 1 + order.filter((c) => c !== car && c.elapsed < car.elapsed + est.loss).length;
  // Wear per lap seen on this stint calibrates every compound; a fresh set falls back to the model.
  const age = Math.max(1, car.tyreAge),
    modelled =
      (0.7 + circuit.abrasion / 100 + ((circuit.frontWear + circuit.rearWear) / 200) * 0.35) *
      raceModifiers(save, r.session).wear,
    factor =
      car.tyreAge >= 2 && car.tyre.wear > 1
        ? car.tyre.wear / age / compoundModel[car.tyre.compound].wear
        : modelled,
    wet = r.weather.water > 0.17,
    recommended: Compound = r.weather.water > 0.55 ? 'W' : wet ? 'I' : left > 22 ? 'H' : 'M';
  const life = (compound: Compound, from = 0) =>
    Math.max(0, (70 - from) / Math.max(0.3, compoundModel[compound].wear * factor));
  const options = (['S', 'M', 'H', 'I', 'W'] as Compound[]).map((compound) => {
    const rain = compound === 'I' || compound === 'W',
      laps = life(compound);
    return {
      compound,
      name: COMPOUND_NAMES[compound],
      suits: rain === wet,
      current: car.tyre.compound === compound,
      recommended: compound === recommended,
      laps,
      life: show(laps, Math.max(2, laps * 0.14), 'life' + compound, ' v'),
      note: rain === wet ? '' : rain ? 'só com pista molhada' : 'sem aderência na água',
    };
  });
  const remaining = life(car.tyre.compound, car.tyre.wear),
    first = r.lap + 1 + Math.max(0, Math.round(remaining) - 2),
    last = Math.min(r.laps, r.lap + 1 + Math.round(remaining) + 1),
    noStop = remaining >= left && wet === ['I', 'W'].includes(car.tyre.compound);
  const gap = (a?: (typeof order)[number], b?: (typeof order)[number]) =>
    a && b ? Math.abs(a.elapsed - b.elapsed) : null;
  return {
    precision,
    position: index + 1,
    lapsLeft: left,
    tyre: {
      compound: car.tyre.compound,
      name: COMPOUND_NAMES[car.tyre.compound],
      wear: show(car.tyre.wear, 4, 'wear', '%', 0, 100),
      stint: car.tyreAge,
      temperature: Math.round(car.tyre.temperature),
      remaining: show(remaining, Math.max(2, remaining * 0.14), 'remaining', ' v'),
    },
    options,
    recommended,
    pitLoss: show(est.loss, 1.6, 'loss', ' s', 1),
    rejoin:
      precision === 'exact'
        ? 'P' + rejoin
        : precision === 'approx'
          ? '~P' + rejoin
          : (() => {
              const [low, high] = range(rejoin, 1, 'rejoin', 1, order.length);
              return low === high ? 'P' + low : `P${low}–P${high}`;
            })(),
    rejoinPosition: rejoin,
    traffic:
      est.traffic === 0
        ? 'pista livre'
        : precision === 'range'
          ? est.traffic > 2
            ? 'tráfego pesado'
            : 'algum tráfego'
          : `${est.traffic} carro(s) na saída`,
    window: noStop
      ? 'sem parada necessária'
      : first >= r.laps
        ? 'fim de prova'
        : precision === 'exact'
          ? `voltas ${first}–${last}`
          : `voltas ${Math.max(r.lap + 1, first - 1)}–${Math.min(r.laps, last + 1)}`,
    neutral: r.control !== 'GREEN',
    weather: {
      condition: r.weather.condition,
      air: Math.round(r.weather.air),
      track: Math.round(r.weather.track),
      wet,
      rain:
        precision === 'range'
          ? (() => {
              const low = Math.max(0, Math.floor((r.weather.forecast - 8) / 10) * 10);
              return `${low}–${Math.min(100, low + 20)}%`;
            })()
          : Math.round(r.weather.forecast) + '%',
    },
    battery: show(save.game.cars[id].battery, 4, 'battery', '%', 0, 100),
    gapAhead: gap(car, ahead),
    gapBehind: gap(car, behind),
    call: r.pitCalls[id] as { lap: number; compound: Compound } | undefined,
    holding: (r.commands[id]?.holdUntil ?? 0) >= r.lap + 1,
  };
}
export type StrategyBrief = ReturnType<typeof strategyBrief>;
