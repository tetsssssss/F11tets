'use client';
import { useUniverse } from '../components/save-provider';
import { CountryFlag } from '../components/country-flag';
import { RacePlan, Postseason } from './career';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CloudSun,
  Wind,
  Droplets,
  Gauge,
  ShieldAlert,
  Play,
  Flag,
  ArrowDownUp,
} from 'lucide-react';
import { useSave } from '../components/save-provider';
import { PageTitle, Badge, Tabs, EmptyState, SectionHead } from '../components/ui';
import { CircuitMap } from '../components/visuals';

import LiveRace from './live-race';
import { AdvancedSetup } from './universe';
import { beginLiveSession, participation, playNextSession } from '../domain/simulation';
import { sessions } from '../data/regulations';
import {
  getWeekend,
  nextSession,
  runNextSession,
  advanceRound,
  invertSprintGrid,
} from '../domain/simulation';
import type { Session } from '../domain/types';
const Race2D = dynamic(() => import('./race'), {
  loading: () => <div className="panel padded">Preparando race control…</div>,
});
export function SprintGrid({ grid, official = false }: { grid: string[]; official?: boolean }) {
  const { driverById, teamById } = useUniverse();
  const inverted = invertSprintGrid(grid);
  return (
    <section className="panel sprint-grid">
      <SectionHead
        title="Invertemos os grupos. Não o grid inteiro."
        sub={
          official ? 'GRID DA SPRINT • QUALIFICAÇÃO DO SAVE' : 'EXEMPLO DIDÁTICO • AGUARDANDO Q3'
        }
      />
      <div className="sprint-groups">
        {[
          [0, 10],
          [10, 20],
          [20, 32],
        ].map(([start, end], index) => (
          <div className="sprint-group" key={start}>
            <span className="eyebrow">
              GRUPO {index + 1} / P{start + 1}–P{end}
            </span>
            <div className="sprint-column-head">
              <span>QUALI</span>
              <ArrowDownUp size={14} />
              <span>SPRINT</span>
            </div>
            {inverted.slice(start, end).map((id, i) => (
              <div className="sprint-pair" key={id}>
                <span>P{grid.indexOf(id) + 1}</span>
                <strong style={{ borderLeftColor: teamById[driverById[id].teamId].color }}>
                  {driverById[id].short}
                </strong>
                <ArrowRight size={12} />
                <b>P{start + i + 1}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="table-note">
        O grid de domingo mantém a ordem da classificação. A Sprint não altera esse grid.
      </p>
    </section>
  );
}
export default function WeekendPage() {
  const { drivers, driverById, teamById, circuits } = useUniverse();
  const { save, update, ready, notify } = useSave();
  const [tab, setTab] = useState('sessions');
  const weekend = getWeekend(save);
  const next = nextSession(save);
  const [selected, setSelected] = useState<Session | null>(null);
  const current = selected ?? next ?? 'GP';
  const circuit = circuits[Math.min(save.round, circuits.length) - 1];
  const results = weekend.results[current];
  const finished = save.round > circuits.length || save.game.phase === 'postseason';
  function run() {
    if (!next) return;
    setSelected(next);
    const how = participation(save, next);
    update(playNextSession);
    notify(
      how === 'live' || how === 'highlights'
        ? 'Sessão pronta. Retome para largar.'
        : how === 'simulate'
          ? 'Simulação em 16×: acompanhe ou feche quando quiser.'
          : how === 'auto'
            ? 'Treinos concluídos. Resultados simulados salvos.'
            : `${next} concluído. Resultado simulado salvo.`,
    );
  }
  if (save.race && save.race.round === save.round) return <LiveRace />;
  if (finished)
    return (
      <>
        <PageTitle
          eyebrow={'SEASON COMPLETE / 2029'.replaceAll('2029', String(save.season))}
          title="A primeira história está escrita."
          subtitle={`${circuits.length} Grandes Prêmios concluídos neste save.`}
        />
        <Postseason />
        <Link href="/classificacao" className="button primary">
          Ver classificação final <ArrowRight size={16} />
        </Link>
        <EmptyState
          title="Temporada encerrada"
          text="Prepare a próxima temporada e mantenha toda a história da carreira."
        />
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow={`RACE WEEKEND / ROUND ${String(circuit.round).padStart(2, '0')}`}
        title={`GP • ${circuit.country}`}
        subtitle={`${circuit.name} · ${circuit.city} · ${new Date(circuit.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
        action={
          <Badge tone="green-tag">{weekend.results.GP ? 'GP CONCLUÍDO' : 'SIMULAÇÃO LOCAL'}</Badge>
        }
      />
      <section className="weekend-banner panel">
        <div>
          <span className="eyebrow">
            <CountryFlag value={circuit.flag} /> {circuit.country.toUpperCase()}
          </span>
          <h2>{circuit.name}</h2>
          <p>
            {circuit.km.toFixed(3)} km <span className="dot">/</span> {circuit.laps} voltas{' '}
            <span className="dot">/</span> {circuit.corners} curvas
          </p>
          <div className="weather-grid">
            {[
              { icon: CloudSun, value: `${circuit.temperature}°C`, label: 'Temperatura' },
              { icon: Droplets, value: `${circuit.rain}%`, label: 'Chuva' },
              { icon: Gauge, value: `${circuit.grip}%`, label: 'Aderência' },
              { icon: Wind, value: `${circuit.wind} km/h`, label: 'Vento' },
              { icon: ShieldAlert, value: `${circuit.safetyCar}%`, label: 'Safety Car' },
            ].map((x) => (
              <div key={x.label}>
                <x.icon size={18} />
                <strong>{x.value}</strong>
                <small>{x.label}</small>
              </div>
            ))}
          </div>
          <small className="micro">
            CONDIÇÕES SIMULADAS • TRAÇADO CONCEITUAL COMPARTILHADO NESTE PROTÓTIPO
          </small>
        </div>
        <CircuitMap />
      </section>
      <RacePlan />
      <AdvancedSetup />
      {next && next !== 'Sprint' && next !== 'GP' && (
        <button className="button secondary" onClick={() => update(beginLiveSession)}>
          Acompanhar {next} ao vivo
        </button>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'sessions', label: 'Sessões & resultados' },
          { id: 'sprint', label: 'Grid invertido da Sprint' },
          { id: 'race', label: 'Corrida 2D' },
        ]}
      />
      {tab === 'sessions' && (
        <>
          <div className="session-timeline">
            {sessions.map((s, i) => (
              <button
                key={s}
                className={`${current === s ? 'selected' : ''} ${weekend.results[s] ? 'completed' : ''}`}
                onClick={() => setSelected(s)}
              >
                <span>
                  {weekend.results[s] ? <Check size={14} /> : String(i + 1).padStart(2, '0')}
                </span>
                <strong>{s}</strong>
                <small>
                  {weekend.results[s] ? 'CONCLUÍDA' : next === s ? 'PRÓXIMA' : 'AGUARDANDO'}
                </small>
              </button>
            ))}
          </div>
          <div className="session-action panel">
            <div>
              <span className="eyebrow">{next ? 'PRÓXIMA SESSÃO' : 'FIM DE SEMANA CONCLUÍDO'}</span>
              <h2>{next ?? 'Até a próxima bandeirada.'}</h2>
              <p>
                {next
                  ? 'Voltas simuladas com clima, estratégia, desgaste, disputa e incidentes.'
                  : 'Pontos de Sprint, pole e GP contabilizados uma única vez.'}
              </p>
            </div>
            {next ? (
              <button className="button primary" onClick={run} disabled={!ready}>
                <Play size={16} /> INICIAR SESSÃO · {next}
              </button>
            ) : (
              <button
                className="button primary"
                onClick={() => {
                  update((s) => advanceRound(s));
                  setSelected(null);
                  notify(save.round === circuits.length ? `Temporada ${save.season} encerrada.` : 'Próximo GP preparado.');
                }}
              >
                {' '}
                {save.round === circuits.length ? 'Encerrar temporada' : 'Avançar para o próximo GP'}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <section className="panel">
            <SectionHead title={`${current} / Resultados`} sub="TIMING SCREEN" />
            {results ? (
              <div className="table-wrap">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>POS</th>
                      <th>PILOTO</th>
                      <th>EQUIPE</th>
                      <th>{current === 'GP' || current === 'Sprint' ? 'TEMPO TOTAL' : 'TEMPO'}</th>
                      <th>STATUS</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const d = driverById[r.driverId];
                      const t = teamById[r.teamId ?? d.teamId];
                      const eliminated =
                        (current === 'Q1' && r.position > 20) ||
                        (current === 'Q2' && r.position > 10);
                      return (
                        <tr key={r.driverId} className={eliminated ? 'eliminated' : ''}>
                          <td className="position">{String(r.position).padStart(2, '0')}</td>
                          <td>
                            <Link className="standing-name" href={`/pilotos/${d.id}`}>
                              <i style={{ background: t.color }} />
                              <strong>{d.name}</strong>
                            </Link>
                          </td>
                          <td className="muted">{t.name}</td>
                          <td className="mono">
                            {Math.floor(r.time / 60)}:{(r.time % 60).toFixed(3).padStart(6, '0')}
                          </td>
                          <td>
                            {r.status === 'DNF' || r.status === 'DSQ' ? (
                              <Badge tone="red-tag">{r.status}</Badge>
                            ) : eliminated ? (
                              <Badge>ELIMINADO</Badge>
                            ) : r.fastestLap ? (
                              <Badge tone="purple-tag">VOLTA RÁPIDA +1</Badge>
                            ) : current === 'Q3' && r.position === 1 ? (
                              <Badge tone="amber-tag">POLE +2</Badge>
                            ) : (
                              <span className="muted">
                                {current === 'Q1' || current === 'Q2'
                                  ? 'AVANÇA'
                                  : current === 'Sprint' && r.gain > 0
                                    ? `↑ ${r.gain} posições`
                                    : '—'}
                              </span>
                            )}
                          </td>
                          <td className="points">{r.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="table-note">
                  {current === 'GP' || current === 'Sprint'
                    ? 'Tempo acumulado da simulação, incluindo boxes e punições. DNF/DSQ não pontuam.'
                    : 'Q1: 20 avançam. Q2: 10 avançam. Q3 define P1–P10 e concede +2 ao pole.'}
                </p>
              </div>
            ) : (
              <EmptyState
                title="O cronômetro ainda não começou."
                text={`Complete as sessões anteriores e inicie ${current} para gerar resultados.`}
              />
            )}
          </section>
        </>
      )}
      {tab === 'sprint' && (
        <SprintGrid
          grid={weekend.qualifyingGrid.length ? weekend.qualifyingGrid : drivers.map((d) => d.id)}
          official={!!weekend.qualifyingGrid.length}
        />
      )}
      {tab === 'race' && (
        <Race2D
          key={circuit.id}
          circuit={circuit}
          results={weekend.results[current]}
          tape={weekend.tapes?.[current]}
          session={current}
        />
      )}
    </>
  );
}
