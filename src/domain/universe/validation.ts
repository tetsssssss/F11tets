import type { Save } from '../types';
import type { ContractTerms, SeasonSnapshot } from './types';
import { allDrivers, allEngineers } from './world';

type Shape = (value: unknown, model: unknown) => boolean;
const between = (v: number, min = 0, max = 100) => Number.isFinite(v) && v >= min && v <= max;
const roles = [
  'FRANCHISE DRIVER',
  'NUMBER ONE',
  'EQUAL STATUS',
  'NUMBER TWO',
  'PROSPECT',
  'RESERVE',
];
export function validTerms(t: ContractTerms): boolean {
  return (
    !!t &&
    Number.isInteger(t.start) &&
    t.start >= 2029 &&
    roles.includes(t.role) &&
    between(t.performanceBonus, 0, 2) &&
    between(t.championshipBonus, 0, 2) &&
    Number.isInteger(t.optionYears) &&
    between(t.optionYears, 0, 5) &&
    typeof t.teamOption === 'boolean' &&
    typeof t.driverOption === 'boolean' &&
    Number.isInteger(t.releaseBelow) &&
    between(t.releaseBelow, 0, 16) &&
    Array.isArray(t.promises) &&
    t.promises.every(
      (p) =>
        [
          'igualdade',
          'prioridade',
          'carro competitivo',
          'investimento',
          'liberdade esportiva',
        ].includes(p.kind) && ['pending', 'kept', 'broken'].includes(p.status),
    )
  );
}
/** Dynamic registries cannot be checked against the original 32 person keys. */
export function validPersistentWorld(s: Save, model: Save, shape: Shape): boolean {
  try {
    const w = s.world,
      g = s.game,
      m = model.world;
    if (
      !w ||
      w.version !== 1 ||
      !shape(
        {
          ...w,
          pool: [],
          engineerPool: [],
          people: m.people,
          terms: m.terms,
          organizations: m.organizations,
          components: m.components,
          circuitContracts: m.circuitContracts,
          seasonRoster: m.seasonRoster,
        },
        m,
      )
    )
      return false;
    const people = allDrivers(s),
      engineers = allEngineers(s),
      ids = new Set(people.map((d) => d.id)),
      teamIds = new Set(g.teams.map((t) => t.id));
    if (
      ids.size !== people.length ||
      new Set(engineers.map((e) => e.id)).size !== engineers.length ||
      people.some((d) => engineers.some((e) => e.id === d.id))
    )
      return false;
    if (
      w.league.teamCount !== 16 ||
      w.league.driverCount !== 32 ||
      !Number.isInteger(w.league.calendarSize) ||
      w.league.calendarSize < 1 ||
      w.league.calendarSize > model.game.circuits.length ||
      !between(w.league.licenseThreshold, 1, 120) ||
      !between(w.league.rookiePracticeTarget, 0, 10) ||
      !between(w.league.componentAllocation, 1, 20) ||
      !between(w.league.extraComponentGridPenalty, 0, 32)
    )
      return false;
    for (const d of people) {
      const meta = w.people[d.id];
      if (
        !shape(d, model.game.drivers[0]) ||
        !shape(meta, { ...m.people[model.game.drivers[0].id], debut: null }) ||
        !['ACTIVE', 'RESERVE', 'DEVELOPMENT', 'FREE AGENT', 'RETIRED'].includes(meta.status) ||
        !['BRIEF', 'PROCEDURAL'].includes(meta.provenance) ||
        !between(meta.fatigue) ||
        !between(meta.motivation) ||
        !between(meta.scouting) ||
        !between(meta.licensePoints, 0, 120) ||
        !between(d.rating) ||
        !between(d.potential) ||
        !between(d.age, 15, 150)
      )
        return false;
      if (
        g.drivers.some((x) => x.id === d.id) !== (meta.status === 'ACTIVE') ||
        (!teamIds.has(d.teamId) && d.teamId !== 'free')
      )
        return false;
      if (
        !shape(g.stats[d.id], model.game.stats[model.game.drivers[0].id]) ||
        !Number.isFinite(s.driverPoints[d.id]) ||
        Object.values(d.attributes).some((v) => !between(v))
      )
        return false;
    }
    for (const e of engineers)
      if (
        !shape(e, model.game.engineers[0]) ||
        Object.values(e.attributes).some((v) => !between(v))
      )
        return false;
    for (const id of g.drivers.map((d) => d.id)) {
      for (const key of ['cars', 'setups', 'decisions', 'knowledge', 'reputation'] as const)
        if (!shape(g[key][id], model.game[key][model.game.drivers[0].id])) return false;
      if (
        !Number.isFinite(g.discipline[id]) ||
        !shape(s.career.ceoRelations[id], model.career.ceoRelations[model.game.drivers[0].id])
      )
        return false;
      const c = w.components[id];
      if (!c || Object.values(c).some((v) => !Number.isFinite(v) || v < 0)) return false;
      for (const key of [
        'frontWing',
        'rearWing',
        'rideHeight',
        'differential',
        'brakeMigration',
        'cooling',
      ] as const) {
        const v = g.decisions[id][key];
        if (v !== undefined && !between(v)) return false;
      }
    }
    const relationship = Object.values(model.game.relationships)[0];
    for (const rel of Object.values(g.relationships))
      if (!shape(rel, relationship) || Object.values(rel).some((v) => !between(v))) return false;
    for (const t of g.teams) {
      const o = w.organizations[t.id];
      if (
        !shape(o, m.organizations[model.managedTeam]) ||
        !between(o.confidence) ||
        !between(o.researchAllocation) ||
        Object.values(o.accounts).some((v) => v < 0) ||
        o.tyreContract.supplier !== t.tires ||
        o.tyreContract.end - o.tyreContract.start < 2
      )
        return false;
      if (
        g.tyres.some(
          (p) =>
            g.teams.filter((team) => team.tires === p.name).length >
            Math.max(4, model.game.teams.filter((t) => t.tires === p.name).length),
        )
      )
        return false;
      const temporary = w.substitutions.filter((x) => x.teamId === t.id).length;
      if (
        w.pool.filter(
          (d) => d.teamId === t.id && ['RESERVE', 'DEVELOPMENT'].includes(w.people[d.id].status),
        ).length !== 3 &&
        !temporary
      )
        return false;
    }
    for (const c of g.contracts)
      if (!validTerms(w.terms[c.id]) || !['active', 'future', 'expired'].includes(c.status))
        return false;
    const universeIds = new Set([...ids, ...engineers.map((e) => e.id)]);
    for (const n of [...w.negotiations, ...w.pending])
      if (
        !universeIds.has(n.personId) ||
        !universeIds.has(n.replaceId) ||
        !teamIds.has(n.teamId) ||
        !validTerms(n.terms) ||
        !between(n.salary, 0.01, 100) ||
        !Number.isInteger(n.years) ||
        !between(n.years, 1, 5) ||
        !['counter', 'accepted', 'rejected', 'signed'].includes(n.status)
      )
        return false;
    if (
      !w.regulations.some((e) => e.id === w.activeEra) ||
      w.regulations.some(
        (e) => !Number.isInteger(e.effective) || e.effective < e.announced || e.costCap <= 0,
      )
    )
      return false;
    if (
      w.offseason &&
      (!Number.isInteger(w.offseason.step) ||
        !between(w.offseason.step, 0, 8) ||
        w.offseason.season !== s.season ||
        g.phase !== 'postseason')
    )
      return false;
    if (
      !['Casual', 'Standard', 'Simulation'].includes(w.settings.difficulty) ||
      !['full', 'summary'].includes(w.settings.telemetry) ||
      !between(w.settings.fontSize, 85, 140) ||
      w.settings.locale !== 'pt-BR'
    )
      return false;
    const snapshot = (a: SeasonSnapshot) =>
      shape(a, {
        season: 0,
        provenance: '',
        drivers: [model.game.drivers[0]],
        teams: [model.game.teams[0]],
        engineers: [model.game.engineers[0]],
        contracts: [model.game.contracts[0]],
        calendar: [model.game.circuits[0]],
        regulation: m.regulations[0],
        teamStats: model.game.teamStats,
        terms: {},
        awards: [{ name: '', personId: '', value: 0, unit: '' }],
      }) &&
      new Set(a.drivers.map((d) => d.id)).size === a.drivers.length &&
      a.drivers.every((d) => ids.has(d.id)) &&
      a.contracts.every(
        (c) =>
          a.drivers.some((d) => d.id === c.personId) ||
          a.engineers.some((e) => e.id === c.personId),
      );
    if (w.closing && !snapshot(w.closing)) return false;
    if (
      g.history.some((a) => a.snapshot && (!snapshot(a.snapshot) || a.snapshot.season !== a.season))
    )
      return false;
    if (new Set(g.history.map((a) => a.season)).size !== g.history.length) return false;
    return true;
  } catch {
    return false;
  }
}
