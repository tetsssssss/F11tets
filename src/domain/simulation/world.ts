import type { Save } from '../types';
import { drivers } from '../../data/drivers';
import { teams } from '../../data/teams';
import { engineers } from '../../data/engineers';
import { circuits } from '../../data/circuits';
import { engines, batteries, tires } from '../../data/suppliers';
import { relationshipLabels, makeRatings } from '../../data/attributes';
import type { Universe, Stats, Decision, CircuitModel } from './types';
import { seedFor } from './random';
export type EngineSource = (typeof engines)[number];
export type BatterySource = (typeof batteries)[number];
export type TyreSource = (typeof tires)[number];
export const pairKey = (a: string, b: string) => [a, b].sort().join('|');
export const emptyStats = (): Stats => ({
  starts: 0,
  wins: 0,
  podiums: 0,
  poles: 0,
  fastestLaps: 0,
  dnfs: 0,
  sprintWins: 0,
  points: 0,
  overtakes: 0,
  finishes: [],
  qualifying: [],
});
export const defaultDecision = (): Decision => ({
  compound: 'M',
  engineMap: 'Race',
  energy: 'Race',
  regen: 2,
  aero: 'Flow',
  wing: 50,
  balance: 50,
  pace: 'Equilibrado',
  pitLap: 0,
  orders: false,
});
// Editorial physical profiles. Not official telemetry. Every venue has independent values.
export const circuitModels: CircuitModel[] = circuits.map((c, i) => ({
  ...c,
  straights: 2 + (i % 4),
  averageSpeed: 160 + ((i * 17) % 85),
  aero: 35 + ((i * 19) % 60),
  abrasion: 30 + ((i * 13) % 65),
  overtaking: 20 + ((i * 23) % 75),
  rainSensitivity: 30 + ((i * 7) % 65),
  frontWear: 35 + ((i * 11) % 55),
  rearWear: 35 + ((i * 17) % 55),
  braking: 35 + ((i * 29) % 60),
  regeneration: 40 + ((i * 13) % 55),
  power: 30 + ((i * 31) % 65),
  traction: 40 + ((i * 19) % 55),
  ...(c.name === 'Monza' ? { aero: 25, power: 96, averageSpeed: 245, overtaking: 82 } : {}),
  ...(c.name === 'Circuit de Monaco'
    ? { aero: 95, power: 25, averageSpeed: 155, overtaking: 8 }
    : {}),
  ...(c.name === 'Suzuka' ? { aero: 86, frontWear: 86, abrasion: 77 } : {}),
}));
export function createUniverse(seed: number): Universe {
  const ds = structuredClone(drivers).map((d) => ({
    ...d,
    salary: Math.round((d.rating - 65) * 0.35 * 10) / 10,
  }));
  const ts = structuredClone(teams).map((t, i) => ({
    ...t,
    battery: batteries[i % batteries.length].name,
  }));
  const relationships: Universe['relationships'] = {};
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++)
      relationships[pairKey(ds[i].id, ds[j].id)] = makeRatings(
        relationshipLabels,
        ds[i].teamId === ds[j].teamId ? 65 : 55,
        i * 31 + j,
      );
  return {
    engineVersion: 2,
    seasonSeed: seed,
    phase: 'season',
    drivers: ds,
    teams: ts,
    engineers: structuredClone(engineers),
    circuits: structuredClone(circuitModels),
    engines: structuredClone(engines),
    batteries: structuredClone(batteries),
    tyres: structuredClone(tires),
    cars: Object.fromEntries(
      ds.map((d) => [
        d.id,
        {
          mileage: 0,
          wear: 0,
          temperature: 90,
          fuel: 100,
          battery: 90,
          batteryTemperature: 35,
          batteryWear: 0,
          damage: {
            frontWing: 0,
            rearWing: 0,
            floor: 0,
            suspension: 0,
            tyre: 0,
            powerUnit: 0,
            battery: 0,
          },
          upgradeSeconds: 0,
        },
      ]),
    ),
    setups: Object.fromEntries(
      ds.map((d) => [
        d.id,
        {
          confidence: 20,
          tyreUnderstanding: 10,
          batteryUnderstanding: 10,
          setsUsed: 0,
          learnedWing: 50,
          learnedBalance: 50,
        },
      ]),
    ),
    decisions: Object.fromEntries(ds.map((d) => [d.id, defaultDecision()])),
    knowledge: Object.fromEntries(
      ds.map((d) => [
        d.id,
        Object.fromEntries(
          circuits.map((c, i) => [
            c.id,
            makeRatings(
              Object.keys(d.circuitAttributes),
              d.rating - 12,
              i + drivers.indexOf(drivers.find((x) => x.id === d.id)!),
            ),
          ]),
        ),
      ]),
    ),
    relationships,
    finances: Object.fromEntries(
      ts.map((t) => [t.id, { cash: t.budget, income: t.budget, expenses: 0, ledger: [] }]),
    ),
    contracts: [
      ...ds.map((d) => ({
        id: `driver-${d.id}`,
        kind: 'driver' as const,
        personId: d.id,
        teamId: d.teamId,
        until: d.contract,
        salary: d.salary!,
        buyout: d.salary! * 1.5,
        status: 'active' as const,
        option: false,
        performanceClause: 50,
      })),
      ...engineers.map((e) => ({
        id: `engineer-${e.id}`,
        kind: 'engineer' as const,
        personId: e.id,
        teamId: e.teamId,
        until: 2030,
        salary: 1.2,
        buyout: 1.8,
        status: 'active' as const,
        option: false,
        performanceClause: 20,
      })),
    ],
    development: [],
    atr: Object.fromEntries(ts.map((t, i) => [t.id, 75 + i * 5])),
    news: [],
    interviews: [],
    reputation: Object.fromEntries([
      ...ds.map((d) => [d.id, d.rating]),
      ...ts.map((t) => [t.id, t.prestige]),
    ]),
    stats: Object.fromEntries(ds.map((d) => [d.id, emptyStats()])),
    teamStats: Object.fromEntries(ts.map((t) => [t.id, emptyStats()])),
    teamPoints: Object.fromEntries(ts.map((t) => [t.id, 0])),
    constructorBonus: Object.fromEntries(ts.map((t) => [t.id, 0])),
    penalties: [],
    discipline: Object.fromEntries(ds.map((d) => [d.id, 0])),
    gridPenalties: {},
    history: [],
    champions: [
      { season: 2026, driver: 'Andrea Kimi Antonelli', team: 'Mercedes' },
      { season: 2027, driver: 'Andrea Kimi Antonelli', team: 'Mercedes' },
      { season: 2028, driver: 'Lando Norris', team: 'McLaren' },
    ],
    weather: {
      condition: 'seco',
      air: 24,
      track: 34,
      wind: 12,
      humidity: 55,
      intensity: 0,
      water: 0,
      grip: 95,
      forecast: 10,
    },
    champion: null,
    constructorChampion: null,
    philosophies: Object.fromEntries(
      ts.map((t, i) => [
        t.id,
        {
          risk: t.id === 'bugatti' ? 85 : t.id === 'porsche' ? 35 : 40 + ((i * 7) % 45),
          ambition: t.id === 'ferrari' ? 98 : t.potential,
          patience: t.id === 'williams' ? 85 : 45 + ((i * 9) % 40),
          development: 55 + ((i * 13) % 40),
        },
      ]),
    ),
  };
}

export function cloneState(save: Save): Save {
  return {
    ...save,
    world: {
      ...structuredClone({ ...save.world, closing: null, seasonRoster: null, feederHistory: [] }),
      closing: save.world.closing,
      seasonRoster: save.world.seasonRoster,
      feederHistory: [...save.world.feederHistory],
    },
    career: structuredClone(save.career),
    race: save.race
      ? { ...structuredClone({ ...save.race, frames: [] }), frames: [...save.race.frames] }
      : null,
    driverPoints: { ...save.driverPoints },
    weekends: save.weekends.map((w) => ({
      ...w,
      results: { ...w.results },
      tapes: { ...w.tapes },
    })),
    game: { ...structuredClone({ ...save.game, history: [] }), history: [...save.game.history] },
  };
}
