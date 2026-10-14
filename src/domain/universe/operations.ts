import type { Save, Session } from '../types';
import type { WorldState } from './types';
import { cloneState } from '../simulation/world';
import { clamp, rng, seedFor } from '../simulation/random';
import { transact, addNews } from '../simulation/management';
import { allDrivers, ensureDriverState, notifyWorld } from './world';
import { canManage } from './market';

function substitute(s: Save, starterId: string, reserveId: string, reason: string) {
  const starter = s.game.drivers.find((d) => d.id === starterId),
    reserve = s.world.pool.find((d) => d.id === reserveId);
  if (
    !starter ||
    !reserve ||
    reserve.teamId !== starter.teamId ||
    s.world.people[reserve.id].licensePoints < s.world.league.licenseThreshold
  )
    return false;
  ensureDriverState(s, reserve);
  s.world.pool = s.world.pool.filter((d) => d.id !== reserve.id);
  s.world.pool.push(starter);
  s.game.drivers = s.game.drivers.map((d) => (d.id === starter.id ? reserve : d));
  s.world.people[starter.id].status = 'RESERVE';
  s.world.people[reserve.id].status = 'ACTIVE';
  s.game.engineers.find((e) => e.driverId === starter.id)!.driverId = reserve.id;
  s.game.cars[reserve.id] = structuredClone(s.game.cars[starter.id]);
  s.world.substitutions.push({
    teamId: starter.teamId,
    starter: starter.id,
    reserve: reserve.id,
    round: s.round,
    reason,
  });
  notifyWorld(s, 'INFORMATION', `${reserve.name} assume o carro`, reason, '/academias');
  return true;
}
export function restoreSubstitutes(s: Save, practiceOnly = false) {
  for (const entry of [...s.world.substitutions]) {
    if (practiceOnly && entry.reason !== 'TL1 de rookie') continue;
    const starter = s.world.pool.find((d) => d.id === entry.starter),
      reserve = s.game.drivers.find((d) => d.id === entry.reserve);
    if (!starter || !reserve) continue;
    s.world.pool = s.world.pool.filter((d) => d.id !== starter.id);
    s.world.pool.push(reserve);
    s.game.drivers = s.game.drivers.map((d) => (d.id === reserve.id ? starter : d));
    s.world.people[starter.id].status = 'ACTIVE';
    s.world.people[reserve.id].status = 'RESERVE';
    s.game.engineers.find((e) => e.driverId === reserve.id)!.driverId = starter.id;
    s.game.cars[starter.id] = structuredClone(s.game.cars[reserve.id]);
    s.game.setups[starter.id] = structuredClone(s.game.setups[reserve.id]);
    s.world.substitutions = s.world.substitutions.filter((x) => x !== entry);
  }
}
export function prepareParticipation(s: Save, session: Session) {
  if (session !== 'TL1') return;
  for (const d of [...s.game.drivers]) {
    const meta = s.world.people[d.id];
    if (meta.injuryUntil >= s.round || meta.suspendedUntil >= s.round) {
      const reserve = s.world.pool.find(
        (p) =>
          p.teamId === d.teamId &&
          s.world.people[p.id].status === 'RESERVE' &&
          s.world.people[p.id].licensePoints >= s.world.league.licenseThreshold,
      );
      if (reserve)
        substitute(
          s,
          d.id,
          reserve.id,
          meta.injuryUntil >= s.round ? 'Substituição por lesão' : 'Substituição por suspensão',
        );
    }
  }
  for (const t of s.game.teams) {
    if (s.world.substitutions.some((x) => x.teamId === t.id)) continue;
    const o = s.world.organizations[t.id],
      assigned = s.world.rookieAssignments[t.id];
    if (
      !assigned &&
      (o.rookieRuns >= s.world.league.rookiePracticeTarget ||
        (t.id === s.managedTeam && !s.world.settings.spectator))
    )
      continue;
    const reserve = s.world.pool.find(
      (d) =>
        d.teamId === t.id &&
        s.world.people[d.id].status === 'RESERVE' &&
        (!assigned || d.id === assigned),
    );
    const starter = s.game.drivers
      .filter((d) => d.teamId === t.id)
      .sort((a, b) => a.rating - b.rating)[0];
    if (reserve && substitute(s, starter.id, reserve.id, 'TL1 de rookie')) o.rookieRuns++;
    delete s.world.rookieAssignments[t.id];
  }
}
export function assignRookie(s: Save, id: string): Save {
  if (!canManage(s) || s.weekends.find((w) => w.round === s.round)?.results.TL1) return s;
  const d = s.world.pool.find(
    (d) => d.id === id && d.teamId === s.managedTeam && s.world.people[d.id].status === 'RESERVE',
  );
  if (!d) return s;
  const n = cloneState(s);
  n.world.rookieAssignments[s.managedTeam] = id;
  return n;
}
export function maintainPersonnel(s: Save) {
  const tape = s.weekends.find((w) => w.round === s.round)?.tapes?.GP;
  for (const d of s.game.drivers) {
    const meta = s.world.people[d.id],
      inventory = s.world.components[d.id];
    meta.fatigue = clamp(meta.fatigue + 3 - (s.round === 18 ? 60 : 0));
    inventory.km = s.game.cars[d.id].mileage;
    if (
      tape?.events.some(
        (e) => e.driverId === d.id && ['collision', 'retirement'].includes(e.type),
      ) &&
      rng(seedFor(s.seed, s.season, s.round, d.id, 'injury'))() < 0.025
    ) {
      meta.injuryUntil = s.round + 1;
      notifyWorld(
        s,
        'URGENT',
        `${d.name}: recuperação médica`,
        'Reserva convocado para o próximo fim de semana.',
        '/academias',
      );
    }
  }
  for (const t of s.game.teams) {
    const o = s.world.organizations[t.id];
    o.crew.fatigue = clamp(o.crew.fatigue + 2 - (s.round === 18 ? 60 : 0));
  }
  if (s.round === 18)
    notifyWorld(
      s,
      'INFORMATION',
      'Pausa de recuperação',
      'Intervalo abstrato de 28 dias: 21 de férias e 7 de preparação. Fadiga reduzida.',
      '/calendario',
    );
}
export function replaceComponent(
  s: Save,
  id: string,
  part: 'engine' | 'turbo' | 'battery' | 'gearbox',
): Save {
  if (!canManage(s) || !s.game.drivers.some((d) => d.id === id && d.teamId === s.managedTeam))
    return s;
  const n = cloneState(s),
    inv = n.world.components[id];
  if (
    !transact(
      n,
      n.managedTeam,
      -{ engine: 2, turbo: 0.7, battery: 1, gearbox: 0.8 }[part],
      'components',
      `Reposição ${part}`,
    )
  )
    return s;
  inv[part]++;
  n.game.cars[id].wear = Math.max(0, n.game.cars[id].wear - 20);
  if (inv[part] > n.world.league.componentAllocation)
    n.game.gridPenalties[id] =
      (n.game.gridPenalties[id] ?? 0) + n.world.league.extraComponentGridPenalty;
  return n;
}
export function researchAllocation(s: Save, value: number): Save {
  if (!canManage(s) || !Number.isFinite(value)) return s;
  const n = cloneState(s);
  n.world.organizations[s.managedTeam].researchAllocation = clamp(value);
  return n;
}
export function rotateCrew(s: Save): Save {
  if (!canManage(s)) return s;
  const n = cloneState(s),
    crew = n.world.organizations[s.managedTeam].crew;
  if (!transact(n, n.managedTeam, -0.3, 'staff', 'Rotação da equipe de boxes')) return s;
  crew.rotation = crew.rotation === 'A' ? 'B' : 'A';
  crew.fatigue = Math.max(0, crew.fatigue - 35);
  return n;
}
export function privateTest(s: Save): Save {
  if (!canManage(s) || s.world.organizations[s.managedTeam].privateTests >= 3) return s;
  const n = cloneState(s);
  if (!transact(n, n.managedTeam, -2, 'testing', 'Teste privado: limite provisório de 3/ano'))
    return s;
  n.world.organizations[s.managedTeam].privateTests++;
  for (const d of n.game.drivers.filter((d) => d.teamId === n.managedTeam)) {
    n.game.setups[d.id].confidence = clamp(n.game.setups[d.id].confidence + 12);
    n.game.cars[d.id].mileage += 100;
  }
  return n;
}
export function changeSupplier(s: Save, kind: 'battery' | 'tyres', name: string): Save {
  if (!canManage(s) || s.weekends.some((w) => w.round === s.round && !w.results.GP)) return s;
  const t = s.game.teams.find((t) => t.id === s.managedTeam)!,
    o = s.world.organizations[t.id];
  if (
    kind === 'tyres' &&
    (o.tyreContract.end >= s.season ||
      s.game.teams.filter((t) => t.tires === name).length >= 4 ||
      !s.game.tyres.some((p) => p.name === name))
  )
    return s;
  if (kind === 'battery' && (!s.game.batteries.some((b) => b.name === name) || t.battery === name))
    return s;
  const n = cloneState(s);
  if (!transact(n, t.id, -2, 'supplier contracts', name)) return s;
  const team = n.game.teams.find((x) => x.id === t.id)!;
  if (kind === 'battery') team.battery = name;
  else {
    team.tires = name;
    n.world.organizations[t.id].tyreContract = {
      supplier: name,
      start: s.season,
      end: s.season + 2,
    };
  }
  addNews(n, 'CONFIRMED', 'Contrato de fornecimento', `${team.name}: ${name}`);
  return n;
}
export function settings(s: Save, patch: Partial<WorldState['settings']>): Save {
  const n = cloneState(s);
  Object.assign(n.world.settings, patch);
  n.world.settings.fontSize = clamp(n.world.settings.fontSize, 85, 140);
  if (patch.difficulty) {
    n.world.settings.autoPit = patch.difficulty !== 'Simulation';
    n.world.settings.autoTyre = patch.difficulty !== 'Simulation';
    n.world.settings.autoOrders = patch.difficulty === 'Casual';
  }
  return n;
}
export function readMessage(s: Save, id: string): Save {
  const n = cloneState(s),
    m = n.world.inbox.find((x) => x.id === id);
  if (m) m.read = true;
  return n;
}
