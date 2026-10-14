'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSave, useUniverse } from '../components/save-provider';
import { PersonPortrait } from '../components/person-portrait';
import { PageTitle, SectionHead } from '../components/ui';
import { nextSession, getWeekend, participation } from '../domain/simulation';
import { updateCareerSettings } from '../domain/gameplay/career';
import {
  applyProfile,
  ASSISTS,
  DISTANCES,
  presetSettings,
  settingsOf,
  SLIDERS,
  type CareerSettings,
  type Preset,
} from '../domain/gameplay/settings';
import { circuitGeometry, trackBounds } from '../presentation/circuit-geometry';
import { seasonPulse } from '../presentation/season-pulse';
import { championshipChase } from '../presentation/championship-chase';
import { raceMomentum } from '../presentation/race-momentum';
import { paddockIntelligence, type PaddockSignal } from '../presentation/paddock-intelligence';
import { academyTalentWatch } from '../presentation/feeder-career';
import type { Save } from '../domain/types';
/** Championship row of the career: the driver in driver mode, the team otherwise. */
function standing(save: Save) {
  const g = save.game,
    driver = save.career.mode === 'driver' && save.career.driverId;
  const table = driver
      ? [...g.drivers].sort((a, b) => save.driverPoints[b.id] - save.driverPoints[a.id])
      : [...g.teams].sort((a, b) => g.teamPoints[b.id] - g.teamPoints[a.id]),
    id = driver || save.managedTeam;
  return {
    position: table.findIndex((x) => x.id === id) + 1,
    points: driver ? (save.driverPoints[driver] ?? 0) : (g.teamPoints[save.managedTeam] ?? 0),
  };
}
/** GP finishes of the career's cars, newest last. Read from saved results only. */
function careerResults(save: Save) {
  const driver = save.career.mode === 'driver' ? save.career.driverId : null;
  return save.weekends
    .filter((w) => w.results.GP)
    .map((w) => {
      const rows = w.results.GP!.filter((r) =>
        driver ? r.driverId === driver : r.teamId === save.managedTeam,
      );
      const best = [...rows].sort((a, b) => a.position - b.position)[0];
      return best && { round: w.round, position: best.position, dnf: best.status === 'DNF' };
    })
    .filter((x): x is { round: number; position: number; dnf: boolean } => !!x);
}
const HOW: Record<string, string> = {
  live: 'JOGAR',
  simulate: 'SIMULAR',
  auto: 'SIMULAR TREINOS',
  highlights: 'HIGHLIGHTS',
  instant: 'RESULTADO INSTANTÂNEO',
};
/** The career's front page: who you are, where the season stands and the one main action. */
export function CareerHub() {
  const { save } = useSave(),
    { driverById, teamById } = useUniverse();
  const [insightFilter, setInsightFilter] = useState<'Visão geral' | 'Prioridades' | PaddockSignal['group']>('Visão geral');
  const g = save.game,
    team = teamById[save.managedTeam],
    driverId = save.career.mode === 'driver' ? save.career.driverId : null,
    faces = driverId
      ? [driverId]
      : g.drivers.filter((d) => d.teamId === save.managedTeam).map((d) => d.id),
    session = nextSession(save),
    circuit = g.circuits[Math.min(save.round, g.circuits.length) - 1],
    { position, points } = standing(save),
    form = careerResults(save).slice(-5),
    live = save.race?.status === 'RUNNING',
    weekend = getWeekend(save),
    started = Object.keys(weekend.results).length > 0;
  const art = useMemo(() => {
    const geometry = circuitGeometry(circuit),
      b = trackBounds(geometry, 16);
    return { d: geometry.path, box: `${b.x} ${b.y} ${b.w} ${b.h}` };
  }, [circuit]);
  const pulse = seasonPulse(save);
  const chase = championshipChase(save);
  const momentum = raceMomentum(save);
  const intelligence = useMemo(() => paddockIntelligence(save), [save]);
  const feeder = useMemo(() => academyTalentWatch(save), [save]);
  const visibleInsights = insightFilter === 'Visão geral'
    ? intelligence.signals.slice(0, 9)
    : insightFilter === 'Prioridades'
      ? intelligence.signals.filter((signal) => signal.priority !== 'info').slice(0, 9)
      : intelligence.signals.filter((signal) => signal.group === insightFilter).slice(0, 9);
  return (
    <section
      className="career-hub"
      style={{ '--team': team.color } as React.CSSProperties}
      aria-label="Central da carreira"
    >
      <div className="hub-identity">
        <div className="hub-faces">
          {faces.map((id) => (
            <PersonPortrait
              key={id}
              personId={id}
              name={driverById[id]?.name}
              size={faces.length > 1 ? 104 : 148}
              focus="face"
              showTeamAccent={team.color}
              eager
              fictional={id.startsWith('junior-')}
            />
          ))}
        </div>
        <div>
          <span className="eyebrow">
            TEMPORADA {save.season} · {save.career.mode === 'driver' ? 'PILOTO' : 'CHEFE DE EQUIPE'}
          </span>
          <h1>{save.career.name}</h1>
          <p className="hub-team">{team.name}</p>
          <dl className="hub-numbers">
            <div>
              <dt>CAMPEONATO</dt>
              <dd>P{position}</dd>
            </div>
            <div>
              <dt>PONTOS</dt>
              <dd>{points}</dd>
            </div>
            <div>
              <dt>ROUND</dt>
              <dd>
                {String(Math.min(save.round, g.circuits.length)).padStart(2, '0')}
                <small>/{g.circuits.length}</small>
              </dd>
            </div>
            <div>
              <dt>FORMA</dt>
              <dd className="hub-form">
                {form.length
                  ? form.map((f) => (
                      <span
                        key={f.round}
                        className={f.dnf ? 'dnf' : f.position <= 3 ? 'podium' : ''}
                      >
                        {f.dnf ? 'DNF' : 'P' + f.position}
                      </span>
                    ))
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="hub-next">
        <svg viewBox={art.box} aria-hidden="true">
          <path d={art.d} fill="none" stroke="#0a1512" strokeWidth="26" strokeLinejoin="round" />
          <path
            d={art.d}
            fill="none"
            stroke="var(--team)"
            strokeWidth="13"
            strokeLinejoin="round"
          />
          <path d={art.d} fill="none" stroke="#f3f6f7" strokeWidth="1.2" strokeDasharray="5 12" />
        </svg>
        <div>
          <span className="eyebrow">PRÓXIMO EVENTO</span>
          {session ? (
            <>
              <strong className="hub-round">
                ROUND {String(save.round).padStart(2, '0')}/{g.circuits.length} · {circuit.country}
              </strong>
              <h2>{circuit.name}</h2>
              <p>
                <b>{live ? save.race!.session : session}</b> · {HOW[participation(save, session)]}
              </p>
              <Link className="button primary hub-action" href="/fim-de-semana">
                {live
                  ? 'VOLTAR À CORRIDA'
                  : started
                    ? 'CONTINUAR FIM DE SEMANA'
                    : 'INICIAR FIM DE SEMANA'}{' '}
                →
              </Link>
            </>
          ) : weekend.results.GP && g.phase !== 'postseason' && save.round <= g.circuits.length ? (
            <>
              <strong className="hub-round">
                ROUND {String(save.round).padStart(2, '0')}/{g.circuits.length} · {circuit.country}
              </strong>
              <h2>GP concluído</h2>
              <p>Veja o resultado e avance para o próximo round.</p>
              <Link className="button primary hub-action" href="/fim-de-semana">
                FECHAR FIM DE SEMANA →
              </Link>
            </>
          ) : (
            <>
              <h2>Temporada encerrada</h2>
              <Link className="button primary hub-action" href="/fim-de-semana">
                VER FECHAMENTO →
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="hub-menu" aria-label="Menu da carreira">
        {(
          [
            ['/fim-de-semana', 'Próximo evento'],
            ['/calendario', 'Calendário'],
            ['/classificacao', 'Campeonato'],
            [
              driverId ? '/pilotos/' + driverId : '/equipes/' + save.managedTeam,
              driverId ? 'Meu piloto' : 'Perfil',
            ],
            ['/equipes/' + save.managedTeam, 'Equipe'],
            ['/mercado', 'Mercado'],
            ['/f2', 'Fórmula 2'],
            ['/f3', 'Fórmula 3'],
            ['/substituicoes', 'Assentos F1'],
            ['/estatisticas', 'Estatísticas'],
            ['/historia', 'Histórico'],
            ['/carreira', 'Configurações da carreira'],
          ] as const
        ).map(([href, label], i) => (
          <Link key={label} href={href} className={i === 0 ? 'main' : ''}>
            <small>{String(i + 1).padStart(2, '0')}</small>
            {label}
          </Link>
        ))}
      </nav>
      <section className="hub-world" aria-label="Panorama do universo">
        <div className="hub-world-header">
          <div>
            <span className="eyebrow">PADDOCK EM MOVIMENTO</span>
            <h2>O mundo não para</h2>
          </div>
          <Link href="/temporada">Ver temporada →</Link>
        </div>
        <div className="hub-world-grid">
          <div className="hub-world-column">
            <div className="hub-world-title"><strong>CAMPEONATO</strong><span>{pulse.completed}/{pulse.total} GPs</span></div>
            <div className="hub-progress" role="progressbar" aria-label="Progresso do campeonato" aria-valuemin={0} aria-valuemax={pulse.total} aria-valuenow={pulse.completed}>
              <span style={{ width: `${pulse.total ? (pulse.completed / pulse.total) * 100 : 0}%` }} />
            </div>
            {pulse.standings.length ? (
              <ol className="hub-world-standings">
                {pulse.standings.map((driver) => <li key={driver.id}>
                  <span className="hub-world-rank">{driver.position.toString().padStart(2, '0')}</span>
                  <Link href={`/pilotos/${driver.id}`}>{driver.name}</Link>
                  <b>{driver.points} pts</b>
                </li>)}
              </ol>
            ) : <p className="hub-world-empty">A disputa começa no primeiro GP. Nenhum líder foi definido.</p>}
            {pulse.lastWinner && <p className="hub-world-detail">Último vencedor: <strong>{pulse.lastWinner}</strong></p>}
          </div>
          <div className="hub-world-column">
            <div className="hub-world-title"><strong>PRÓXIMAS PARADAS</strong><Link href="/calendario">Calendário →</Link></div>
            {pulse.upcoming.length ? <ol className="hub-world-calendar">
              {pulse.upcoming.map((circuit) => <li key={circuit.id}>
                <span>R{String(circuit.round).padStart(2, '0')}</span>
                <div><strong>{circuit.name}</strong><small>{circuit.country}</small></div>
              </li>)}
            </ol> : <p className="hub-world-empty">Não há mais GPs a disputar nesta temporada.</p>}
          </div>
          <div className="hub-world-column">
            <div className="hub-world-title"><strong>ÚLTIMAS NOTÍCIAS</strong><Link href="/caixa-de-entrada">Ver todas →</Link></div>
            {pulse.news.length ? <ul className="hub-world-news">
              {pulse.news.map((item) => <li key={item.id}>
                <small>GP {item.round} · {item.category.toUpperCase()}</small>
                <strong>{item.title}</strong>
              </li>)}
            </ul> : <p className="hub-world-empty">O paddock ainda não registrou notícias nesta temporada.</p>}
          </div>
          <div className="hub-world-column hub-chase">
            <div className="hub-world-title"><strong>DISPUTA NO CAMPEONATO</strong><Link href="/classificacao">Tabela →</Link></div>
            {chase ? <>
              <div className="hub-chase-identity">
                {chase.mode === 'driver' && <PersonPortrait personId={chase.id} name={chase.name} size={56} focus="face" fictional={chase.id.startsWith('junior-')} showTeamAccent={teamById[driverById[chase.id]?.teamId]?.color} />}
                <div><small>{chase.direction === 'ahead' ? 'À SUA FRENTE' : chase.direction === 'behind' ? 'ATRÁS DE VOCÊ' : 'EMPATADO EM PONTOS'}</small>
                  <Link href={chase.mode === 'driver' ? `/pilotos/${chase.id}` : `/equipes/${chase.id}`}>{chase.name}</Link>
                  <span>P{chase.position} · {chase.points} pontos</span>
                </div>
              </div>
              <strong className="hub-chase-gap">{chase.gap} <small>pontos de diferença</small></strong>
              {chase.duels.length ? <div className="hub-chase-duels" aria-label="Últimos confrontos em corridas concluídas">
                {chase.duels.map((duel) => <span key={duel.round} className={duel.outcome} title={`GP ${duel.round}`} aria-label={`GP ${duel.round}: ${duel.outcome === 'win' ? 'à frente' : duel.outcome === 'loss' ? 'atrás' : 'empatado'}`}>
                  {duel.outcome === 'win' ? 'V' : duel.outcome === 'loss' ? 'D' : 'E'}
                </span>)}
              </div> : <p className="hub-world-empty">Ainda sem chegada comparável entre vocês.</p>}
            </> : <p className="hub-world-empty">A disputa aparecerá após o primeiro GP concluído.</p>}
          </div>
          <div className="hub-world-column hub-race-momentum">
            <div className="hub-world-title"><strong>RITMO NO CAMPEONATO</strong><Link href="/estatisticas">Estatísticas →</Link></div>
            {momentum.rounds.length ? <>
              <div className="hub-momentum-head"><strong>{momentum.points} <small>pontos</small></strong><span>nos últimos {momentum.rounds.length} GPs</span></div>
              <ol className="hub-momentum-bars" aria-label="Pontuação nas últimas corridas">
                {momentum.rounds.map((item) => <li key={item.round}>
                  <span>R{item.round}</span><div className="hub-momentum-track" role="meter" aria-label={`GP ${item.round}: ${item.points} pontos`} aria-valuemin={0} aria-valuemax={Math.max(1, momentum.best)} aria-valuenow={item.points}><i style={{ width: `${momentum.best ? (item.points / momentum.best) * 100 : 0}%` }} /></div><b>{item.points}</b>
                </li>)}
              </ol>
              {momentum.delta !== null && <p className="hub-world-detail">Variação frente ao GP anterior: <strong>{momentum.delta > 0 ? '+' : ''}{momentum.delta} pts</strong></p>}
            </> : <p className="hub-world-empty">Os pontos por corrida aparecerão após a primeira bandeirada.</p>}
          </div>
          <div className="hub-world-column hub-feeder">
            <div className="hub-world-title"><strong>CAMINHO PARA A F1 · F2</strong><Link href="/f2">Ver campeonato →</Link></div>
            <div className="hub-feeder-progress"><b>{feeder.completed}/{feeder.total}</b><span>etapas concluídas</span></div>
            {feeder.top ? <>
              <div className="hub-feeder-driver">
                <PersonPortrait personId={feeder.top.id} name={feeder.top.name} size={49} fictional />
                <div><small>DESTAQUE DA SUA ACADEMIA</small><Link href={`/pilotos/${feeder.top.id}`}>{feeder.top.name}</Link><span>P{feeder.top.position} · {feeder.top.points} pts · {feeder.academyDrivers} inscritos</span></div>
              </div>
              <p className="hub-world-detail">Superlicença: <strong>{feeder.pointsToLicense === 0 ? 'elegível' : `faltam ${feeder.pointsToLicense} pontos`}</strong></p>
              {feeder.trend.length > 0 && <div className="hub-feeder-trend" aria-label="Pontos nas últimas etapas da F2">
                {feeder.trend.map((item) => <span key={item.round} title={`Etapa ${item.round}: ${item.points} pontos`}><i style={{ height: `${Math.max(8, item.points / 35 * 100)}%` }} /><small>{item.points}</small></span>)}
              </div>}
            </> : <p className="hub-world-empty">Sua equipe não tem pilotos no grid atual da F2. Consulte talentos independentes.</p>}
            {feeder.leader && <p className="hub-world-detail">Líder: <strong>{feeder.leader.name}</strong> · {feeder.leader.points} pts</p>}
            {feeder.next && <p className="hub-world-detail">Próxima rodada: <strong>{feeder.next.circuitName}</strong></p>}
            {!feeder.next && feeder.total > 0 && <p className="hub-world-detail">Calendário da F2 concluído.</p>}
          </div>
        </div>
      </section>
      <section className="paddock-intelligence" aria-label="Central de decisões da carreira">
        <header className="paddock-intelligence-head">
          <div>
            <span className="eyebrow">PAINEL ESTRATÉGICO · {intelligence.season}</span>
            <h2>Decisões do paddock</h2>
            <p>Alertas derivados de contratos, dados esportivos e acontecimentos do seu save.</p>
          </div>
          <div className="paddock-intelligence-summary" aria-live="polite">
            <strong>{intelligence.attention}</strong><span>pontos de atenção</span>
            {intelligence.urgent > 0 && <strong className="urgent">{intelligence.urgent} urgentes</strong>}
          </div>
        </header>
        <div className="paddock-insight-filters" role="group" aria-label="Filtrar informações do paddock">
          {(['Visão geral', 'Prioridades', 'Pista', 'Equipe', 'Mercado', 'Mundo'] as const).map((group) => (
            <button key={group} type="button" aria-pressed={insightFilter === group}
              className={insightFilter === group ? 'selected' : ''} onClick={() => setInsightFilter(group)}>{group}</button>
          ))}
        </div>
        <div className="paddock-insight-grid" aria-live="polite">
          {visibleInsights.map((signal) => (
            <Link href={signal.href} key={signal.id} className={`paddock-insight ${signal.priority}`}>
              <span className="paddock-insight-type">{signal.group} · {signal.priority === 'urgent' ? 'URGENTE' : signal.priority === 'attention' ? 'ATENÇÃO' : 'INFORMAÇÃO'}</span>
              <strong>{signal.title}</strong>
              <p>{signal.description}</p>
              <span className="paddock-insight-bottom"><b>{signal.value ?? 'Ver detalhes'}</b><span aria-hidden="true">VER →</span></span>
            </Link>
          ))}
          {!visibleInsights.length && <p className="paddock-insight-empty">{insightFilter === 'Prioridades' ? 'Nenhuma ação pendente detectada nos dados disponíveis. Consulte as áreas para acompanhar o mundo.' : 'Nenhum acontecimento registrado nesta área até o momento.'}</p>}
        </div>
      </section>
    </section>
  );
}
/** Career numbers summed from what the save already records. */
export function CareerStats() {
  const { save } = useSave();
  const g = save.game,
    driver = save.career.mode === 'driver' ? save.career.driverId : null,
    s = driver ? g.stats[driver] : g.teamStats[save.managedTeam],
    results = careerResults(save),
    finishes = results.filter((r) => !r.dnf).map((r) => r.position),
    past = g.history
      .map((a) => {
        const table = Object.entries(driver ? a.points : a.teamPoints).sort((x, y) => y[1] - x[1]);
        return table.findIndex(([id]) => id === (driver || save.managedTeam)) + 1;
      })
      .filter((p) => p > 0),
    best = Math.min(standing(save).position, ...past);
  if (!s) return null;
  return (
    <section className="panel padded">
      <SectionHead title="Estatísticas da carreira" sub={save.career.name.toUpperCase()} />
      <dl className="career-stats">
        {(
          [
            ['Largadas', s.starts],
            ['Vitórias', s.wins],
            ['Pódios', s.podiums],
            ['Poles', s.poles],
            ['Voltas mais rápidas', s.fastestLaps],
            ['Pontos', s.points],
            ['Abandonos', s.dnfs],
            ['Melhor chegada', finishes.length ? 'P' + Math.min(...finishes) : '—'],
            ['Melhor campeonato', 'P' + best],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
const PRESET_NOTE: Record<Preset, string> = {
  CASUAL: 'IA mais branda, menos desgaste e falhas, todas as ajudas e números exatos.',
  NORMAL: 'O equilíbrio padrão do motor.',
  PRO: 'IA estrategista, danos maiores e menos assistência.',
  SIMULATION: 'IA no melhor nível, desgaste e falhas realistas, estimativas em vez de números.',
  CUSTOM: 'Você ajustou os valores manualmente.',
};
const SESSION_OPTIONS = {
  practice: [
    ['watch', 'Assistir'],
    ['simulate', 'Simular'],
    ['auto', 'Simular automaticamente'],
  ],
  qualifying: [
    ['play', 'Jogar'],
    ['simulate', 'Simular'],
  ],
  sprint: [
    ['play', 'Jogar'],
    ['simulate', 'Simular'],
  ],
  gp: [
    ['play', 'Jogar'],
    ['simulate', 'Simular'],
    ['highlights', 'Highlights'],
    ['instant', 'Resultado instantâneo'],
  ],
} as const;
const SESSION_LABEL = {
  practice: 'Treinos',
  qualifying: 'Classificação',
  sprint: 'Sprint',
  gp: 'GP',
};
/** Editor shared by the career settings page and the new-career form. */
export function CareerSettingsEditor({
  value,
  onChange,
  compact = false,
}: {
  value: CareerSettings;
  onChange: (next: CareerSettings) => void;
  compact?: boolean;
}) {
  // Any manual change turns the career CUSTOM and that mark stays on the save.
  const tweak = (patch: Partial<CareerSettings>) =>
    onChange({ ...value, ...patch, preset: 'CUSTOM', custom: true });
  return (
    <div className={'career-settings' + (compact ? ' compact' : '')}>
      <fieldset>
        <legend>Preset</legend>
        <div className="segmented" role="group" aria-label="Preset de dificuldade">
          {(['CASUAL', 'NORMAL', 'PRO', 'SIMULATION', 'CUSTOM'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={value.preset === p ? 'selected' : ''}
              aria-pressed={value.preset === p}
              disabled={p === 'CUSTOM' && value.preset !== 'CUSTOM'}
              onClick={() =>
                p !== 'CUSTOM' &&
                onChange({
                  ...presetSettings(p),
                  custom: value.custom,
                  distance: value.distance,
                  sessions: value.sessions,
                  profile: value.profile,
                  speed: value.speed,
                })
              }
            >
              {p === 'SIMULATION' ? 'SIMULAÇÃO' : p}
            </button>
          ))}
        </div>
        <p className="micro">
          {PRESET_NOTE[value.preset]}
          {value.custom && value.preset !== 'CUSTOM' ? ' Esta carreira já foi personalizada.' : ''}
        </p>
      </fieldset>
      <fieldset>
        <legend>Perfil de experiência</legend>
        <div className="segmented" role="group" aria-label="Perfil de experiência">
          {(
            [
              ['watch', 'Quero acompanhar tudo'],
              ['moments', 'Quero jogar os momentos importantes'],
              ['manage', 'Quero gerenciar e simular mais'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={value.profile === id ? 'selected' : ''}
              aria-pressed={value.profile === id}
              onClick={() => onChange(applyProfile(value, id))}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Distância da corrida</legend>
        <div className="segmented" role="group" aria-label="Distância da corrida">
          {DISTANCES.map((d) => (
            <button
              key={d}
              type="button"
              className={value.distance === d ? 'selected' : ''}
              aria-pressed={value.distance === d}
              onClick={() => onChange({ ...value, distance: d })}
            >
              {d}%
            </button>
          ))}
        </div>
        <p className="micro">
          Desgaste, combustível e janelas de pit acompanham a distância escolhida.
        </p>
      </fieldset>
      <fieldset>
        <legend>Participação nas sessões</legend>
        <div className="settings-grid">
          {(Object.keys(SESSION_OPTIONS) as (keyof typeof SESSION_OPTIONS)[]).map((key) => (
            <label key={key}>
              {SESSION_LABEL[key]}
              <select
                aria-label={'Participação: ' + SESSION_LABEL[key]}
                value={value.sessions[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    sessions: { ...value.sessions, [key]: e.target.value },
                  } as CareerSettings)
                }
              >
                {SESSION_OPTIONS[key].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Velocidade inicial
            <select
              aria-label="Velocidade da carreira"
              value={value.speed}
              onChange={(e) =>
                onChange({ ...value, speed: Number(e.target.value) as CareerSettings['speed'] })
              }
            >
              {[0.5, 0.75, 1, 2, 4, 8, 16].map((v) => (
                <option key={v} value={v}>
                  {v === 0.5 ? '0,50' : v === 0.75 ? '0,75' : v}×
                </option>
              ))}
              <option value={0}>AUTO</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Assistências</legend>
        <div className="settings-grid toggles">
          {ASSISTS.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={value.assists[key]}
                onChange={(e) => tweak({ assists: { ...value.assists, [key]: e.target.checked } })}
              />{' '}
              {label}
            </label>
          ))}
          <label>
            Rádio
            <select
              aria-label="Detalhe do rádio"
              value={value.radio}
              onChange={(e) =>
                onChange({ ...value, radio: e.target.value as CareerSettings['radio'] })
              }
            >
              <option value="MINIMAL">Mínimo</option>
              <option value="TV">TV</option>
              <option value="TECHNICAL">Técnico</option>
            </select>
          </label>
          <label>
            Informação
            <select
              aria-label="Precisão da informação"
              value={value.information}
              onChange={(e) =>
                tweak({ information: e.target.value as CareerSettings['information'] })
              }
            >
              <option value="precise">Números exatos</option>
              <option value="estimated">Estimativas e intervalos</option>
            </select>
          </label>
        </div>
      </fieldset>
      {!compact && (
        <fieldset>
          <legend>Sliders</legend>
          <div className="slider-list">
            {SLIDERS.map(([key, label, low, high]) => (
              <label key={key}>
                <span>
                  {label}{' '}
                  <b>
                    {value.sliders[key]}
                    {key === 'tyreWear' ? '%' : ''}
                  </b>
                </span>
                <input
                  type="range"
                  aria-label={label}
                  min={key === 'tyreWear' ? 50 : 0}
                  max={key === 'tyreWear' ? 150 : 100}
                  step={5}
                  value={value.sliders[key]}
                  onChange={(e) =>
                    tweak({ sliders: { ...value.sliders, [key]: Number(e.target.value) } })
                  }
                />
                <small>
                  <span>{low}</span>
                  <span>{high}</span>
                </small>
              </label>
            ))}
          </div>
          <p className="micro">
            Os sliders mudam frequência de eventos e qualidade das decisões da IA. As notas dos
            pilotos e carros nunca são alteradas.
          </p>
        </fieldset>
      )}
    </div>
  );
}
export function CareerSettingsPage() {
  const { save, update, saving } = useSave();
  const settings = settingsOf(save),
    racing = save.race?.status === 'RUNNING';
  return (
    <>
      <PageTitle
        eyebrow={`CAREER SETTINGS · ${save.season}`}
        title="Configurações da carreira"
        subtitle="Fazem parte do save e podem ser alteradas a qualquer momento."
        action={
          <Link href="/temporada" className="button secondary">
            ← Central da carreira
          </Link>
        }
      />
      <section className="panel padded">
        <SectionHead
          title={settings.preset === 'SIMULATION' ? 'SIMULAÇÃO' : settings.preset}
          sub={
            (settings.custom ? 'CARREIRA PERSONALIZADA · ' : '') + (saving ? 'SALVANDO…' : 'SALVO')
          }
        />
        {racing && (
          <p className="micro">
            Há uma sessão em andamento: a distância só muda a partir da próxima corrida.
          </p>
        )}
        <CareerSettingsEditor
          value={settings}
          onChange={(next) => update((s) => updateCareerSettings(s, next))}
        />
      </section>
      <CareerStats />
    </>
  );
}
