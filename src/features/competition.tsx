'use client';
import { useUniverse } from '../components/save-provider';
import { CountryFlag } from '../components/country-flag';
import { CareerOffice } from './career';
import { CareerHub } from './career-hub';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Flag } from 'lucide-react';
import {
  PageTitle,
  SectionHead,
  ChampionshipTable,
  Tabs,
  ProjectionNote,
  PowerRankingCard,
  StatRadar,
  Badge,
  EmptyState,
  TeamMark,
} from '../components/ui';
import { CircuitMap } from '../components/visuals';
import { useSave } from '../components/save-provider';

import { regulations } from '../data/regulations';
import { news } from '../data/editorial';
import { completedRaces } from '../domain/selectors';
import { NewsCard } from './home';
import { SprintGrid } from './weekend';
export function Standings({ constructors = false }: { constructors?: boolean }) {
  const { drivers, teams } = useUniverse();
  const { save } = useSave();
  const [tab, setTab] = useState(constructors ? 'teams' : 'drivers');
  return (
    <>
      <PageTitle
        eyebrow={'CHAMPIONSHIP / 2029'.replaceAll('2029', String(save.season))}
        title={constructors ? 'Campeonato de construtores' : 'Cada ponto importa.'}
        subtitle={`${completedRaces(save)} de ${save.game.circuits.length} GPs concluídos · ${completedRaces(save) === 0 ? 'Pré-temporada' : 'Resultados simulados deste save'}`}
        action={
          <Link className="button secondary" href="/fim-de-semana">
            Ir para a pista <ArrowRight size={16} />
          </Link>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'drivers', label: 'Pilotos · 32' },
          { id: 'teams', label: 'Construtores · 16' },
        ]}
      />
      <section className="panel">
        <SectionHead
          title={tab === 'drivers' ? 'Campeonato de pilotos' : 'Campeonato de construtores'}
          sub={'2029 • PONTOS OFICIAIS DO SAVE'.replaceAll('2029', String(save.season))}
        />
        <ChampionshipTable type={tab === 'drivers' ? 'drivers' : 'teams'} />
      </section>
      <div className="scoring-note">
        <Flag size={18} />
        <p>
          GP pontua até P13 · Pole +2 · Volta rápida +1 · Sprint pontua até P10 e maior ganho de
          posições +1.
        </p>
        <Link className="text-link" href="/regulamento">
          Ver regulamento <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
}
export function Rankings() {
  const { drivers, teams, teamById, engineers, powerRankings, powerScore } = useUniverse();
  const { save } = useSave();
  const [tab, setTab] = useState('teams');
  const dRank = [...drivers].sort((a, b) => b.rating - a.rating);
  const eRank = [...engineers].sort((a, b) => b.rating - a.rating);
  const races = completedRaces(save);
  return (
    <>
      <PageTitle
        eyebrow={'THE FORM GUIDE / 2029'.replaceAll('2029', String(save.season))}
        title="Power rankings."
        subtitle="Uma leitura do grid antes da próxima bandeirada. Potência não é promessa de vitória."
      />
      <ProjectionNote>
        PROJEÇÃO EDITORIAL • Power Score = 50% carro + 30% média dos pilotos + 20% média dos
        engenheiros.
      </ProjectionNote>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'teams', label: 'Equipes · 16' },
          { id: 'drivers', label: 'Pilotos · 32' },
          { id: 'engineers', label: 'Engenheiros · 32' },
          { id: 'results', label: 'Estatísticas do save' },
        ]}
      />
      {tab === 'teams' && (
        <>
          <div className="rankings-layout">
            <section className="panel">
              <SectionHead title="A ordem das forças" sub="POWER SCORE / 100" />
              {powerRankings.map((t, i) => (
                <PowerRankingCard key={t.id} team={t} index={i} />
              ))}
            </section>
            <aside className="panel power-leader">
              <span className="eyebrow">REFERÊNCIA INICIAL</span>
              <TeamMark team={powerRankings[0]} />
              <h2>{powerRankings[0].name}</h2>
              <span className="big-power">
                {powerScore(powerRankings[0]).power}
                <small>POWER SCORE</small>
              </span>
              <StatRadar
                values={Object.values(powerScore(powerRankings[0])).slice(1)}
                labels={['Carro', 'Pilotos', 'Engenharia', 'Confiab.', 'P&D', 'Momentum']}
                color={powerRankings[0].color}
              />
              <p>Ratings provisórios. O novo regulamento ainda precisa encontrar a pista.</p>
              <Link href={`/equipes/${powerRankings[0].id}`} className="button secondary">
                Explorar projeto <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
          <section className="panel">
            <SectionHead title="Por dentro de cada projeto" sub="MATRIZ DE PERFORMANCE" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>EQUIPE</th>
                    {[
                      'POWER',
                      'CAR',
                      'DRIVER',
                      'ENGINEERING',
                      'RELIABILITY',
                      'DEVELOPMENT',
                      'MOMENTUM',
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {powerRankings.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/equipes/${t.id}`} style={{ color: t.color }}>
                          {t.name}
                        </Link>
                      </td>
                      {Object.values(powerScore(t)).map((v, i) => (
                        <td className="mono" key={i}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {(tab === 'drivers' || tab === 'engineers') && (
        <section className="panel">
          <SectionHead
            title={tab === 'drivers' ? 'Os 32 pilotos' : 'As 32 vozes do rádio'}
            sub="RATING EDITORIAL / 100"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>NOME</th>
                  <th>EQUIPE</th>
                  <th>OVERALL</th>
                  <th>{tab === 'drivers' ? 'POTENCIAL' : 'SINERGIA'}</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'drivers' ? dRank : eRank).map((item, i) => (
                  <tr key={item.id}>
                    <td className="position">{String(i + 1).padStart(2, '0')}</td>
                    <td>
                      <Link href={`/${tab === 'drivers' ? 'pilotos' : 'engenheiros'}/${item.id}`}>
                        {item.name}
                      </Link>
                    </td>
                    <td style={{ color: teamById[item.teamId].color }}>
                      {teamById[item.teamId].name}
                    </td>
                    <td>
                      <div className="table-rating">
                        <div className="meter">
                          <i
                            style={{
                              width: `${item.rating}%`,
                              background: teamById[item.teamId].color,
                            }}
                          />
                        </div>
                        <strong>{item.rating}</strong>
                      </div>
                    </td>
                    <td className="mono">{'potential' in item ? item.potential : item.synergy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'results' && (
        <section className="panel">
          <SectionHead title="O que a pista já contou" sub={`${races} GPs • AMOSTRA DO SAVE`} />
          {races === 0 ? (
            <EmptyState
              title="Ainda não há dados de corrida."
              text="Inicie o primeiro fim de semana para construir estatísticas. Não há vitórias ou resultados pré-inventados."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>PILOTO</th>
                    <th>GPs</th>
                    <th>VITÓRIAS</th>
                    <th>PÓDIOS</th>
                    <th>POLES</th>
                    <th>V. RÁPIDAS</th>
                    <th>DNFs / DSQ</th>
                    <th>ULTRAPASSAGENS</th>
                    <th>MÉDIA GP</th>
                    <th>MÉDIA QUALI</th>
                    <th>PONTOS</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => {
                    const stat = save.game.stats[d.id];
                    return (
                      <tr key={d.id}>
                        <td>
                          <Link href={`/pilotos/${d.id}`}>{d.name}</Link>
                        </td>
                        <td>{stat.starts}</td>
                        <td>{stat.wins}</td>
                        <td>{stat.podiums}</td>
                        <td>{stat.poles}</td>
                        <td>{stat.fastestLaps}</td>
                        <td>{stat.dnfs}</td>
                        <td>{stat.overtakes}</td>
                        <td>
                          {stat.finishes.length
                            ? (
                                stat.finishes.reduce((a, b) => a + b, 0) / stat.finishes.length
                              ).toFixed(1)
                            : '—'}
                        </td>
                        <td>
                          {stat.qualifying.length
                            ? (
                                stat.qualifying.reduce((a, b) => a + b, 0) / stat.qualifying.length
                              ).toFixed(1)
                            : '—'}
                        </td>
                        <td>{save.driverPoints[d.id]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
export function CalendarPage() {
  const { driverById, circuits } = useUniverse();
  const { save } = useSave();
  const [selected, setSelected] = useState(Math.min(save.round, circuits.length));
  const c = circuits[selected - 1];
  return (
    <>
      <PageTitle
        eyebrow={'WORLD TOUR / 2029'.replaceAll('2029', String(save.season))}
        title={`${circuits.length} destinos. Um campeonato.`}
        subtitle="Calendário conceitual do universo. Datas e condições são provisórias."
      />
      <section className="calendar-feature panel">
        <div>
          <Badge tone="red-tag">ROUND {String(c.round).padStart(2, '0')}</Badge>
          <h2>
            <CountryFlag value={c.flag} /> {c.country}
          </h2>
          <p>
            {c.name} · {c.city}
          </p>
          <div className="calendar-feature-date">
            <CalendarDays size={18} />
            {new Date(c.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </div>
          <p>
            {c.km.toFixed(3)} km · {c.laps} voltas · {c.corners} curvas
          </p>
          {c.round === save.round && (
            <Link href="/fim-de-semana" className="button primary">
              Abrir fim de semana <ArrowRight size={16} />
            </Link>
          )}
          {save.weekends.find((w) => w.round === c.round)?.results.GP && (
            <Badge tone="green-tag">
              VENCEDOR:{' '}
              {
                driverById[save.weekends.find((w) => w.round === c.round)!.results.GP![0].driverId]
                  .name
              }
            </Badge>
          )}
        </div>
        <CircuitMap />
      </section>
      <div className="calendar-grid">
        {circuits.map((c) => {
          const complete = !!save.weekends.find((w) => w.round === c.round)?.results.GP;
          return (
            <button
              key={c.id}
              className={`calendar-card ${selected === c.round ? 'selected' : ''}`}
              onClick={() => setSelected(c.round)}
              aria-pressed={selected === c.round}
            >
              <div className="flex-between">
                <span className="eyebrow">R{String(c.round).padStart(2, '0')}</span>
                <span>
                  <CountryFlag value={c.flag} />
                </span>
              </div>
              <h3>{c.country}</h3>
              <p>{c.name}</p>
              <div className="flex-between">
                <strong>
                  {new Date(c.date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </strong>
                {complete ? (
                  <Check size={16} className="green" />
                ) : c.round === save.round ? (
                  <Badge tone="red-tag">PRÓXIMO</Badge>
                ) : (
                  <span className="muted">14:00 UTC</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
export function SeasonPage() {
  const { driverById, circuits, news, recentChampions } = useUniverse();
  const { save } = useSave();
  const races = completedRaces(save);
  return (
    <>
      <PageTitle
        eyebrow={'SEASON JOURNAL / 2029'.replaceAll('2029', String(save.season))}
        title="Um universo em movimento."
        subtitle="Acompanhe o campeonato e as histórias que definem a nova era."
        action={
          <Link href="/fim-de-semana" className="button primary">
            Continuar temporada <ArrowRight size={16} />
          </Link>
        }
      />
      {save.career.started && <CareerHub />}
      <CareerOffice />
      <div className="season-metrics">
        <div>
          <small>GRANDES PRÊMIOS</small>
          <strong>
            {races}
            <span> / {circuits.length}</span>
          </strong>
        </div>
        <div>
          <small>EQUIPES</small>
          <strong>16</strong>
        </div>
        <div>
          <small>PILOTOS</small>
          <strong>32</strong>
        </div>
        <div>
          <small>ERA TÉCNICA</small>
          <strong>
            V8 <span>HYBRID</span>
          </strong>
        </div>
      </div>
      <section className="panel">
        <SectionHead title="Diário de resultados" sub="RESULTADOS SIMULADOS DO SAVE" />
        {races === 0 ? (
          <EmptyState
            title="Todas as possibilidades estão abertas."
            text="GP1 ainda não realizado. Nenhuma vitória, pole ou pontuação foi inventada."
          />
        ) : (
          <div className="race-history">
            {save.weekends
              .filter((w) => w.results.GP)
              .map((w) => (
                <div key={w.round}>
                  <span className="position">{String(w.round).padStart(2, '0')}</span>
                  <div>
                    <strong>
                      <CountryFlag value={circuits[w.round - 1].flag} />{' '}
                      {circuits[w.round - 1].name}
                    </strong>
                    <small>Vencedor: {driverById[w.results.GP![0].driverId].name}</small>
                  </div>
                  <Badge>{w.results.GP![0].points} PTS NO GP</Badge>
                </div>
              ))}
          </div>
        )}
      </section>
      <SectionHead title="Notícias do paddock" sub="ARQUIVO EDITORIAL DO UNIVERSO" />
      <div className="home-news all-news">
        {news.slice(1).map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
      <section className="legacy-strip">
        {recentChampions.map((c) => (
          <div key={c.year}>
            <span>{c.year}</span>
            <h3>{c.driver}</h3>
            <p>{c.team}</p>
          </div>
        ))}
        <div>
          <span>{save.season}</span>
          <h3>Nova era</h3>
          <p>O capítulo é seu.</p>
        </div>
      </section>
    </>
  );
}
export function RegulationsPage() {
  const { drivers } = useUniverse();
  return (
    <>
      <PageTitle
        eyebrow="TECHNICAL & SPORTING CODE / 2029"
        title="As regras mudaram. Tudo mudou."
        subtitle="Regulamento do universo fictício F1 Universe — não corresponde às regras oficiais da Fórmula 1."
      />
      <section className="regulation-hero">
        <div>
          <span className="eyebrow">O COMEÇO DE OUTRA ERA</span>
          <h2>
            MENOR.
            <br />
            MAIS HUMANO.
            <br />
            <span>MAIS INTENSO.</span>
          </h2>
        </div>
        <div className="regulation-numbers">
          <div>
            <strong>V8</strong>
            <span>HÍBRIDO · BATERIA DE ALTA POTÊNCIA</span>
          </div>
          <div>
            <strong>
              1,78<span>m</span>
            </strong>
            <span>LARGURA</span>
          </div>
          <div>
            <strong>
              4,65<span>m</span>
            </strong>
            <span>COMPRIMENTO</span>
          </div>
        </div>
      </section>
      <div className="rule-cards">
        {[
          {
            title: 'Aerodinâmica ativa',
            text: 'Corner Mode: carga nas curvas. Flow Mode: equilíbrio. Straight Mode: eficiência em reta. Follow Mode: aproximação e disputa.',
          },
          {
            title: 'O piloto volta ao centro',
            text: 'Sem DRS tradicional, sem ABS e sem controle de tração. Precisão, erro humano e gestão de energia fazem a diferença.',
          },
          {
            title: 'A escala da nova era',
            text: '16 equipes, 32 pilotos e 35 GPs. Projetos independentes de motor, quatro fabricantes de pneus e um mercado separado de baterias.',
          },
        ].map((r) => (
          <section key={r.title} className="panel padded">
            <h3>{r.title}</h3>
            <p>{r.text}</p>
          </section>
        ))}
      </div>
      <SectionHead title="Classificação: sobreviver. Avançar. Atacar." sub="ROAD TO POLE" />
      <div className="quali-format">
        {regulations.qualifying.map((q) => (
          <section key={q.session}>
            <span>{q.session}</span>
            <h3>
              {q.entrants}
              <small>PILOTOS</small>
            </h3>
            <p>
              {q.session === 'Q3'
                ? 'Disputa pela pole · +2 pontos'
                : `${q.eliminated} eliminados · ${q.advance} avançam`}
            </p>
          </section>
        ))}
      </div>
      <SprintGrid grid={drivers.map((d) => d.id)} />
      <div className="two-col">
        <PointsTable
          title="Grand Prix"
          points={regulations.gpPoints}
          notes="Pole +2 · Volta mais rápida +1, independentemente da posição final."
        />
        <PointsTable
          title="Sprint"
          points={regulations.sprintPoints}
          notes="Maior ganho positivo de posições +1. Em empate, todos os empatados recebem o bônus. Grid de domingo preservado."
        />
      </div>
      <ProjectionNote>
        Decisão provisória do protótipo: empate no maior ganho da Sprint premia todos os empatados;
        sem ganho positivo, não há bônus. Empates no campeonato são resolvidos por vitórias e,
        depois, quantidade de P2, P3 e demais posições em GPs. A melhor equipe do fim de semana
        recebe +2 somente nos construtores; empate desse bônus usa identificador estável. DNF/DSQ
        não pontuam.
      </ProjectionNote>
    </>
  );
}
function PointsTable({ title, points, notes }: { title: string; points: number[]; notes: string }) {
  return (
    <section className="panel">
      <SectionHead title={title} sub="PONTUAÇÃO" />
      <div className="points-grid">
        {points.map((p, i) => (
          <div key={i}>
            <span>P{i + 1}</span>
            <strong>{p}</strong>
          </div>
        ))}
      </div>
      <p className="table-note">{notes}</p>
    </section>
  );
}
