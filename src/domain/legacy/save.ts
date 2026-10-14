import { drivers } from '../../data/drivers';
import { teams } from '../../data/teams';
import { developmentProjects } from '../../data/editorial';
import { sessions } from '../../data/regulations';
import { advanceRound, runNextSession } from './simulation';
import type { Save } from './types';
export const SAVE_KEY = 'f1-universe-2029-v1';
export function createSave(seed = 2029): Save {
  return {
    version: 1,
    season: 2029,
    seed,
    round: 1,
    weekends: [],
    driverPoints: Object.fromEntries(drivers.map((d) => [d.id, 0])),
    managedTeam: 'mclaren',
    projects: ['floor-v3', 'front-wing'],
    preferences: { reducedMotion: false, compact: false },
  };
}
// Replay validates sporting state, prevents duplicate points and rejects incomplete/corrupt imports.
export function parseSave(text: string): Save | null {
  try {
    const raw = JSON.parse(text) as Save;
    if (
      raw.version !== 1 ||
      raw.season !== 2029 ||
      !Number.isSafeInteger(raw.seed) ||
      raw.seed < 0 ||
      raw.seed > 2147483647 ||
      !Number.isInteger(raw.round) ||
      raw.round < 1 ||
      raw.round > 36 ||
      !Array.isArray(raw.weekends) ||
      raw.weekends.length > 35
    )
      return null;
    if (
      !teams.some((t) => t.id === raw.managedTeam) ||
      !Array.isArray(raw.projects) ||
      raw.projects.some((p) => !developmentProjects.some((x) => x.id === p)) ||
      new Set(raw.projects).size !== raw.projects.length
    )
      return null;
    if (
      typeof raw.preferences?.compact !== 'boolean' ||
      typeof raw.preferences?.reducedMotion !== 'boolean'
    )
      return null;
    let replay = createSave(raw.seed);
    for (let i = 0; i < raw.weekends.length; i++) {
      const weekend = raw.weekends[i];
      if (weekend.round !== i + 1 || !weekend.results || !Object.keys(weekend.results).length)
        return null;
      const completed = Object.keys(weekend.results);
      if (completed.some((s, idx) => s !== sessions[idx])) return null;
      for (let n = 0; n < completed.length; n++) replay = runNextSession(replay);
      if (JSON.stringify(replay.weekends[i]) !== JSON.stringify(weekend)) return null;
      if (raw.round > replay.round) replay = advanceRound(replay);
    }
    if (
      replay.round !== raw.round ||
      drivers.some((d) => replay.driverPoints[d.id] !== raw.driverPoints[d.id]) ||
      Object.keys(raw.driverPoints).length !== 32
    )
      return null;
    return {
      ...replay,
      managedTeam: raw.managedTeam,
      projects: raw.projects,
      preferences: raw.preferences,
    };
  } catch {
    return null;
  }
}
