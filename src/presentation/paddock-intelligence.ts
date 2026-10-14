import type { Save } from '../domain/types';
import { championshipChase } from './championship-chase';
import { raceMomentum } from './race-momentum';

/** Read-only dashboard. Every fact must be traceable to the active save.
 * No synthetic race events, no changes to the save schema or championship engine.
 */
export type PaddockSignal = {
  id: string;
  group: 'Pista' | 'Equipe' | 'Mercado' | 'Mundo';
  priority: 'urgent' | 'attention' | 'info';
  title: string;
  description: string;
  href: string;
  value?: string;
};
export type PaddockReport = {
  signals: PaddockSignal[];
  attention: number;
  urgent: number;
  lastRound: number | null;
  season: number;
};
const finite = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
const numeric = (value: unknown) => Math.max(0, finite(value));
const order: Record<PaddockSignal['priority'], number> = { urgent: 0, attention: 1, info: 2 };
const finish = (rows: Save['weekends'][number]['results']['GP']) =>
  Array.isArray(rows) && rows.length > 0;

export function paddockIntelligence(save: Save): PaddockReport {
  const signals: PaddockSignal[] = [];
  const add = (signal: PaddockSignal) => signals.push(signal);
  const teamId = save.managedTeam;
  const organization = save.world.organizations[teamId];
  const team = save.game.teams.find((entry) => entry.id === teamId);
  const roster = save.game.drivers.filter((driver) => driver.teamId === teamId);
  const people = new Map([...save.game.drivers, ...save.world.pool].map((driver) => [driver.id, driver.name]));
  const completed = save.weekends
    .filter((weekend) => finish(weekend.results.GP) && Number.isInteger(weekend.round))
    .sort((a, b) => a.round - b.round);
  const lastRound = completed.at(-1)?.round ?? null;
  const ready = Boolean(organization && team);

  // Sprint 4: valid championship facts; Sprint 5: competitive pressure.
  const chase = championshipChase(save);
  if (chase) add({
    id: 'rival', group: 'Pista', priority: chase.gap <= 10 ? 'attention' : 'info',
    title: 'Disputa direta no campeonato',
    description: `${chase.name} está ${chase.direction === 'ahead' ? 'à frente' : chase.direction === 'behind' ? 'atrás' : 'empatado'} (${chase.gap} pontos de diferença).`,
    href: '/classificacao', value: `${chase.gap} pts`,
  });
  const pace = raceMomentum(save);
  if (pace.rounds.length >= 2) add({
    id: 'pace', group: 'Pista', priority: pace.delta !== null && pace.delta < 0 ? 'attention' : 'info',
    title: 'Momento competitivo',
    description: `Últimos ${pace.rounds.length} GPs: ${pace.points} pontos; variação do último GP: ${pace.delta! > 0 ? '+' : ''}${pace.delta} pontos.`,
    href: '/estatisticas', value: `${pace.points} pts`,
  });

  // Sprint 6: next weekend context. A circuit's rain field is climatology, not a weather forecast.
  const circuit = save.game.circuits.find((entry) => entry.round >= save.round && !completed.some((w) => w.round === entry.round));
  if (circuit) add({
    id: 'next-track', group: 'Pista', priority: 'info', title: 'Próximo desafio',
    description: `${circuit.name}, round ${circuit.round}. Referência climática do circuito: ${finite(circuit.rain)}% de chuva; não é uma previsão ao vivo.`,
    href: '/calendario', value: `R${circuit.round}`,
  });

  if (ready) {
    // Sprint 7: driver fitness and medical availability.
    const unavailable = roster.filter((driver) => {
      const meta = save.world.people[driver.id];
      return meta && (meta.injuryUntil >= save.round || meta.suspendedUntil >= save.round);
    });
    const tired = roster.filter((driver) => numeric(save.world.people[driver.id]?.fatigue) >= 65);
    if (unavailable.length || tired.length) add({
      id: 'fitness', group: 'Equipe', priority: unavailable.length ? 'urgent' : 'attention',
      title: 'Disponibilidade dos pilotos',
      description: unavailable.length
        ? `${unavailable.map((driver) => driver.name).join(', ')}: impedimento médico ou disciplinar registrado para este round.`
        : `${tired.map((driver) => driver.name).join(', ')}: fadiga elevada no elenco titular.`,
      href: '/academias', value: `${unavailable.length || tired.length} piloto(s)`,
    });

    // Sprint 8: power-unit allocation and penalty visibility.
    const allocation = numeric(save.world.league.componentAllocation);
    const overloaded = roster.flatMap((driver) => {
      const parts = save.world.components[driver.id];
      return parts ? (['engine', 'turbo', 'battery', 'gearbox'] as const)
        .filter((key) => finite(parts[key]) > allocation).map((key) => `${driver.name} · ${key}`) : [];
    });
    if (overloaded.length) add({
      id: 'components', group: 'Equipe', priority: 'urgent', title: 'Cota de componentes excedida',
      description: `${overloaded.slice(0, 3).join('; ')}. Verifique as penalidades do motor antes da próxima sessão.`,
      href: '/organizacao', value: String(overloaded.length),
    });

    // Sprint 9: pit-crew fatigue, measured rather than invented.
    const crew = organization.crew;
    if (numeric(crew.fatigue) >= 65) add({
      id: 'pit-crew', group: 'Equipe', priority: 'attention', title: 'Equipe de boxes desgastada',
      description: `Fadiga registrada de ${Math.round(finite(crew.fatigue))}/100 na rotação ${crew.rotation}.`,
      href: '/organizacao', value: `${Math.round(finite(crew.fatigue))}%`,
    });

    // Sprint 10: liquidity; Sprint 11: regulation-aligned spending cap.
    const finances = save.game.finances[teamId];
    if (finances && finances.cash < 30) add({
      id: 'liquidity', group: 'Equipe', priority: finances.cash < 0 ? 'urgent' : 'attention',
      title: 'Atenção ao caixa da equipe',
      description: `Saldo registrado: ${finite(finances.cash).toFixed(1)} milhões (unidade financeira do universo).`,
      href: '/organizacao', value: `${finite(finances.cash).toFixed(1)} M`,
    });
    const era = save.world.regulations.find((regulation) => regulation.id === save.world.activeEra);
    if (era && era.costCap > 0) {
      const share = numeric(organization.accounts.capSpent) / era.costCap;
      if (share >= 0.85) add({
        id: 'cost-cap', group: 'Equipe', priority: share > 1 ? 'urgent' : 'attention',
        title: 'Teto financeiro sob pressão',
        description: `${Math.round(share * 100)}% do teto operacional registrado foi utilizado nesta temporada.`,
        href: '/organizacao', value: `${Math.round(share * 100)}%`,
      });
    }

    // Sprint 12: actual active projects, never a fabricated development prediction.
    const projects = save.game.development.filter((project) => project.teamId === teamId && project.status === 'active');
    if (projects.length) add({
      id: 'development', group: 'Equipe', priority: projects.some((project) => project.due <= save.round) ? 'attention' : 'info',
      title: 'Projetos em desenvolvimento',
      description: `${projects.length} projeto(s) em andamento. Próxima entrega registrada: round ${Math.min(...projects.map((project) => project.due))}.`,
      href: '/desenvolvimento', value: String(projects.length),
    });

    // Sprint 13: contracts actually expiring by the current season.
    const expiring = save.game.contracts.filter((contract) =>
      contract.teamId === teamId && contract.status === 'active' && contract.until <= save.season,
    );
    if (expiring.length) add({
      id: 'contracts', group: 'Mercado', priority: 'attention', title: 'Vínculos perto do encerramento',
      description: expiring.slice(0, 3).map((contract) => people.get(contract.personId) ?? contract.personId).join(', ') +
        `: ${expiring.length} contrato(s) com término nesta temporada ou antes.`,
      href: '/mercado', value: String(expiring.length),
    });

    // Sprint 14: team board pressure and real stated objectives.
    const goal = organization.targets.find((target) => target.level === 'PRIMARY');
    if (goal) {
      const position = [...save.game.teams]
        .sort((a, b) => numeric(save.game.teamPoints[b.id]) - numeric(save.game.teamPoints[a.id]) || a.name.localeCompare(b.name))
        .findIndex((entry) => entry.id === teamId) + 1;
      const progress = goal.metric === 'position' ? `P${position} no campeonato; objetivo P${goal.target} ou melhor` :
        `${goal.metric}: meta ${goal.target} (veja os indicadores do conselho)`;
      add({
        id: 'board', group: 'Equipe', priority: organization.confidence < 40 ? 'urgent' : organization.confidence < 60 ? 'attention' : 'info',
        title: 'Confiança da direção',
        description: `${progress}. Confiança atual: ${Math.round(finite(organization.confidence))}/100.`,
        href: '/organizacao', value: `${Math.round(finite(organization.confidence))}/100`,
      });
    }

    // Sprint 15: rookie practice requirement and player assignments.
    const target = numeric(save.world.league.rookiePracticeTarget);
    const done = numeric(organization.rookieRuns);
    if (target && done < target) add({
      id: 'rookies', group: 'Mercado', priority: save.round > save.game.circuits.length - 4 ? 'attention' : 'info',
      title: 'Sessões obrigatórias de novatos',
      description: `${done}/${target} participação(ões) de rookie em treinos registrada(s) para a equipe.`,
      href: '/academias', value: `${Math.max(0, target - done)} restante(s)`,
    });
  }

  // Sprint 16: actual offer/counter state, scoped to the managed team.
  const proposals = save.world.negotiations.filter((negotiation) =>
    negotiation.teamId === teamId && ['accepted', 'counter'].includes(negotiation.status),
  );
  if (proposals.length) add({
    id: 'offers', group: 'Mercado', priority: 'attention', title: 'Negociações pedindo decisão',
    description: `${proposals.length} negociação(ões) com contraproposta ou aceite pendente(s) de conclusão.`,
    href: '/silly-season', value: String(proposals.length),
  });

  // Sprint 17: factual paddock changes in chronological order.
  const recentTransfer = [...save.world.transfers]
    .filter((transfer) => transfer.season <= save.season)
    .sort((a, b) => b.season - a.season || b.round - a.round)[0];
  if (recentTransfer) add({
    id: 'transfers', group: 'Mundo', priority: 'info', title: 'Movimento no mercado',
    description: `${people.get(recentTransfer.personId) ?? recentTransfer.personId}: ${recentTransfer.detail} (${recentTransfer.season}, R${recentTransfer.round}).`,
    href: '/silly-season', value: String(recentTransfer.season),
  });

  // Sprint 18: persisted, unread inbox activity.
  const unread = save.world.inbox.filter((message) => !message.read);
  const urgent = unread.filter((message) => message.type === 'URGENT' || message.type === 'ACTION REQUIRED');
  if (unread.length) add({
    id: 'inbox', group: 'Mundo', priority: urgent.length ? 'urgent' : 'info', title: 'Mensagens aguardando leitura',
    description: `${unread.length} mensagem(ns) não lida(s), ${urgent.length} marcada(s) como urgentes ou com ação necessária.`,
    href: '/caixa-de-entrada', value: String(unread.length),
  });

  // Sprint 19: future rules and the feeder ladder are sourced from existing world state.
  const nextEra = [...save.world.regulations]
    .filter((regulation) => regulation.effective > save.season)
    .sort((a, b) => a.effective - b.effective)[0];
  if (nextEra) add({
    id: 'regulation', group: 'Mundo', priority: nextEra.effective === save.season + 1 ? 'attention' : 'info',
    title: 'Próxima mudança de regulamento',
    description: `${nextEra.name}: prevista no universo para ${nextEra.effective}, área ${nextEra.area}.`,
    href: '/off-season', value: String(nextEra.effective),
  });
  const ladder = [...save.world.feederHistory].sort((a, b) => b.season - a.season)[0];
  const winner = ladder?.standings.find((entry) => entry.position === 1);
  if (ladder && winner) add({
    id: 'feeder', group: 'Mundo', priority: 'info', title: 'Destaque das categorias de base',
    description: `${people.get(winner.id) ?? winner.id} liderou ${ladder.category} em ${ladder.season} (${numeric(winner.points)} pontos).`,
    href: '/academias', value: String(ladder.season),
  });

  // Sprint 20: one actionable, accessible, deterministic priority queue.
  const ranked = signals.sort((a, b) => order[a.priority] - order[b.priority] || a.id.localeCompare(b.id));
  return {
    signals: ranked,
    attention: ranked.filter((signal) => signal.priority !== 'info').length,
    urgent: ranked.filter((signal) => signal.priority === 'urgent').length,
    lastRound,
    season: save.season,
  };
}
