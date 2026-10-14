import { drivers as initialDrivers } from '../data/drivers';
import { teams } from '../data/teams';
import { engineers as initialEngineers } from '../data/engineers';
import { compareStats } from './simulation/management';
import type { Universe } from './simulation/types';
import type { Save, Team } from './types';
import { allDrivers } from './universe/world';
export const mean = (values: number[]) =>
  Math.round(values.reduce((a, b) => a + b, 0) / values.length);
export function powerScore(team: Team, universe?: Universe) {
  const drivers = universe?.drivers ?? initialDrivers;
  const engineers = universe?.engineers ?? initialEngineers;
  const driverScore = mean(drivers.filter((d) => d.teamId === team.id).map((d) => d.rating));
  const engineeringScore = mean(engineers.filter((e) => e.teamId === team.id).map((e) => e.rating));
  return {
    power: Math.round(team.rating * 0.5 + driverScore * 0.3 + engineeringScore * 0.2),
    car: team.rating,
    driver: driverScore,
    engineering: engineeringScore,
    reliability: team.attributes.Confiabilidade,
    development: team.attributes.Desenvolvimento,
    momentum: team.dynamics[1].value,
  };
}
export const powerRankings = [...teams].sort((a, b) => powerScore(b).power - powerScore(a).power);
export const technicalRankings = [...teams].sort((a, b) => b.rating - a.rating);
export function driverStandings(save: Save) {
  return allDrivers(save)
    .filter(
      (d) =>
        save.game.drivers.some((x) => x.id === d.id) ||
        save.game.stats[d.id]?.starts > 0 ||
        save.driverPoints[d.id] > 0,
    )
    .sort(
      (a, b) =>
        compareStats(save.game.stats[a.id], save.game.stats[b.id]) || a.id.localeCompare(b.id),
    );
}
export function teamPoints(save: Save, id: string) {
  return save.game.teamPoints[id] ?? 0;
}
export function teamStandings(save: Save) {
  return [...save.game.teams].sort(
    (a, b) =>
      compareStats(save.game.teamStats[a.id], save.game.teamStats[b.id]) ||
      a.id.localeCompare(b.id),
  );
}
export function completedRaces(save: Save) {
  return save.weekends.filter((w) => w.results.GP).length;
}
