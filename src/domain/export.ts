import { regulations } from '../data/regulations';
import { createSave } from './save';
import type { Save } from './types';
export function exportUniverse(save: Save = createSave()) {
  return {
    schemaVersion: 4,
    provenance: {
      universe: 'FICTIONAL_USER_BRIEF',
      ratings: 'EDITORIAL_FIXTURE',
      engineers: 'FICTIONAL_REPLACEABLE',
      calendar: 'CONCEPT_PROPOSAL',
      results: 'SIMULATED_SAVE',
      cars: 'ORIGINAL_SVG_PLACEHOLDER',
      history: 'USER_DEFINED_UNIVERSE',
    },
    drivers: save.game.drivers,
    talentPool: save.world.pool,
    persistentUniverse: save.world,
    teams: save.game.teams,
    engineers: save.game.engineers,
    engines: save.game.engines,
    batteries: save.game.batteries,
    tires: save.game.tyres,
    circuits: save.game.circuits,
    regulations,
    championship: save,
  };
}
