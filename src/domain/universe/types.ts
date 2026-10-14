import type { Driver, Engineer, Ratings, Team } from '../types';
import type { CircuitModel, Contract, Stats } from '../simulation/types';

export type Role =
  'FRANCHISE DRIVER' | 'NUMBER ONE' | 'EQUAL STATUS' | 'NUMBER TWO' | 'PROSPECT' | 'RESERVE';
export type DriverStatus = 'ACTIVE' | 'RESERVE' | 'DEVELOPMENT' | 'FREE AGENT' | 'RETIRED';
export type PromiseKind =
  'igualdade' | 'prioridade' | 'carro competitivo' | 'investimento' | 'liberdade esportiva';
export type ContractTerms = {
  start: number;
  role: Role;
  performanceBonus: number;
  championshipBonus: number;
  optionYears: number;
  teamOption: boolean;
  driverOption: boolean;
  releaseBelow: number;
  promises: { kind: PromiseKind; status: 'pending' | 'kept' | 'broken' }[];
};
export type DriverRecord = {
  status: DriverStatus;
  academy: string | null;
  provenance: 'BRIEF' | 'PROCEDURAL';
  personality: 'calm' | 'competitive' | 'ambitious' | 'patient';
  motivation: number;
  fatigue: number;
  injuryUntil: number;
  suspendedUntil: number;
  licensePoints: number;
  scouting: number;
  category: string;
  marketValue: number;
  retiredSeason: number | null;
  debut: number | null;
};
export type Negotiation = {
  feePaid?: number;
  id: string;
  personId: string;
  replaceId: string;
  teamId: string;
  kind: 'driver' | 'engineer';
  salary: number;
  years: number;
  start: number;
  terms: ContractTerms;
  status: 'counter' | 'accepted' | 'rejected' | 'signed';
  response: string;
  counter: { salary: number; years: number; role: Role; releaseBelow: number } | null;
};
export type Transfer = {
  id: string;
  season: number;
  round: number;
  personId: string;
  from: string;
  to: string;
  kind: 'driver' | 'engineer';
  detail: string;
};
export type Goal = {
  level: 'PRIMARY' | 'SECONDARY' | 'STRETCH';
  metric: 'position' | 'wins' | 'podiums' | 'points';
  target: number;
};
export type Organization = {
  owner: {
    patience: number;
    ambition: number;
    spending: number;
    interference: number;
    loyalty: number;
    risk: number;
  };
  confidence: number;
  targets: Goal[];
  researchAllocation: number;
  futureResearch: number;
  factory: number;
  crew: { skill: number; equipment: number; fatigue: number; rotation: 'A' | 'B' };
  staff: Record<string, number>;
  tyreContract: { supplier: string; start: number; end: number };
  accounts: {
    capSpent: number;
    operating: number;
    development: number;
    drivers: number;
    staff: number;
    engine: number;
    battery: number;
    tyres: number;
  };
  rookieRuns: number;
  privateTests: number;
};
export type RegulationEra = {
  id: string;
  name: string;
  announced: number;
  effective: number;
  area: 'baseline' | 'aero' | 'energy' | 'reliability';
  costCap: number;
  engineCap: number | null;
  minWeight: number | null;
  description: string;
};
export type SeasonSnapshot = {
  season: number;
  provenance: 'CAPTURED' | 'LEGACY_PARTIAL';
  drivers: Driver[];
  teams: Team[];
  engineers: Engineer[];
  contracts: Contract[];
  calendar: CircuitModel[];
  regulation: RegulationEra;
  teamStats: Record<string, Stats>;
  terms: Record<string, ContractTerms>;
  awards: { name: string; personId: string; value: number; unit: string }[];
};
export const offseasonSteps = [
  'Prêmios',
  'Contratos',
  'Mercado de pilotos',
  'Mercado de engenheiros',
  'Congelamento técnico',
  'Regulamento',
  'Pré-temporada',
  'Testes coletivos',
  'Pronto para o GP1',
] as const;
export type WorldState = {
  version: 1;
  league: {
    teamCount: number;
    driverCount: number;
    calendarSize: number;
    licenseThreshold: number;
    rookiePracticeTarget: number;
    componentAllocation: number;
    extraComponentGridPenalty: number;
    provisionalRules: string[];
  };
  pool: Driver[];
  engineerPool: Engineer[];
  people: Record<string, DriverRecord>;
  terms: Record<string, ContractTerms>;
  organizations: Record<string, Organization>;
  negotiations: Negotiation[];
  transfers: Transfer[];
  pending: Negotiation[];
  feederHistory: {
    season: number;
    category: string;
    standings: { id: string; points: number; position: number }[];
  }[];
  regulations: RegulationEra[];
  activeEra: string;
  circuitContracts: Record<
    string,
    { end: number; fee: number; popularity: number; safety: number; heritage: number }
  >;
  seasonRoster: { season: number; drivers: Driver[]; engineers: Engineer[]; teams: Team[] };
  closing: SeasonSnapshot | null;
  offseason: { season: number; step: number; completed: string[] } | null;
  substitutions: {
    teamId: string;
    starter: string;
    reserve: string;
    round: number;
    reason: string;
  }[];
  rookieAssignments: Record<string, string>;
  components: Record<
    string,
    { engine: number; turbo: number; battery: number; gearbox: number; km: number }
  >;
  ceo: {
    employed: boolean;
    reputation: Ratings;
    mediaPressure: number;
    offers: { teamId: string; salary: number; status: 'pending' | 'accepted' | 'declined' }[];
    dismissals: { season: number; round: number; teamId: string; reason: string }[];
  };
  inbox: {
    id: string;
    season: number;
    round: number;
    type: 'URGENT' | 'ACTION REQUIRED' | 'INFORMATION' | 'RUMOUR';
    title: string;
    body: string;
    read: boolean;
    href: string;
  }[];
  settings: {
    difficulty: 'Casual' | 'Standard' | 'Simulation';
    autoPit: boolean;
    autoTyre: boolean;
    autoOrders: boolean;
    graphics: 'Low' | 'Medium' | 'High';
    fontSize: number;
    highContrast: boolean;
    colorblind: boolean;
    sandbox: boolean;
    spectator: boolean;
    telemetry: 'full' | 'summary';
    tutorialDismissed: boolean;
    locale: 'pt-BR';
  };
};
