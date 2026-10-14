'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PersonPortrait } from '../components/person-portrait';
import { FeederRaceReplay } from '../components/feeder-race-replay';
import { useSave, useUniverse } from '../components/save-provider';
import { canManage, scoutDriver } from '../domain/universe/market';
import { PageTitle, SectionHead } from '../components/ui';
import { formulaTwo, feederProspectScore, feederAcademyStandings, feederForm, feederRival } from '../domain/universe/formula-two';
import { feederRaceFacts, feederHallOfFame } from '../presentation/feeder-career';
import { feederDriverDuels, feederGridMovement, feederTalentShortlist, feederAcademyRival, feederStandingsEvolution } from '../presentation/feeder-rivalry';

export default function FormulaTwoPage() {
  const { save, update, notify } = useSave();
  const { teamById } = useUniverse();
  const [race, setRace] = useState<number | null>(null);
  const [session, setSession] = useState<'feature' | 'sprint'>('feature');
  const [academy, setAcademy] = useState('all');
  const [compare, setCompare] = useState<string | null>(null);
  const [archiveYear, setArchiveYear] = useState<number | null>(null);
  const [standingsView, setStandingsView] = useState<'drivers' | 'academies'>('drivers');
  const [showAllFinishers, setShowAllFinishers] = useState(false);
  const f2 = useMemo(() => formulaTwo(save), [save]);
  const years = [...new Set(save.world.feederHistory.filter((h) => h.category === 'F2').map((h) => h.season))].sort((a, b) => b - a);
  const selectedYear = archiveYear && years.includes(archiveYear) ? archiveYear : years[0];
  const archive = save.world.feederHistory.find((h) => h.category === 'F2' && h.season === selectedYear);
  const selectedEvent = f2.events.find((e) => e.round === race) ?? f2.events.at(-1) ?? null;
  const entrants = Object.fromEntries(f2.entrants.map((d) => [d.id, d]));
  const filtered = f2.standings.filter((d) => academy === 'all' || (d.academy ?? 'free') === academy);
  const contender = filtered.find((d) => d.id === compare) ?? filtered[0];
  const scout = contender ? feederProspectScore(save, contender.id, f2) : null;
  const maxPoints = Math.max(1, f2.standings[0]?.points ?? 0);
  const academyStandings = useMemo(() => feederAcademyStandings(f2), [f2]);
  const form = contender ? feederForm(f2, contender.id) : [];
  const rival = contender ? feederRival(f2, contender.id) : null;
  const completedEvents = new Set(f2.events.map((e) => e.round));
  const raceFacts = useMemo(() => feederRaceFacts(f2, selectedEvent, session), [f2, selectedEvent, session]);
  const history = useMemo(() => feederHallOfFame(save), [save]);
  const talentShortlist = useMemo(() => feederTalentShortlist(save, f2), [save, f2]);
  const academyDuel = useMemo(() => feederAcademyRival(f2, save.managedTeam), [f2, save.managedTeam]);
  const duel = contender && rival ? feederDriverDuels(f2, contender.id, rival.id) : null;
  const evolution = contender ? feederStandingsEvolution(f2, contender.id) : [];
  const classified = selectedEvent ? feederGridMovement(selectedEvent[session]) : [];

  return (
    <section className="f2-universe" aria-label="Campeonato de Fórmula 2">
      <PageTitle
        eyebrow={`ESCADA PARA A F1 · TEMPORADA ${save.season}`}
        title="Formula 2 · a próxima geração"
        subtitle="Grid de talentos procedurais, corridas Sprint e principal, superlicença, observação e acesso ao mercado de pilotos."
      />
      <div className="f2-banner panel padded">
        <div>
          <span className="eyebrow">CAMPEONATO DE ACESSO</span>
          <h2>O futuro disputa cada posição.</h2>
          <p>
            Cada GP da F2 abre após a conclusão do GP correspondente na F1. O motor usa seed
            reproduzível e atributos dos jovens pilotos. O calendário é uma adaptação fictícia de
            12 etapas, não o calendário oficial real da categoria.
          </p>
          <div className="f2-actions">
            <Link className="button secondary" href="/academias">Academias e scouting →</Link>
            <Link className="button secondary" href="/silly-season">Negociações →</Link>
          </div>
        </div>
        <div className="f2-headline-stats" aria-label="Resumo da Formula 2">
          <div><b>{f2.entrants.length}</b><span>PILOTOS</span></div>
          <div><b>{f2.completed}/{f2.calendar.length}</b><span>EVENTOS</span></div>
          <div><b>{f2.finished ? 'FINAL' : 'ATIVA'}</b><span>TEMPORADA</span></div>
        </div>
      </div>
      <div className="f2-layout">
        <section className="panel padded">
          <SectionHead title="Mundial de pilotos" sub="SPRINT + CORRIDA PRINCIPAL" />
          <div className="f2-session-switch f2-view-switch" aria-label="Classificação por categoria">
            <button type="button" className={standingsView==='drivers'?'active':''} aria-pressed={standingsView==='drivers'} onClick={()=>setStandingsView('drivers')}>Pilotos</button>
            <button type="button" className={standingsView==='academies'?'active':''} aria-pressed={standingsView==='academies'} onClick={()=>setStandingsView('academies')}>Academias</button>
          </div>
          {standingsView === 'drivers' && <>
          <label className="f2-select">Vínculo
            <select aria-label="Filtrar F2 por academia" value={academy} onChange={(e) => { setAcademy(e.target.value); setCompare(null); }}>
              <option value="all">Todos os pilotos</option>
              {save.game.teams.filter((team) => f2.standings.some((p) => p.academy === team.id)).map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
              {f2.standings.some((p) => p.academy === null) && <option value="free">Sem academia</option>}
            </select>
          </label>
          {filtered.length ? (
            <div className="f2-standing" role="list" aria-label="Classificação F2">
              {filtered.map((row) => {
                const d = entrants[row.id];
                const academyTeam = row.academy ? teamById[row.academy] : null;
                const pct = (row.points / maxPoints) * 100;
                return <button
                  key={row.id}
                  type="button"
                  role="listitem"
                  className={`f2-driver ${contender?.id === row.id ? 'selected' : ''}`}
                  style={{ '--accent': academyTeam?.color ?? '#6ca6ad', '--progress': `${pct}%` } as React.CSSProperties}
                  onClick={() => setCompare(row.id)}
                  aria-pressed={contender?.id === row.id}
                >
                  <span className="f2-rank">{String(row.position).padStart(2, '0')}</span>
                  <PersonPortrait personId={row.id} name={row.name} size={42} fictional />
                  <span className="f2-driver-info">
                    <strong>{d?.name ?? row.name}</strong>
                    <small>{academyTeam?.short ?? 'Independente'} · {row.wins} vitórias · {row.podiums} pódios</small>
                    <span className="f2-progress" aria-hidden="true" />
                  </span>
                  <b className="f2-score">{row.points}<small>pts</small></b>
                </button>;
              })}
            </div>
          ) : <p>Nenhum piloto elegível neste filtro.</p>}
          </>}
          {standingsView === 'academies' && <div className="f2-standing" role="list" aria-label="Classificação de academias F2">
            {academyStandings.map((entry) => <button
              key={entry.academy}
              type="button"
              role="listitem"
              className="f2-driver"
              style={{'--accent':teamById[entry.academy]?.color??'#78b7b6','--progress':`${(entry.points/Math.max(1,academyStandings[0]?.points??0))*100}%`} as React.CSSProperties}
              onClick={()=>{setAcademy(entry.academy);setStandingsView('drivers');setCompare(null);}}
            >
              <span className="f2-rank">{String(entry.rank).padStart(2,'0')}</span>
              <span className="f2-driver-info">
                <strong>{teamById[entry.academy]?.name??'Independentes'}</strong>
                <small>{entry.drivers} pilotos · {entry.victories} vitórias · {entry.podiums} pódios</small>
                <span className="f2-progress" aria-hidden="true" />
              </span>
              <b className="f2-score">{entry.points}<small>pts</small></b>
            </button>)}
          </div>}
        </section>
        <aside className="f2-side">
          <section className="panel padded">
            <SectionHead title="Radar de novos talentos" sub="DADOS DO SAVE" />
            {contender && scout ? <>
              <div className="f2-spotlight">
                <PersonPortrait personId={contender.id} name={contender.name} size={92} fictional />
                <div>
                  <h3>{contender.name}</h3>
                  <p>{teamById[contender.academy ?? '']?.name ?? 'Piloto independente'}</p>
                  <Link href={`/pilotos/${contender.id}`}>Ver perfil detalhado →</Link>
                </div>
              </div>
              <div className="f2-metrics">
                <div><span>Potencial</span><b>{scout.potential}</b></div>
                <div><span>Scouting</span><b>{scout.observed}%</b></div>
                <div><span>Superlicença</span><b>{scout.ready ? 'Apto' : `Faltam ${scout.pointsToLicense}`}</b></div>
                <div><span>Temporada</span><b>{scout.seasonPoints ?? '—'} pts</b></div>
              </div>
              {rival && <div className="f2-rival" aria-label="Disputa mais próxima no campeonato">
                <span className="eyebrow">RIVAL DIRETO</span>
                <strong>{rival.name}</strong>
                <b>{rival.difference>0?'+':''}{rival.difference} pts</b>
              </div>}
              {duel && duel.compared > 0 && <div className="f2-duel" aria-label="Confrontos diretos em sessões concluídas">
                <span>Frente a {rival?.name}: <strong>{duel.ownWins} × {duel.rivalWins}</strong></span>
                <small>{duel.compared} sessões · {duel.doubleDnfs} abandonos conjuntos</small>
              </div>}
              {form.length > 0 && <div className="f2-form-chart" aria-label={`Pontos de ${contender.name} por rodada`}>
                <span className="eyebrow">EVOLUÇÃO NA TEMPORADA</span>
                <div className="f2-form-bars">
                  {form.map((p)=><span key={p.round} role="img" aria-label={`GP ${p.round}: ${p.gained} pontos, total ${p.points}`} title={`GP${p.round}: +${p.gained} pts`}
                    style={{'--bar':`${Math.max(4, p.gained/35*100)}%`} as React.CSSProperties}
                    className={p.topThree?'podium':''}><i/></span>)}
                </div>
              </div>}
              {evolution.length > 0 && <div className="f2-evolution" aria-label="Posição de campeonato após cada rodada">
                <span className="eyebrow">POSIÇÃO POR ETAPA</span>
                <div>{evolution.map((point) => <span key={point.round} title={`Etapa ${point.round}: P${point.position}, ${point.points} pontos`} style={{'--relative-position': `${Math.max(5, (1-(point.position-1)/Math.max(1,f2.standings.length-1))*100)}%`} as React.CSSProperties}><i /><small>P{point.position}</small></span>)}</div>
              </div>}
              <button type="button" className="button secondary" disabled={!canManage(save)||scout.observed>=100||save.game.finances[save.managedTeam].cash<0.25}
                onClick={()=>{update((s)=>scoutDriver(s,contender.id));notify(`Relatório de ${contender.name} solicitado.`);}}>
                {scout.observed>=100?'Relatório completo':'Observar piloto · $0,25M'}
              </button>
              <p className="f2-help">Superlicença e promoção dependem das regras de mercado da F1. A projeção de talento não equivale a uma contratação garantida.</p>
            </> : <p>Selecione um piloto da classificação para consultar seu relatório.</p>}
          </section>
          <section className="panel padded" aria-label="Observatório da base">
            <SectionHead title="Observatório de talentos" sub="POTENCIAL + LICENÇA + OBSERVAÇÃO" />
            <p className="f2-help">Seleção calculada a partir dos jovens existentes no save. Estimativa, não garantia de sucesso.</p>
            <div className="f2-shortlist">{talentShortlist.map((candidate) => <button key={candidate.id} type="button" onClick={()=>{setAcademy('all');setStandingsView('drivers');setCompare(candidate.id);}}
              aria-label={`Selecionar ${candidate.name} no campeonato`}>
              <span>P{candidate.position}</span><strong>{candidate.name}</strong>
              <small>POT {candidate.potential} · {candidate.licensed?'Licença válida':`${candidate.licensePoints}/${save.world.league.licenseThreshold} licença`}</small>
            </button>)}</div>
            {academyDuel && <p className="f2-academy-duel">Sua academia: <b>{academyDuel.ours.points} pts</b> · adversário mais próximo: <b>{teamById[academyDuel.rival.academy]?.name??'Independentes'}</b> ({academyDuel.difference>0?'+':''}{academyDuel.difference} pts).</p>}
          </section>
          <section className="panel padded">
            <SectionHead title="Calendário F2" sub="12 ETAPAS, 2 CORRIDAS POR ETAPA" />
            <div className="f2-calendar">
              {f2.calendar.map((c, index) => (
                <button
                  className={`f2-calendar-round ${completedEvents.has(c.round) ? 'done' : ''} ${selectedEvent?.round === c.round ? 'selected' : ''}`}
                  key={c.circuitId}
                  type="button"
                  disabled={!completedEvents.has(c.round)}
                  onClick={() => setRace(c.round)}
                  aria-label={`F2 rodada ${index + 1}, ${c.circuitName}: ${completedEvents.has(c.round) ? 'resultado disponível' : 'aguardando GP da F1'}`}
                >
                  <span>{index + 1}</span><b>{c.circuitName}</b>
                  <small>{completedEvents.has(c.round) ? 'CONCLUÍDA' : `APÓS GP${c.round}`}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <section className={`panel padded f2-race-result ${selectedEvent?.weather === 'wet' ? 'f2-weather-wet' : ''}`}>
        <SectionHead title="Fim de semana de corrida" sub="RESULTADO DETERMINÍSTICO, SEM MODIFICAR A F1" />
        {selectedEvent ? <>
          <div className="f2-race-topline">
            <h3>{selectedEvent.circuitName} · GP {selectedEvent.round} <span className="f2-weather-tag">{selectedEvent.weather === 'wet' ? 'CHUVA SIMULADA' : 'PISTA SECA'}</span></h3>
            <div className="f2-session-switch" aria-label="Tipo de corrida">
              <button type="button" aria-pressed={session === 'sprint'} className={session === 'sprint' ? 'active' : ''} onClick={() => setSession('sprint')}>Sprint</button>
              <button type="button" aria-pressed={session === 'feature'} className={session === 'feature' ? 'active' : ''} onClick={() => setSession('feature')}>Principal</button>
            </div>
          </div>
          <FeederRaceReplay key={`${save.season}-F2-${selectedEvent.round}-${session}`} event={selectedEvent} session={session} seed={save.seed} season={save.season} category="F2" reducedMotion={save.preferences.reducedMotion} names={Object.fromEntries(f2.entrants.map((d)=>[d.id,d.name]))}/>
          <div className="f2-podium" aria-label="Pódio da F2">
            {selectedEvent[session].filter((r)=>!r.dnf).slice(0,3).map((r,i)=><div className="f2-podium-driver" key={r.driverId}
              style={{'--podium-order':i} as React.CSSProperties}>
              <PersonPortrait personId={r.driverId} name={entrants[r.driverId]?.name ?? r.driverId} size={62} fictional />
              <span>{i+1}º</span>
              <b>{entrants[r.driverId]?.name ?? r.driverId}</b>
              <small>{r.points} pontos</small>
            </div>)}
          </div>
          <div className="f2-finishers">
            {classified.slice(0, showAllFinishers ? classified.length : 12).map((r, index) => <div className={`f2-finisher ${r.dnf?'is-dnf':''}`} key={r.driverId} style={{ '--delay': `${Math.min(index * 40, 360)}ms` } as React.CSSProperties}>
              <span className="f2-rank">P{r.position}</span>
              <strong>{entrants[r.driverId]?.name ?? r.driverId}</strong>
              <small>Grid {r.grid} · {r.dnf ? 'Abandonou' : `${r.resultLabel} posições`}</small>
              <b>{r.dnf ? 'DNF' : `+${r.points} pts`}</b>
            </div>)}
          </div>
          {classified.length>12 && <button type="button" className="button secondary f2-show-more" aria-expanded={showAllFinishers} onClick={()=>setShowAllFinishers((old)=>!old)}>
            {showAllFinishers ? 'Exibir apenas os 12 primeiros' : `Ver todos os ${classified.length} pilotos, incluindo abandonos`}
          </button>}
          <div className="f2-broadcast" aria-label="Resumo factual da etapa">
            {raceFacts.map((fact, index) => <div className={`f2-broadcast-fact ${fact.kind}`} key={fact.kind}
              style={{ '--delay': `${index * 65}ms` } as React.CSSProperties}>
              <span>{fact.heading}</span>
              {fact.driverId ? <Link href={`/pilotos/${fact.driverId}`}>{fact.detail}</Link> : <strong>{fact.detail}</strong>}
            </div>)}
          </div>
        </> : <p>A primeira rodada da F2 aparecerá após a conclusão do GP correspondente na temporada principal. Nenhuma corrida futura é apresentada como já disputada.</p>}
      </section>
      <section className="panel padded">
        <SectionHead title="Memória da Fórmula 2" sub="CLASSIFICAÇÕES ARQUIVADAS NO ENCERRAMENTO" />
        {archive ? <>
          <label>Temporada
            <select value={selectedYear} onChange={(e) => setArchiveYear(Number(e.target.value))} aria-label="Ano arquivado da F2">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className="f2-archive">
            {archive.standings.slice(0, 8).map((s) => <div key={s.id}>
              <b>{s.position}º</b>
              <span>{[...save.world.pool, ...save.game.drivers].find((d) => d.id === s.id)?.name ?? s.id}</span>
              <strong>{s.points} pts</strong>
            </div>)}
          </div>
          <p className="f2-help">Arquivos anteriores à implantação da F2 com fins de semana preservam a classificação histórica antiga. A listagem não reconstrói corridas retroativamente.</p>
        </> : <p>O arquivo anual é criado ao concluir a etapa de prêmios da pós-temporada.</p>}
        {history.length > 0 && <div className="f2-champions" aria-label="Campeões históricos da F2">
          <span className="eyebrow">GALERIA DE CAMPEÕES</span>
          {history.slice(0, 8).map((row) => <Link key={row.season} href={`/pilotos/${row.id}`}>
            <span>{row.season}</span><strong>{row.name}</strong><b>{row.points} pts</b>
          </Link>)}
        </div>}
      </section>
    </section>
  );
}
