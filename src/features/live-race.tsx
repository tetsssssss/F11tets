'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSave, useUniverse } from '../components/save-provider';
import { cloneState } from '../domain/simulation/world';
import { tickLive, getWeekend } from '../domain/simulation';
import { controlledIds } from '../domain/gameplay/career';
import type { RaceState } from '../domain/gameplay/types';
import { RaceCommandCard } from './race-command-card';
import LiveMap from './live-map';
import { readRaceViewMode, writeRaceViewMode, type RaceViewMode } from '../presentation/race-view-preference';
import { PersonPortrait } from '../components/person-portrait';
import { resolvePersonPhoto } from '../presentation/person-photo';
import { raceHighlights } from '../presentation/race-presentation';
import { formatRaceGap } from '../presentation/race-gap';
import { raceFeed, type RaceFeedMode } from '../presentation/race-feed';
import { racePulse } from '../presentation/race-pulse';
import { pitwallLive } from '../presentation/pitwall-live';
import { RaceSoundControls } from './race-sound-controls';
import { RaceControl } from './race-control';
import { settingsOf } from '../domain/gameplay/settings';
import { podiumOrder } from '../presentation/race-ceremony';
type Timing = 'expanded' | 'compact' | 'hidden';
export default function LiveRace({
  quickRace = false, onQuickRaceExit,
}: { quickRace?: boolean; onQuickRaceExit?: () => void } = {}) {
  const { save, update, saving, slot } = useSave(),
    { driverById, teamById, circuits } = useUniverse();
  const r = save.race!;
  const [interval, setInterval] = useState(false),
    [narration, setNarration] = useState<string>(settingsOf(save).radio),
    [replay, setReplay] = useState(-1),
    [replaySpeed, setReplaySpeed] = useState(1),
    [renderMode, setRenderMode] = useState<RaceViewMode>('2d'),
    [graphicsNotice, setGraphicsNotice] = useState(''),
    [full, setFull] = useState(false),
    [clean, setClean] = useState(false),
    [options, setOptions] = useState(false),
    [timing, setTiming] = useState<Timing>('compact'),
    [expandedLog, setExpandedLog] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [active, setActive] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  // Graphics preference is local to this browser; changing the view never touches career saves.
  useEffect(() => { setRenderMode(readRaceViewMode()); }, []);
  // On phones the cockpit is one screen tall: keep it flush to the top so the stage, PIT and commands are all reachable.
  // Re-aligned after layout shifts (view switch, rotation) only while the page header is just above it; a deliberate scroll stays.
  const phoneQuery = '(max-width: 760px), (max-height: 520px) and (orientation: landscape) and (max-width: 1000px)';
  const alignHud = useRef((force: boolean) => {
    const hud = hudRef.current;
    if (!hud || typeof window === 'undefined' || !window.matchMedia?.(phoneQuery).matches || hud.classList.contains('is-full')) return;
    const top = hud.getBoundingClientRect().top;
    if (force || (Math.abs(top) > 2 && top < window.innerHeight * 0.3 && top > -window.innerHeight * 0.3)) hud.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => alignHud.current(true));
    let timer = 0;
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(() => alignHud.current(false), 250); };
    window.addEventListener('resize', later);
    window.addEventListener('orientationchange', later);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); window.removeEventListener('resize', later); window.removeEventListener('orientationchange', later); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => alignHud.current(false), 120);
    return () => window.clearTimeout(timer);
  }, [renderMode]);
  function selectView(next: RaceViewMode) {
    setRenderMode(next);
    writeRaceViewMode(next);
    setGraphicsNotice('');
  }
  function graphicsFallback(reason: string) {
    setRenderMode('2d');
    writeRaceViewMode('2d');
    setGraphicsNotice(`Babylon.js 3D indisponível: ${reason}. Voltamos ao 2D sem interromper a corrida.`);
  }
  // Narrow screens start with the timing folded away so the circuit takes the screen.
  useEffect(() => {
    if (window.innerWidth <= 900 || window.innerHeight <= 520) setTiming('hidden');
  }, []);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);
  // The result panel lives on the page, so the fullscreen map steps aside at the flag.
  useEffect(() => {
    if (r.status === 'FINISHED') setFull(false);
  }, [r.status]);
  const highlights = raceHighlights(r);
  const pulse = racePulse(r);
  const feed = raceFeed(r.events, narration as RaceFeedMode, narration === 'MINIMAL' ? 6 : 12);
  useEffect(() => {
    if (replay < 0 || replay >= highlights.length - 1) return;
    const timer = setTimeout(() => setReplay((v) => v + 1), 2200 / replaySpeed);
    return () => clearTimeout(timer);
  }, [replay, replaySpeed, highlights.length]);
  useEffect(() => {
    for (const id of r.ids) {
      const src = resolvePersonPhoto(id, id.startsWith('junior-')).card;
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [r.seed]);
  const updater = useRef(update);
  updater.current = update;
  // Race Theater keyboard controls. Never intercept typing or focused buttons;
  // keep the existing on-screen controls as the accessible primary interface.
  useEffect(() => {
    const onRaceKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const element = event.target;
      if (element instanceof HTMLElement &&
        (element.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(element.tagName))) return;
      if (event.code === 'Space') {
        event.preventDefault();
        updater.current((s) => {
          if (!s.race || s.race.status !== 'RUNNING') return s;
          const n = cloneState(s);
          n.race!.paused = !n.race!.paused;
          return n;
        });
      }
      if (event.key.toLowerCase() === 'f' && !event.shiftKey) {
        event.preventDefault();
        setFull((current) => !current);
      }
    };
    window.addEventListener('keydown', onRaceKey);
    return () => window.removeEventListener('keydown', onRaceKey);
  }, []);
  useEffect(() => {
    if (r.paused || r.status !== 'RUNNING') return;
    const timer = setTimeout(() => updater.current((s) => tickLive(s)), 1800 / r.speed);
    return () => clearTimeout(timer);
  }, [r.lap, r.sector, r.speed, r.paused, r.status]);
  const order = [...r.cars].sort(
    (a, b) =>
      (a.status === 'RUNNING' ? 0 : 1) - (b.status === 'RUNNING' ? 0 : 1) ||
      b.lap - a.lap ||
      a.elapsed - b.elapsed,
  );
  const ids = controlledIds(save).filter((id) => r.cars.some((c) => c.id === id)),
    activeId = active && ids.includes(active) ? active : ids[0],
    accent = activeId ? teamById[driverById[activeId].teamId].color : '#dba34f';
  const engineeringFocus = selected ?? activeId ?? order[0]?.id ?? null;
  const pitwall = pitwallLive(save, engineeringFocus);
  // Picking a speed turns automatic pacing off; AUTO turns it on at the session's cruise speed.
  function pace(value: number | 'AUTO') {
    update((s) => {
      const n = cloneState(s),
        race = n.race!;
      if (value === 'AUTO') race.auto = race.auto ?? 8;
      else {
        delete race.auto;
        race.speed = value as RaceState['speed'];
      }
      return n;
    });
  }
  function change(key: keyof RaceState, value: unknown) {
    update((s) => {
      const n = cloneState(s);
      Object.assign(n.race!, { [key]: value });
      return n;
    });
  }
  function openFull() {
    // Phones open with the timing folded away so the circuit takes the screen.
    setTiming(window.innerWidth > 900 && window.innerHeight > 520 ? 'compact' : 'hidden');
    setFull(true);
  }
  // Compact timing: the top five, the player's cars, their team mates and whoever is fighting.
  const fighting = new Set(
      r.control === 'GREEN'
        ? Object.values(r.battles ?? {})
            .filter((b) => b.lastLap >= r.lap)
            .flatMap((b) => [b.attacker, b.defender])
        : [],
    ),
    teams = new Set(ids.map((id) => driverById[id].teamId)),
    rows = order
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c, i }) =>
          timing === 'expanded' ||
          i < 5 ||
          teams.has(driverById[c.id].teamId) ||
          fighting.has(c.id) ||
          c.id === selected,
      );
  const gapOf = (i: number) =>
    order[i].status !== 'RUNNING'
      ? order[i].status
      : i
        ? formatRaceGap(order[i], order[0])
        : 'LÍDER';
  const lastLap = r.lap >= r.laps - 1,
    circuit = circuits[r.round - 1],
    eventOptions = (
      <>
        <label>
          Eventos críticos
          <select
            aria-label="Eventos críticos"
            value={r.autoEvents}
            onChange={(e) => change('autoEvents', e.target.value)}
          >
            <option value="slow">Reduzir para 1×</option>
            <option value="pause">Pausar</option>
            <option value="off">Manter velocidade</option>
          </select>
        </label>
        <label>
          Narração
          <select
            aria-label="Estilo de narração"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
          >
            {['MINIMAL', 'TV', 'TECHNICAL'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </>
    );
  const finish = r.status === 'FINISHED' && (
    <section className="panel padded finish-panel">
      <span className="eyebrow">{quickRace ? 'BANDEIRADA · CORRIDA RÁPIDA' : 'BANDEIRADA · RESULTADO SALVO'}</span>
      <h2>{driverById[getWeekend(save).results[r.session]![0].driverId].name} vence</h2>
      <div className="podium-portraits podium-ceremony" aria-label="Cerimônia do pódio">
        <div className="podium-spotlight" aria-hidden="true" />
        {podiumOrder(getWeekend(save).results[r.session]!)
          .map((result, i) => (
            <div className={'podium-contender podium-place-' + result.position} key={result.driverId}
              style={{ '--podium-color': teamById[driverById[result.driverId].teamId]?.color ?? '#e5c16d', '--podium-delay': `${i * 180}ms` } as CSSProperties}>
              <PersonPortrait
                personId={result.driverId}
                name={driverById[result.driverId].name}
                size={96}
                eager
                fictional={result.driverId.startsWith('junior-')}
              />
              <strong>
                P{result.position} · {driverById[result.driverId].short}
              </strong>
              <span className="podium-team">{teamById[driverById[result.driverId].teamId]?.short}</span>
              <div className="podium-step" aria-hidden="true"><span>{result.position}</span></div>
            </div>
          ))}
      </div>
      <div className="replay-controls">
        <button className="button secondary" onClick={() => setReplay(replay < 0 ? 0 : -1)}>
          {replay < 0 ? 'Reproduzir highlights' : 'Parar highlights'}
        </button>
        {[1, 2, 4].map((speed) => (
          <button
            key={speed}
            aria-pressed={replaySpeed === speed}
            onClick={() => setReplaySpeed(speed)}
          >
            {speed}×
          </button>
        ))}
      </div>
      {replay >= 0 && highlights[replay] && (
        <p className="highlight-event">
          V{highlights[replay].lap} · {highlights[replay].type} — {highlights[replay].detail}
        </p>
      )}
      <p>
        {quickRace ? 'Resultado isolado: nenhum dos três slots de carreira foi alterado. ' : 'Pontuação contabilizada uma única vez. '}{' '}
        {ids
          .map((id) => {
            const result = getWeekend(save).results[r.session]!.find((x) => x.driverId === id)!;
            return driverById[id].short + ': P' + result.position + ' · ' + result.points + ' pts';
          })
          .join(' / ')}
      </p>
      <button className="button primary" onClick={() => {
        if (quickRace) onQuickRaceExit?.();
        else update((s) => ({ ...s, race: null }));
      }}>
        {quickRace ? 'Nova corrida rápida' : 'Ver resultado e continuar'}
      </button>{' '}
      {!quickRace && <Link href="/classificacao" className="button secondary">
        Classificação do campeonato
      </Link>}
    </section>
  );
  return (
    <div className="live-race">
      {finish}
      <div
        ref={hudRef}
        className={
          'race-hud timing-' +
          timing +
          (full ? ' is-full race-theater' : '') +
          (clean && full ? ' is-clean' : '') +
          (ids.length > 1 ? ' two-cars' : '')
        }
        style={{ '--accent': accent } as CSSProperties}
        {...(full ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Race Theater' } : {})}
      >
        <header className="live-header hud-top">
          <div className="hud-lap">
            <small>VOLTA</small>
            <b>
              {Math.min(r.lap + 1, r.laps)}/{r.laps}
            </b>
          </div>
          <div className="hud-where">
            <strong>{circuit.name}</strong>
            <small>
              {r.session} · {circuit.country} ·{' '}
              {save.career.mode === 'driver' ? 'PILOTO' : 'CONSTRUTOR'}
              {r.dev ? ' · DEV FIXTURE' : ''}
            </small>
          </div>
          <div className="hud-weather">
            <strong>{r.weather.condition}</strong>
            <small>
              {r.weather.air.toFixed(0)}°C · pista {r.weather.track.toFixed(0)}°C
            </small>
          </div>
          <div className="race-mobile-views" role="group" aria-label="Visualização da corrida no celular">
            <button type="button" className={renderMode === '2d' ? 'selected' : ''} aria-pressed={renderMode === '2d'} onClick={() => selectView('2d')}>2D TÁTICO</button>
            <button type="button" className={renderMode === 'iso' ? 'selected' : ''} aria-pressed={renderMode === 'iso'} onClick={() => selectView('iso')}>2.5D</button>
            <button type="button" className={renderMode === 'babylon' ? 'selected' : ''} aria-pressed={renderMode === 'babylon'} onClick={() => selectView('babylon')}>3D BABYLON</button>
          </div>
          {r.control !== 'GREEN' && (
            <span className={'hud-flag flag-' + r.control.replace(' ', '-')} role="status">
              {r.control === 'RED' ? 'RED FLAG' : r.control}
            </span>
          )}
          {lastLap && (
            <span className="hud-flag flag-final">
              {r.status === 'FINISHED' ? 'BANDEIRADA' : 'ÚLTIMA VOLTA'}
            </span>
          )}
          <div className="hud-pace">
            <button
              className="button primary"
              disabled={r.status === 'FINISHED'}
              onClick={() => change('paused', !r.paused)}
            >
              {r.paused ? 'RETOMAR' : 'PAUSAR'}
            </button>
            <button
              className="button secondary hud-step"
              aria-label="Próximo setor"
              title="Avançar um setor com a corrida pausada"
              disabled={!r.paused || r.status === 'FINISHED'}
              onClick={() => update((s) => tickLive(s, true))}
            >
              +SETOR
            </button>
            <label className="mobile-speed-control">
              <span>VELOCIDADE</span>
              <select aria-label="Velocidade da corrida no celular"
                value={r.auto ? 'AUTO' : String(r.speed)}
                onChange={(event) => pace(event.target.value === 'AUTO' ? 'AUTO' : Number(event.target.value))}>
                {[0.5, 0.75, 1, 2, 4, 8, 16].map(value => <option key={value} value={value}>{value === 0.5 ? '0,50' : value === 0.75 ? '0,75' : value}×</option>)}
                <option value="AUTO">AUTO</option>
              </select>
            </label>
            <div className="speed-controls" role="group" aria-label="Velocidade">
              {[0.5, 0.75, 1, 2, 4, 8, 16].map((v) => (
                <button
                  className={r.speed === v ? 'selected' : ''}
                  aria-pressed={r.speed === v}
                  key={v}
                  onClick={() => pace(v)}
                >
                  {v === 0.5 ? '0,50' : v === 0.75 ? '0,75' : v}×
                </button>
              ))}
              <button
                className={r.auto ? 'selected auto' : 'auto'}
                aria-pressed={!!r.auto}
                title="A velocidade acompanha o momento da corrida"
                onClick={() => pace('AUTO')}
              >
                {r.auto === 16 ? 'HIGHLIGHTS' : 'AUTO'}
              </button>
            </div>
          </div>
          <div className="hud-tools">
            <RaceSoundControls race={r} focusedId={selected ?? activeId ?? order[0]?.id ?? null} />
            <span className="hud-save" title={'Slot ' + slot}>
              {saving ? 'Salvando…' : 'Salvo'}
            </span>
            <button
              className="button secondary theater-timing-toggle"
              aria-pressed={timing !== 'hidden'}
              onClick={() => setTiming(timing === 'hidden' ? 'compact' : 'hidden')}
            >
              TIMING
            </button>
            {full && (
              <>
                <button
                  className="button secondary"
                  aria-pressed={clean}
                  title="Só mapa, volta, clima, piloto e comandos"
                  onClick={() => setClean((v) => !v)}
                >
                  CLEAN VIEW
                </button>
                <button
                  className="button secondary"
                  aria-expanded={options}
                  aria-label="Opções da corrida"
                  onClick={() => setOptions((v) => !v)}
                >
                  ⚙
                </button>
                <button
                  ref={closeRef}
                  className="button secondary theater-close"
                  aria-label="Fechar Race Theater"
                  onClick={() => setFull(false)}
                >
                  FECHAR ✕
                </button>
              </>
            )}
          </div>
          {full && options && <div className="hud-options">{eventOptions}</div>}
        </header>
        <div className="hud-stage">
          <LiveMap
            renderMode={renderMode}
            full={full}
            clean={clean && full}
            selected={selected}
            onSelect={setSelected}
            onFull={openFull}
            onRenderMode={selectView}
            onBabylonError={graphicsFallback}
          />
          {graphicsNotice && <div className="race-graphics-notice" role="status">{graphicsNotice}<button type="button" aria-label="Fechar aviso gráfico" onClick={() => setGraphicsNotice('')}>×</button></div>}
          {timing !== 'hidden' && !(clean && full) && (
            <aside className="timing-tower" aria-label="Timing">
              <div className="tower-head">
                <strong>TIMING</strong>
                <div className="seg" role="group" aria-label="Tamanho do timing">
                  <button
                    className={timing === 'compact' ? 'selected' : ''}
                    aria-pressed={timing === 'compact'}
                    title="Top 5, seus pilotos e batalhas"
                    onClick={() => setTiming('compact')}
                  >
                    TOP
                  </button>
                  <button
                    className={timing === 'expanded' ? 'selected' : ''}
                    aria-pressed={timing === 'expanded'}
                    title="Os 32 pilotos"
                    onClick={() => setTiming('expanded')}
                  >
                    TODOS
                  </button>
                </div>
                <button aria-label="Ocultar timing" onClick={() => setTiming('hidden')}>
                  ×
                </button>
              </div>
              <ol className="theater-timing" aria-label="Timing compacto">
                {rows.map(({ c, i }, n) => (
                  <li
                    key={c.id}
                    className={
                      (ids.includes(c.id) ? 'controlled-car ' : '') +
                      (selected === c.id ? 'is-selected ' : '') +
                      (fighting.has(c.id) ? 'in-battle ' : '') +
                      (n && rows[n - 1].i !== i - 1 ? 'after-skip' : '')
                    }
                    style={{ '--team': teamById[driverById[c.id].teamId].color } as CSSProperties}
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(selected === c.id ? null : c.id); } }}
                    role="button" tabIndex={0} aria-label={`Selecionar piloto ${driverById[c.id].name}`}
                  >
                    <span>{i + 1}</span>
                    {timing === 'expanded' && (
                      <PersonPortrait
                        personId={c.id}
                        name={driverById[c.id].name}
                        size={22}
                        fictional={c.id.startsWith('junior-')}
                      />
                    )}
                    <b>{driverById[c.id].short}</b>
                    <span>{gapOf(i)}</span>
                    <small>
                      {c.tyre.compound}
                      {timing === 'expanded' ? '·' + c.tyreAge : ''}
                    </small>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
        {!(clean && full) && <RaceControl race={r} driverName={(id) => driverById[id]?.name ?? id} teamName={(id) => teamById[driverById[id]?.teamId]?.name ?? '—'} carNumber={(id) => driverById[id]?.number} batteryOf={(id) => save.game.cars[id]?.battery} fuelOf={(id) => save.game.cars[id]?.fuel} focusId={selected ?? activeId ?? order[0]?.id ?? null} onFocus={setSelected} />}
        <footer className="hud-dock">
          {(clean && full ? ids.filter((id) => id === activeId) : ids).map((id) => (
            <RaceCommandCard
              key={id}
              id={id}
              active={id === activeId}
              onActivate={ids.length > 1 ? () => setActive(id) : undefined}
            />
          ))}
        </footer>
      </div>
      <div className="live-bottom">
        <section className="panel">
          <div className="section-head">
            <h2>Classificação em pista</h2>
            <button className="button secondary" onClick={() => setInterval((v) => !v)}>
              {interval ? 'INTERVAL' : 'GAP TO LEADER'}
            </button>
          </div>
          <div className="table-wrap live-timing">
            <table>
              <thead>
                <tr>
                  {['POS', 'PILOTO', 'GAP', 'PNEU / IDADE', 'BATERIA', 'ÚLTIMA VOLTA', 'PIT'].map(
                    (x) => (
                      <th key={x}>{x}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {order.map((c, i) => (
                  <tr key={c.id} className={ids.includes(c.id) ? 'controlled-car' : ''}>
                    <td>{i + 1}</td>
                    <td>{driverById[c.id].short}</td>
                    <td>
                      {c.status !== 'RUNNING'
                        ? c.status
                        : i
                          ? formatRaceGap(c, order[interval ? i - 1 : 0])
                          : 'LÍDER'}
                    </td>
                    <td>
                      {c.tyre.compound} · {c.tyreAge}V · {c.tyre.wear.toFixed(0)}%
                    </td>
                    <td>{save.game.cars[c.id].battery.toFixed(0)}%</td>
                    <td>{c.last ? c.last.toFixed(3) + ' s' : '—'}</td>
                    <td>
                      {c.pitPhase === 'CALLED'
                        ? 'CHAMADO'
                        : c.pitPhase === 'EXIT'
                          ? 'SAÍDA'
                          : c.pits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel padded race-events">
          <h2>Direção de prova</h2>
          <div className="race-pulse" aria-label="Resumo em tempo real da corrida">
            <span><strong>{pulse.active}/{pulse.field}</strong> em pista</span>
            <span><strong>{pulse.pits}</strong> paradas</span>
            <span><strong>{pulse.passes}</strong> ultrapassagens confirmadas</span>
            <span><strong>{pulse.retirements}</strong> abandonos</span>
            <span><strong>{pulse.incidents}</strong> incidentes</span>
          </div>
          {r.status === 'RUNNING' && <div className="pitwall-live" aria-label="Painel do engenheiro ao vivo">
            <h3>Engenharia ao vivo · {driverById[engineeringFocus ?? '']?.short ?? 'Piloto'}</h3>
            <div className="pitwall-live-grid">{pitwall.map((signal, index) => (
              <div key={`${signal.title}-${index}`} className={`pitwall-signal pitwall-${signal.level}`}>
                <strong>{signal.title}</strong><small>{signal.detail}</small>
              </div>
            ))}</div>
            {!pitwall.length && <small>Sem alertas de engenharia prioritários nesta volta.</small>}
          </div>}
          {pulse.mostActiveId && <p className="race-pulse-leader">Mais ultrapassagens: {driverById[pulse.mostActiveId]?.short ?? pulse.mostActiveId} ({pulse.mostActiveCount})</p>}
          <small className="race-shortcuts">Atalhos: espaço para pausar/retomar e F para abrir/fechar o Race Theater. Os botões continuam disponíveis.</small>
          {!full && <div className="race-options">{eventOptions}</div>}
          {feed.map(({ event: e, repeats }, i) => (
              <p key={`${e.lap}-${e.driverId}-${e.type}-${i}`}>
                <b>V{e.lap} · {e.type}{repeats > 1 ? ` · ${repeats} ocorrências` : ''}</b>
                <br />
                {narration !== 'MINIMAL' && e.detail}
                {narration === 'TECHNICAL' && (
                  <small className="block">
                    {driverById[e.driverId]?.short}{' '}
                    {e.otherId ? ' / ' + driverById[e.otherId]?.short : ''} · severidade{' '}
                    {e.severity ?? 'informativa'}
                  </small>
                )}
              </p>
            ))}
          {!r.events.length && <p>Aguardando largada.</p>}
          {r.events.length > 0 && !feed.length && <p>Sem ocorrências de destaque neste momento. O registro técnico completo está disponível abaixo.</p>}
          <details>
            <summary>Log completo · {r.events.length} eventos</summary>
            {r.events.slice(expandedLog ? 0 : -250).map((e, i) => (
              <p key={i}>
                V{e.lap} · {e.type} · {e.detail}
              </p>
            ))}
            {r.events.length > 250 && <button className="button secondary" onClick={() => setExpandedLog((open) => !open)}>{expandedLog ? 'Mostrar últimos 250' : `Mostrar todos os ${r.events.length} eventos`}</button>}
          </details>
          <Link href="/dev">Painel de desenvolvimento</Link>
        </section>
      </div>
    </div>
  );
}
