import type { Save } from '../types';
import { developmentProjects } from '../../data/editorial';
import { clamp, mean, rng, round, seedFor } from './random';
import { pairKey, emptyStats, defaultDecision, cloneState } from './world';
import type { Upgrade, News, Contract } from './types';
import { completeOffseason, openOffseason } from '../universe/seasons';
import { allDrivers, growDriver, ensureDriverState } from '../universe/world';
import { restoreSubstitutes } from '../universe/operations';
export const prizeMoney = [310, 250, 205, 158, 142, 128, 115, 103, 92, 82, 72, 62, 50, 36, 22, 10];
export const projectCatalog = [
  ...developmentProjects,
  {
    id: 'sidepod',
    name: 'Sidepod',
    part: 'Sidepod',
    progress: 0,
    cost: 2.7,
    gain: 0.06,
    confidence: 75,
    risk: 'Médio',
    round: 4,
    target: '4 etapas',
  },
];
export function addNews(save: Save, category: string, title: string, body: string) {
  save.game.news.unshift({
    id: `${save.season}-${save.round}-${save.game.news.length}`,
    round: save.round,
    season: save.season,
    category,
    title,
    body,
  });
}
export function transact(
  save: Save,
  teamId: string,
  amount: number,
  category: string,
  detail: string,
) {
  const f = save.game.finances[teamId];
  const accounts = save.world?.organizations[teamId]?.accounts;
  const cap = save.world?.regulations.find((e) => e.id === save.world.activeEra)?.costCap ?? 235;
  const excluded = [
    'salary',
    'driver salary',
    'engineer salary',
    'contract',
    'contract option',
    'performance bonus',
    'championship bonus',
    'buyout',
    'prize',
    'season budget',
  ];
  if (amount < 0 && accounts && !excluded.includes(category) && accounts.capSpent - amount > cap)
    return false;
  if (amount < 0 && f.cash + amount < 0) return false;
  f.cash = round(f.cash + amount);
  if (amount < 0) f.expenses = round(f.expenses - amount);
  else f.income = round(f.income + amount);
  if (amount < 0 && accounts) {
    if (!excluded.includes(category)) accounts.capSpent = round(accounts.capSpent - amount);
    if (category === 'R&D') accounts.development -= amount;
    else if (category === 'driver salary') accounts.drivers -= amount;
    else if (category === 'engineer salary' || category === 'staff') accounts.staff -= amount;
    else if (category === 'battery') accounts.battery -= amount;
    else if (category === 'tyres') accounts.tyres -= amount;
    else accounts.operating -= amount;
  }
  f.ledger.push({
    season: save.season,
    round: save.round,
    amount: round(amount),
    category,
    detail,
  });
  return true;
}
export function startProject(save: Save, projectId: string, teamId = save.managedTeam): Save {
  if (
    save.race?.status === 'RUNNING' ||
    (save.career.mode === 'driver' && teamId === save.managedTeam)
  )
    return save;
  const p = projectCatalog.find((p) => p.id === projectId);
  if (
    !p ||
    save.game.development.some(
      (x) =>
        x.teamId === teamId &&
        x.projectId === projectId &&
        (x.status === 'active' || x.start === save.round),
    ) ||
    save.game.finances[teamId].cash < p.cost ||
    save.game.phase !== 'season'
  )
    return save;
  const next = cloneState(save);
  const t = next.game.teams.find((t) => t.id === teamId)!;
  const duration = Math.max(
    2,
    Math.ceil(p.cost * 1.6 * (100 / next.game.atr[teamId]) * (100 / t.attributes.Desenvolvimento)),
  );
  if (!transact(next, teamId, -p.cost, 'R&D', p.name)) return save;
  const allocation = next.world.organizations[teamId].researchAllocation / 100;
  next.world.organizations[teamId].futureResearch += p.cost * allocation;
  next.game.development.push({
    id: `${teamId}-${projectId}-${save.season}-${save.round}`,
    projectId,
    teamId,
    start: save.round,
    due: save.round + duration,
    cost: p.cost,
    expected: p.gain * (1 - allocation),
    actual: null,
    status: 'active',
    progress: 0,
  });
  addNews(
    next,
    'upgrade',
    `${t.name} inicia ${p.name}`,
    `Investimento de US$ ${p.cost}M. Conclusão prevista em ${duration} etapas.`,
  );
  return next;
}
export function projectProgress(p: Upgrade, round: number) {
  return p.status === 'delivered' ? 100 : clamp(((round - p.start) / (p.due - p.start)) * 100);
}
export function deliverUpgrades(save: Save) {
  for (const p of save.game.development) {
    if (p.status !== 'active') continue;
    p.progress = projectProgress(p, save.round + 1);
    if (save.round + 1 < p.due) continue;
    const t = save.game.teams.find((t) => t.id === p.teamId)!;
    const correlation = t.dynamics.find((d) => d.label === 'Correlação CFD/túnel/pista')!.value;
    const random = rng(seedFor(save.game.seasonSeed, p.id));
    const factor =
      random() < (100 - correlation) / 220 ? -0.15 : 0.3 + correlation / 150 + random() * 0.35;
    p.actual = round(p.expected * factor);
    p.status = 'delivered';
    p.progress = 100;
    for (const d of save.game.drivers.filter((d) => d.teamId === p.teamId))
      save.game.cars[d.id].upgradeSeconds = round(save.game.cars[d.id].upgradeSeconds + p.actual);
    const key =
      p.projectId === 'battery'
        ? 'Integração motor-chassi'
        : p.projectId === 'suspension'
          ? 'Suspensão'
          : p.projectId === 'cooling'
            ? 'Refrigeração'
            : 'Eficiência aerodinâmica';
    t.attributes[key] = clamp(t.attributes[key] + p.actual * 8);
    addNews(
      save,
      'upgrade',
      `${t.name}: upgrade ${p.actual > 0 ? 'validado' : 'abaixo da correlação'}`,
      `Previsto −${p.expected.toFixed(2)} s; efeito real ${p.actual >= 0 ? '−' : '+'}${Math.abs(p.actual).toFixed(3)} s por volta.`,
    );
  }
}
export function upgradeInfrastructure(save: Save): Save {
  if (
    save.race?.status === 'RUNNING' ||
    (save.career.mode === 'driver' &&
      save.managedTeam === save.game.drivers.find((d) => d.id === save.career.driverId)?.teamId)
  )
    return save;
  const t = save.game.teams.find((t) => t.id === save.managedTeam)!;
  if (t.infrastructure >= 99 || save.game.finances[t.id].cash < 8) return save;
  const next = cloneState(save);
  transact(next, t.id, -8, 'infrastructure', 'Ampliação de engenharia');
  const nt = next.game.teams.find((x) => x.id === t.id)!;
  nt.infrastructure = clamp(nt.infrastructure + 2);
  nt.attributes.Desenvolvimento = clamp(nt.attributes.Desenvolvimento + 1);
  return next;
}
export function contractQuote(
  save: Save,
  personId: string,
  kind: 'driver' | 'engineer',
  salary: number,
) {
  const g = save.game;
  const person =
    kind === 'driver'
      ? g.drivers.find((d) => d.id === personId)
      : g.engineers.find((e) => e.id === personId);
  if (!person) return { accepted: false, cost: 0, chance: 0 };
  const current = g.contracts.find((c) => c.personId === personId && c.status === 'active')!;
  const team = g.teams.find((t) => t.id === save.managedTeam)!;
  const teammates = g.drivers.filter((d) => d.teamId === team.id);
  const relation =
    kind === 'driver'
      ? mean(teammates.map((d) => g.relationships[pairKey(d.id, personId)]?.Respeito ?? 50))
      : 75;
  const reputation = g.reputation[personId] ?? person.rating;
  const potential = 'potential' in person ? person.potential : person.rating;
  const age = 'age' in person ? person.age : 35;
  const sameNation =
    'country' in person && teammates.some((d) => d.country === person.country) ? 4 : 0;
  const need = person.rating - mean(teammates.map((d) => d.rating));
  const chance = clamp(
    40 +
      (salary / current.salary - 1) * 35 +
      (team.prestige - reputation) * 0.5 +
      relation * 0.12 +
      sameNation +
      (potential - person.rating) * 0.4 +
      (age > 38 ? 5 : 0) +
      need * 0.5 -
      (g.discipline[personId] ?? 0) * 2,
  );
  return {
    accepted:
      salary > 0 && rng(seedFor(g.seasonSeed, save.round, kind, personId, salary))() * 100 < chance,
    cost: round(current.buyout + salary * 0.15),
    chance: Math.round(chance),
  };
}
export function signContract(
  save: Save,
  personId: string,
  replaceId: string,
  kind: 'driver' | 'engineer',
  years: number,
  salary: number,
): Save {
  if (
    save.race?.status === 'RUNNING' ||
    (save.career.mode === 'driver' &&
      save.managedTeam === save.game.drivers.find((d) => d.id === save.career.driverId)?.teamId)
  )
    return save;
  if (
    !Number.isFinite(salary) ||
    salary <= 0 ||
    salary > 100 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 5
  )
    return save;
  const list = kind === 'driver' ? save.game.drivers : save.game.engineers;
  const target = list.find((p) => p.id === personId),
    replace = list.find((p) => p.id === replaceId);
  if (
    !target ||
    !replace ||
    replace.teamId !== save.managedTeam ||
    target.teamId === replace.teamId
  )
    return save;
  const quote = contractQuote(save, personId, kind, salary);
  if (!quote.accepted || save.game.finances[save.managedTeam].cash < quote.cost) return save;
  const next = cloneState(save),
    g = next.game;
  const dest = save.managedTeam,
    origin = target.teamId;
  transact(next, dest, -quote.cost, 'contract', `Contrato de ${target.name}`);
  transact(next, origin, quote.cost * 0.8, 'buyout', `Saída de ${target.name}`);
  const people = kind === 'driver' ? g.drivers : g.engineers;
  const a = people.find((p) => p.id === personId)!,
    b = people.find((p) => p.id === replaceId)!;
  a.teamId = dest;
  b.teamId = origin;
  if (kind === 'driver') {
    const ea = g.engineers.find((e) => e.driverId === personId)!,
      eb = g.engineers.find((e) => e.driverId === replaceId)!;
    ea.driverId = replaceId;
    eb.driverId = personId;
    ea.synergy = clamp(ea.synergy - 18);
    eb.synergy = clamp(eb.synergy - 18);
    const oldCar = g.cars[personId];
    g.cars[personId] = g.cars[replaceId];
    g.cars[replaceId] = oldCar;
    g.drivers.find((d) => d.id === personId)!.salary = salary;
    g.drivers.find((d) => d.id === personId)!.contract = save.season + years;
  } else {
    const ea = g.engineers.find((e) => e.id === personId)!,
      eb = g.engineers.find((e) => e.id === replaceId)!;
    [ea.driverId, eb.driverId] = [eb.driverId, ea.driverId];
    ea.synergy = clamp(ea.synergy - 20);
    eb.synergy = clamp(eb.synergy - 20);
  }
  for (const c of g.contracts.filter(
    (c) => c.kind === kind && [personId, replaceId].includes(c.personId),
  )) {
    c.teamId = c.personId === personId ? dest : origin;
    if (c.personId === personId) {
      c.salary = salary;
      c.until = save.season + years;
      c.buyout = round(salary * years * 0.7);
      c.performanceClause = 50;
      c.option = years > 1;
    }
  }
  addNews(
    next,
    'transferência',
    `${target.name} chega à ${g.teams.find((t) => t.id === dest)!.name}`,
    `${replace.name} faz o caminho inverso. Contrato de ${years} anos; salário US$${salary}M/ano. Adaptação reiniciada.`,
  );
  return next;
}
export function answerInterview(save: Save, id: string, answer: 'team' | 'rival' | 'self'): Save {
  const interview = save.game.interviews.find((i) => i.id === id);
  if (!interview || interview.answered) return save;
  const next = cloneState(save);
  const row = next.game.interviews.find((i) => i.id === id)!;
  row.answered = true;
  row.answer = answer;
  const d = next.game.drivers.find((d) => d.id === row.driverId)!;
  for (const dyn of d.dynamics)
    if (['Moral', 'Confiança', 'Gestão de pressão'].includes(dyn.label))
      dyn.value = clamp(dyn.value + (answer === 'team' ? 2 : answer === 'self' ? 1 : -2));
  for (const [pair, ratings] of Object.entries(next.game.relationships))
    if (pair.split('|').includes(d.id)) {
      ratings.Respeito = clamp(ratings.Respeito + (answer === 'team' ? 2 : -1));
      ratings.Tensão = clamp(ratings.Tensão + (answer === 'rival' ? 4 : -1));
    }
  next.game.reputation[d.id] = clamp(
    next.game.reputation[d.id] + (answer === 'team' ? 1 : answer === 'rival' ? -2 : 0.5),
  );
  addNews(
    next,
    'entrevista',
    `${d.name}: ${answer === 'team' ? '“O mérito é de toda a equipe.”' : answer === 'self' ? '“Vou trabalhar no que posso melhorar.”' : '“Os rivais precisam respeitar os limites.”'}`,
    'A resposta alterou moral, pressão e relações no paddock.',
  );
  return next;
}
export function compareStats(
  a: { points: number; finishes: number[] },
  b: { points: number; finishes: number[] },
) {
  if (a.points !== b.points) return b.points - a.points;
  for (let p = 1; p <= 32; p++) {
    const delta =
      b.finishes.filter((x) => x === p).length - a.finishes.filter((x) => x === p).length;
    if (delta) return delta;
  }
  return 0;
}
export function settleWeekend(save: Save) {
  const g = save.game;
  const w = save.weekends.find((w) => w.round === save.round)!;
  const weekendPoints = Object.fromEntries(g.teams.map((t) => [t.id, 0]));
  for (const s of ['Q3', 'Sprint', 'GP'] as const)
    for (const r of w.results[s] ?? [])
      weekendPoints[r.teamId ?? g.drivers.find((d) => d.id === r.driverId)!.teamId] += r.points;
  const winner = Object.keys(weekendPoints).sort(
    (a, b) => weekendPoints[b] - weekendPoints[a] || a.localeCompare(b),
  )[0];
  g.teamPoints[winner] += 2;
  g.constructorBonus[winner] += 2;
  g.teamStats[winner].points += 2;
  addNews(
    save,
    'construtores',
    `${g.teams.find((t) => t.id === winner)!.name} ganha o bônus do fim de semana`,
    '+2 pontos exclusivamente no campeonato de construtores; desempate do bônus por identificador estável.',
  );
  for (const t of g.teams) {
    const contracts = g.contracts.filter((c) => c.teamId === t.id && c.status === 'active');
    const driverSalary =
      contracts.filter((c) => c.kind === 'driver').reduce((s, c) => s + c.salary, 0) / Math.max(1, g.circuits.length);
    const engineerSalary =
      contracts.filter((c) => c.kind === 'engineer').reduce((s, c) => s + c.salary, 0) / Math.max(1, g.circuits.length);
    for (const c of contracts) {
      if (
        c.kind === 'driver' &&
        c.performanceClause > 0 &&
        (g.stats[c.personId]?.points ?? 0) >= c.performanceClause
      ) {
        if (
          transact(
            save,
            t.id,
            -c.salary * (save.world.terms[c.id]?.performanceBonus ?? 0.08),
            'performance bonus',
            'Bônus contratual de desempenho',
          )
        )
          c.performanceClause = 0;
      }
    }
    for (const [category, cost] of [
      ['driver salary', driverSalary],
      ['engineer salary', engineerSalary],
      ['travel', 0.5],
      ['staff', 0.35],
      ['supplier contracts', 0.6],
    ] as const) {
      if (!transact(save, t.id, -cost, category, `Etapa ${save.round}`)) {
        g.philosophies[t.id].risk = clamp(g.philosophies[t.id].risk - 3);
        addNews(
          save,
          'crise',
          `${t.name} limita despesas`,
          'Caixa insuficiente; contratações e projetos são bloqueados até recomposição.',
        );
      }
    }
    // Maintenance has a cost; neglect feeds the contextual reliability model.
    if (transact(save, t.id, -0.4, 'maintenance', 'Inspeção e reparo após GP'))
      for (const d of g.drivers.filter((d) => d.teamId === t.id)) {
        g.cars[d.id].wear = Math.max(0, g.cars[d.id].wear - 1);
        for (const k in g.cars[d.id].damage) g.cars[d.id].damage[k] = 0;
      }
  }
  deliverUpgrades(save);
  if ([12, 24].includes(save.round)) {
    const ranking = [...g.teams].sort(
      (a, b) =>
        g.teamPoints[b.id] - g.teamPoints[a.id] ||
        compareStats(g.teamStats[a.id], g.teamStats[b.id]),
    );
    ranking.forEach((t, i) => (g.atr[t.id] = 75 + i * 5));
    addNews(
      save,
      'ATR',
      `Handicap recalculado após GP${save.round}`,
      'Recursos aerodinâmicos variam de 75% para P1 a 150% para P16.',
    );
  }
}
export function runTeamAI(save: Save): Save {
  let next = save;
  for (const t of next.game.teams) {
    if (t.id === next.managedTeam) continue;
    const philosophy = next.game.philosophies[t.id];
    const random = rng(seedFor(next.game.seasonSeed, next.round, t.id, 'management'));
    if (next.game.finances[t.id].cash > 25 && random() < philosophy.development / 150) {
      const choice = projectCatalog[Math.floor(random() * projectCatalog.length)];
      next = startProject(next, choice.id, t.id);
    }
    if (
      [Math.ceil(next.game.circuits.length / 3), Math.ceil(next.game.circuits.length * 2 / 3), next.game.circuits.length].includes(next.round) &&
      random() < (philosophy.risk + 100 - philosophy.patience) / 240
    ) {
      const own = next.game.drivers
        .filter((d) => d.teamId === t.id)
        .sort((a, b) => a.rating - b.rating)[0];
      const targets = next.game.drivers
        .filter((d) => d.teamId !== t.id && d.id !== next.career.driverId && d.rating > own.rating)
        .sort((a, b) => b.potential - b.age * 0.12 - (a.potential - a.age * 0.12));
      const target = targets[Math.floor(random() * Math.min(5, targets.length))];
      if (target && own.id !== next.career.driverId) {
        const managed = next.managedTeam;
        const proposal = { ...next, managedTeam: t.id };
        const result = signContract(
          proposal,
          target.id,
          own.id,
          'driver',
          2,
          round((target.salary ?? 5) * 1.35),
        );
        next = { ...result, managedTeam: managed };
      }
    }
    if ([12, 24].includes(next.round) && random() < philosophy.development / 220) {
      const own = next.game.engineers
        .filter((e) => e.teamId === t.id)
        .sort((a, b) => a.rating - b.rating)[0];
      const target = next.game.engineers
        .filter((e) => e.teamId !== t.id && e.rating > own.rating)
        .sort((a, b) => b.rating - a.rating)[0];
      if (target) {
        const current = next.game.contracts.find((c) => c.personId === target.id)!;
        const managed = next.managedTeam;
        next = {
          ...signContract(
            { ...next, managedTeam: t.id },
            target.id,
            own.id,
            'engineer',
            2,
            round(current.salary * 1.4),
          ),
          managedTeam: managed,
        };
      }
    }
  }
  return next;
}
export function exerciseOption(save: Save, contractId: string): Save {
  if (
    save.race?.status === 'RUNNING' ||
    (save.career.mode === 'driver' &&
      save.managedTeam === save.game.drivers.find((d) => d.id === save.career.driverId)?.teamId)
  )
    return save;
  const c = save.game.contracts.find((c) => c.id === contractId && c.teamId === save.managedTeam);
  if (!c?.option || c.until > save.season + 1 || save.game.finances[c.teamId].cash < c.salary * 0.2)
    return save;
  const n = cloneState(save);
  const contract = n.game.contracts.find((c) => c.id === contractId)!;
  transact(n, c.teamId, -c.salary * 0.2, 'contract option', 'Exercício de opção contratual');
  contract.until++;
  contract.option = false;
  if (contract.kind === 'driver')
    n.game.drivers.find((d) => d.id === contract.personId)!.contract = contract.until;
  addNews(
    n,
    'contrato',
    'Opção de renovação exercida',
    'Vínculo estendido por uma temporada com pagamento da taxa contratual.',
  );
  return n;
}
export function prepareNextSeason(save: Save): Save {
  if (save.game.phase !== 'postseason') return save;
  let next = cloneState(save);
  openOffseason(next);
  restoreSubstitutes(next);
  next = completeOffseason(next);
  const g = next.game;
  g.history.push({
    season: save.season,
    driverChampion: g.champion!,
    teamChampion: g.constructorChampion!,
    points: { ...save.driverPoints },
    teamPoints: { ...g.teamPoints },
    stats: structuredClone(save.game.stats),
    // Historical sporting data and the complete event log remain immutable.
    // Per-lap animation frames are transient replay data, not championship records.
    weekends:
      save.world.settings.telemetry === 'summary'
        ? save.weekends.map((w) => ({
            ...w,
            tapes: Object.fromEntries(
              Object.entries(w.tapes ?? {}).map(([session, tape]) => [
                session,
                { ...tape, compact: true, frames: [] },
              ]),
            ),
          }))
        : save.weekends,
    snapshot: next.world.closing ?? undefined,
  });
  next.season++;
  next.race = null;
  next.round = 1;
  next.weekends = [];
  next.driverPoints = Object.fromEntries(allDrivers(next).map((d) => [d.id, 0]));
  g.teamPoints = Object.fromEntries(g.teams.map((t) => [t.id, 0]));
  g.constructorBonus = Object.fromEntries(g.teams.map((t) => [t.id, 0]));
  g.stats = Object.fromEntries(allDrivers(next).map((d) => [d.id, emptyStats()]));
  g.teamStats = Object.fromEntries(g.teams.map((t) => [t.id, emptyStats()]));
  g.phase = 'season';
  g.champion = null;
  g.constructorChampion = null;
  g.seasonSeed = seedFor(save.seed, next.season);
  g.development = g.development
    .filter((p) => p.status === 'active')
    .map((p) => ({ ...p, start: p.start - g.circuits.length, due: p.due - g.circuits.length }));
  g.penalties = [];
  g.gridPenalties = {};
  for (const c of g.circuits) c.date = c.date.replace(String(save.season), String(next.season));
  for (const d of g.drivers) {
    const random = rng(seedFor(g.seasonSeed, d.id, 'growth'));
    const roll = random();
    const trajectory =
      d.age < 25
        ? roll < 0.18
          ? 'breakout'
          : roll < 0.4
            ? 'estagnação'
            : 'crescimento'
        : d.age > 36
          ? 'declínio'
          : roll < 0.12
            ? 'desenvolvimento tardio'
            : roll > 0.9
              ? 'regressão'
              : 'pico';
    for (const key in d.attributes) {
      const experience = [
        'Consistência',
        'Inteligência de corrida',
        'Feedback técnico',
        'Gestão de pneus',
        'Gestão de energia',
      ].includes(key);
      const delta = experience
        ? 0.3 + random() * 0.6
        : trajectory === 'breakout'
          ? 1 + random() * 1.5
          : trajectory === 'crescimento'
            ? 0.2 + random()
            : trajectory === 'declínio'
              ? -0.4 - random()
              : trajectory === 'regressão'
                ? -0.5
                : trajectory === 'desenvolvimento tardio'
                  ? 0.6
                  : 0;
      d.attributes[key] = round(
        clamp(d.attributes[key] + delta, 35, Math.max(d.potential, d.attributes[key])),
      );
    }
    d.age++;
    d.rating = Math.round(mean(Object.values(d.attributes)));
    g.decisions[d.id] = defaultDecision();
    g.setups[d.id].confidence = 20;
    g.setups[d.id].setsUsed = 0;
    g.cars[d.id].mileage = 0;
    g.cars[d.id].wear = 0;
    g.cars[d.id].batteryWear = 0;
    for (const key in g.cars[d.id].damage) g.cars[d.id].damage[key] = 0;
    addNews(
      next,
      'progressão',
      `${d.name}: ${trajectory}`,
      `Nova temporada aos ${d.age} anos. Potencial orienta o teto, sem garantir crescimento.`,
    );
  }
  for (const d of next.world.pool) growDriver(next, d);
  for (const t of g.teams)
    transact(next, t.id, t.budget * 0.55, 'season budget', `Orçamento de ${next.season}`);
  for (const contract of g.contracts)
    if (contract.status === 'active' && contract.until < next.season) {
      contract.until = next.season + 1;
      contract.salary = round(contract.salary * 1.03);
      contract.performanceClause = contract.kind === 'driver' ? 50 : 20;
      if (contract.kind === 'driver') {
        const d = allDrivers(next).find((d) => d.id === contract.personId)!;
        d.salary = contract.salary;
        d.contract = contract.until;
      }
    }
  const standings = [...(g.history.at(-1)!.snapshot?.teams ?? g.teams)].sort(
    (a, b) => (g.history.at(-1)!.teamPoints[b.id] ?? 0) - (g.history.at(-1)!.teamPoints[a.id] ?? 0),
  );
  standings.forEach((t, i) => {
    g.atr[t.id] = 75 + i * 5;
    const o = next.world.organizations[t.id];
    o.accounts = {
      capSpent: 0,
      operating: 0,
      development: 0,
      drivers: 0,
      staff: 0,
      engine: 0,
      battery: 0,
      tyres: 0,
    };
    o.rookieRuns = 0;
    o.privateTests = 0;
    o.crew.fatigue = 0;
    o.targets[0].target = Math.max(1, Math.min(g.teams.length, i + 2));
  });
  for (const d of g.drivers) {
    ensureDriverState(next, d);
    next.world.components[d.id] = { engine: 1, turbo: 1, battery: 1, gearbox: 1, km: 0 };
    next.world.people[d.id].fatigue = 0;
  }
  next.world.seasonRoster = {
    season: next.season,
    drivers: structuredClone(g.drivers),
    engineers: structuredClone(g.engineers),
    teams: structuredClone(g.teams),
  };
  next.world.closing = null;
  next.world.offseason = null;
  next.world.rookieAssignments = {};
  addNews(
    next,
    'temporada',
    `Bem-vindo a ${next.season}`,
    'Resultados e títulos anteriores arquivados. Pontos zerados; carro, contratos e relações preservados.',
  );
  return next;
}
