import type { Session } from '../types';
import type {
  Decision,
  TyreState,
  RaceControl,
  RaceEvent,
  RaceFrame,
  Weather,
  Compound,
} from '../simulation/types';
export type CommandKind = 'NORMAL' | 'ATTACK' | 'DEFEND' | 'BRAKING_ATTACK' | 'SAVE';
export type DriverCommand = {
  cooldownUntil?: number;
  brakingAttempts?: number;
  intensity?: 'Normal' | 'Aggressive' | 'All-In';
  kind: CommandKind;
  remaining: number;
  acknowledged: boolean;
  noAttack: boolean;
  yieldTo: string | null;
  holdUntil: number;
};
export type RaceCar = {
  id: string;
  elapsed: number;
  best: number;
  lap: number;
  tyre: TyreState;
  tyreAge: number;
  pits: number;
  status: 'RUNNING' | 'DNF' | 'DSQ';
  penalty: number;
  overtakes: number;
  last: number;
  pitPhase: 'TRACK' | 'CALLED' | 'EXIT';
};
export type RadioLine = {
  id: number;
  driverId: string;
  target: 'driver' | 'engineer';
  lap: number;
  text: string;
};
export type PitCall = { lap: number; compound: Compound };
export type RaceState = {
  battles?: Record<
    string,
    {
      attacker: string;
      defender: string;
      startLap: number;
      lastLap: number;
      pressure: number;
      attempts: number;
      defenderAdaptation: number;
      batteryDifference: number;
      tyreDifference: number;
      relationship: number;
    }
  >;
  recordFrames?: boolean;
  restart?: 'standing' | 'rolling';
  version: 1;
  session: Session;
  round: number;
  seed: number;
  rngState: number;
  ids: string[];
  laps: number;
  lap: number;
  sector: 1 | 2 | 3;
  status: 'RUNNING' | 'FINISHED';
  paused: boolean;
  speed: 0.5 | 0.75 | 1 | 2 | 4 | 8 | 16;
  /** Automatic pacing: the cruising speed (8 for AUTO, 16 for highlights). Absent = manual. */
  auto?: 8 | 16;
  autoEvents: 'off' | 'slow' | 'pause';
  weather: Weather;
  control: RaceControl;
  neutralLaps: number;
  cars: RaceCar[];
  decisions: Record<string, Decision>;
  baseDecisions: Record<string, Decision>;
  commands: Record<string, DriverCommand>;
  pitCalls: Record<string, PitCall>;
  events: RaceEvent[];
  frames: RaceFrame[];
  radio: RadioLine[];
  commandSequence: number;
  forcedRain: number | null;
  dev: boolean;
};
export type CareerMode = 'driver' | 'constructor';
export type CEORelation = {
  Confiança: number;
  Respeito: number;
  Lealdade: number;
  Satisfação: number;
  Obediência: number;
};
export type Offer = {
  id: string;
  teamId: string;
  salary: number;
  years: number;
  status: 'pending' | 'accepted' | 'declined';
};
export type Career = {
  mode: CareerMode;
  driverId: string | null;
  started: boolean;
  name: string;
  ceoRelations: Record<string, CEORelation>;
  board: {
    confidence: number;
    target: number;
    wins: number;
    podiums: number;
    status: 'SECURE' | 'UNDER PRESSURE' | 'AT RISK' | 'EXCELLENT' | 'STABLE' | 'UNDER REVIEW';
  };
  offers: Offer[];
  offersSeason: number;
  /** Difficulty, race length, session participation and assists. Part of the save. */
  settings: import('./settings').CareerSettings;
};
