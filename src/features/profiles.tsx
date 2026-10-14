'use client';
import { PersonPortrait } from '../components/person-portrait';
import { useUniverse } from '../components/save-provider';
import { CountryFlag } from '../components/country-flag';
import { pairKey } from '../domain/simulation/world';
import { formulaTwo, feederForm, feederRival, feederProspectScore } from '../domain/universe/formula-two';
import { formulaThree } from '../domain/universe/formula-three';
import { potentialEstimate } from '../domain/universe/world';
import { driverJourney } from '../presentation/driver-journey';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowLeft,
  Search,
  Radio,
  Trophy,
  Target,
  MapPin,
  Shield,
} from 'lucide-react';

import { driverGroups, teamGroups, relationshipLabels, makeRatings } from '../data/attributes';

import { news } from '../data/editorial';
import { useSave } from '../components/save-provider';
import {
  PageTitle,
  DriverCard,
  TeamCard,
  EngineerCard,
  RatingGroups,
  DynamicRating,
  StatRadar,
  ProjectionNote,
  Tabs,
  RatingBar,
  Badge,
  TeamMark,
  SectionHead,
  EmptyState,
} from '../components/ui';
import { DriverPortrait, CarShowroom } from '../components/visuals';
import { mean, teamPoints, teamStandings } from '../domain/selectors';
import type { Driver, Save } from '../domain/types';
export function Directory({ type }: { type: 'pilotos' | 'equipes' | 'engenheiros' }) {
  const { drivers, driverById, teams, teamById, engineers } = useUniverse();
  const {save} = useSave();
  const [category, setCategory] = useState('F1');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('grid');
  const source = type === 'pilotos'
    ? [...drivers, ...save.world.pool].filter((d)=>category==='all' ||
        (category==='F1' ? drivers.some((active)=>active.id===d.id) : save.world.people[d.id]?.category===category))
    : type === 'equipes' ? teams : engineers;
  const items = source.filter(
    (item) =>
      item.name
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(
          query
            .toLocaleLowerCase('pt-BR')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        ) &&
      (filter === 'all' || ('teamId' in item ? item.teamId : item.id) === filter),
  );
  if (sort === 'rating') items.sort((a, b) => b.rating - a.rating);
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageTitle
        eyebrow={`PADDOCK / ${type.toUpperCase()}`}
        title={
          type === 'pilotos'
            ? 'Os protagonistas.'
            : type === 'equipes'
              ? '16 equipes. Uma ambição.'
              : 'A outra voz no cockpit.'
        }
        subtitle={
          type === 'pilotos'
            ? 'F1, F2 e F3. Explore titulares, reservas e jovens talentos da carreira.'
            : type === 'equipes'
              ? 'Identidades, projetos e as duplas que vão definir a nova era.'
              : '32 engenheiros fictícios, cada um conectado a um piloto.'
        }
      />
      <ProjectionNote />
      {type==='pilotos'&&<div className="driver-category-tabs" role="group" aria-label="Filtrar categorias de pilotos">
        {['F1','F2','F3','all'].map((option)=><button type="button" key={option} className={`button secondary ${category===option?'active':''}`} aria-pressed={category===option} onClick={()=>{setCategory(option);setFilter('all');}}>{option==='all'?'Todos':option}</button>)}
        <small>Pilotos das categorias de base possuem perfis próprios e identidades fictícias.</small>
      </div>}
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label={`Buscar ${type}`}
            placeholder={`Buscar ${type}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="select-field">
          <span>Equipe</span>
          <select
            aria-label="Filtrar equipe"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas as equipes</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Ordenar</span>
          <select aria-label="Ordenação" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="grid">Ordem do grid</option>
            <option value="rating">Maior overall</option>
            <option value="name">Nome</option>
          </select>
        </label>
        <span className="result-count">
          {items.length} / {source.length}
        </span>
      </div>
      <div className={type === 'pilotos' ? 'driver-grid' : 'card-grid'}>
        {items.map((item) =>
          type === 'pilotos' ? (
            drivers.some((active)=>active.id===item.id)
              ? <DriverCard key={item.id} driver={driverById[item.id]} />
              : <Link key={item.id} href={`/pilotos/${item.id}`} className="junior-directory-card panel padded">
                  <PersonPortrait personId={item.id} name={item.name} fictional size={72}/>
                  <div><span className="eyebrow">{save.world.people[item.id]?.category??'Base'} · {(item as Driver).flag} {(item as Driver).age} anos</span>
                    <h3>{item.name}</h3><p>Overall {item.rating} · Potencial {(item as Driver).potential} · {save.world.people[item.id]?.status??'—'}</p>
                    <small>Ver histórico, atributos e scouting →</small></div>
                </Link>
          ) : type === 'equipes' ? (
            <TeamCard key={item.id} team={teamById[item.id]} />
          ) : (
            <EngineerCard key={item.id} engineer={engineers.find((e) => e.id === item.id)!} />
          ),
        )}
      </div>
      {items.length === 0 && (
        <EmptyState
          title="Nenhum resultado"
          text="Tente outro nome ou selecione todas as equipes."
        />
      )}
    </>
  );
}
export function RelationshipCard({ driver, other }: { driver: Driver; other: Driver }) {
  const { drivers, teamById } = useUniverse();
  const { save } = useSave();
  const ratings = save.game.relationships[pairKey(driver.id, other.id)];
  return (
    <article className="panel relationship-card">
      <Link href={`/pilotos/${other.id}`} className="relationship-person">
        <DriverPortrait driver={other} small />
        <div>
          <span className="eyebrow">
            {other.teamId === driver.teamId ? 'COMPANHEIRO' : 'RIVAL'}
          </span>
          <h3>{other.name}</h3>
          <p>{teamById[other.teamId].name}</p>
        </div>
        <ArrowUpRight size={17} />
      </Link>
      <div className="relationship-values">
        {Object.entries(ratings).map(([l, v]) => (
          <div key={l}>
            <span>{l}</span>
            <strong>{Math.round(v)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
/** Young drivers have their own career dossier instead of a generic "no seat" warning. */
function JuniorDossier({ save, d }: { save: Save; d: Driver }) {
  const record = save.world.people[d.id];
  const academy = save.game.teams.find((t)=>t.id === record?.academy);
  const champ = record?.category === 'F3' ? formulaThree(save) : formulaTwo(save);
  const standing = champ.standings.find((row)=>row.id===d.id);
  const scout = feederProspectScore(save,d.id);
  const potential = potentialEstimate(save,d);
  const form = feederForm(champ,d.id);
  const rival = feederRival(champ,d.id);
  const journey=driverJourney(save,d.id);
  const old = save.world.feederHistory.filter((h)=>h.standings.some((r)=>r.id===d.id))
    .map((h)=>({...h, result:h.standings.find((r)=>r.id===d.id)!})).reverse().slice(0,6);
  return <section className="junior-dossier">
    <Link className="back-link" href={record?.category==='F3'?'/f3':'/f2'}><ArrowLeft size={15}/> Voltar ao campeonato de acesso</Link>
    <PageTitle eyebrow={`PROSPECT DOSSIER / ${save.season}`} title={d.name}
      subtitle={<><CountryFlag value={d.flag}/> {d.country} · {record?.category ?? 'Categoria de base'} · {academy?.name ?? 'Sem academia'}</>}/>
    <div className="junior-dossier-top panel padded">
      <PersonPortrait personId={d.id} name={d.name} fictional size={164}/>
      <div>
        <span className="eyebrow">HISTÓRIA EM CONSTRUÇÃO</span>
        <h2>{record?.category === 'F2' ? 'Na luta por uma vaga na F1' : 'Formação e desenvolvimento'}</h2>
        <p>Talento procedural de {d.age} anos. Os resultados abaixo vêm das categorias de acesso e não são estatísticas oficiais da F1.</p>
        <div className="junior-metric-grid">
          <div><span>OVERALL</span><b>{d.rating}</b></div>
          <div><span>POTENCIAL OBSERVADO</span><b>{potential.low.toFixed(0)}–{potential.high.toFixed(0)}</b></div>
          <div><span>SUPERLICENÇA</span><b>{record?.licensePoints ?? 0}/40</b></div>
          <div><span>SCOUTING</span><b>{record?.scouting ?? 0}%</b></div>
        </div>
        <div className="f2-actions"><Link href={record?.category==='F3'?'/f3':'/f2'} className="button secondary">Temporada {record?.category==='F3'?'F3':'F2'} →</Link><Link href="/silly-season" className="button secondary">Mercado de pilotos →</Link></div>
      </div>
    </div>
    <div className="two-col">
      <section className="panel padded">
        <SectionHead title="Desempenho de base" sub="PONTOS E PROGRESSÃO REGISTRADOS"/>
        {standing ? <>
          <p><b>P{standing.position}</b> · {standing.points} pontos · {standing.wins} vitórias · {standing.podiums} pódios de corrida principal.</p>
          {rival && <p>Rival próximo: <b>{rival.name}</b> · diferença de {rival.difference} pontos.</p>}
          <div className="junior-form" aria-label={`Pontuação da ${record?.category==='F3'?'F3':'F2'} por etapa`}>
            {form.map((entry)=><div key={entry.round}><small>R{entry.round}</small><span style={{width:`${Math.max(3, entry.gained/35*100)}%`}}/><b>+{entry.gained}</b></div>)}
          </div>
          {!form.length && <p>O campeonato ainda não teve uma rodada concluída no save.</p>}
        </> : <p>Sem resultados da categoria nesta temporada. O histórico anual fica disponível após o encerramento.</p>}
      </section>
      <section className="panel padded">
        <SectionHead title="Passaporte para a Fórmula 1" sub="PROGRESSÃO ELEGÍVEL"/>
        <p>{scout?.ready ? 'Superlicença suficiente para disputar negociações.' : `Faltam ${scout?.pointsToLicense ?? '—'} pontos de superlicença.`}</p>
        <p>Motivação: <b>{record?.motivation ?? '—'}/100</b> · Situação: <b>{record?.status}</b> · Academia: <b>{academy?.name ?? 'Livre'}</b>.</p>
        <p>Desempenho em categorias de acesso influencia o scouting e a licença, mas não substitui uma negociação e um assento válido na F1.</p>
        <h3>Temporadas anteriores</h3>
        {old.length ? old.map((h)=><p key={h.season+h.category}>{h.season} · {h.category} · P{h.result.position} · {h.result.points} pts</p>) : <p>O histórico será arquivado ao final da temporada.</p>}
        {journey.events.length>0&&<div className="driver-journey-timeline" aria-label="Linha do tempo da carreira">
          {journey.events.slice(-8).reverse().map((record,i)=><p key={`${record.season}-${record.kind}-${i}`}>
            <b>{record.season}</b> · {record.label}</p>)}
        </div>}
      </section>
    </div>
  </section>;
}

export function DriverProfile({ id }: { id: string }) {
  const { drivers, driverById, teamById, engineers, circuits, news } = useUniverse();
  const [tab, setTab] = useState('attributes');
  const { save } = useSave();
  const d = driverById[id];
  if (!d)
    return (
      <PageTitle
        eyebrow="ARQUIVO"
        title="Piloto indisponível neste save"
        subtitle="Este personagem não pertence ao universo carregado."
      />
    );
  const t = teamById[d.teamId];
  const e = engineers.find((e) => e.driverId === id)!;
  const journey=driverJourney(save,id);
  if (!t || !e) return <JuniorDossier save={save} d={d} />;
  const circuit = circuits[Math.min(save.round, circuits.length) - 1];
  const story = news.find((n) => n.href === `/pilotos/${id}`);
  const history = [...save.game.history.flatMap((a) => a.weekends), ...save.weekends]
    .filter((w) => w.round === circuit.round && w.results.GP)
    .flatMap((w) => w.results.GP!.filter((r) => r.driverId === id));
  const rivals = [
    ...drivers.filter((x) => x.teamId === d.teamId && x.id !== id),
    ...drivers
      .filter((x) => x.id !== id && x.teamId !== d.teamId)
      .sort((a, b) => Math.abs(a.rating - d.rating) - Math.abs(b.rating - d.rating))
      .slice(0, 2),
  ];
  return (
    <>
      <Link href="/pilotos" className="back-link">
        <ArrowLeft size={15} /> Todos os pilotos
      </Link>
      <PageTitle
        eyebrow={'DRIVER DOSSIER / 2029'.replaceAll('2029', String(save.season))}
        title={d.name}
        subtitle={
          <>
            <CountryFlag value={d.flag} /> {d.country} · {t.name} · #{d.number}
          </>
        }
        action={
          <Link href={`/equipes/${t.id}`} className="button secondary">
            <TeamMark team={t} /> Ver equipe <ArrowUpRight size={16} />
          </Link>
        }
      />
      <ProjectionNote />
      <div className="profile-layout">
        <aside className="panel driver-id">
          <DriverPortrait driver={d} />
          <div className="profile-summary">
            <span className="eyebrow" style={{ color: t.color }}>
              {t.name}
            </span>
            <h2>{d.name}</h2>
            <div className="overall-pair">
              <div>
                <strong style={{ color: t.color }}>{d.rating}</strong>
                <span>OVERALL</span>
              </div>
              <div>
                <strong>{d.potential}</strong>
                <span>POTENCIAL</span>
              </div>
            </div>
            <dl className="key-values">
              <div>
                <dt>Idade / {save.season}</dt>
                <dd>{d.age} anos</dd>
              </div>
              <div>
                <dt>Contrato ativo</dt>
                <dd>Até {d.contract}</dd>
              </div>
              <div>
                <dt>Salário</dt>
                <dd>US$ {(d.salary ?? 0).toFixed(1)}M / ano</dd>
              </div>
              <div>
                <dt>Pontos no save</dt>
                <dd>{save.driverPoints[id]}</dd>
              </div>
              <div>
                <dt>Número provisório</dt>
                <dd>#{d.number}</dd>
              </div>
            </dl>
            <Link href={`/engenheiros/${e.id}`} className="engineer-link">
              <Radio size={18} />
              <div>
                <small>ENGENHEIRO DE CORRIDA</small>
                <strong>{e.name}</strong>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
        <div className="profile-main">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'attributes', label: 'Atributos' },
              { id: 'circuit', label: 'Neste circuito' },
              { id: 'relationships', label: 'Relacionamentos' },
            ]}
          />
          {tab === 'attributes' && (
            <>
              <div className="profile-attributes">
                <section className="panel">
                  <SectionHead title="DNA do piloto" sub="20 ATRIBUTOS-BASE" />
                  <RatingGroups groups={driverGroups} ratings={d.attributes} color={t.color} />
                </section>
                <section className="panel">
                  <SectionHead title="Perfil de performance" sub="PROJEÇÃO EDITORIAL" />
                  <StatRadar
                    values={Object.values(driverGroups).map((labels) =>
                      mean(labels.map((l) => d.attributes[l])),
                    )}
                    labels={['Velocidade', 'Controle', 'Corrida', 'Combate', 'Técnica']}
                    color={t.color}
                  />
                  <p className="table-note">
                    Overall editorial; radar calculado pela média de cada grupo.
                  </p>
                </section>
              </div>
              <section className="panel">
                <SectionHead title="O momento do piloto" sub="12 ATRIBUTOS DINÂMICOS • CARREIRA" />
                <div className="dynamic-grid">
                  {d.dynamics.map((item) => (
                    <DynamicRating key={item.label} item={item} />
                  ))}
                </div>
              </section>
              {story && (
                <article className="story-quote">
                  <span className="eyebrow">{story.category}</span>
                  <h2>{story.title}</h2>
                  <p>{story.body}</p>
                </article>
              )}
            </>
          )}
          {tab === 'circuit' && (
            <section className="panel padded">
              <span className="eyebrow">
                <CountryFlag value={circuit.flag} /> {circuit.name}
              </span>
              <h2>Neste circuito</h2>
              <p className="muted">
                Conhecimento acumulado por treinos e corridas neste circuito. Os indicadores de
                adaptação influenciam o ritmo; os resultados registrados aparecem abaixo.
              </p>
              <div className="ratings-two-col">
                {Object.entries(save.game.knowledge[d.id][circuit.id]).map(([l, v]) => (
                  <RatingBar key={l} label={l} value={v} color={t.color} />
                ))}
              </div>
              <div className="stats-four">
                <div>
                  <small>MELHOR CLASSIFICAÇÃO</small>
                  <strong>
                    {save.weekends
                      .find((w) => w.round === circuit.round)
                      ?.qualifyingGrid.indexOf(id)! >= 0
                      ? save.weekends
                          .find((w) => w.round === circuit.round)!
                          .qualifyingGrid.indexOf(id) + 1
                      : '—'}
                  </strong>
                </div>
                <div>
                  <small>MELHOR CORRIDA</small>
                  <strong>
                    {history.length ? Math.min(...history.map((r) => r.position)) : '—'}
                  </strong>
                </div>
                <div>
                  <small>MÉDIA HISTÓRICA</small>
                  <strong>{history.length ? mean(history.map((r) => r.position)) : '—'}</strong>
                </div>
                <div>
                  <small>AMOSTRA</small>
                  <strong>{history.length} GP</strong>
                </div>
              </div>
              {!history.length ? (
                <EmptyState
                  title="Uma página em branco"
                  text="Nenhuma corrida registrada neste circuito. O histórico será criado pelas sessões do seu save."
                />
              ) : (
                <p>
                  Último resultado no save: P{history[0].position} · {history[0].points} pontos na
                  corrida.
                </p>
              )}
            </section>
          )}
          {tab === 'relationships' && (
            <>
              <div className="relationship-center">
                <DriverPortrait driver={d} small />
                <div>
                  <span className="eyebrow">REDE COMPETITIVA</span>
                  <h2>{d.name}</h2>
                  <p>Dez dimensões independentes. Sem nota de amizade.</p>
                </div>
              </div>
              <div className="relationship-grid">
                {rivals.map((other) => (
                  <RelationshipCard key={other.id} driver={d} other={other} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <section className="panel padded driver-journey-section" aria-label="Histórico esportivo do piloto">
        <SectionHead title="História da carreira" sub="APENAS RESULTADOS GRAVADOS NO SAVE"/>
        <div className="junior-metric-grid">
          <div><span>GPs F1</span><b>{journey.careerStarts}</b></div>
          <div><span>Vitórias F1</span><b>{journey.careerWins}</b></div>
          <div><span>Pódios F1</span><b>{journey.careerPodiums}</b></div>
          <div><span>Pontos F1</span><b>{journey.careerPoints}</b></div>
        </div>
        {journey.events.length>0?<div className="driver-journey-timeline">
          {journey.events.slice(-15).reverse().map((event,i)=><p key={`${event.season}-${event.kind}-${i}`}><b>{event.season}</b> · {event.label}</p>)}
        </div>:<p>A carreira ainda não possui resultados ou transferências arquivados.</p>}
      </section>
    </>
  );
}
export function TeamProfile({ id }: { id: string }) {
  const { drivers, teamById, powerRankings, technicalRankings, tires } = useUniverse();
  const team = teamById[id];
  const { save } = useSave();
  const [tab, setTab] = useState('car');
  const duo = drivers.filter((d) => d.teamId === id);
  const rank = powerRankings.findIndex((t) => t.id === id) + 1;
  return (
    <>
      <Link href="/equipes" className="back-link">
        <ArrowLeft size={15} /> Todas as equipes
      </Link>
      <PageTitle
        eyebrow={'CONSTRUCTOR DOSSIER / 2029'.replaceAll('2029', String(save.season))}
        title={team.name}
        subtitle={team.base}
        action={<TeamMark team={team} />}
      />
      <ProjectionNote />
      <div className="team-facts panel">
        <div>
          <small>MOTOR</small>
          <strong>{team.engine}</strong>
        </div>
        <div>
          <small>BATERIA CONTRATADA</small>
          <strong>{team.battery ?? 'A definir'}</strong>
        </div>
        <div>
          <small>PNEUS</small>
          <strong>{team.tires}</strong>
        </div>
        <div>
          <small>PONTOS</small>
          <strong>{teamPoints(save, id)}</strong>
        </div>
        <div>
          <small>POWER RANK</small>
          <strong>#{rank}</strong>
        </div>
        <div>
          <small>RANK TÉCNICO</small>
          <strong>#{technicalRankings.findIndex((t) => t.id === id) + 1}</strong>
        </div>
        <div>
          <small>POSIÇÃO NO CAMPEONATO</small>
          <strong>
            {Object.values(save.driverPoints).some((points) => points > 0)
              ? `P${teamStandings(save).findIndex((t) => t.id === id) + 1}`
              : '—'}
          </strong>
        </div>
        <div>
          <small>PRESTÍGIO / POTENCIAL</small>
          <strong>
            {team.prestige} / {team.potential}
          </strong>
        </div>
      </div>
      <CarShowroom team={team} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'car', label: 'Engenharia & operação' },
          { id: 'drivers', label: 'Dupla de pilotos' },
          { id: 'dynamics', label: 'Momento da equipe' },
        ]}
      />
      {tab === 'car' && (
        <div className="team-technical">
          <section className="panel">
            <SectionHead title="As seis áreas do projeto" sub="20 ATRIBUTOS-BASE" />
            <RatingGroups groups={teamGroups} ratings={team.attributes} color={team.color} />
          </section>
          <section className="panel">
            <SectionHead title="Plataforma de performance" sub="DADOS PROVISÓRIOS" />
            <StatRadar
              values={Object.values(teamGroups).map((ls) =>
                mean(ls.map((l) => team.attributes[l])),
              )}
              labels={['Aero', 'Mecânica', 'Powertrain', 'Pneus', 'Operação', 'P&D']}
              color={team.color}
            />
            <div className="stats-four">
              <div>
                <small>POTENCIAL</small>
                <strong>{team.potential}</strong>
              </div>
              <div>
                <small>INFRA</small>
                <strong>{team.infrastructure}</strong>
              </div>
              <div>
                <small>ORÇAMENTO</small>
                <strong>${team.budget}M</strong>
              </div>
              <div>
                <small>PRESTÍGIO</small>
                <strong>{team.prestige}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
      {tab === 'drivers' && (
        <div className="driver-grid duo">
          {duo.map((d) => (
            <DriverCard driver={d} key={d.id} />
          ))}
        </div>
      )}
      {tab === 'dynamics' && (
        <section className="panel">
          <SectionHead title="Estado do projeto" sub="12 ATRIBUTOS DINÂMICOS • CARREIRA" />
          <div className="dynamic-grid">
            {team.dynamics.map((item) => (
              <DynamicRating key={item.label} item={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function EngineerProfile({ id }: { id: string }) {
  const { save } = useSave();
  const { driverById, teamById, engineers } = useUniverse();
  const e = engineers.find((e) => e.id === id)!;
  const d = driverById[e.driverId];
  const t = teamById[e.teamId];
  return (
    <>
      <Link href="/engenheiros" className="back-link">
        <ArrowLeft size={15} /> Todos os engenheiros
      </Link>
      <PageTitle
        eyebrow={'RACE ENGINEERING / ' + save.season}
        title={e.name}
        subtitle={`Engenheiro de ${d.name} · ${t.name}`}
      />
      <ProjectionNote>
        IDENTIDADE FICTÍCIA SUBSTITUÍVEL • Atributos e sinergia editoriais, sem medição histórica.
      </ProjectionNote>
      <section className="synergy-hero panel">
        <div className="synergy-symbol">
          <PersonPortrait personId={e.id} name={e.name} size={96} fictional={e.fictional} />
        </div>
        <div>
          <span className="eyebrow">DUAS VOZES. UM OBJETIVO.</span>
          <h2>
            {d.name} <span className="muted">+</span> {e.name}
          </h2>
          <p>Precisão no rádio. Confiança dentro do cockpit.</p>
          <Link className="text-link" href={`/pilotos/${d.id}`}>
            Ver ficha do piloto <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="synergy-value" style={{ color: t.color }}>
          {Math.round(e.synergy)}
          <small>SINERGIA</small>
        </div>
      </section>
      <div className="two-col">
        <section className="panel padded">
          <SectionHead title="Atributos do engenheiro" sub="10 ATRIBUTOS-BASE" />
          {Object.entries(e.attributes).map(([l, v]) => (
            <RatingBar key={l} label={l} value={v} color={t.color} />
          ))}
        </section>
        <div>
          <section className="panel">
            <SectionHead title="Conexão operacional" sub="6 ATRIBUTOS DINÂMICOS" />
            <div className="dynamic-grid single">
              {e.dynamics.map((item) => (
                <DynamicRating item={item} key={item.label} />
              ))}
            </div>
          </section>
          <section className="panel padded synergy-notes">
            <h3>Forças da parceria</h3>
            <p className="green">
              {Object.entries(e.attributes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k]) => k)
                .join(' · ')}
            </p>
            <h3>Pontos de atenção</h3>
            <p>
              {Object.entries(e.attributes)
                .sort((a, b) => a[1] - b[1])
                .slice(0, 2)
                .map(([k]) => k)
                .join(' · ')}
            </p>
            <small className="muted">
              Leitura dos atributos atuais do engenheiro. Sinergia e forma evoluem com os
              resultados.
            </small>
          </section>
        </div>
      </div>
    </>
  );
}
