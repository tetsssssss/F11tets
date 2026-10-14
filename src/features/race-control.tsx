'use client';
import { useState } from 'react';
import type { RaceState } from '../domain/gameplay/types';
import { formatRaceGap } from '../presentation/race-gap';
import { gapRows, lapHistory, positionChange, tyreHistory, type GapView } from '../presentation/race-control-data';

const TABS = ['MOMENTO', 'GAP', 'PNEUS', 'VOLTAS', 'POSIÇÕES', 'ESTRATÉGIA', 'CLIMA', 'TELEMETRIA'] as const;
type Tab = typeof TABS[number];
const fmt = (v: number | undefined, decimals = 1) => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(decimals) : '—';

/** Read-only HUD: operates on the *existing* race state and never changes its simulation. */
export function RaceControl({ race, driverName, teamName, carNumber, batteryOf, fuelOf, focusId, onFocus } : {
  race: RaceState;
  driverName: (id: string) => string;
  teamName: (id: string) => string;
  carNumber: (id: string) => number | undefined;
  batteryOf: (id: string) => number | undefined;
  fuelOf: (id: string) => number | undefined;
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('MOMENTO');
  const [gapView, setGapView] = useState<GapView>('full');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 900);
  const order = [...race.cars].sort((a, b) =>
    (a.status === 'RUNNING' ? 0 : 1) - (b.status === 'RUNNING' ? 0 : 1) || b.lap - a.lap || a.elapsed - b.elapsed,
  );
  const running = order.filter(c => c.status === 'RUNNING');
  const focus = order.find(c => c.id === focusId) || order[0];
  const lastFrame = race.frames.at(-1);
  const tele = lastFrame?.cars.find(c => c.id === focus?.id);
  const selectedIndex = order.findIndex(c => c.id === focus?.id);
  const visibleGap = gapRows(order, focus?.id ?? null, gapView, compareId);
  const fastest = Math.min(...running.map(car => car.best).filter(time => Number.isFinite(time) && time > 0 && time < 1e8));
  const history = focus ? lapHistory(race, focus.id).slice(-8) : [];
  const compounds = focus ? tyreHistory(race, focus.id) : [];
  const c = (key: Tab) => key === tab ? 'race-control-tab active' : 'race-control-tab';
  return <section className={'race-control ' + (open ? 'is-expanded' : 'is-collapsed')} aria-label="Central da corrida">
    <header className="race-control-heading">
      <div><strong>RACE CONTROL</strong><small> V{Math.min(race.lap + 1, race.laps)}/{race.laps} · {focus ? driverName(focus.id) : 'Corrida'}</small></div>
      <button type="button" className="race-control-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Recolher dados ▾' : 'Ver dados da corrida ▴'}</button>
    </header>
    {open && <>
      <nav className="race-control-tabs" role="tablist" aria-label="Informações da corrida">
        {TABS.map(key => <button key={key} type="button" className={c(key)} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{key}</button>)}
      </nav>
      <div className="race-control-content" role="tabpanel" aria-label={tab}>
        {tab === 'MOMENTO' && <div className="race-control-feed" aria-live="off">
          {race.events.length ? [...race.events].reverse().slice(0, 9).map((e, index) => <article key={`${race.events.length-index}-${e.driverId}-${e.type}`} className="race-control-event"><b>V{e.lap} · {e.type}</b><span>{e.detail}</span></article>) : <p className="race-control-empty">Aguardando os primeiros acontecimentos da corrida.</p>}
        </div>}
        {tab === 'GAP' && <>
          <div className="race-control-filters" role="group" aria-label="Visualização de GAP">
            {([['full', 'Todos'], ['near', 'Próximos'], ['compare', 'Comparar']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={gapView === value} onClick={() => setGapView(value)}>{label}</button>)}
            {gapView === 'compare' && <label>Com <select aria-label="Comparar com piloto" value={compareId ?? ''} onChange={event => setCompareId(event.target.value || null)}><option value="">Selecione</option>{order.filter(car => car.id !== focus?.id).map(car => <option key={car.id} value={car.id}>{driverName(car.id)}</option>)}</select></label>}
          </div>
          <div className="race-control-scroll"><table className="race-control-table"><thead><tr><th scope="col">P</th><th scope="col">Piloto</th><th scope="col">Equipe</th><th scope="col">GAP líder</th><th scope="col">À frente</th><th scope="col">Volta</th></tr></thead><tbody>
            {visibleGap.map(car => { const i = order.indexOf(car); return <tr key={car.id} className={focus?.id === car.id ? 'is-focused' : ''}><td>{i + 1}</td><td><button type="button" onClick={() => onFocus(car.id)}>{driverName(car.id)}</button></td><td>{teamName(car.id)}</td><td>{formatRaceGap(car, running[0])}</td><td>{car.status !== 'RUNNING' ? '—' : i === 0 ? 'LÍDER' : formatRaceGap(car, order[i - 1])}</td><td>{car.lap + 1}</td></tr>; })}
          </tbody></table></div>
        </>}
        {tab === 'POSIÇÕES' && <div className="race-control-scroll"><table className="race-control-table"><thead><tr><th scope="col">P</th><th scope="col">Nº</th><th scope="col">Piloto</th><th scope="col">Equipe</th><th scope="col">Voltas</th><th scope="col">Status</th><th scope="col">GAP</th></tr></thead><tbody>
          {order.map((car, i) => { const movement = positionChange(race, car.id); return <tr key={car.id} className={focus?.id === car.id ? 'is-focused' : ''}><td>{i + 1} {movement && movement > 0 ? `↑${movement}` : movement && movement < 0 ? `↓${-movement}` : ''}</td><td>{carNumber(car.id) ?? '—'}</td><td><button type="button" onClick={() => onFocus(car.id)}>{driverName(car.id)}</button></td><td>{teamName(car.id)}</td><td>{car.lap}</td><td>{car.status === 'RUNNING' ? 'Em pista' : car.status}</td><td>{formatRaceGap(car, running[0])}</td></tr>; })}
        </tbody></table></div>}
        {tab === 'PNEUS' && <div className="race-control-scroll"><table className="race-control-table"><thead><tr><th>P</th><th>Piloto</th><th>Composto</th><th>Voltas</th><th>Desgaste</th><th>Paradas</th></tr></thead><tbody>{order.map((car,i) => <tr key={car.id} className={focus?.id === car.id ? 'is-focused' : ''}><td>{i+1}</td><td><button type="button" onClick={() => onFocus(car.id)}>{driverName(car.id)}</button></td><td><span className={'race-control-tyre tyre-'+car.tyre.compound}>{car.tyre.compound}</span></td><td>{car.tyreAge}</td><td>{fmt(car.tyre.wear,0)}%</td><td>{car.pits}</td></tr>)}</tbody></table><p className="race-control-footnote">Histórico registrado de {focus ? driverName(focus.id) : 'piloto'}: {compounds.length ? compounds.join(' → ') : 'indisponível neste save'}. O composto inicial pode não constar se o registro começou após a largada.</p></div>}
        {tab === 'VOLTAS' && <div className="race-control-scroll"><p className="race-control-footnote">Melhor volta da corrida: {Number.isFinite(fastest) ? `${fmt(fastest, 3)} s` : 'ainda não registrada'}</p><table className="race-control-table"><thead><tr><th>P</th><th>Piloto</th><th>Última (s)</th><th>Melhor (s)</th><th>Voltas</th></tr></thead><tbody>{order.map((car,i) => <tr key={car.id} className={focus?.id === car.id ? 'is-focused' : ''}><td>{i+1}</td><td><button type="button" onClick={() => onFocus(car.id)}>{driverName(car.id)}</button></td><td>{car.last > 0 && Number.isFinite(car.last) ? fmt(car.last,3) : '—'}</td><td className={car.best === fastest ? 'is-fastest-lap' : ''}>{car.best > 0 && car.best < 1e8 && Number.isFinite(car.best) ? fmt(car.best,3) : '—'}</td><td>{car.lap}</td></tr>)}</tbody></table><p className="race-control-footnote">Últimas voltas registradas de {focus ? driverName(focus.id) : 'piloto'}: {history.length ? history.map(row => `V${row.lap} ${fmt(row.seconds, 3)}s`).join(' · ') : 'indisponíveis neste save'}. Tempos setoriais não são gravados pelo simulador.</p></div>}
        {tab === 'ESTRATÉGIA' && <div className="race-control-cards"><div><small>Foco</small><strong>{focus ? driverName(focus.id) : '—'}</strong></div><div><small>Próximo box agendado</small><strong>{focus && race.pitCalls[focus.id] ? 'V'+race.pitCalls[focus.id].lap+' · '+race.pitCalls[focus.id].compound : 'Não agendado'}</strong></div><div><small>Paradas realizadas</small><strong>{focus?.pits ?? '—'}</strong></div><div><small>Composto / desgaste</small><strong>{focus ? `${focus.tyre.compound} · ${fmt(focus.tyre.wear, 0)}%` : '—'}</strong></div><div><small>Última volta</small><strong>{focus?.last && Number.isFinite(focus.last) ? `${fmt(focus.last, 3)}s` : '—'}</strong></div><div><small>Comando ativo</small><strong>{focus ? race.commands[focus.id]?.kind ?? '—' : '—'}</strong></div><p className="race-control-footnote">Boxes registrados: {focus ? race.events.filter(event => event.driverId === focus.id && event.type === 'pit').slice(-3).map(event => `V${event.lap} ${event.detail}`).join(' · ') || 'nenhum' : '—'}. Comandos continuam no painel de engenharia.</p></div>}
        {tab === 'CLIMA' && <div className="race-control-cards"><div><small>Condição</small><strong>{race.weather.condition}</strong></div><div><small>Ar / pista</small><strong>{fmt(race.weather.air,0)}° / {fmt(race.weather.track,0)}°C</strong></div><div><small>Umidade</small><strong>{fmt(race.weather.humidity,0)}%</strong></div><div><small>Intensidade da chuva</small><strong>{fmt(race.weather.intensity,2)}</strong></div><div><small>Água na pista</small><strong>{fmt(race.weather.water,2)}</strong></div><div><small>Aderência</small><strong>{fmt(race.weather.grip,2)}</strong></div><div><small>Previsão do simulador</small><strong>{fmt(race.weather.forecast,0)}%</strong></div><p className="race-control-footnote">Evolução registrada: {race.frames.length > 1 ? race.frames.slice(-4).map(frame => `V${frame.lap} ${frame.weather.condition}`).join(' → ') : 'indisponível neste save'}.</p></div>}
        {tab === 'TELEMETRIA' && <div className="race-control-cards"><div><small>Piloto</small><strong>{focus ? driverName(focus.id) : '—'}</strong></div><div><small>Posição</small><strong>{selectedIndex >= 0 ? 'P'+(selectedIndex+1) : '—'}</strong></div><div><small>Bateria</small><strong>{focus && typeof batteryOf(focus.id) === 'number' ? fmt(batteryOf(focus.id),0)+'%' : '—'}</strong></div><div><small>Combustível restante</small><strong>{focus && typeof fuelOf(focus.id) === 'number' ? `${fmt(fuelOf(focus.id),1)} unidades` : '—'}</strong></div><div><small>Pneu</small><strong>{focus ? focus.tyre.compound+' · '+fmt(focus.tyre.temperature,0)+'°C' : '—'}</strong></div><div><small>Setor registrado</small><strong>{tele?.sector ?? '—'}</strong></div><div><small>Ritmo relativo registrado</small><strong>{typeof tele?.relativeSpeed === 'number' && Number.isFinite(tele.relativeSpeed) ? `${fmt(tele.relativeSpeed, 2)}×` : '—'}</strong></div><div><small>Velocidade instantânea</small><strong>Não disponível</strong></div><p className="race-control-footnote">Somente medidas presentes no estado da simulação. Sem velocidades ou sensores fictícios.</p></div>}
      </div>
    </>}
  </section>;
}
