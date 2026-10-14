'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageTitle, SectionHead } from '../components/ui';
import { PersonPortrait } from '../components/person-portrait';
import { FeederRaceReplay } from '../components/feeder-race-replay';
import { useSave, useUniverse } from '../components/save-provider';
import { formulaThree } from '../domain/universe/formula-three';
import { feederForm } from '../domain/universe/formula-two';
import { feederGridMovement } from '../presentation/feeder-rivalry';
import { f3HistoricalChampions } from '../data/f3-historical';
import { driverGroups } from '../data/attributes';

export default function FormulaThreePage() {
  const {save}=useSave();
  const {teamById}=useUniverse();
  const [selected,setSelected]=useState<string|null>(null);
  const [round,setRound]=useState<number|null>(null);
  const [session,setSession]=useState<'feature'|'sprint'>('feature');
  const championship=useMemo(()=>formulaThree(save),[save]);
  const entrant=championship.standings.find((d)=>d.id===selected)??championship.standings[0];
  const profile=championship.entrants.find((d)=>d.id===entrant?.id);
  const event=championship.events.find((r)=>r.round===round)??championship.events.at(-1);
  const years=[...new Set(save.world.feederHistory.filter((h)=>h.category==='F3').map((h)=>h.season))].sort((a,b)=>b-a);
  const history=years.map((year)=>({year, champion:save.world.feederHistory.find((h)=>h.category==='F3'&&h.season===year)?.standings[0]}));
  const names=Object.fromEntries([...save.game.drivers,...save.world.pool].map((d)=>[d.id,d.name]));
  return <section className="f2-universe" aria-label="Campeonato de Fórmula 3">
    <PageTitle eyebrow={`CATEGORIA DE BASE · ${save.season}`} title="Fórmula 3 · o começo da jornada"
      subtitle="Até 30 jovens pilotos, 10 rodadas fictícias, corridas Sprint e principal, atributos, scouting e progressão para a F2." />
    <div className="f2-banner f3-banner panel padded"><div><span className="eyebrow">ROAD TO F1</span><h2>A próxima geração está na pista.</h2>
      <p>Simulação fictícia a partir do universo salvo. Uma etapa aparece após o respectivo GP da F1. O desempenho não altera pontos da F1.</p>
      <div className="f2-actions"><Link className="button secondary" href="/f2">Ver Fórmula 2 →</Link><Link className="button secondary" href="/academias">Scouting →</Link></div>
    </div><div className="f2-headline-stats"><div><b>{championship.entrants.length}</b><span>PILOTOS</span></div>
      <div><b>{championship.completed}/{championship.calendar.length}</b><span>RODADAS</span></div>
      <div><b>{championship.finished?'FINAL':'EM DISPUTA'}</b><span>CAMPEONATO</span></div></div></div>
    <div className="f2-layout"><section className="panel padded"><SectionHead title="Classificação de pilotos" sub="F3 · TEMPORADA ATUAL" />
      <div className="f2-standing" role="list" aria-label="Classificação de F3">
        {championship.standings.map((row)=><button key={row.id} type="button" role="listitem" className={`f2-driver ${entrant?.id===row.id?'selected':''}`}
          aria-pressed={entrant?.id===row.id} onClick={()=>setSelected(row.id)}>
          <span className="f2-rank">{String(row.position).padStart(2,'0')}</span>
          <PersonPortrait personId={row.id} name={row.name} size={42} fictional />
          <span className="f2-driver-info"><strong>{row.name}</strong><small>{teamById[row.academy??'']?.short??'Independente'} · {row.wins} vitórias · {row.podiums} pódios</small></span>
          <b className="f2-score">{row.points}<small>pts</small></b>
        </button>)}
      </div></section>
      <aside className="f2-side"><section className="panel padded"><SectionHead title="Dossiê de talentos" sub="ATRIBUTOS DO PILOTO" />
        {entrant&&profile?<><div className="f2-spotlight"><PersonPortrait personId={profile.id} name={profile.name} fictional size={92}/>
          <div><h3>{profile.name}</h3><p>{profile.flag} {profile.age} anos · {teamById[entrant.academy??'']?.name??'Independente'}</p>
            <Link href={`/pilotos/${profile.id}`}>Histórico detalhado →</Link></div></div>
          <div className="f2-metrics"><div><span>Overall</span><b>{profile.rating}</b></div><div><span>Potencial</span><b>{profile.potential}</b></div>
          <div><span>Superlicença</span><b>{save.world.people[profile.id]?.licensePoints??0}</b></div>
          <div><span>Motivação</span><b>{save.world.people[profile.id]?.motivation??0}</b></div></div>
          <div className="f3-attribute-bars" aria-label="Atributos simulados do piloto">
            {Object.entries(driverGroups).map(([label,attributes])=>{
              const grade=Math.round(attributes.reduce((total,key)=>total+(profile.attributes[key]??profile.rating),0)/attributes.length);
              return <div className="f3-attribute-row" key={label}><span>{label}</span>
                <div className="f3-attribute-track"><i style={{width:`${grade}%`}} /></div><b>{grade}</b></div>;
            })}
          </div>
          <div className="junior-form" aria-label="Evolução de pontos na F3">{feederForm(championship,profile.id).map((f)=><div key={f.round}>
            <small>R{f.round}</small><span style={{width:`${Math.max(3, f.gained/35*100)}%`}}/><b>+{f.gained}</b></div>)}</div>
        </>:<p>Aguarde inscrições.</p>}</section>
        <section className="panel padded"><SectionHead title="Memória da Fórmula 3" sub="CAMPEÕES DE TEMPORADAS ENCERRADAS" />
          {history.length?history.map(({year,champion})=><p key={year}><b>{year}</b> · {names[champion?.id??'']??champion?.id} · {champion?.points} pts</p>)
            :<p>O primeiro campeão aparecerá após a temporada.</p>}</section></aside></div>
    <section className="panel padded" aria-label="Hall histórico real da FIA Formula 3">
      <SectionHead title="Campeões reais · arquivo histórico" sub="IDENTIDADES E RESULTADOS HISTÓRICOS · FORA DO SAVE DE 2029" />
      <p>Referência histórica independente da nossa simulação fictícia. Fotografias dos campeões com retratos já catalogados usam exatamente suas identidades reais.</p>
      <div className="f2-standing" role="list">{f3HistoricalChampions.map((pilot)=><div key={pilot.year} className="f2-driver" role="listitem">
        <span className="f2-rank">{pilot.year}</span>
        {pilot.personId ? <PersonPortrait personId={pilot.personId} name={pilot.name} size={52} />
          : <img loading="lazy" alt="Ugo Ugochukwu, campeão de 2026" width={52} height={52} style={{objectFit:'cover',borderRadius:8}}
              src="https://res.cloudinary.com/prod-f2f3/image/upload/v1772027990/f3/articles/2026/02_February/Ugo_Ugochokwu_2020_1WxVTFiY.jpg" />}
        <span className="f2-driver-info"><strong>{pilot.name}</strong><small>{pilot.team} · {pilot.points===null?'Campeão FIA F3':`${pilot.points} pontos em 2026`}</small></span>
        <a href={pilot.url} target="_blank" rel="noopener noreferrer" className="button secondary">Histórico oficial ↗</a>
      </div>)}</div>
    </section>
    <section className="panel padded"><SectionHead title="Corridas da temporada" sub="SPRINT E PROVA PRINCIPAL" />
      <div className="f2-actions" role="group" aria-label="Seleção de corrida F3">{championship.calendar.map((r)=><button type="button" key={r.round}
        className={`button secondary ${event?.round===r.round?'active':''}`} disabled={!championship.events.some((e)=>e.round===r.round)}
        onClick={()=>setRound(r.round)}>{r.circuitName}</button>)}</div>
      <div className="f2-session-switch" aria-label="Sessão F3"><button type="button" aria-pressed={session==='sprint'} onClick={()=>setSession('sprint')}>Sprint</button>
        <button type="button" aria-pressed={session==='feature'} onClick={()=>setSession('feature')}>Corrida principal</button></div>
      {event&&<FeederRaceReplay key={`${save.season}-F3-${event.round}-${session}`} event={event} session={session} seed={save.seed} season={save.season} category="F3" reducedMotion={save.preferences.reducedMotion} names={names}/> }
      {event&&<div className="f3-podium" aria-label="Pódio da sessão F3 concluída">
        {event[session].filter((r)=>!r.dnf&&r.position<=3).map((r)=><div className="f3-podium-card" key={r.driverId}>
          <span>#{r.position}</span>
          <PersonPortrait personId={r.driverId} name={championship.entrants.find((d)=>d.id===r.driverId)?.name} fictional size={64}/>
          <strong>{championship.entrants.find((d)=>d.id===r.driverId)?.name}</strong>
          <small>+{r.points} pts · largada P{r.grid}</small>
        </div>)}
      </div>}
      {event?<div className="f2-standing" role="list" aria-label="Resultados F3">{feederGridMovement(event[session]).map((r)=><div className="f2-driver" key={r.driverId} role="listitem">
        <span className="f2-rank">{r.position}</span><PersonPortrait personId={r.driverId} name={championship.entrants.find((d)=>d.id===r.driverId)?.name} fictional size={38}/>
        <span className="f2-driver-info"><strong>{championship.entrants.find((d)=>d.id===r.driverId)?.name??r.driverId}</strong>
          <small>Largada P{r.grid} · {r.dnf?'Abandono':`+${r.points} pts`}</small></span></div>)}</div>
        :<p>Não há sessões concluídas. As rodadas da F3 são desbloqueadas pelos GPs da F1.</p>}
    </section>
  </section>;
}
