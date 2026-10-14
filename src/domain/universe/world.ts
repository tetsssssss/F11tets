import type { Save, Driver, Engineer } from '../types';
import type { Universe, Contract } from '../simulation/types';
import type { WorldState, DriverRecord, ContractTerms } from './types';
import {
  makeRatings,
  makeDynamics,
  driverGroups,
  driverDynamicLabels,
  circuitLabels,
  relationshipLabels,
} from '../../data/attributes';
import { clamp, rng, seedFor, mean } from '../simulation/random';
import { defaultDecision, emptyStats, pairKey } from '../simulation/world';

const origins = [
  ['BR', '🇧🇷', 'Caio', 'Ribeiro'],
  ['GB', '🇬🇧', 'Elliot', 'Hughes'],
  ['JP', '🇯🇵', 'Ren', 'Nakamura'],
  ['FR', '🇫🇷', 'Luc', 'Moreau'],
  ['IT', '🇮🇹', 'Matteo', 'Conti'],
  ['DE', '🇩🇪', 'Jonas', 'Vogel'],
  ['AR', '🇦🇷', 'Tomás', 'Vega'],
  ['US', '🇺🇸', 'Noah', 'Reed'],
  ['ES', '🇪🇸', 'Adrián', 'Soler'],
  ['AU', '🇦🇺', 'Theo', 'Foster'],
  ['ZA', '🇿🇦', 'Luca', 'Mokoena'],
  ['MX', '🇲🇽', 'Diego', 'Luna'],
];
export const allDrivers = (s: Save) => [...s.game.drivers, ...s.world.pool];
export const allEngineers = (s: Save) => [...s.game.engineers, ...s.world.engineerPool];
export const driverRecord = (
  seed: number,
  d: Driver,
  status: DriverRecord['status'] = 'ACTIVE',
): DriverRecord => ({
  status,
  academy: status === 'ACTIVE' ? null : d.teamId,
  provenance: status === 'ACTIVE' ? 'BRIEF' : 'PROCEDURAL',
  personality: (['calm', 'competitive', 'ambitious', 'patient'] as const)[seedFor(seed, d.id) % 4],
  motivation: 75,
  fatigue: 0,
  injuryUntil: 0,
  suspendedUntil: 0,
  licensePoints: status === 'DEVELOPMENT' ? 20 : 40,
  scouting: status === 'ACTIVE' ? 100 : 20,
  category: status === 'ACTIVE' ? 'F1' : status === 'DEVELOPMENT' ? 'F3' : 'F2',
  marketValue: Math.max(0.5, (d.rating - 55) * 0.22),
  retiredSeason: null,
  debut: status === 'ACTIVE' ? 2029 : null,
});
export function proceduralDriver(
  seed: number,
  season: number,
  index: number,
  teamId = 'free',
): Driver {
  const random = rng(seedFor(seed, season, index, 'junior')),
    o = origins[Math.floor(random() * origins.length)],
    second = origins[(index + Math.floor(random() * origins.length)) % origins.length];
  const rating = 62 + Math.floor(random() * 17),
    potential = clamp(rating + 8 + random() * 18, 70, 98);
  return {
    id: `junior-${season}-${index}`,
    name: `${o[2]} ${second[3]} ${String(index + 1).padStart(2, '0')}`,
    short: `J${index.toString(36).toUpperCase().padStart(2, '0')}`,
    teamId,
    number: 100 + index,
    country: o[0],
    flag: o[1],
    age: 17 + Math.floor(random() * 6),
    rating,
    potential: Math.round(potential),
    contract: season + 2,
    salary: 0.4 + rating / 100,
    attributes: makeRatings(Object.values(driverGroups).flat(), rating, index + season),
    dynamics: makeDynamics(driverDynamicLabels, rating - 4, index),
    circuitAttributes: makeRatings(circuitLabels, rating - 5, index),
  };
}
export function initialTerms(c: Contract, season: number): ContractTerms {
  return {
    start: Math.min(2029, season),
    role: c.kind === 'driver' ? 'EQUAL STATUS' : 'RESERVE',
    performanceBonus: 0.08,
    championshipBonus: 0.2,
    optionYears: 1,
    teamOption: c.option,
    driverOption: false,
    releaseBelow: 0,
    promises: [],
  };
}
export function createPersistentWorld(seed: number, season: number, g: Universe): WorldState {
  // The 48 academy seats remain unchanged, plus 16 independent young drivers who
  // can enter F2/F3, be scouted and earn a contract. Existing v4 saves are not expanded.
  const academyPool = g.teams.flatMap((t, i) =>
    [0, 1, 2].map((j) => proceduralDriver(seed, season, i * 3 + j, t.id)),
  );
  const independentPool = Array.from({ length: 16 }, (_, i) =>
    proceduralDriver(seed, season, academyPool.length + i, 'free'),
  );
  const pool = [...academyPool, ...independentPool];
  const people = Object.fromEntries([
    ...g.drivers.map((d) => [d.id, driverRecord(seed, d)]),
    ...pool.map((d, i) => [
      d.id,
      {
        ...driverRecord(seed, d, i >= academyPool.length ? 'FREE AGENT' : i % 3 === 2 ? 'DEVELOPMENT' : 'RESERVE'),
        category: i >= academyPool.length ? (i % 2 === 0 ? 'F2' : 'F3') : i % 3 === 2 ? 'F3' : 'F2',
        academy: i >= academyPool.length ? null : d.teamId,
      },
    ]),
  ]);
  return {
    version: 1,
    league: {
      teamCount: g.teams.length,
      driverCount: g.drivers.length,
      calendarSize: g.circuits.length,
      licenseThreshold: 40,
      rookiePracticeTarget: 2,
      componentAllocation: 4,
      extraComponentGridPenalty: 5,
      provisionalRules: [
        '48 vagas de academia e 16 talentos independentes procedurais: lista nominal do briefing não fornecida.',
        'Superlicença: 40 pontos; TL1 rookie: 2/equipe/ano; 4 unidades/componentes, +5 posições por extra. Parâmetros provisórios editáveis.',
      ],
    },
    pool,
    engineerPool: [],
    people,
    terms: Object.fromEntries(g.contracts.map((c) => [c.id, initialTerms(c, season)])),
    organizations: Object.fromEntries(
      g.teams.map((t, i) => [
        t.id,
        {
          owner: {
            patience: g.philosophies[t.id].patience,
            ambition: t.prestige,
            spending: 60 + ((i * 7) % 35),
            interference: 25 + ((i * 9) % 55),
            loyalty: 65,
            risk: g.philosophies[t.id].risk,
          },
          confidence: 70,
          targets: [
            { level: 'PRIMARY', metric: 'position', target: Math.min(g.teams.length, i + 2) },
            { level: 'SECONDARY', metric: 'podiums', target: i < 8 ? 3 : 1 },
            { level: 'STRETCH', metric: 'wins', target: i < 5 ? 2 : 1 },
          ],
          researchAllocation: 15,
          futureResearch: 0,
          factory: t.infrastructure,
          crew: {
            skill: t.attributes['Pit stops'],
            equipment: t.infrastructure,
            fatigue: 0,
            rotation: 'A',
          },
          staff: {
            'Technical Director': t.attributes.Desenvolvimento,
            'Head of Aero': t.attributes.Aerodinâmica ?? t.rating,
            'Chief Designer': t.rating,
            'Head of Strategy': t.attributes.Estratégia,
            'Sporting Director': t.attributes['Operação geral'],
          },
          tyreContract: { supplier: t.tires, start: season, end: season + 2 },
          accounts: {
            capSpent: 0,
            operating: 0,
            development: 0,
            drivers: 0,
            staff: 0,
            engine: 0,
            battery: 0,
            tyres: 0,
          },
          rookieRuns: 0,
          privateTests: 0,
        },
      ]),
    ),
    negotiations: [],
    pending: [],
    transfers: [],
    feederHistory: [],
    regulations: [
      {
        id: 'era-2029',
        name: 'Nova era V8 híbrida',
        announced: 2028,
        effective: 2029,
        area: 'baseline',
        costCap: 235,
        engineCap: null,
        minWeight: null,
        description:
          'V8 2.4 twin-turbo híbrido, ~15.000 rpm, sem MGU-H. Teto operacional US$235M; teto de fabricante e peso mínimo não especificados.',
      },
    ],
    activeEra: 'era-2029',
    circuitContracts: Object.fromEntries(
      g.circuits.map((c, i) => [
        c.id,
        {
          end: season + 3 + (i % 4),
          fee: 20 + (i % 12),
          popularity: 70 + (i % 25),
          safety: 85 + (i % 14),
          heritage: 60 + (i % 35),
        },
      ]),
    ),
    seasonRoster: {
      season,
      drivers: structuredClone(g.drivers),
      engineers: structuredClone(g.engineers),
      teams: structuredClone(g.teams),
    },
    closing: null,
    offseason: null,
    substitutions: [],
    rookieAssignments: {},
    components: Object.fromEntries(
      g.drivers.map((d) => [d.id, { engine: 1, turbo: 1, battery: 1, gearbox: 1, km: 0 }]),
    ),
    ceo: {
      employed: true,
      reputation: {
        Technical: 50,
        Strategic: 50,
        Leadership: 50,
        Negotiation: 50,
        'Driver Management': 50,
        Media: 50,
        Finance: 50,
      },
      mediaPressure: 20,
      offers: [],
      dismissals: [],
    },
    inbox: [],
    settings: {
      difficulty: 'Standard',
      autoPit: true,
      autoTyre: true,
      autoOrders: false,
      graphics: 'Medium',
      fontSize: 100,
      highContrast: false,
      colorblind: false,
      sandbox: false,
      spectator: false,
      telemetry: 'full',
      tutorialDismissed: false,
      locale: 'pt-BR',
    },
  };
}
export function ensureDriverState(s: Save, d: Driver) {
  const g = s.game;
  g.stats[d.id] ??= emptyStats();
  s.driverPoints[d.id] ??= 0;
  g.decisions[d.id] ??= defaultDecision();
  g.setups[d.id] ??= {
    confidence: 20,
    tyreUnderstanding: 10,
    batteryUnderstanding: 10,
    setsUsed: 0,
    learnedWing: 50,
    learnedBalance: 50,
  };
  g.cars[d.id] ??= structuredClone(g.cars[g.drivers[0].id]);
  g.reputation[d.id] ??= d.rating;
  g.discipline[d.id] ??= 0;
  g.knowledge[d.id] ??= Object.fromEntries(
    g.circuits.map((c, i) => [
      c.id,
      makeRatings(Object.keys(d.circuitAttributes), d.rating - 12, i),
    ]),
  );
  s.career.ceoRelations[d.id] ??= {
    Confiança: 60,
    Respeito: 60,
    Lealdade: 60,
    Satisfação: 65,
    Obediência: 65,
  };
  s.world.components[d.id] ??= { engine: 1, turbo: 1, battery: 1, gearbox: 1, km: 0 };
  for (const other of allDrivers(s))
    if (d.id !== other.id)
      g.relationships[pairKey(d.id, other.id)] ??= makeRatings(
        relationshipLabels,
        55,
        seedFor(s.seed, d.id, other.id),
      );
}
export function addPoolContracts(s: Save) {
  for (const d of s.world.pool) {
    if (!s.game.contracts.some((c) => c.personId === d.id)) {
      const c: Contract = {
        id: 'driver-' + d.id,
        kind: 'driver',
        personId: d.id,
        teamId: d.teamId,
        until: d.contract,
        salary: d.salary ?? 1,
        buyout: 1,
        status: d.teamId === 'free' ? 'expired' : 'active',
        option: true,
        performanceClause: 0,
      };
      s.game.contracts.push(c);
      s.world.terms[c.id] = { ...initialTerms(c, s.season), role: 'RESERVE' };
    }
    s.game.stats[d.id] ??= emptyStats();
    s.driverPoints[d.id] ??= 0;
  }
}
export function notifyWorld(
  s: Save,
  type: WorldState['inbox'][number]['type'],
  title: string,
  body: string,
  href = '/temporada',
) {
  const w = s.world;
  w.inbox.unshift({
    id: `mail-${s.season}-${s.round}-${w.inbox.length}`,
    season: s.season,
    round: s.round,
    type,
    title,
    body,
    href,
    read: false,
  });
}
export function potentialEstimate(s: Save, d: Driver) {
  const accuracy = s.world.people[d.id]?.scouting ?? 100,
    spread = Math.ceil((100 - accuracy) / 10);
  return {
    low: Math.max(d.rating, d.potential - spread),
    high: Math.min(99, d.potential + spread),
  };
}
export function generateEngineer(s: Save, index: number): Engineer {
  const source = s.game.engineers[index % s.game.engineers.length],
    rating = 65 + (seedFor(s.seed, s.season, index, 'engineer') % 21);
  return {
    ...structuredClone(source),
    id: `engineer-${s.season}-${index}`,
    name: `Eng. ${proceduralDriver(s.seed, s.season, index).name}`,
    driverId: '',
    teamId: 'free',
    rating,
    synergy: 30,
    attributes: makeRatings(Object.keys(source.attributes), rating, index),
    dynamics: source.dynamics.map((x) => ({ ...x, value: 50, trend: 0 })),
  };
}
export function growDriver(s: Save, d: Driver) {
  const random = rng(seedFor(s.seed, s.season, d.id, 'evolution'));
  for (const key in d.attributes) {
    const mental = ['Consistência', 'Inteligência de corrida', 'Feedback técnico'].includes(key);
    const delta = mental
      ? (d.age < 38 ? 0.3 : 0.1) + random() * 0.4
      : d.age < 21
        ? 0.5 + random() * 1.8
        : d.age < 25
          ? 0.2 + random() * 1.1
          : d.age < 34
            ? (random() - 0.5) * 0.5
            : d.age < 38
              ? -0.2 - random() * 0.3
              : -0.5 - random() * 0.8;
    d.attributes[key] = clamp(
      d.attributes[key] + delta + (random() < 0.06 ? -0.5 : 0),
      35,
      Math.max(d.potential, d.attributes[key]),
    );
  }
  d.age++;
  d.rating = Math.round(mean(Object.values(d.attributes)));
}
