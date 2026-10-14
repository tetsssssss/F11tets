import type { Save, Session, Result } from '../types';
import { addNews, compareStats, prizeMoney, settleWeekend, transact } from './management';
import { clamp, round } from './random';
import { pairKey } from './world';
import { allDrivers } from '../universe/world';
export function applyConsequences(save: Save, session: Session, results: Result[]) {
  const g = save.game;
  const race = session === 'GP' || session === 'Sprint';
  for (const r of results) {
    const d = g.drivers.find((d) => d.id === r.driverId)!;
    const tid = r.teamId ?? d.teamId;
    const st = g.stats[d.id],
      ts = g.teamStats[tid];
    save.driverPoints[d.id] += r.points;
    g.teamPoints[tid] += r.points;
    st.points += r.points;
    ts.points += r.points;
    if (session === 'Q3' && r.position === 1) {
      st.poles++;
      ts.poles++;
    }
    if (session === 'GP') {
      for (const s of [st, ts]) {
        s.starts++;
        s.finishes.push(r.position);
        s.overtakes += r.overtakes ?? 0;
        if (r.status === 'DNF' || r.status === 'DSQ') s.dnfs++;
        else {
          if (r.position === 1) s.wins++;
          if (r.position <= 3) s.podiums++;
          if (r.fastestLap) s.fastestLaps++;
        }
      }
    }
    if (session === 'Sprint' && r.position === 1 && r.status === 'FINISHED') {
      st.sprintWins++;
      ts.sprintWins++;
    }
    if (race) {
      const change = r.status !== 'FINISHED' ? -3 : r.position <= 3 ? 2 : r.gain > 2 ? 1 : -0.3;
      for (const dyn of d.dynamics) {
        dyn.trend = round(change * 0.2);
        dyn.value = round(clamp(dyn.value + change * 0.15));
      }
      g.reputation[d.id] = round(clamp(g.reputation[d.id] + change * 0.1));
      const e = g.engineers.find((e) => e.driverId === d.id)!;
      e.synergy = clamp(e.synergy + change * 0.12);
      for (const dyn of e.dynamics) {
        dyn.trend = change * 0.1;
        dyn.value = clamp(dyn.value + change * 0.1);
      }
      for (const dyn of g.teams.find((t) => t.id === tid)!.dynamics) {
        dyn.trend = change * 0.1;
        dyn.value = clamp(dyn.value + change * 0.1);
      }
    }
    if (session === 'GP') {
      const k = g.knowledge[d.id][g.circuits[save.round - 1].id];
      for (const key in k) k[key] = round(clamp(k[key] + 0.4));
    }
  }
  const w = save.weekends.find((w) => w.round === save.round)!;
  if (session === 'Q3') w.qualifyingGrid.forEach((id, i) => g.stats[id].qualifying.push(i + 1));
  for (const event of w.tapes?.[session]?.events ?? []) {
    if (event.otherId) {
      const rel = g.relationships[pairKey(event.driverId, event.otherId)];
      const conflict = event.type === 'contact';
      for (const key in rel) {
        const negative = [
          'Rivalidade',
          'Tensão',
          'Agressividade mútua',
          'Memória de conflitos',
        ].includes(key);
        rel[key] = clamp(
          rel[key] +
            (conflict
              ? negative
                ? 2
                : -1
              : event.type === 'team order'
                ? negative
                  ? -0.2
                  : 0.3
                : 0),
        );
      }
    }
    if (event.severity === 'terminal')
      addNews(
        save,
        'incidente',
        `${g.drivers.find((d) => d.id === event.driverId)!.name}: abandono`,
        event.detail,
      );
  }
  if (['Q3', 'Sprint', 'GP'].includes(session))
    addNews(
      save,
      'resultado',
      `${g.drivers.find((d) => d.id === results[0].driverId)!.name} ${session === 'Q3' ? 'conquista a pole' : `vence ${session}`}`,
      `${g.circuits[save.round - 1].name} · ${save.season}. Resultado gerado pelo motor da carreira.`,
    );
  if (session === 'Q3' || session === 'GP') {
    const own = g.drivers.find((d) => d.teamId === save.managedTeam)!;
    g.interviews.push({
      id: `${save.season}-${save.round}-${session}`,
      driverId: own.id,
      round: save.round,
      answered: false,
    });
  }
  if (session === 'GP') {
    settleWeekend(save);
    const last = save.weekends.filter((w) => w.results.GP).slice(-3);
    if (last.length === 3 && last.every((w) => w.results.GP![0].driverId === results[0].driverId))
      addNews(
        save,
        'narrativa',
        'Três vitórias consecutivas',
        `${g.drivers.find((d) => d.id === results[0].driverId)!.name} estabelece uma sequência dominante.`,
      );
    for (const t of g.teams) {
      const ds = g.drivers.filter((d) => d.teamId === t.id);
      const five = save.weekends.filter((w) => w.results.GP).slice(-5);
      if (five.length === 5)
        for (const d of ds) {
          const other = ds.find((x) => x.id !== d.id)!;
          if (
            five.every((w) => {
              const a = w.results.GP!.find((r) => r.driverId === d.id)!,
                b = w.results.GP!.find((r) => r.driverId === other.id)!;
              return (
                !!a && !!b && a.teamId === t.id && b.teamId === t.id && a.position > b.position
              );
            })
          )
            addNews(
              save,
              'pressão',
              `${d.name} perde cinco duelos internos`,
              `${t.name} reavalia o equilíbrio entre seus pilotos.`,
            );
        }
    }
    if (save.round === g.circuits.length) {
      const dr = allDrivers(save)
        .filter((d) => g.stats[d.id]?.starts > 0)
        .sort((a, b) => compareStats(g.stats[a.id], g.stats[b.id]) || a.id.localeCompare(b.id));
      const tr = [...g.teams].sort(
        (a, b) => compareStats(g.teamStats[a.id], g.teamStats[b.id]) || a.id.localeCompare(b.id),
      );
      g.champion = dr[0].id;
      g.constructorChampion = tr[0].id;
      g.phase = 'postseason';
      const championTeam = g.teams.find((t) => t.id === dr[0].teamId);
      g.champions.push({
        season: save.season,
        driver: dr[0].name,
        team: championTeam?.name ?? tr[0].name,
      });
      const championContract = g.contracts.find(
        (c) => c.personId === dr[0].id && c.status === 'active',
      );
      if (championContract)
        transact(
          save,
          championContract.teamId,
          -championContract.salary *
            (save.world.terms[championContract.id]?.championshipBonus ?? 0.2),
          'championship bonus',
          `Título de ${dr[0].name}`,
        );
      tr.forEach((t, i) =>
        transact(save, t.id, prizeMoney[i], 'prize', `P${i + 1} em ${save.season}`),
      );
      addNews(
        save,
        'título',
        `${dr[0].name}, campeão de ${save.season}`,
        `${tr[0].name} conquista os construtores. Premiações creditadas; próxima temporada disponível.`,
      );
    }
  }
}
