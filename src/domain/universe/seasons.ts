import type { Save } from '../types';
import type { SeasonSnapshot } from './types';
import { offseasonSteps } from './types';
import { cloneState } from '../simulation/world';
import { rng, seedFor, clamp, mean } from '../simulation/random';
import {
  allDrivers,
  allEngineers,
  proceduralDriver,
  driverRecord,
  generateEngineer,
  notifyWorld,
  initialTerms,
  addPoolContracts,
} from './world';
import {
  moveDriver,
  moveEngineer,
  replenishAcademies,
  assessPromises,
  negotiate,
  signNegotiation,
} from './market';
import { addNews, transact } from '../simulation/management';
import { formulaTwo, feederLicenseAward } from './formula-two';
import { formulaThree } from './formula-three';

export function captureSeason(s: Save): SeasonSnapshot {
  const stats = s.game.stats,
    leaders = (metric: 'wins' | 'poles' | 'overtakes') =>
      allDrivers(s)
        .filter((d) => stats[d.id])
        .sort((a, b) => stats[b.id][metric] - stats[a.id][metric] || a.id.localeCompare(b.id))[0];
  const awards: SeasonSnapshot['awards'] = (['wins', 'poles', 'overtakes'] as const).flatMap(
    (metric) => {
      const d = leaders(metric);
      return d && stats[d.id][metric] > 0
        ? [
            {
              name:
                metric === 'wins'
                  ? 'Mais vitórias'
                  : metric === 'poles'
                    ? 'Mais poles'
                    : 'Mais ultrapassagens',
              personId: d.id,
              value: stats[d.id][metric],
              unit: metric,
            },
          ]
        : [];
    },
  );
  const rookie = allDrivers(s)
    .filter(
      (d) =>
        s.world.people[d.id].debut === s.season &&
        s.world.people[d.id].provenance === 'PROCEDURAL' &&
        stats[d.id]?.starts > 0,
    )
    .sort((a, b) => stats[b.id].points - stats[a.id].points)[0];
  if (rookie)
    awards.push({
      name: 'Rookie do ano',
      personId: rookie.id,
      value: stats[rookie.id].points,
      unit: 'pontos',
    });
  return {
    season: s.season,
    provenance: 'CAPTURED',
    drivers: structuredClone(allDrivers(s)),
    teams: structuredClone(s.game.teams),
    engineers: structuredClone(allEngineers(s)),
    contracts: structuredClone(s.game.contracts),
    calendar: structuredClone(s.game.circuits),
    regulation: structuredClone(s.world.regulations.find((e) => e.id === s.world.activeEra)!),
    teamStats: structuredClone(s.game.teamStats),
    terms: structuredClone(s.world.terms),
    awards,
  };
}
export function openOffseason(s: Save) {
  if (s.world.offseason?.season === s.season) return;
  s.world.closing = captureSeason(s);
  s.world.offseason = { season: s.season, step: 0, completed: [] };
  notifyWorld(
    s,
    'ACTION REQUIRED',
    'A temporada terminou',
    'Prêmios, contratos, mercado e preparação técnica aguardam decisões.',
    '/off-season',
  );
}
export function announceRegulation(s: Save) {
  const last = s.world.regulations.at(-1)!,
    effective = last.effective + (last.area === 'baseline' ? 2 : 3);
  if (effective > s.season + 2 || s.round < 20) return;
  const area = (['aero', 'energy', 'reliability'] as const)[Math.floor((effective - 2031) / 3) % 3];
  s.world.regulations.push({
    id: 'era-' + effective,
    name: `Regulamento ${effective} · ${area}`,
    announced: s.season,
    effective,
    area,
    costCap: last.costCap,
    engineCap: last.engineCap,
    minWeight: last.minWeight,
    description:
      'Mudança técnica anunciada. Pesquisa para a próxima era e capacidade de engenharia determinam a adaptação.',
  });
  notifyWorld(
    s,
    'INFORMATION',
    `Regulamento ${effective} anunciado`,
    'É possível direcionar parte do desenvolvimento para a nova era.',
    '/organizacao',
  );
  addNews(
    s,
    'CONFIRMED',
    'Federação anuncia nova era técnica',
    `Entrada em vigor em ${effective}; área: ${area}.`,
  );
}
function feederSeason(s: Save) {
  const categories = ['F2', 'F3', 'Super Formula', 'IndyCar', 'Formula E', 'WEC'];
  for (const category of categories) {
    if (s.world.feederHistory.some((h)=>h.season===s.season && h.category===category)) continue;
    if (category === 'F2') {
      // Archive the actual two-race calendar of the F2 companion series, not a random final ranking.
      // End-of-season uses every calendar race, including any GPs still pending in the UI.
      const f2 = formulaTwo(s, s.game.circuits.length);
      if (f2.standings.length) {
        const standings = f2.standings.map((row) => {
          const record = s.world.people[row.id];
          record.licensePoints = clamp(
            record.licensePoints + feederLicenseAward(row.position, f2.standings.length), 0, 120,
          );
          return { id: row.id, position: row.position, points: row.points };
        });
        s.world.feederHistory.push({ season: s.season, category, standings });
        // Successful F2 results uncover more information for real F1 scouting.
        for (const row of f2.standings.slice(0, 5))
          s.world.people[row.id].scouting = clamp(s.world.people[row.id].scouting + 7);
        // A factual world event: the title and academy are sourced from the
        // archived race-by-race championship, never from speculative news.
        const champion = f2.standings[0];
        if (champion) {
          const academy = champion.academy
            ? s.game.teams.find((team) => team.id === champion.academy)?.name ?? 'academia parceira'
            : 'programa independente';
          addNews(s, 'CONFIRMED', `${champion.name} conquista o título da F2`,
            `${champion.points} pontos em ${f2.events.length} etapas. Formação: ${academy}. A trajetória agora conta para a superlicença, mas não garante vaga na F1.`);
          notifyWorld(s, 'INFORMATION', `Campeão da F2: ${champion.name}`,
            `Título de ${s.season} confirmado com ${champion.points} pontos. Avalie o piloto no mercado de jovens talentos.`, '/f2');
        }
      }
      continue;
    }
    if (category === 'F3') {
      const f3 = formulaThree(s, s.game.circuits.length);
      const standings = f3.standings.map((row) => {
        const meta = s.world.people[row.id];
        meta.licensePoints = clamp(meta.licensePoints + Math.max(1,20-(row.position-1)*3),0,120);
        return {id:row.id,points:row.points,position:row.position};
      });
      s.world.feederHistory.push({season:s.season,category,standings});
      const champion = f3.standings[0];
      if (champion) {
        addNews(s,'CONFIRMED',`${champion.name} é campeão da F3`,
          `${champion.points} pontos em ${f3.events.length} etapas fictícias; resultado registrado na carreira.`);
        notifyWorld(s,'INFORMATION',`Campeão F3: ${champion.name}`,
          'Campeonato finalizado; candidatos ao acesso à F2 disponíveis no scouting.','/f3');
      }
      for (const row of standings.slice(0,3)) {
        const d=s.world.pool.find((person)=>person.id===row.id);
        const meta=s.world.people[row.id];
        if(!d||!meta||meta.status==='RETIRED'||d.age>25) continue;
        meta.category='F2';
        notifyWorld(s,'INFORMATION',`${d.name} avança da F3 para a F2`,
          `P${row.position} na F3 de ${s.season}. Promoção esportiva à F2, sem entrada automática na F1.`,'/f2');
      }
      continue;
    }
    const entries = s.world.pool.filter(
      (d, i) =>
        s.world.people[d.id].status !== 'RETIRED' &&
        (categories.includes(s.world.people[d.id].category)
          ? s.world.people[d.id].category === category
          : i % categories.length === categories.indexOf(category)),
    );
    const order = entries.sort(
      (a, b) =>
        b.rating +
        rng(seedFor(s.seed, s.season, b.id, category))() * 12 -
        a.rating -
        rng(seedFor(s.seed, s.season, a.id, category))() * 12,
    );
    const standings = order.map((d, i) => {
      const rec = s.world.people[d.id];
      rec.licensePoints = clamp(rec.licensePoints + Math.max(2, 40 - i * 5), 0, 120);
      return { id: d.id, points: Math.max(0, 250 - i * 19), position: i + 1 };
    });
    s.world.feederHistory.push({ season: s.season, category, standings });

  }
}
function applyPending(s: Save) {
  for (const deal of s.world.pending.filter((p) => p.start <= s.season + 1)) {
    const ok =
      deal.kind === 'driver'
        ? moveDriver(
            s,
            deal.personId,
            deal.replaceId,
            deal.teamId,
            deal.years,
            deal.salary,
            deal.terms,
            'Contrato futuro ativado',
          )
        : moveEngineer(s, deal.personId, deal.replaceId, deal.teamId, deal.years, deal.salary);
    if (ok) {
      const c = s.game.contracts.find((c) => c.personId === deal.personId)!;
      c.until = deal.start + deal.years - 1;
      const driver = allDrivers(s).find((d) => d.id === deal.personId);
      if (driver) driver.contract = c.until;
      s.world.terms[c.id].start = deal.start;
    } else {
      if (deal.feePaid)
        transact(s, deal.teamId, deal.feePaid, 'contract refund', 'Contrato futuro não ativado');
      notifyWorld(
        s,
        'ACTION REQUIRED',
        'Contrato futuro requer revisão',
        'O assento ou a elegibilidade mudou. Taxa de assinatura devolvida.',
        '/mercado',
      );
    }
  }
  s.world.pending = s.world.pending.filter((p) => p.start > s.season + 1);
}
function driverMarket(s: Save) {
  const year = s.season + 1;
  for (let i = 0; i < 8; i++) {
    const d = proceduralDriver(s.seed, year, i);
    s.world.pool.push(d);
    s.world.people[d.id] = driverRecord(s.seed, d, 'FREE AGENT');
    s.world.people[d.id].licensePoints = 20 + (i % 3) * 10;
    s.world.people[d.id].category = ['F2', 'F3', 'Super Formula', 'IndyCar', 'Formula E', 'WEC'][
      i % 6
    ];
  }
  // A sustainable junior pyramid: replace F3 graduates with new 17-20 year old
  // fictional prospects, instead of letting the category drain after ten seasons.
  // Keep the pool bounded to ~27 eligible F3 racers and preserve all old identities.
  const eligibleF3=s.world.pool.filter((d)=>s.world.people[d.id]?.category==='F3' &&
    s.world.people[d.id]?.status!=='RETIRED' && d.age<=25).length;
  for(let i=0;i<Math.max(0,27-eligibleF3);i++){
    const d=proceduralDriver(s.seed,year,100+i);
    if(s.world.people[d.id])continue;
    d.age=17+(i%4);
    d.attributes=Object.fromEntries(Object.entries(d.attributes).map(([key,value])=>[key,clamp(value-5,40,88)]));
    d.rating=Math.round(mean(Object.values(d.attributes)));
    d.potential=clamp(Math.max(d.potential,d.rating+12),65,98);
    s.world.pool.push(d);
    s.world.people[d.id]={...driverRecord(s.seed,d,'FREE AGENT'),
      category:'F3',licensePoints:5+(i%3)*4,scouting:10,academy:null};
  }
  addPoolContracts(s);
  for (const d of [...s.world.pool]) {
    const rec = s.world.people[d.id];
    if (
      rec.status === 'RETIRED' &&
      rec.retiredSeason !== null &&
      s.season - rec.retiredSeason <= 2 &&
      d.age < 45 &&
      rng(seedFor(s.seed, year, d.id, 'return'))() < 0.035
    ) {
      rec.status = 'FREE AGENT';
      rec.retiredSeason = null;
      rec.motivation = 70;
      notifyWorld(
        s,
        'INFORMATION',
        `${d.name} considera retornar`,
        'Disponível no mercado de pilotos.',
        '/academias',
      );
    }
  }
  for (const d of [...s.game.drivers]) {
    const rec = s.world.people[d.id],
      c = s.game.contracts.find((c) => c.personId === d.id)!,
      random = rng(seedFor(s.seed, year, d.id, 'career'));
    const retirement = clamp(
      (d.age - 34) * 0.035 +
        (100 - rec.motivation) * 0.002 +
        (d.rating < 75 ? 0.1 : 0) +
        (rec.injuryUntil > s.round ? 0.05 : 0),
      0,
      0.85,
    );
    const retired = d.id !== s.career.driverId && d.age > 34 && random() < retirement;
    const candidates = s.world.pool
      .filter(
        (p) =>
          ['RESERVE', 'FREE AGENT', 'DEVELOPMENT'].includes(s.world.people[p.id].status) &&
          s.world.people[p.id].licensePoints >= s.world.league.licenseThreshold &&
          p.id !== s.career.driverId,
      )
      .sort(
        (a, b) =>
          b.rating +
          b.potential * 0.1 +
          (b.teamId === d.teamId ? 4 : 0) -
          (a.rating + a.potential * 0.1 + (a.teamId === d.teamId ? 4 : 0)),
      );
    const candidate = candidates[0],
      expires = c.until < year;
    const teammate = s.game.drivers.find((peer)=>peer.teamId === d.teamId && peer.id!==d.id);
    const ownStats=s.game.stats[d.id];
    const mateStats=teammate ? s.game.stats[teammate.id] : null;
    const underperforming = !!ownStats && !!mateStats &&
      ownStats.starts >= 12 && mateStats.starts >= 12 &&
      (mateStats.points - ownStats.points) >= 90 &&
      mateStats.points >= ownStats.points * 2.5;
    const offseasonReview=underperforming && !!candidate && candidate.rating>=d.rating-8 &&
      rng(seedFor(s.seed, year, d.id, 'performance-release'))() < 0.65;
    const shouldReplace =
      !!candidate &&
      (retired || offseasonReview ||
        (expires && (candidate.rating >= d.rating - 4 || d.age > 36 || rec.motivation < 35)));
    if (
      shouldReplace &&
      !(
        s.career.mode === 'constructor' &&
        s.world.ceo.employed &&
        d.teamId === s.managedTeam &&
        !retired
      )
    ) {
      const salary = Math.max(1, Math.round((candidate.rating - 60) * 0.22 * 10) / 10),
        terms = { ...initialTerms(c, year), start: year, role: 'PROSPECT' as const };
      const offered = negotiate(
        s,
        {
          personId: candidate.id,
          replaceId: d.id,
          teamId: d.teamId,
          kind: 'driver',
          salary: Math.max(salary, (candidate.salary ?? 1) * 1.5),
          years: 2,
          start: s.season,
          terms,
        },
        true,
      );
      const row = offered.world.negotiations[0];
      if (row?.status === 'accepted') {
        const signed = signNegotiation(offered, row.id, true);
        if (signed !== offered) {
          Object.assign(s, signed);
          if (retired) {
            s.world.people[d.id].status = 'RETIRED';
            s.world.people[d.id].retiredSeason = s.season;
            addNews(
              s,
              'CONFIRMED',
              `${d.name} encerra sua carreira na F1`,
              'Decisão ligada a idade, motivação e perspectivas esportivas.',
            );
          }
        }
      }
    }
    const current = s.game.contracts.find((x) => x.personId === d.id)!;
    if (current.status === 'active' && current.until < year) {
      current.until = year + 1;
      current.salary = Math.round(current.salary * 1.025 * 100) / 100;
      const person = allDrivers(s).find((p) => p.id === d.id)!;
      person.contract = current.until;
      person.salary = current.salary;
    }
  }
  replenishAcademies(s);
}
function staffMarket(s: Save) {
  for (let i = 0; i < 4; i++) {
    const e = generateEngineer(s, i);
    if (allEngineers(s).some((x) => x.id === e.id)) continue;
    s.world.engineerPool.push(e);
    const c = {
      id: 'contract-' + e.id,
      kind: 'engineer' as const,
      personId: e.id,
      teamId: 'free',
      until: s.season,
      salary: 1.2,
      buyout: 0,
      status: 'expired' as const,
      option: false,
      performanceClause: 0,
    };
    s.game.contracts.push(c);
    s.world.terms[c.id] = initialTerms(c, s.season);
  }
  for (const e of [...s.game.engineers]) {
    const c = s.game.contracts.find((c) => c.personId === e.id)!;
    if (c.until > s.season) continue;
    const candidate = s.world.engineerPool
      .filter((x) => x.rating > e.rating - 5)
      .sort((a, b) => b.rating - a.rating)[0];
    if (
      candidate &&
      !(s.career.mode === 'constructor' && s.world.ceo.employed && e.teamId === s.managedTeam) &&
      rng(seedFor(s.seed, s.season, e.id, 'staff'))() < 0.45
    ) {
      const offered = negotiate(
          s,
          {
            personId: candidate.id,
            replaceId: e.id,
            teamId: e.teamId,
            kind: 'engineer',
            salary: 2.5,
            years: 3,
            start: s.season,
            terms: initialTerms(c, s.season),
          },
          true,
        ),
        row = offered.world.negotiations[0];
      if (row?.status === 'accepted') Object.assign(s, signNegotiation(offered, row.id, true));
    }
    const current = s.game.contracts.find((x) => x.id === c.id)!;
    if (current.status === 'active' && current.until <= s.season) current.until = s.season + 2;
  }
}
function regulationChange(s: Save) {
  const year = s.season + 1,
    era = s.world.regulations.filter((e) => e.effective <= year).at(-1)!;
  if (era.id === s.world.activeEra) return;
  s.world.activeEra = era.id;
  const keys =
    era.area === 'aero'
      ? ['Aerodinâmica', 'Eficiência aerodinâmica', 'Curvas médias', 'Curvas rápidas']
      : era.area === 'energy'
        ? ['Integração motor-chassi', 'Refrigeração', 'Velocidade de reta']
        : ['Confiabilidade', 'Suspensão', 'Frenagem'];
  for (const t of s.game.teams) {
    const o = s.world.organizations[t.id],
      random = rng(seedFor(s.seed, era.id, t.id));
    const adaptation =
      o.futureResearch / 8 + (t.attributes.Desenvolvimento - 75) / 12 + (o.factory - 75) / 16;
    for (const key of keys)
      t.attributes[key] = clamp(t.attributes[key] - 4 + adaptation + (random() - 0.5) * 5);
    t.rating = Math.round(mean(Object.values(t.attributes)));
    o.futureResearch = 0;
    for (const d of s.game.drivers.filter((d) => d.teamId === t.id))
      s.game.cars[d.id].upgradeSeconds *= 0.55;
  }
  addNews(
    s,
    'CONFIRMED',
    `${era.name} entra em vigor`,
    'Projetos reavaliados; preparação anterior altera a adaptação de cada construtor.',
  );
}
export function advanceOffseason(save: Save): Save {
  if (save.game.phase !== 'postseason' || save.race?.status === 'RUNNING') return save;
  const n = cloneState(save);
  openOffseason(n);
  const o = n.world.offseason!;
  if (o.step >= offseasonSteps.length - 1) return save;
  const step = offseasonSteps[o.step];
  if (o.step === 0) feederSeason(n);
  if (o.step === 1) {
    assessPromises(n);
    applyPending(n);
  }
  if (o.step === 2) driverMarket(n);
  if (o.step === 3) staffMarket(n);
  if (o.step === 4) {
    for (const tyre of n.game.tyres)
      tyre.values = tyre.values.map((v, i) =>
        clamp(v + (rng(seedFor(n.seed, n.season, tyre.name, i))() - 0.5) * 2),
      ) as typeof tyre.values;
    const counts: Record<string, number> = Object.fromEntries(
      n.game.tyres.map((t) => [
        t.name,
        n.game.teams.filter((team) => team.tires === t.name).length,
      ]),
    );
    for (const team of n.game.teams) {
      const org = n.world.organizations[team.id];
      if (org.tyreContract.end < n.season + 1) {
        if (counts[team.tires] > 4) {
          const replacement = n.game.tyres.find((t) => counts[t.name] < 4);
          if (replacement) {
            counts[team.tires]--;
            team.tires = replacement.name;
            counts[team.tires]++;
          }
        }
        org.tyreContract = { supplier: team.tires, start: n.season + 1, end: n.season + 3 };
      }
    }
    for (const contract of Object.values(n.world.circuitContracts))
      if (contract.end < n.season + 1) {
        contract.end = n.season + 4;
        contract.fee = Math.round(contract.fee * 1.03 * 100) / 100;
      }
  }
  if (o.step === 5) regulationChange(n);
  if (o.step === 7)
    for (const d of n.game.drivers) {
      n.game.setups[d.id].confidence = 35;
      n.game.cars[d.id].mileage = 150;
      n.world.people[d.id].fatigue = 0;
    }
  n.world.offseason!.completed.push(step);
  n.world.offseason!.step++;
  notifyWorld(
    n,
    'INFORMATION',
    `${step}: concluído`,
    `${n.world.offseason!.step}/${offseasonSteps.length - 1} etapas da preparação encerradas.`,
    '/off-season',
  );
  return n;
}
export function completeOffseason(save: Save): Save {
  let n = save;
  while (!n.world.offseason || n.world.offseason.step < offseasonSteps.length - 1) {
    const next = advanceOffseason(n);
    if (next === n) break;
    n = next;
  }
  return n;
}
