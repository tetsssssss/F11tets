export const regulations = {
  year: 2029,
  teams: 16,
  drivers: 32,
  rounds: 35,
  width: 1.78,
  length: 4.65,
  engine: 'V8 híbrido',
  modes: ['Corner Mode', 'Flow Mode', 'Straight Mode', 'Follow Mode'],
  qualifying: [
    { session: 'Q1', entrants: 32, eliminated: 12, advance: 20 },
    { session: 'Q2', entrants: 20, eliminated: 10, advance: 10 },
    { session: 'Q3', entrants: 10, eliminated: 0, advance: 10 },
  ],
  gpPoints: [30, 27, 25, 22, 19, 16, 13, 11, 9, 7, 5, 3, 1],
  sprintPoints: [12, 10, 8, 7, 6, 5, 4, 3, 2, 1],
  poleBonus: 2,
  fastestLapBonus: 1,
  sprintGainBonus: 1,
  // The brief leaves ties undefined: tied most-gain drivers each receive +1, only for a positive gain.
  sprintGainTieRule: 'all-positive-tied',
};
export const sessions = ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3', 'Sprint', 'GP'] as const;
export const recentChampions = [
  { year: 2026, driver: 'Antonelli', team: 'Mercedes', color: '#5ee2c0' },
  { year: 2027, driver: 'Antonelli', team: 'Mercedes', color: '#5ee2c0' },
  { year: 2028, driver: 'Norris', team: 'McLaren', color: '#ff9b43' },
];
