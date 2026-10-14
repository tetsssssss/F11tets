import type { Save } from '../types';
import { clamp, rng, seedFor } from '../simulation/random';
import { cloneState } from '../simulation/world';
import { notifyWorld } from './world';
export const boardStatus = (n: number) =>
  n >= 80
    ? 'EXCELLENT'
    : n >= 60
      ? 'STABLE'
      : n >= 40
        ? 'UNDER REVIEW'
        : n >= 20
          ? 'UNDER PRESSURE'
          : 'AT RISK';
export function evaluateBoards(s: Save) {
  const ranking = [...s.game.teams].sort(
    (a, b) => s.game.teamPoints[b.id] - s.game.teamPoints[a.id],
  );
  for (const [i, t] of ranking.entries()) {
    const o = s.world.organizations[t.id],
      stats = s.game.teamStats[t.id],
      primary = o.targets.find((x) => x.level === 'PRIMARY')!,
      achievement = i + 1 <= primary.target;
    const trend = (achievement ? 1.8 : -1.6) * (1 + (o.owner.ambition - o.owner.patience) / 200);
    o.confidence = clamp(o.confidence + trend);
    if (t.id !== s.managedTeam || s.career.mode !== 'constructor' || !s.world.ceo.employed)
      continue;
    const ceo = s.world.ceo;
    ceo.reputation.Strategic = clamp(ceo.reputation.Strategic + (achievement ? 0.4 : -0.25));
    ceo.reputation.Finance = clamp(
      ceo.reputation.Finance + (o.accounts.capSpent <= 235 ? 0.1 : -2),
    );
    ceo.mediaPressure = clamp(ceo.mediaPressure + (achievement ? -2 : 3));
    s.career.board = {
      confidence: o.confidence,
      target: primary.target,
      wins: o.targets.find((g) => g.metric === 'wins')?.target ?? 0,
      podiums: o.targets.find((g) => g.metric === 'podiums')?.target ?? 0,
      status: boardStatus(o.confidence),
    };
    if (
      o.confidence < 20 &&
      s.round >= 8 &&
      rng(seedFor(s.seed, s.season, s.round, t.id, 'dismissal'))() > o.owner.patience / 130
    ) {
      ceo.employed = false;
      ceo.dismissals.push({
        season: s.season,
        round: s.round,
        teamId: t.id,
        reason: 'Resultados abaixo do objetivo e perda de confiança.',
      });
      ceo.offers = ranking
        .filter((x) => x.id !== t.id)
        .slice(-5, -2)
        .map((x) => ({ teamId: x.id, salary: 1 + x.prestige / 40, status: 'pending' }));
      notifyWorld(
        s,
        'URGENT',
        'O conselho encerrou seu contrato',
        'Seu universo continua. Avalie propostas para voltar ao paddock.',
        '/organizacao',
      );
    }
  }
}
export function acceptCEOOffer(save: Save, teamId: string): Save {
  if (
    save.career.mode !== 'constructor' ||
    save.world.ceo.employed ||
    save.race?.status === 'RUNNING' ||
    save.weekends.some((w) => w.round === save.round && !w.results.GP)
  )
    return save;
  const offer = save.world.ceo.offers.find((o) => o.teamId === teamId && o.status === 'pending');
  if (!offer) return save;
  const n = cloneState(save);
  n.managedTeam = teamId;
  n.career.name = n.game.teams.find((t) => t.id === teamId)!.name;
  n.world.ceo.employed = true;
  for (const o of n.world.ceo.offers) o.status = o.teamId === teamId ? 'accepted' : 'declined';
  n.world.organizations[teamId].confidence = 60;
  n.career.board.confidence = 60;
  n.career.board.status = 'STABLE';
  notifyWorld(
    n,
    'INFORMATION',
    'Novo contrato de CEO assinado',
    'Mandato iniciado com a confiança do conselho em 60.',
    '/temporada',
  );
  return n;
}
