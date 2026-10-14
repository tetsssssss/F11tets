import type { Save, Driver } from '../types';
import type { CircuitModel, Decision, Weather, TyreState, Compound, CarState } from './types';
import { clamp, mean, round, rng, seedFor } from './random';
export const energyModes = {
  Save: { power: 0.1, drain: 3, heat: 0.2 },
  Race: { power: 0.45, drain: 6, heat: 0.6 },
  Attack: { power: 0.8, drain: 9, heat: 1 },
  Boost: { power: 1.1, drain: 13, heat: 1.5 },
  Overtake: { power: 1.3, drain: 16, heat: 1.8 },
};
export const compoundModel = {
  H: { pace: 0.65, wear: 0.85, target: 96 },
  M: { pace: 0.25, wear: 1.2, target: 92 },
  S: { pace: -0.2, wear: 1.65, target: 88 },
  I: { pace: 1.2, wear: 1.3, target: 65 },
  W: { pace: 2, wear: 1.1, target: 55 },
};
export function weatherAt(
  c: CircuitModel,
  seed: number,
  lap: number,
  previous?: Weather,
  variability = 1,
): Weather {
  const random = rng(seedFor(seed, 'weather', Math.floor(lap / 4)));
  const forecast = clamp(c.rain + (random() - 0.5) * 24 * variability);
  const intensity = clamp(
    (forecast / 100 + Math.sin(lap / 13 + (seed % 7)) * 0.3 - 0.42) * 1.8,
    0,
    1,
  );
  const water = clamp(
    (previous?.water ?? intensity * 0.5) * 0.72 + intensity * 0.34 - (intensity < 0.1 ? 0.045 : 0),
    0,
    1,
  );
  const condition =
    intensity > 0.65
      ? 'chuva forte'
      : intensity > 0.35
        ? 'chuva moderada'
        : intensity > 0.1
          ? 'chuva leve'
          : water > 0.25
            ? 'pista secando'
            : water > 0.06
              ? 'pista mista'
              : forecast > 25
                ? 'nublado'
                : 'seco';
  return {
    condition,
    air: round(c.temperature + (random() - 0.5) * 5),
    track: round(c.temperature + 12 - intensity * 15),
    wind: c.wind + random() * 6,
    humidity: round(45 + water * 50),
    intensity: round(intensity),
    water: round(water),
    grip: round(clamp(c.grip + Math.min(lap, 12) * 0.3 - water * 32, 40, 100)),
    forecast: round(forecast),
  };
}
export const suitableTyre = (weather: Weather): Compound =>
  weather.water > 0.55 ? 'W' : weather.water > 0.17 ? 'I' : 'M';
export function newTyres(compound: Compound): TyreState {
  return {
    compound,
    temperature: 65,
    wear: 0,
    graining: 0,
    overheating: 0,
    life: 100,
    punctureRisk: 0,
  };
}
export function tyreStep(
  tyre: TyreState,
  d: Driver,
  save: Save,
  c: CircuitModel,
  w: Weather,
  decision: Decision,
  neutral = false,
): TyreState {
  const team = save.game.teams.find((t) => t.id === d.teamId)!;
  const brand = save.game.tyres.find((t) => t.name === team.tires)!;
  const spec = compoundModel[tyre.compound];
  const warmth = (brand.values[0] + team.attributes['Aquecimento dos pneus']) / 200;
  const target =
    spec.target +
    w.track * 0.1 +
    (decision.pace === 'Atacar' ? 6 : decision.pace === 'Conservar' ? -5 : 0) -
    w.water * 20 -
    (neutral ? 18 : 0);
  const temperature = tyre.temperature + (target - tyre.temperature) * (0.18 + warmth * 0.1);
  const window = 12 + brand.values[3] * 0.08;
  const overheating = Math.max(0, temperature - spec.target - window);
  const graining = clamp(tyre.graining + (temperature < spec.target - 15 ? 0.25 : -0.15));
  const management =
    (d.attributes['Gestão de pneus'] +
      team.attributes['Gestão de pneus'] +
      brand.values[2] +
      brand.values[1]) /
    400;
  const axle = (c.frontWear + c.rearWear) / 200;
  const setupPenalty =
    (100 - save.game.setups[d.id].confidence) / 180 +
    (100 - save.game.setups[d.id].tyreUnderstanding) / 500;
  const wear = clamp(
    tyre.wear +
      spec.wear *
        (decision.suspension === 'Macia' ? 0.96 : decision.suspension === 'Rígida' ? 1.04 : 1) *
        (0.7 + c.abrasion / 100 + axle * 0.35) *
        (1.35 - management * 0.7) *
        (neutral ? 0.5 : 1) *
        (decision.pace === 'Atacar' ? 1.25 : decision.pace === 'Conservar' ? 0.8 : 1) +
      overheating * 0.03 +
      setupPenalty * 0.15,
  );
  return {
    ...tyre,
    temperature: round(temperature),
    wear: round(wear),
    graining: round(graining),
    overheating: round(overheating),
    life: round(100 - wear),
    punctureRisk: Math.max(0, wear - 82) / 1500,
  };
}
export function powerStep(
  car: CarState,
  d: Driver,
  save: Save,
  c: CircuitModel,
  w: Weather,
  decision: Decision,
  neutral = false,
) {
  const team = save.game.teams.find((t) => t.id === d.teamId)!;
  const battery = save.game.batteries.find((b) => b.name === team.battery)!;
  const a = battery.attributes;
  const mode = energyModes[decision.energy];
  const map = decision.engineMap === 'Economy' ? 0.8 : decision.engineMap === 'Quali' ? 1.22 : 1;
  const quality = mean(Object.values(a)) / 100;
  const skill =
    (d.attributes['Gestão de energia'] +
      save.game.engineers.find((e) => e.driverId === d.id)!.attributes['Gestão de energia']) /
    200;
  const regeneration =
    (c.regeneration / 100) *
    (decision.regen * 1.4 + 1) *
    (a.Regeneração / 100) *
    (1 + skill * 0.25 + save.game.setups[d.id].batteryUnderstanding / 1000);
  const discharge =
    mode.drain *
    (neutral ? 0.3 : 1) *
    (1.3 - a.Eficiência / 200) *
    (1 + (decision.wing / 100) * 0.1);
  const available = clamp(car.battery / 20, 0, 1);
  const boost =
    mode.power * available * (a['Potência de descarga'] / 100) * (1 - car.batteryWear / 250);
  car.battery = round(clamp(car.battery + regeneration - discharge));
  car.batteryTemperature = round(
    clamp(
      car.batteryTemperature + mode.heat - (a['Gestão térmica'] / 100) * 0.7 + (w.air - 25) * 0.015,
      20,
      90,
    ),
  );
  car.batteryWear = round(
    clamp(car.batteryWear + 0.005 * (2 - quality) + (car.batteryTemperature > 65 ? 0.03 : 0)),
  );
  car.temperature = round(
    clamp(
      car.temperature +
        mode.heat * 0.35 +
        (map - 1) * 2 +
        (w.air - 25) * 0.02 -
        (team.attributes.Refrigeração / 100) * 0.35,
      75,
      140,
    ),
  );
  car.fuel = round(Math.max(0, car.fuel - (1.3 + mode.power * 0.4) * (1.1 - quality * 0.15) * map));
  car.wear = round(
    clamp(car.wear + 0.025 * (1 + mode.power) * map + (car.temperature > 115 ? 0.15 : 0)),
  );
  car.mileage = round(car.mileage + c.km);
  return boost + (map - 1) * 1.5;
}
export function setupQuality(c: CircuitModel, decision: Decision) {
  const targetWing = c.aero;
  const targetBalance = 45 + (c.frontWear - c.rearWear) * 0.2;
  return clamp(
    100 -
      Math.abs(decision.wing - targetWing) * 0.8 -
      Math.abs(decision.balance - targetBalance) * 1.1 -
      (Math.abs((decision.frontWing ?? targetWing) - targetWing) +
        Math.abs((decision.rearWing ?? targetWing) - targetWing)) *
        0.12 -
      Math.abs((decision.rideHeight ?? 50) - 50) * 0.1 -
      Math.abs((decision.differential ?? c.traction) - c.traction) * 0.1 -
      Math.abs((decision.brakeMigration ?? c.braking) - c.braking) * 0.08 -
      Math.abs((decision.cooling ?? c.temperature * 2) - c.temperature * 2) * 0.06,
  );
}
export function performance(
  save: Save,
  d: Driver,
  c: CircuitModel,
  w: Weather,
  decision: Decision,
  tyre: TyreState,
  boost: number,
  qualifying = false,
) {
  const g = save.game;
  const t = g.teams.find((t) => t.id === d.teamId)!;
  const e = g.engineers.find((e) => e.driverId === d.id)!;
  const car = g.cars[d.id];
  const engine = g.engines.find((x) => x.name === t.engine)!;
  // Every base attribute and dynamic contributes; specialist weights then respond to this circuit.
  const driverBase = mean(Object.values(d.attributes));
  const driverDynamic = mean(d.dynamics.map((x) => x.value));
  const technical = mean(Object.values(t.attributes));
  const teamDynamic = mean(
    t.dynamics.map((x) => (/Pressão/.test(x.label) ? 100 - x.value : x.value)),
  );
  const engineer =
    mean(Object.values(e.attributes)) * 0.7 +
    mean(e.dynamics.map((x) => (x.label === 'Pressão' ? 100 - x.value : x.value))) * 0.3;
  const knowledge = mean(Object.values(g.knowledge[d.id][c.id]));
  const corner =
    (t.attributes['Curvas lentas'] * c.traction +
      t.attributes['Curvas médias'] * 50 +
      t.attributes['Curvas rápidas'] * c.aero) /
    (c.traction + 50 + c.aero);
  const handling = mean(
    ['Frenagem', 'Entrada de curva', 'Meio de curva', 'Saída de curva', 'Controle do carro'].map(
      (k) => d.attributes[k],
    ),
  );
  const wetPenalty = (w.water * (4 + (100 - d.attributes.Chuva) * 0.045) * c.rainSensitivity) / 75;
  const expectedTyre = suitableTyre(w);
  const mismatch =
    expectedTyre === 'W' && !['W', 'I'].includes(tyre.compound)
      ? 10 * w.water
      : expectedTyre === 'I' && !['W', 'I'].includes(tyre.compound)
        ? 5 * w.water
        : w.water < 0.1 && ['W', 'I'].includes(tyre.compound)
          ? 3.5
          : 0;
  const setup = setupQuality(c, decision);
  const aero =
    decision.aero === 'Corner'
      ? (100 - c.aero) * 0.004 - c.aero * 0.002
      : decision.aero === 'Straight'
        ? (100 - c.power) * 0.005 - c.power * 0.002
        : decision.aero === 'Follow'
          ? 0.1
          : 0;
  const layers = {
    driver: (100 - driverBase) * 0.038,
    car: (100 - technical) * 0.033,
    corners: (((100 - corner) * c.aero) / 100) * 0.018,
    handling: (((100 - handling) * c.braking) / 100) * 0.01,
    power: (((100 - mean(Object.values(engine.attributes))) * c.power) / 100) * 0.018,
    battery: -boost * 0.55,
    tyres:
      compoundModel[tyre.compound].pace +
      tyre.wear * 0.027 +
      tyre.graining * 0.012 +
      tyre.overheating * 0.04 +
      mismatch,
    engineer: (100 - engineer) * 0.012,
    adaptation: (100 - knowledge) * 0.014,
    setup: (100 - setup) * 0.026,
    weather: wetPenalty + w.wind * 0.004 + (100 - w.grip) * 0.009,
    form: (100 - driverDynamic) * 0.009 + (100 - teamDynamic) * 0.008,
    confidence: (100 - g.setups[d.id].confidence) * 0.004,
    fatigue: (save.world.people[d.id]?.fatigue ?? 0) * 0.004,
    aero,
    damage: mean(Object.values(car.damage)) * 0.045 + car.wear * 0.006,
    upgrade: -car.upgradeSeconds,
    session: (100 - d.attributes[qualifying ? 'Classificação' : 'Ritmo de corrida']) * 0.023,
  };
  return {
    lap: (c.km / c.averageSpeed) * 3600 + Object.values(layers).reduce((a, b) => a + b, 0),
    layers,
  };
}
export function learnPractice(save: Save, ids: string[], c: CircuitModel) {
  for (const id of ids) {
    const d = save.game.drivers.find((d) => d.id === id)!;
    const e = save.game.engineers.find((e) => e.driverId === id)!;
    const setup = save.game.setups[id];
    const communication =
      (e.attributes.Comunicação + d.attributes['Feedback técnico'] + e.synergy) / 300;
    setup.confidence = clamp(setup.confidence + 12 + communication * 10);
    setup.tyreUnderstanding = clamp(setup.tyreUnderstanding + 18);
    setup.batteryUnderstanding = clamp(setup.batteryUnderstanding + 15);
    const focus = save.game.decisions[id].practiceFocus;
    if (focus === 'Tyres' || focus === 'Long Run')
      setup.tyreUnderstanding = clamp(setup.tyreUnderstanding + 8);
    if (focus === 'Battery') setup.batteryUnderstanding = clamp(setup.batteryUnderstanding + 10);
    if (focus === 'Aero' || focus === 'Setup') setup.confidence = clamp(setup.confidence + 5);
    e.synergy = clamp(e.synergy + 1 + communication);
    setup.setsUsed += 2;
    setup.learnedWing = round(
      setup.learnedWing + (c.aero - setup.learnedWing) * communication * 0.6,
    );
    setup.learnedBalance = round(
      setup.learnedBalance +
        (45 + (c.frontWear - c.rearWear) * 0.2 - setup.learnedBalance) * communication * 0.6,
    );
    if (d.teamId !== save.managedTeam) {
      save.game.decisions[id].wing = setup.learnedWing;
      save.game.decisions[id].balance = setup.learnedBalance;
    }
    for (const key in save.game.knowledge[id][c.id])
      save.game.knowledge[id][c.id][key] = clamp(
        save.game.knowledge[id][c.id][key] + 0.8 + communication * 0.7,
      );
  }
}
