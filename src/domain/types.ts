export type Ratings = Record<string, number>;
export type Dynamic = { label: string; value: number; trend: number };
export type Team = {
  id: string;
  name: string;
  short: string;
  color: string;
  secondary: string;
  engine: string;
  tires: string;
  battery: string | null;
  base: string;
  rating: number;
  potential: number;
  prestige: number;
  budget: number;
  attributes: Ratings;
  dynamics: Dynamic[];
  infrastructure: number;
};
export type Driver = {
  id: string;
  name: string;
  short: string;
  teamId: string;
  number: number;
  country: string;
  flag: string;
  age: number;
  rating: number;
  potential: number;
  contract: number;
  salary: number | null;
  attributes: Ratings;
  dynamics: Dynamic[];
  circuitAttributes: Ratings;
};
export type Engineer = {
  id: string;
  name: string;
  driverId: string;
  teamId: string;
  fictional: true;
  rating: number;
  synergy: number;
  attributes: Ratings;
  dynamics: Dynamic[];
};
export type Circuit = {
  id: string;
  round: number;
  name: string;
  city: string;
  country: string;
  flag: string;
  date: string;
  km: number;
  laps: number;
  corners: number;
  temperature: number;
  rain: number;
  wind: number;
  grip: number;
  safetyCar: number;
};
export type Session = 'TL1' | 'TL2' | 'TL3' | 'Q1' | 'Q2' | 'Q3' | 'Sprint' | 'GP';
export type Result = {
  driverId: string;
  position: number;
  time: number;
  points: number;
  fastestLap: boolean;
  gain: number;
  teamId?: string;
  status?: 'FINISHED' | 'DNF' | 'DSQ';
  laps?: number;
  overtakes?: number;
  penalty?: number;
};
export type Weekend = {
  round: number;
  results: Partial<Record<Session, Result[]>>;
  qualifyingGrid: string[];
  sprintGrid: string[];
  tapes?: Partial<Record<Session, import('./simulation/types').RaceTape>>;
  seeds?: Record<string, number>;
};
export type Save = {
  version: 4;
  world: import('./universe/types').WorldState;
  career: import('./gameplay/types').Career;
  race: import('./gameplay/types').RaceState | null;
  season: number;
  seed: number;
  round: number;
  weekends: Weekend[];
  driverPoints: Record<string, number>;
  managedTeam: string;
  projects: string[];
  preferences: { reducedMotion: boolean; compact: boolean };
  game: import('./simulation/types').Universe;
};
export type GameState = Save;
export type SimulationEngine = {
  run: (session: Session, ids: string[], seed: number, round: number) => Result[];
};
export type CarPart =
  | 'CarModel'
  | 'FrontWing'
  | 'RearWing'
  | 'Floor'
  | 'Sidepod'
  | 'Wheels'
  | 'Suspension'
  | 'Cockpit'
  | 'Livery'
  | 'Battery'
  | 'Engine';
