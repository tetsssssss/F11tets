'use client';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { PersonPortrait } from '../components/person-portrait';
import { useSave, useUniverse } from '../components/save-provider';
import {
  brakingOpportunity,
  issueCommand,
  callPit,
  radio,
  radioCatalog,
  RADIO_CATEGORIES,
  type RadioCategory,
} from '../domain/gameplay/commands';
import type { Compound } from '../domain/simulation/types';
import { engineerAdvice, settingsOf, shown } from '../domain/gameplay/settings';
import { strategyBrief } from '../presentation/strategy';
import { formatRaceGap } from '../presentation/race-gap';
type Panel = '' | 'strategy' | 'radio' | 'data' | 'events' | 'weather';
const PANELS: [Exclude<Panel, ''>, string][] = [
  ['strategy', 'ESTRATÉGIA'],
  ['radio', 'RÁDIO'],
  ['data', 'TELEMETRIA'],
  ['events', 'INCIDENTES'],
  ['weather', 'CLIMA'],
];
const PRECISION = {
  exact: 'Leitura exata do pit wall',
  approx: 'Estimativa do pit wall',
  range: 'Intervalos: o pit wall não tem certeza',
};
/**
 * One controlled car in the race dock: a compact strip, the five commands, and a drawer that
 * opens only when asked. `active` gives the full strip; the other car of a team stays compact.
 */
export function RaceCommandCard({
  id,
  active = true,
  onActivate,
}: {
  id: string;
  active?: boolean;
  /** Present when two cars are controlled: makes this one the active driver. */
  onActivate?: () => void;
}) {
  const { save, update } = useSave(),
    { driverById, teamById } = useUniverse();
  const [panel, setPanel] = useState<Panel>(''),
    [picked, setPicked] = useState<Compound | null>(null),
    [target, setTarget] = useState<'driver' | 'engineer'>('engineer'),
    [category, setCategory] = useState<RadioCategory>('PACE');
  const r = save.race!,
    c = r.cars.find((c) => c.id === id)!,
    d = driverById[id],
    team = teamById[d.teamId],
    battery = save.game.cars[id],
    cmd = r.commands[id],
    brake = brakingOpportunity(save, id);
  const disabled = r.status !== 'RUNNING' || c.status !== 'RUNNING';
  const assists = settingsOf(save).assists,
    advice = assists.engineerRecommendations ? engineerAdvice(save, id) : null;
  const order = [...r.cars].sort(
      (a, b) =>
        (a.status === 'RUNNING' ? 0 : 1) - (b.status === 'RUNNING' ? 0 : 1) ||
        b.lap - a.lap ||
        a.elapsed - b.elapsed,
    ),
    position = order.indexOf(c) + 1,
    ahead = order[position - 2],
    toggle = (next: Exclude<Panel, ''>) => {
      onActivate?.();
      setPanel(panel === next ? '' : next);
    };
  const brief = panel === 'strategy' ? strategyBrief(save, id) : null,
    compound = picked ?? brief?.recommended ?? 'H',
    engineer = save.game.engineers.find((e) => e.driverId === id),
    // A driver talks to the engineer; a team boss can address either of them.
    voice = save.career.mode === 'constructor' ? target : 'engineer',
    lines = r.radio.filter((x) => x.driverId === id);
  return (
    <section
      className={'panel command-card ' + (active ? 'is-active' : 'is-compact')}
      style={{ '--team': team.color } as CSSProperties}
      aria-label={'Comandos de ' + d.name}
    >
      {panel && (
        <div className="hud-drawer" role="group" aria-label={'Detalhes de ' + d.name}>
          <div className="drawer-tabs">
            {PANELS.map(([key, label]) => (
              <button
                key={key}
                className={panel === key ? 'selected' : ''}
                aria-pressed={panel === key}
                onClick={() => setPanel(key)}
              >
                {label}
              </button>
            ))}
            <button className="drawer-close" aria-label="Fechar painel" onClick={() => setPanel('')}>
              ×
            </button>
          </div>
          {brief && (
            <div className="command-detail strategy-panel">
              <dl className="strategy-grid">
                <div>
                  <dt>Pneu atual</dt>
                  <dd>
                    {brief.tyre.compound} · {brief.tyre.name}
                  </dd>
                </div>
                <div>
                  <dt>Desgaste</dt>
                  <dd>{brief.tyre.wear}</dd>
                </div>
                <div>
                  <dt>Voltas no stint</dt>
                  <dd>{brief.tyre.stint}</dd>
                </div>
                <div>
                  <dt>Vida restante</dt>
                  <dd>{brief.tyre.remaining}</dd>
                </div>
                <div>
                  <dt>Pit loss</dt>
                  <dd>
                    {brief.pitLoss}
                    {brief.neutral ? ' · neutralizada' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Pit rejoin</dt>
                  <dd>
                    {brief.rejoin} <small>(agora P{brief.position})</small>
                  </dd>
                </div>
                <div>
                  <dt>Tráfego provável</dt>
                  <dd>{brief.traffic}</dd>
                </div>
                <div>
                  <dt>Janela recomendada</dt>
                  <dd>{brief.window}</dd>
                </div>
                <div>
                  <dt>Clima</dt>
                  <dd>
                    {brief.weather.condition} · {brief.weather.air}°C
                  </dd>
                </div>
                <div>
                  <dt>Prob. de chuva</dt>
                  <dd>{brief.weather.rain}</dd>
                </div>
                <div>
                  <dt>Battery</dt>
                  <dd>{brief.battery}</dd>
                </div>
                <div>
                  <dt>Gap</dt>
                  <dd>
                    {brief.gapAhead === null ? 'LÍDER' : '+' + brief.gapAhead.toFixed(1)}
                    {' / '}
                    {brief.gapBehind === null ? '—' : '−' + brief.gapBehind.toFixed(1)}
                  </dd>
                </div>
              </dl>
              <div className="compound-options" role="group" aria-label={'Composto de ' + d.name}>
                {brief.options.map((o) => (
                  <button
                    key={o.compound}
                    className={
                      'compound-' +
                      o.compound +
                      (compound === o.compound ? ' selected' : '') +
                      (o.suits ? '' : ' unsuited')
                    }
                    aria-pressed={compound === o.compound}
                    aria-label={`Composto ${o.compound}, ${o.name}, dura ${o.life}`}
                    title={o.note || o.name}
                    onClick={() => setPicked(o.compound)}
                  >
                    <b>{o.compound}</b>
                    <span>{o.life}</span>
                    <small>{o.note || (o.recommended ? 'recomendado' : o.name)}</small>
                  </button>
                ))}
              </div>
              <div className="button-row strategy-calls">
                <button
                  className="button primary"
                  disabled={disabled}
                  onClick={() => update((s) => callPit(s, id, 'now', compound))}
                >
                  BOX NOW
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => update((s) => callPit(s, id, 'next', compound))}
                >
                  NEXT LAP
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => update((s) => radio(s, id, 'Fique fora'))}
                >
                  STAY OUT
                </button>
                <button
                  className="button secondary"
                  disabled={!brief.call}
                  onClick={() => update((s) => callPit(s, id, 'cancel', compound))}
                >
                  CANCEL
                </button>
              </div>
              <p className="strategy-status">
                {brief.call
                  ? 'Confirmado: volta ' + brief.call.lap + ' · ' + brief.call.compound
                  : brief.holding
                    ? 'STAY OUT ativo: sem parada nas próximas voltas.'
                    : 'Sem chamada manual. Estratégia automática ativa.'}
                <small> · {PRECISION[brief.precision]}</small>
              </p>
            </div>
          )}
          {panel === 'radio' && (
            <div className="command-detail radio-panel">
              <div className="radio-head">
                {voice === 'engineer' && engineer ? (
                  <PersonPortrait
                    personId={engineer.id}
                    name={engineer.name}
                    size={64}
                    fictional
                    eager
                    showTeamAccent={team.color}
                  />
                ) : (
                  <PersonPortrait
                    personId={id}
                    name={d.name}
                    size={64}
                    focus="face"
                    quality="master"
                    eager
                    fictional={id.startsWith('junior-')}
                    showTeamAccent={team.color}
                  />
                )}
                <div>
                  <strong>{voice === 'engineer' && engineer ? engineer.name : d.name}</strong>
                  <small>
                    {voice === 'engineer' ? 'Engenheiro de ' + d.short : 'Piloto'} · {team.name}
                  </small>
                </div>
                {save.career.mode === 'constructor' && (
                  <select
                    aria-label={'Destinatário de ' + d.name}
                    value={target}
                    onChange={(e) => setTarget(e.target.value as 'driver' | 'engineer')}
                  >
                    <option value="engineer">Engenheiro</option>
                    <option value="driver">Piloto</option>
                  </select>
                )}
              </div>
              <div className="radio-categories" role="group" aria-label="Categoria do rádio">
                {RADIO_CATEGORIES.map((x) => (
                  <button
                    key={x}
                    className={category === x ? 'selected' : ''}
                    aria-pressed={category === x}
                    onClick={() => setCategory(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <div className="radio-options">
                {radioCatalog
                  .filter((x) => x.category === category)
                  .map((x) => (
                    <button
                      key={x.message}
                      className={x.kind}
                      disabled={disabled}
                      onClick={() => update((s) => radio(s, id, x.message, voice))}
                    >
                      {x.label}
                    </button>
                  ))}
              </div>
              <div className="radio-transcript" aria-live="polite">
                {lines.slice(-5).map((x) => (
                  <p key={x.id}>
                    <b>
                      V{x.lap} · {x.target === 'engineer' ? 'ENG' : 'PIL'}
                    </b>{' '}
                    {x.text}
                  </p>
                ))}
                {!lines.length && <p>Sem mensagens ainda.</p>}
              </div>
            </div>
          )}
          {panel === 'data' && (
            <div className="command-detail">
              <dl className="strategy-grid">
                <div>
                  <dt>Pneu</dt>
                  <dd>
                    {c.tyre.compound} · {c.tyre.temperature.toFixed(0)}°C
                  </dd>
                </div>
                <div>
                  <dt>Desgaste</dt>
                  <dd>{shown(save, c.tyre.wear, id + 'tyre')}</dd>
                </div>
                <div>
                  <dt>Bateria</dt>
                  <dd>
                    {shown(save, battery.battery, id + 'battery')} ·{' '}
                    {battery.batteryTemperature.toFixed(0)}°C
                  </dd>
                </div>
                <div>
                  <dt>Última volta</dt>
                  <dd>{c.last ? c.last.toFixed(3) + ' s' : '—'}</dd>
                </div>
                <div>
                  <dt>Melhor volta</dt>
                  <dd>{c.best && Number.isFinite(c.best) ? c.best.toFixed(3) + ' s' : '—'}</dd>
                </div>
                <div>
                  <dt>Paradas</dt>
                  <dd>{c.pits}</dd>
                </div>
                <div>
                  <dt>Punição</dt>
                  <dd>{c.penalty ? '+' + c.penalty + ' s' : 'nenhuma'}</dd>
                </div>
                <div>
                  <dt>Ultrapassagens</dt>
                  <dd>{c.overtakes}</dd>
                </div>
              </dl>
              <p>FREADA: {brake.reason}</p>
              {save.career.mode === 'constructor' && (
                <div className="command-metrics">
                  {Object.entries(save.career.ceoRelations[id]).map(([k, v]) => (
                    <span key={k}>
                      {k} <b>{v.toFixed(0)}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {panel === 'events' && (
            <div className="command-detail">
              {r.events
                .filter((e) => e.driverId === id || e.otherId === id)
                .slice(-7)
                .reverse()
                .map((e, i) => (
                  <p key={i}>
                    <b>
                      V{e.lap} · {e.type}
                    </b>{' '}
                    {e.detail}
                  </p>
                ))}
              {!r.events.some((e) => e.driverId === id || e.otherId === id) && (
                <p>Nenhum incidente com {d.short} até agora.</p>
              )}
            </div>
          )}
          {panel === 'weather' && (
            <div className="command-detail">
              <dl className="strategy-grid">
                <div>
                  <dt>Condição</dt>
                  <dd>{r.weather.condition}</dd>
                </div>
                <div>
                  <dt>Ar / pista</dt>
                  <dd>
                    {r.weather.air.toFixed(0)}°C / {r.weather.track.toFixed(0)}°C
                  </dd>
                </div>
                <div>
                  <dt>Água na pista</dt>
                  <dd>{(r.weather.water * 100).toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Aderência</dt>
                  <dd>{r.weather.grip.toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Vento</dt>
                  <dd>{r.weather.wind.toFixed(0)} km/h</dd>
                </div>
                <div>
                  <dt>Umidade</dt>
                  <dd>{r.weather.humidity.toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Radar de chuva</dt>
                  <dd>{r.weather.forecast.toFixed(0)}%</dd>
                </div>
                <div>
                  <dt>Direção de prova</dt>
                  <dd>{r.control}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
      <div
        className="driver-strip"
        {...(onActivate && !active
          ? {
              role: 'button',
              tabIndex: 0,
              title: 'Tornar ' + d.short + ' o piloto ativo',
              onClick: onActivate,
              onKeyDown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onActivate();
                }
              },
            }
          : {})}
      >
        <PersonPortrait
          personId={id}
          name={d.name}
          size={46}
          focus="face"
          eager
          fictional={id.startsWith('junior-')}
          showTeamAccent={team.color}
        />
        <div className="strip-id">
          <strong>{d.short}</strong>
          <small>{d.name}</small>
        </div>
        <span className="strip-stat strip-pos">
          <b>{c.status === 'RUNNING' ? 'P' + position : c.status}</b>
        </span>
        <span className="strip-stat">
          <small>GAP</small>
          <b>{formatRaceGap(c, ahead ?? c)}</b>
        </span>
        <span className="strip-stat">
          <small>
            {c.tyre.compound} · {c.tyreAge}V
          </small>
          <b>{shown(save, c.tyre.wear, id + 'tyre')}</b>
        </span>
        <span className="strip-stat">
          <small>BAT</small>
          <b>{shown(save, battery.battery, id + 'battery')}</b>
        </span>
        <span className={'micro strip-command' + (cmd.acknowledged ? '' : ' refused')}>
          {cmd.kind === 'BRAKING_ATTACK' ? 'BRAKE' : cmd.kind} {cmd.remaining}L
          {cmd.acknowledged ? '' : ' · RECUSADA'}
        </span>
      </div>
      <div className="five-commands">
        <button disabled={disabled} onClick={() => update((s) => issueCommand(s, id, 'ATTACK'))}>
          ATAQUE
        </button>
        <button disabled={disabled} onClick={() => update((s) => issueCommand(s, id, 'DEFEND'))}>
          DEFESA
        </button>
        <button
          disabled={disabled || !brake.available}
          title={brake.reason}
          onClick={() => update((s) => issueCommand(s, id, 'BRAKING_ATTACK'))}
        >
          FREADA
        </button>
        <button
          disabled={disabled}
          className={r.pitCalls[id] ? 'armed' : ''}
          aria-expanded={panel === 'strategy'}
          onClick={() => toggle('strategy')}
        >
          PIT
        </button>
        <button
          disabled={disabled}
          aria-expanded={panel === 'radio'}
          onClick={() => toggle('radio')}
        >
          RÁDIO
        </button>
      </div>
      <button
        className="strip-more"
        aria-label={'Dados de ' + d.name}
        aria-expanded={panel === 'data'}
        title="Telemetria, incidentes e clima"
        onClick={() => toggle('data')}
      >
        ⋯
      </button>
      {advice && active && (
        <p className="engineer-advice" aria-label="Recomendação do engenheiro">
          <b>ENG</b> {advice}
        </p>
      )}
    </section>
  );
}
