import type { Save, Driver } from '../types';
import type { Negotiation, ContractTerms, Role } from './types';
import {
  allDrivers,
  allEngineers,
  ensureDriverState,
  notifyWorld,
  initialTerms,
  proceduralDriver,
  driverRecord,
  addPoolContracts,
} from './world';
import { cloneState, pairKey } from '../simulation/world';
import { clamp, mean, round, rng, seedFor } from '../simulation/random';
import { addNews, transact } from '../simulation/management';
import { validTerms } from './validation';

export function canManage(s: Save, teamId = s.managedTeam, ai = false) {
  return (
    s.race?.status !== 'RUNNING' &&
    (ai || (s.career.mode === 'constructor' && s.world.ceo.employed && teamId === s.managedTeam))
  );
}
export function replenishAcademies(s: Save) {
  for (const team of s.game.teams)
    for (const status of ['RESERVE', 'RESERVE', 'DEVELOPMENT'] as const) {
      const needed = status === 'RESERVE' ? 2 : 1;
      if (
        s.world.pool.filter((d) => d.teamId === team.id && s.world.people[d.id].status === status)
          .length >= needed
      )
        continue;
      const free = s.world.pool.find(
        (d) =>
          s.world.people[d.id].status === 'FREE AGENT' &&
          d.age < 29 &&
          s.world.people[d.id].licensePoints >= s.world.league.licenseThreshold,
      );
      if (free) {
        free.teamId = team.id;
        s.world.people[free.id].status = status;
        s.world.people[free.id].academy = team.id;
        const c = s.game.contracts.find((c) => c.personId === free.id)!;
        c.teamId = team.id;
        c.status = 'active';
        c.until = s.season + 2;
      } else {
        let i = allDrivers(s).length;
        while (s.world.people[`junior-${s.season}-${i}`]) i++;
        const d = proceduralDriver(s.seed, s.season, i, team.id);
        s.world.pool.push(d);
        s.world.people[d.id] = driverRecord(s.seed, d, status);
      }
    }
  addPoolContracts(s);
}
export function moveDriver(
  s: Save,
  personId: string,
  replaceId: string,
  teamId: string,
  years: number,
  salary: number,
  terms?: ContractTerms,
  reason = 'Contrato',
): boolean {
  const g = s.game,
    person = allDrivers(s).find((d) => d.id === personId),
    out = g.drivers.find((d) => d.id === replaceId && d.teamId === teamId);
  if (
    !person ||
    !out ||
    personId === replaceId ||
    s.world.people[personId].licensePoints < s.world.league.licenseThreshold ||
    s.world.people[personId].status === 'RETIRED'
  )
    return false;
  const origin = person.teamId,
    active = g.drivers.some((d) => d.id === personId),
    a = g.contracts.find((c) => c.personId === personId)!,
    b = g.contracts.find((c) => c.personId === replaceId)!;
  ensureDriverState(s, person);
  ensureDriverState(s, out);
  const targetEngineer = g.engineers.find((e) => e.driverId === replaceId)!;
  targetEngineer.driverId = personId;
  targetEngineer.synergy = clamp(targetEngineer.synergy - 18);
  if (active) {
    const sourceEngineer = g.engineers.find(
      (e) => e.driverId === personId && e.id !== targetEngineer.id,
    )!;
    sourceEngineer.driverId = replaceId;
    sourceEngineer.synergy = clamp(sourceEngineer.synergy - 18);
    out.teamId = origin;
    b.teamId = origin;
    [g.cars[personId], g.cars[replaceId]] = [g.cars[replaceId], g.cars[personId]];
  } else {
    s.world.pool = s.world.pool.filter((d) => d.id !== personId);
    g.drivers = g.drivers.map((d) => (d.id === replaceId ? person : d));
    out.teamId = 'free';
    s.world.pool.push(out);
    s.world.people[replaceId].status = 'FREE AGENT';
    s.world.people[replaceId].academy = null;
    b.teamId = 'free';
    b.status = 'expired';
    g.cars[personId] = structuredClone(g.cars[replaceId]);
  }
  person.teamId = teamId;
  person.salary = salary;
  person.contract = s.season + years;
  s.world.people[personId].status = 'ACTIVE';
  s.world.people[personId].academy = null;
  s.world.people[personId].debut ??= s.season;
  Object.assign(a, {
    teamId,
    until: s.season + years,
    salary,
    status: 'active',
    buyout: round(salary * years * 0.7),
    performanceClause: 50,
  });
  s.world.terms[a.id] = terms
    ? structuredClone(terms)
    : { ...initialTerms(a, s.season), start: s.season };
  s.world.terms[a.id].start = s.season;
  s.world.transfers.push({
    id: `transfer-${s.season}-${s.world.transfers.length}`,
    season: s.season,
    round: s.round,
    personId,
    from: origin,
    to: teamId,
    kind: 'driver',
    detail: reason,
  });
  if (s.career.mode === 'driver') {
    const player = allDrivers(s).find((d) => d.id === s.career.driverId)!;
    if (player.teamId !== 'free') s.managedTeam = player.teamId;
  }
  for (const d of g.drivers) ensureDriverState(s, d);
  addNews(
    s,
    'CONFIRMED',
    `${person.name} na ${g.teams.find((t) => t.id === teamId)!.name}`,
    `${reason}. ${years} temporadas; adaptação com o engenheiro reiniciada.`,
  );
  replenishAcademies(s);
  return true;
}
export function moveEngineer(
  s: Save,
  personId: string,
  replaceId: string,
  teamId: string,
  years: number,
  salary: number,
): boolean {
  const g = s.game,
    p = allEngineers(s).find((e) => e.id === personId),
    old = g.engineers.find((e) => e.id === replaceId && e.teamId === teamId);
  if (!p || !old || p.id === old.id) return false;
  const origin = p.teamId,
    driver = old.driverId,
    active = g.engineers.some((e) => e.id === p.id);
  if (active) {
    old.teamId = origin;
    old.driverId = p.driverId;
    old.synergy = 35;
    const contract = g.contracts.find((c) => c.personId === old.id)!;
    contract.teamId = origin;
  } else {
    s.world.engineerPool = s.world.engineerPool.filter((e) => e.id !== p.id);
    g.engineers = g.engineers.map((e) => (e.id === old.id ? p : e));
    old.teamId = 'free';
    old.driverId = '';
    s.world.engineerPool.push(old);
    const oldContract = g.contracts.find((c) => c.personId === old.id)!;
    oldContract.teamId = 'free';
    oldContract.status = 'expired';
  }
  p.teamId = teamId;
  p.driverId = driver;
  p.synergy = 35;
  let c = g.contracts.find((c) => c.personId === p.id);
  if (!c) {
    c = {
      id: 'contract-' + p.id,
      kind: 'engineer',
      personId: p.id,
      teamId,
      until: s.season + years,
      salary,
      buyout: salary,
      status: 'active',
      option: false,
      performanceClause: 0,
    };
    g.contracts.push(c);
  }
  Object.assign(c, { teamId, until: s.season + years, salary, status: 'active' });
  s.world.terms[c.id] = { ...initialTerms(c, s.season), start: s.season };
  s.world.transfers.push({
    id: `transfer-${s.season}-${s.world.transfers.length}`,
    season: s.season,
    round: s.round,
    personId,
    from: origin,
    to: teamId,
    kind: 'engineer',
    detail: 'Novo vínculo de engenharia',
  });
  notifyWorld(
    s,
    'INFORMATION',
    `${p.name}: nova dupla`,
    'Sinergia começa em 35 e será construída na pista.',
    '/mercado',
  );
  return true;
}
export function marketInterest(s: Save, id: string, teamId: string, salary: number, role: Role) {
  const person = allDrivers(s).find((d) => d.id === id) ?? allEngineers(s).find((e) => e.id === id);
  if (!person) return { score: 0, reasons: ['Talento indisponível.'] };
  const team = s.game.teams.find((t) => t.id === teamId)!;
  const salaryNow = s.game.contracts.find((c) => c.personId === id)?.salary ?? 1;
  const ranks = [...s.game.teams].sort((a, b) => s.game.teamPoints[b.id] - s.game.teamPoints[a.id]);
  const pos = ranks.findIndex((t) => t.id === teamId) + 1;
  const teammate = s.game.drivers.find((d) => d.teamId === teamId)!;
  const rel = s.game.relationships[pairKey(id, teammate.id)];
  const trust = s.career.ceoRelations[id]?.Confiança ?? 60;
  const potential = team.potential;
  const history = s.game.history.filter((a) => a.teamChampion === teamId).length;
  const age = 'age' in person ? person.age : 35;
  const score = clamp(
    35 +
      (salary / Math.max(0.5, salaryNow) - 1) * 26 +
      (team.prestige - person.rating) * 0.45 +
      (potential - person.rating) * 0.35 +
      (17 - pos) * 0.7 +
      history * 2 +
      (rel ? rel.Respeito - rel.Rivalidade : 0) * 0.08 +
      (trust - 50) * 0.15 +
      (age > 36 ? 6 : 0) +
      (role === 'NUMBER ONE' ? 6 : role === 'NUMBER TWO' ? -8 : 0),
  );
  return {
    score,
    reasons: [
      team.prestige >= person.rating
        ? 'Prestígio alinhado às ambições.'
        : 'Prestígio abaixo das ambições atuais.',
      salary >= salaryNow * 1.2 ? 'Remuneração atrativa.' : 'Remuneração sem grande aumento.',
      potential >= person.rating
        ? 'Potencial técnico compatível.'
        : 'Projeto precisa mostrar evolução.',
      rel && rel.Rivalidade > 75
        ? 'Há resistência ao companheiro atual.'
        : 'Dupla esportiva viável.',
    ],
  };
}
export function negotiate(
  s: Save,
  input: Omit<Negotiation, 'id' | 'status' | 'response' | 'counter'>,
  ai = false,
): Save {
  if (
    !canManage(s, input.teamId, ai) ||
    !Number.isFinite(input.salary) ||
    input.salary <= 0 ||
    input.salary > 100 ||
    !Number.isInteger(input.years) ||
    input.years < 1 ||
    input.years > 5 ||
    !validTerms(input.terms) ||
    !Number.isInteger(input.start) ||
    input.start < s.season ||
    input.start > s.season + 2
  )
    return s;
  const list = input.kind === 'driver' ? allDrivers(s) : allEngineers(s),
    p = list.find((d) => d.id === input.personId),
    old = (input.kind === 'driver' ? s.game.drivers : s.game.engineers).find(
      (d) => d.id === input.replaceId && d.teamId === input.teamId,
    );
  if (!p || !old || p.id === old.id || !s.game.teams.some((t) => t.id === input.teamId)) return s;
  const n = cloneState(s),
    interest = marketInterest(n, p.id, input.teamId, input.salary, input.terms.role),
    current = s.game.contracts.find((c) => c.personId === p.id),
    required = round(
      Math.min(
        100,
        Math.max(current?.salary ?? 1, (current?.salary ?? 1) * (1 + (100 - interest.score) / 150)),
      ),
    );
  const eligible =
    input.kind !== 'driver' ||
    (n.world.people[p.id].licensePoints >= n.world.league.licenseThreshold &&
      n.world.people[p.id].status !== 'RETIRED');
  const accepted = eligible && interest.score >= 60;
  const status = !eligible ? 'rejected' : accepted ? 'accepted' : 'counter';
  const row: Negotiation = {
    ...structuredClone(input),
    id: `deal-${s.season}-${s.world.negotiations.length}`,
    status,
    response: !eligible
      ? 'Superlicença insuficiente ou piloto aposentado.'
      : accepted
        ? 'Os termos atendem ao projeto. Aguardo a assinatura.'
        : `Peço US$${required.toFixed(1)}M, ${Math.max(3, input.years)} anos e igualdade esportiva.`,
    counter:
      accepted || !eligible
        ? null
        : {
            salary: required,
            years: Math.max(3, input.years),
            role: 'EQUAL STATUS',
            releaseBelow: Math.min(16, Math.max(5, Math.round((100 - p.rating) / 2))),
          },
  };
  n.world.negotiations.unshift(row);
  return n;
}
export function signNegotiation(s: Save, id: string, ai = false): Save {
  const row = s.world.negotiations.find((n) => n.id === id && n.status === 'accepted');
  if (
    !row ||
    !canManage(s, row.teamId, ai) ||
    s.world.pending.some((p) => p.personId === row.personId || p.replaceId === row.replaceId)
  )
    return s;
  const n = cloneState(s),
    r = n.world.negotiations.find((d) => d.id === id)!,
    current = n.game.contracts.find((c) => c.personId === r.personId);
  const fee =
    (current?.status === 'active' && current.teamId !== r.teamId ? current.buyout : 0) +
    r.salary * 0.15;
  if (!transact(n, r.teamId, -fee, 'contract', 'Assinatura de contrato')) return s;
  r.feePaid = fee;
  if (r.start > s.season) {
    r.status = 'signed';
    n.world.pending.push(structuredClone(r));
    addNews(
      n,
      'CONFIRMED',
      'Contrato futuro assinado',
      `${r.personId} está contratado para ${r.start}; vínculo atual continua até a transferência.`,
    );
  } else {
    if (n.weekends.some((w) => w.round === n.round && !w.results.GP)) return s;
    const ok =
      r.kind === 'driver'
        ? moveDriver(n, r.personId, r.replaceId, r.teamId, r.years, r.salary, r.terms)
        : moveEngineer(n, r.personId, r.replaceId, r.teamId, r.years, r.salary);
    if (!ok) return s;
    r.status = 'signed';
  }
  n.world.ceo.reputation.Negotiation = clamp(n.world.ceo.reputation.Negotiation + 1);
  return n;
}
export function scoutDriver(s: Save, id: string): Save {
  const record = s.world.people[id];
  if (!record || record.scouting >= 100 || !canManage(s)) return s;
  const n = cloneState(s);
  if (!transact(n, n.managedTeam, -0.25, 'scouting', 'Relatório de observação')) return s;
  n.world.people[id].scouting = clamp(record.scouting + 25);
  return n;
}
export function acceptCounter(save: Save, id: string): Save {
  const offer = save.world.negotiations.find((n) => n.id === id && n.status === 'counter');
  if (!offer?.counter || !canManage(save, offer.teamId)) return save;
  const n = cloneState(save),
    r = n.world.negotiations.find((x) => x.id === id)!;
  r.salary = r.counter!.salary;
  r.years = r.counter!.years;
  r.terms.role = r.counter!.role;
  r.terms.releaseBelow = r.counter!.releaseBelow;
  r.status = 'accepted';
  r.response = 'Contraproposta aceita. Assinatura disponível.';
  r.counter = null;
  return n;
}
export function assessPromises(s: Save) {
  for (const c of s.game.contracts.filter((c) => c.status === 'active' && c.kind === 'driver')) {
    const terms = s.world.terms[c.id],
      d = allDrivers(s).find((d) => d.id === c.personId);
    if (!terms || !d || d.teamId === 'free') continue;
    const pos =
      [...s.game.teams]
        .sort((a, b) => s.game.teamPoints[b.id] - s.game.teamPoints[a.id])
        .findIndex((t) => t.id === c.teamId) + 1;
    for (const p of terms.promises) {
      if (p.status !== 'pending') continue;
      const kept =
        p.kind === 'carro competitivo'
          ? pos <= 5
          : p.kind === 'investimento'
            ? s.world.organizations[c.teamId].accounts.development >= 10
            : p.kind === 'prioridade'
              ? ['NUMBER ONE', 'FRANCHISE DRIVER'].includes(terms.role)
              : p.kind === 'igualdade'
                ? terms.role === 'EQUAL STATUS'
                : !s.weekends.some((w) =>
                    w.tapes?.GP?.events.some(
                      (e) => e.driverId === c.personId && e.type === 'team order',
                    ),
                  );
      p.status = kept ? 'kept' : 'broken';
      const rel = s.career.ceoRelations[c.personId];
      if (rel) {
        rel.Confiança = clamp(rel.Confiança + (kept ? 3 : -12));
        rel.Lealdade = clamp(rel.Lealdade + (kept ? 2 : -8));
      }
      s.world.people[c.personId].motivation = clamp(
        s.world.people[c.personId].motivation + (kept ? 3 : -10),
      );
      if (!kept)
        notifyWorld(s, 'ACTION REQUIRED', `${d.name}: promessa não cumprida`, p.kind, '/mercado');
    }
    if (terms.releaseBelow && pos > terms.releaseBelow) c.buyout = 0;
  }
}
