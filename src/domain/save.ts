import { initialCareer } from './gameplay/career';
import { normalizeSettings } from './gameplay/settings';
import { validRaceState } from './gameplay/validation';
import { sessions } from '../data/regulations';
import { createUniverse } from './simulation/world';
import { parseSave as parseLegacy } from './legacy/save';
import { addNews } from './simulation/management';
import type { Save } from './types';
import { createPersistentWorld, addPoolContracts } from './universe/world';
import { validPersistentWorld } from './universe/validation';
export const SAVE_KEY = 'f1-universe-2029-v1';
export function createSave(seed = 2029): Save {
  const game = createUniverse(seed);
  const save: Save = {
    version: 4,
    world: createPersistentWorld(seed, 2029, game),
    career: initialCareer(),
    race: null,
    season: 2029,
    seed,
    round: 1,
    weekends: [],
    driverPoints: Object.fromEntries(game.drivers.map((d) => [d.id, 0])),
    managedTeam: 'mclaren',
    projects: [],
    preferences: { reducedMotion: false, compact: false },
    game,
  };
  addPoolContracts(save);
  return save;
}
function finiteTree(x: unknown): boolean {
  if (typeof x === 'number') return Number.isFinite(x);
  if (Array.isArray(x)) return x.every(finiteTree);
  if (x && typeof x === 'object') return Object.values(x).every(finiteTree);
  return true;
}
function shape(x: unknown, model: unknown): boolean {
  if (model === null) return x !== undefined;
  if (Array.isArray(model))
    return Array.isArray(x) && (model.length === 0 || x.every((v) => shape(v, model[0])));
  if (typeof model === 'object') {
    return (
      !!x &&
      typeof x === 'object' &&
      Object.entries(model as object).every(([k, v]) => shape((x as Record<string, unknown>)[k], v))
    );
  }
  return typeof x === typeof model;
}
export function parseSave(text: string): Save | null {
  try {
    const raw = JSON.parse(text);
    if (raw.version === 1) {
      const old = parseLegacy(text);
      if (!old) return null;
      const next = createSave(old.seed);
      Object.assign(next, { ...old, version: 4, projects: [] });
      for (const w of next.weekends)
        for (const [session, rows] of Object.entries(w.results))
          for (const r of rows!) {
            const d = next.game.drivers.find((d) => d.id === r.driverId)!;
            r.teamId = d.teamId;
            r.status = 'FINISHED';
            const st = next.game.stats[d.id],
              ts = next.game.teamStats[d.teamId];
            st.points += r.points;
            ts.points += r.points;
            next.game.teamPoints[d.teamId] += r.points;
            if (session === 'GP')
              for (const s of [st, ts]) {
                s.starts++;
                s.finishes.push(r.position);
                if (r.position === 1) s.wins++;
                if (r.position <= 3) s.podiums++;
                if (r.fastestLap) s.fastestLaps++;
              }
            if (session === 'Q3' && r.position === 1) {
              st.poles++;
              ts.poles++;
            }
            if (session === 'Sprint' && r.position === 1) {
              st.sprintWins++;
              ts.sprintWins++;
            }
          }
      if (next.weekends[next.game.circuits.length - 1]?.results.GP) {
        const ds = [...next.game.drivers].sort(
          (a, b) => next.driverPoints[b.id] - next.driverPoints[a.id],
        );
        const ts = [...next.game.teams].sort(
          (a, b) => next.game.teamPoints[b.id] - next.game.teamPoints[a.id],
        );
        next.game.phase = 'postseason';
        next.game.champion = ds[0].id;
        next.game.constructorChampion = ts[0].id;
      }
      addNews(
        next,
        'migração',
        'Save v1 preservado',
        'Resultados anteriores mantidos sem telemetria retroativa. Desenvolvimento demonstrativo substituído pelo sistema financeiro.',
      );
      addPoolContracts(next);
      return parseSave(JSON.stringify(next));
    }
    if (raw.version === 2) {
      raw.version = 3;
      raw.career = { ...initialCareer(), started: true };
      raw.race = null;
    }
    if (raw.version === 3) {
      raw.version = 4;
      raw.world = createPersistentWorld(raw.seed, raw.season, raw.game);
      addPoolContracts(raw);
    }
    if (
      raw.version !== 4 ||
      !Number.isSafeInteger(raw.seed) ||
      raw.seed < 0 ||
      raw.seed > 2147483647 ||
      !Number.isInteger(raw.season) ||
      raw.season < 2029 ||
      !Number.isInteger(raw.round) ||
      raw.round < 1 ||
      raw.round > 161 ||
      !finiteTree(raw)
    )
      return null;
    // Migration: careers saved before career settings existed get the NORMAL defaults, which
    // reproduce the engine exactly as it was. Anything out of range is clamped, never rejected.
    if (raw.career && typeof raw.career === 'object')
      raw.career.settings = normalizeSettings(raw.career.settings);
    const template = createSave(raw.seed);
    const dynamic = [
      'cars',
      'setups',
      'decisions',
      'knowledge',
      'relationships',
      'reputation',
      'stats',
      'discipline',
    ] as const;
    const shapeGame = { ...raw.game };
    for (const key of dynamic) shapeGame[key] = template.game[key];
    if (
      !shape(
        { ...raw, world: template.world, driverPoints: template.driverPoints, game: shapeGame },
        template,
      )
    )
      return null;
    const s = raw as Save,
      g = s.game;
    if (!validPersistentWorld(s, template, shape)) return null;
    if (
      !['driver', 'constructor'].includes(s.career.mode) ||
      (s.career.mode === 'driver' &&
        ![...g.drivers, ...s.world.pool].some(
          (d) => d.id === s.career.driverId && (d.teamId === s.managedTeam || d.teamId === 'free'),
        ))
    )
      return null;
    if (
      !['SECURE', 'UNDER PRESSURE', 'AT RISK', 'EXCELLENT', 'STABLE', 'UNDER REVIEW'].includes(
        s.career.board.status,
      ) ||
      s.career.board.confidence < 0 ||
      s.career.board.confidence > 100 ||
      Object.values(s.career.ceoRelations).some((rel) =>
        Object.values(rel).some((v) => v < 0 || v > 100),
      )
    )
      return null;
    if (
      !shape(s.career.offers, [{ id: '', teamId: '', salary: 0, years: 0, status: '' }]) ||
      s.career.offers.some(
        (o) =>
          !g.teams.some((t) => t.id === o.teamId) ||
          !['pending', 'accepted', 'declined'].includes(o.status) ||
          o.salary < 0 ||
          o.years < 1,
      )
    )
      return null;
    if (s.race && !validRaceState(s)) return null;
    const people = [...g.drivers, ...s.world.pool],
      engineers = [...g.engineers, ...s.world.engineerPool];
    const ids = people.map((d) => d.id),
      teams = g.teams.map((t) => t.id);
    if (
      g.engineVersion !== 2 ||
      !['season', 'postseason'].includes(g.phase) ||
      !teams.includes(s.managedTeam) ||
      g.drivers.length !== s.world.league.driverCount ||
      new Set(ids).size !== ids.length ||
      teams.length !== s.world.league.teamCount ||
      new Set(teams).size !== teams.length ||
      g.engineers.length !== g.drivers.length ||
      g.circuits.length !== s.world.league.calendarSize ||
      g.batteries.length !== 5 ||
      g.tyres.length !== 4 ||
      g.contracts.length !== people.length + engineers.length
    )
      return null;
    if (
      !template.game.drivers.every((d) => ids.includes(d.id)) ||
      !template.game.teams.every((t) => teams.includes(t.id))
    )
      return null;
    for (const t of teams) {
      if (
        g.drivers.filter((d) => d.teamId === t).length !== 2 ||
        g.engineers.filter((e) => e.teamId === t).length !== 2 ||
        g.finances[t].cash < 0
      )
        return null;
    }
    for (const d of g.drivers) {
      const e = g.engineers.filter((e) => e.driverId === d.id);
      if (e.length !== 1 || e[0].teamId !== d.teamId) return null;
      const dec = g.decisions[d.id];
      if (
        (dec.suspension !== undefined &&
          !['Macia', 'Equilibrada', 'Rígida'].includes(dec.suspension)) ||
        (dec.brakes !== undefined &&
          !['Conservadora', 'Equilibrada', 'Agressiva'].includes(dec.brakes)) ||
        !['Economy', 'Race', 'Quali'].includes(dec.engineMap) ||
        !['Save', 'Race', 'Attack', 'Boost', 'Overtake'].includes(dec.energy) ||
        !['Corner', 'Flow', 'Straight', 'Follow'].includes(dec.aero) ||
        !['H', 'M', 'S', 'I', 'W'].includes(dec.compound) ||
        !['Conservar', 'Equilibrado', 'Atacar'].includes(dec.pace) ||
        dec.regen < 1 ||
        dec.regen > 4 ||
        dec.wing < 0 ||
        dec.wing > 100 ||
        dec.balance < 0 ||
        dec.balance > 100
      )
        return null;
    }
    if (new Set(g.contracts.map((c) => c.personId)).size !== g.contracts.length) return null;
    if (
      new Set(engineers.map((e) => e.id)).size !== engineers.length ||
      g.engines.length < teams.length
    )
      return null;
    if (g.circuits.some((c, i) => c.id !== template.game.circuits[i].id || c.round !== i + 1))
      return null;
    for (const t of g.teams)
      if (
        !g.engines.some((e) => e.name === t.engine) ||
        !g.batteries.some((b) => b.name === t.battery) ||
        !g.tyres.some((p) => p.name === t.tires)
      )
        return null;
    if (
      !shape(g.news, [{ id: '', round: 0, season: 0, category: '', title: '', body: '' }]) ||
      !shape(g.interviews, [{ id: '', driverId: '', round: 0, answered: false }]) ||
      g.interviews.some((i) => !ids.includes(i.driverId))
    )
      return null;
    if (
      !shape(g.development, [
        {
          id: '',
          projectId: '',
          teamId: '',
          start: 0,
          due: 0,
          cost: 0,
          expected: 0,
          actual: null,
          status: '',
          progress: 0,
        },
      ])
    )
      return null;
    if (
      !shape(g.penalties, [{ season: 0, round: 0, driverId: '', kind: '', seconds: 0, points: 0 }])
    )
      return null;
    for (const finance of Object.values(g.finances))
      if (!shape(finance.ledger, [{ round: 0, season: 0, category: '', amount: 0, detail: '' }]))
        return null;
    for (const stat of [...Object.values(g.stats), ...Object.values(g.teamStats)])
      if (
        !shape(stat, template.game.stats[template.game.drivers[0].id]) ||
        [...stat.finishes, ...stat.qualifying].some((p) => !Number.isInteger(p) || p < 1 || p > 32)
      )
        return null;
    for (const entity of [...g.drivers, ...g.teams, ...g.engineers])
      if (
        Object.values(entity.attributes).some((v) => v < 0 || v > 100) ||
        entity.dynamics.some((v) => v.value < 0 || v.value > 100)
      )
        return null;
    for (const c of g.circuits)
      if (!Number.isFinite(Date.parse(c.date)) || c.km <= 0 || c.laps < 1 || c.laps > 160)
        return null;
    const dp = Object.fromEntries(ids.map((id) => [id, 0])),
      tp = { ...g.constructorBonus };
    // Calendar length belongs to this save, not a hard-coded 2029 schedule.
    // Round N+1 is permitted only at the completed-season boundary.
    if (s.round > g.circuits.length + 1 || s.weekends.length > g.circuits.length) return null;
    for (let i = 0; i < s.weekends.length; i++) {
      const w = s.weekends[i];
      if (
        w.round !== i + 1 ||
        !w.results ||
        !Array.isArray(w.qualifyingGrid) ||
        !Array.isArray(w.sprintGrid)
      )
        return null;
      const keys = Object.keys(w.results);
      if (
        !keys.length ||
        keys.length > 8 ||
        sessions.slice(0, keys.length).some((x) => !w.results[x])
      )
        return null;
      if (i < s.weekends.length - 1 && !w.results.GP) return null;
      for (const session of sessions) {
        const rows = w.results[session];
        if (!rows) continue;
        if (
          !Array.isArray(rows) ||
          rows.length !== (session === 'Q2' ? 20 : session === 'Q3' ? 10 : 32) ||
          new Set(rows.map((r) => r.driverId)).size !== rows.length
        )
          return null;
        for (let n = 0; n < rows.length; n++) {
          const r = rows[n];
          if (
            !ids.includes(r.driverId) ||
            !teams.includes(r.teamId!) ||
            r.position !== n + 1 ||
            !Number.isInteger(r.points) ||
            r.points < 0 ||
            r.points > 31 ||
            typeof r.time !== 'number' ||
            !['FINISHED', 'DNF', 'DSQ'].includes(r.status!)
          )
            return null;
          dp[r.driverId] += r.points;
          tp[r.teamId!] += r.points;
        }
        const tape = w.tapes?.[session];
        if (tape) {
          if (
            !Array.isArray(tape.frames) ||
            tape.frames.length !== (tape.compact ? 0 : tape.laps) ||
            tape.laps < 1 ||
            tape.laps > 160 ||
            !Array.isArray(tape.events)
          )
            return null;
          for (const event of tape.events)
            if (
              !shape(event, { lap: 0, driverId: '', type: '', detail: '' }) ||
              !ids.includes(event.driverId) ||
              (event.otherId !== undefined && !ids.includes(event.otherId))
            )
              return null;
          for (const frame of tape.frames)
            if (
              !shape(frame.weather, template.game.weather) ||
              !['GREEN', 'YELLOW', 'DOUBLE YELLOW', 'CHEQUERED', 'VSC', 'SC', 'RED'].includes(
                frame.control,
              ) ||
              !Array.isArray(frame.cars) ||
              frame.cars.length !== rows.length ||
              new Set(frame.cars.map((c) => c.id)).size !== rows.length ||
              frame.cars.some(
                (c) =>
                  !shape(c, {
                    id: '',
                    position: 0,
                    elapsed: 0,
                    gap: 0,
                    tyre: '',
                    tyreWear: 0,
                    tyreTemp: 0,
                    battery: 0,
                    pits: 0,
                    status: '',
                    lap: 0,
                    energy: '',
                    aero: '',
                  }) ||
                  !ids.includes(c.id) ||
                  !Number.isFinite(c.battery) ||
                  !Number.isFinite(c.elapsed) ||
                  !Number.isFinite(c.tyreWear),
              )
            )
              return null;
        }
      }
      if (w.results.Q3)
        for (const grid of [w.qualifyingGrid, w.sprintGrid])
          if (
            grid.length !== 32 ||
            new Set(grid).size !== 32 ||
            grid.some((id) => !ids.includes(id))
          )
            return null;
    }
    if (
      ids.some((id) => dp[id] !== s.driverPoints[id] || dp[id] !== g.stats[id].points) ||
      teams.some((id) => tp[id] !== g.teamPoints[id] || tp[id] !== g.teamStats[id].points)
    )
      return null;
    if (
      s.round > s.weekends.length + 1 ||
      (s.round > 1 && !s.weekends.find((w) => w.round === s.round - 1)?.results.GP) ||
      s.weekends.length > s.round
    )
      return null;
    const finalGrandPrix = s.weekends.find((weekend) => weekend.round === g.circuits.length)?.results.GP;
    if (Boolean(finalGrandPrix) !== (g.phase === 'postseason')) return null;
    if (
      g.phase === 'postseason' &&
      (!finalGrandPrix ||
        !ids.includes(g.champion!) ||
        !teams.includes(g.constructorChampion!))
    )
      return null;
    for (const c of g.contracts)
      if (
        !(c.kind === 'driver' ? people : engineers).some(
          (p) => p.id === c.personId && p.teamId === c.teamId,
        ) ||
        (!teams.includes(c.teamId) && c.teamId !== 'free') ||
        !Number.isFinite(c.salary) ||
        c.salary <= 0 ||
        !Number.isFinite(c.until) ||
        !['driver', 'engineer'].includes(c.kind)
      )
        return null;
    for (const p of g.development)
      if (
        !teams.includes(p.teamId) ||
        !['active', 'delivered'].includes(p.status) ||
        !Number.isFinite(p.cost) ||
        !Number.isFinite(p.due)
      )
        return null;
    for (const a of g.history)
      if (
        !a.stats ||
        !Object.values(a.stats).every((x) =>
          shape(x, template.game.stats[template.game.drivers[0].id]),
        ) ||
        !a.points ||
        !Object.values(a.points).every((x) => typeof x === 'number') ||
        !shape(a.teamPoints, template.game.teamPoints) ||
        !Number.isInteger(a.season) ||
        !Array.isArray(a.weekends) ||
        a.weekends.length < 1 ||
        a.weekends.length > 160 ||
        a.weekends.some((w, i) => w.round !== i + 1) ||
        !a.weekends.at(-1)?.results.GP ||
        !ids.includes(a.driverChampion) ||
        !teams.includes(a.teamChampion)
      )
        return null;
    return s;
  } catch {
    return null;
  }
}
