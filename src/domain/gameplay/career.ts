import type { Save } from '../types';
import type { Career, CareerMode } from './types';
import { drivers } from '../../data/drivers';
import { teams } from '../../data/teams';
import { cloneState } from '../simulation/world';
import { clamp, rng, seedFor } from '../simulation/random';
import { evaluateBoards } from '../universe/board';
import { allDrivers } from '../universe/world';
import { defaultSettings, normalizeSettings, type CareerSettings } from './settings';
export function initialCareer(): Career {
  return {
    mode: 'constructor',
    driverId: null,
    started: false,
    name: 'Nova carreira',
    ceoRelations: Object.fromEntries(
      drivers.map((d) => [
        d.id,
        { Confiança: 70, Respeito: 70, Lealdade: 65, Satisfação: 70, Obediência: 75 },
      ]),
    ),
    board: { confidence: 70, target: 4, wins: 2, podiums: 5, status: 'SECURE' },
    offers: [],
    offersSeason: 0,
    settings: defaultSettings(),
  };
}
export function controlledIds(save: Save) {
  if (
    save.world?.settings.spectator ||
    (save.career.mode === 'constructor' && !save.world.ceo.employed)
  )
    return [];
  if (
    save.career.mode === 'driver' &&
    !save.game.drivers.some((d) => d.id === save.career.driverId)
  )
    return [];
  return save.career.mode === 'driver'
    ? [save.career.driverId!]
    : save.game.drivers.filter((d) => d.teamId === save.managedTeam).map((d) => d.id);
}
/** Changes career settings at any point of a career; the pit assist mirrors the world option. */
export function updateCareerSettings(save: Save, settings: CareerSettings): Save {
  if (save.race?.status === 'RUNNING' && settings.distance !== save.career.settings.distance)
    settings = { ...settings, distance: save.career.settings.distance };
  const n = cloneState(save);
  n.career.settings = normalizeSettings(settings);
  n.world.settings.autoPit = n.career.settings.assists.autoPitAssist;
  if (n.race) {
    n.race.autoEvents = n.career.settings.assists.autoPauseEvents ? 'pause' : 'slow';
  }
  return n;
}
export function configureCareer(
  save: Save,
  mode: CareerMode,
  choice: string,
  settings?: CareerSettings,
): Save {
  const n = cloneState(save);
  const driver = n.game.drivers.find((d) => d.id === choice);
  const team = n.game.teams.find((t) => t.id === (mode === 'driver' ? driver?.teamId : choice));
  if (!team) return save;
  n.managedTeam = team.id;
  n.career = {
    ...initialCareer(),
    started: true,
    mode,
    driverId: mode === 'driver' ? driver!.id : null,
    name: mode === 'driver' ? driver!.name : team.name,
  };
  const ranking =
    [...n.game.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === team.id) + 1;
  n.career.board.target = Math.min(16, Math.max(1, ranking + 1));
  n.career.board.wins = ranking < 5 ? 2 : 0;
  n.career.board.podiums = ranking < 8 ? 3 : 1;
  n.world.organizations[team.id].targets[0].target = n.career.board.target;
  if (settings) {
    n.career.settings = normalizeSettings(settings);
    n.world.settings.autoPit = n.career.settings.assists.autoPitAssist;
  }
  return n;
}
export function updateBoard(save: Save) {
  evaluateBoards(save);
  if (save.career.mode !== 'constructor') return;
  const g = save.game,
    b = save.career.board;
  const rank =
    [...g.teams]
      .sort((a, b) => g.teamPoints[b.id] - g.teamPoints[a.id])
      .findIndex((t) => t.id === save.managedTeam) + 1;
  const stats = g.teamStats[save.managedTeam];
  const weekend = save.weekends.find((w) => w.round === save.round);
  const own = controlledIds(save);
  const incidents = (weekend?.tapes?.GP?.events ?? []).filter(
    (e) =>
      own.includes(e.driverId) &&
      ['command ignored', 'pit error', 'unsafe release'].includes(e.type),
  ).length;
  for (const id of own) {
    const result = weekend?.results.GP?.find((r) => r.driverId === id);
    if (!result) continue;
    const rel = save.career.ceoRelations[id],
      delta = result.status === 'FINISHED' && result.position <= b.target * 2 ? 1 : -1;
    rel.Confiança = clamp(rel.Confiança + delta);
    rel.Satisfação = clamp(rel.Satisfação + delta * 2);
    rel.Respeito = clamp(rel.Respeito + delta * 0.5);
    rel.Lealdade = clamp(rel.Lealdade + delta * 0.25);
  }
}
export function makeOffers(save: Save) {
  if (
    save.career.mode !== 'driver' ||
    save.game.phase !== 'postseason' ||
    save.career.offersSeason === save.season
  )
    return;
  const d = allDrivers(save).find((d) => d.id === save.career.driverId)!;
  save.career.offersSeason = save.season;
  save.career.offers = save.game.teams
    .filter((t) => t.id !== d.teamId)
    .filter((t) => {
      const own = save.game.drivers.filter((p) => p.teamId === t.id);
      return d.rating >= Math.min(...own.map((p) => p.rating)) - 8;
    })
    .sort((a, b) => b.prestige - a.prestige)
    .slice(0, 3)
    .map((t) => ({
      id: save.season + '-' + t.id,
      teamId: t.id,
      salary:
        Math.round(
          (d.salary ?? 5) * (1.05 + rng(seedFor(save.seed, save.season, t.id))() * 0.3) * 10,
        ) / 10,
      years: 2,
      status: 'pending',
    }));
}
export function acceptOffer(save: Save, id: string, accept: boolean): Save {
  const offer = save.career.offers.find((o) => o.id === id && o.status === 'pending');
  if (!offer || save.game.phase !== 'postseason' || save.race?.status === 'RUNNING') return save;
  const n = cloneState(save);
  const o = n.career.offers.find((o) => o.id === id)!;
  o.status = accept ? 'accepted' : 'declined';
  if (!accept) return n;
  const d = n.game.drivers.find((d) => d.id === n.career.driverId)!,
    other = n.game.drivers
      .filter((d) => d.teamId === o.teamId)
      .sort((a, b) => a.rating - b.rating)[0];
  const origin = d.teamId;
  d.teamId = o.teamId;
  other.teamId = origin;
  n.managedTeam = o.teamId;
  const a = n.game.engineers.find((e) => e.driverId === d.id)!,
    b = n.game.engineers.find((e) => e.driverId === other.id)!;
  [a.driverId, b.driverId] = [b.driverId, a.driverId];
  a.synergy = Math.max(20, a.synergy - 15);
  b.synergy = Math.max(20, b.synergy - 15);
  [n.game.cars[d.id], n.game.cars[other.id]] = [n.game.cars[other.id], n.game.cars[d.id]];
  for (const c of n.game.contracts.filter(
    (c) => c.kind === 'driver' && [d.id, other.id].includes(c.personId),
  )) {
    c.teamId = c.personId === d.id ? o.teamId : origin;
    if (c.personId === d.id) {
      c.salary = o.salary;
      c.until = n.season + o.years;
      d.salary = o.salary;
      d.contract = c.until;
    }
  }
  for (const p of n.career.offers) if (p.status === 'pending') p.status = 'declined';
  return n;
}
