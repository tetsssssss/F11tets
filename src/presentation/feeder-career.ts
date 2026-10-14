import type { Save } from '../domain/types';
import type { FeederChampionship, FeederEvent, FeederFinish } from '../domain/universe/formula-two';
import { feederForm, formulaTwo } from '../domain/universe/formula-two';

/** Safe read-only window into a real academy's junior roster. */
export function academyTalentWatch(save: Save, championship: FeederChampionship = formulaTwo(save)) {
  const teamId = save.managedTeam;
  const members = championship.standings.filter((row) => row.academy === teamId);
  const top = members[0] ?? null;
  const leader = championship.completed ? championship.standings[0] ?? null : null;
  const next = championship.calendar.find((r) => !championship.events.some((event) => event.round === r.round)) ?? null;
  const licensing = top ? save.world.people[top.id] : null;
  const pointsToLicense = licensing ? Math.max(0, save.world.league.licenseThreshold - licensing.licensePoints) : null;
  const progress = top ? feederForm(championship, top.id) : [];
  return {
    teamId,
    academyDrivers: members.length,
    top,
    leader,
    next,
    pointsToLicense,
    scouting: licensing?.scouting ?? null,
    trend: progress.slice(-3).map((r) => ({ round: r.round, points: r.gained })),
    completed: championship.completed,
    total: championship.calendar.length,
  };
}

export type FeederRaceFact = {
  kind: 'winner' | 'pole' | 'climber' | 'dnf' | 'points' | 'condition';
  heading: string;
  detail: string;
  driverId: string | null;
};

/** Describes only facts derivable from the recorded starting and finishing order. */
export function feederRaceFacts(
  championship: FeederChampionship,
  event: FeederEvent | null,
  session: 'feature' | 'sprint',
): FeederRaceFact[] {
  if (!event) return [];
  const finish = event[session];
  if (!finish.length) return [];
  const names = Object.fromEntries(championship.entrants.map((d) => [d.id, d.name]));
  const name = (row: FeederFinish) => names[row.driverId] ?? row.driverId;
  const classified = finish.filter((r) => !r.dnf);
  const winner = classified[0];
  const pole = finish.find((r) => r.grid === 1);
  const gains = classified.map((row) => ({ row, gained: row.grid - row.position }))
    .sort((a, b) => b.gained - a.gained || a.row.position - b.row.position);
  const climb = gains.find((row) => row.gained > 0);
  const dnfs = finish.filter((row) => row.dnf);
  const facts: FeederRaceFact[] = [{
    kind: 'condition', heading: 'Condições da etapa',
    detail: event.weather === 'wet' ? 'Pista molhada na simulação' : 'Pista seca na simulação', driverId: null,
  }];
  if (pole) facts.push({ kind: 'pole', heading: session === 'feature' ? 'Largada na pole' : 'Primeiro no grid', detail: name(pole), driverId: pole.driverId });
  if (winner) facts.push({ kind: 'winner', heading: 'Vencedor confirmado', detail: name(winner), driverId: winner.driverId });
  if (climb) facts.push({ kind: 'climber', heading: 'Maior ganho de posições', detail: `${name(climb.row)}: +${climb.gained} da largada à chegada`, driverId: climb.row.driverId });
  if (dnfs.length) facts.push({ kind: 'dnf', heading: 'Abandonos', detail: `${dnfs.length} pilotos não concluíram`, driverId: null });
  facts.push({ kind: 'points', heading: 'Pontos distribuídos', detail: `${finish.reduce((total, row) => total + row.points, 0)} pontos`, driverId: null });
  return facts;
}

/** Historical titles available in old and new saves, without recreating old races. */
export function feederHallOfFame(save: Save) {
  const records = save.world.feederHistory.filter((h) => h.category === 'F2');
  const people = new Map([...save.world.pool, ...save.game.drivers].map((driver) => [driver.id, driver.name]));
  return records.map((record) => {
    const champion = record.standings.find((row) => row.position === 1) ?? null;
    return champion ? {
      season: record.season,
      id: champion.id,
      name: people.get(champion.id) ?? champion.id,
      points: champion.points,
    } : null;
  }).filter((v): v is { season: number; id: string; name: string; points: number } => v !== null)
    .sort((a, b) => b.season - a.season);
}
