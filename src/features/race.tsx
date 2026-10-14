'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { CircuitMap } from '../components/visuals';
import { trackPath } from '../data/circuits';
import { useUniverse } from '../components/save-provider';
import { Badge, EmptyState } from '../components/ui';
import type { Circuit, Result, Session } from '../domain/types';
import type { RaceTape } from '../domain/simulation/types';
export default function Race2D({
  circuit,
  results,
  tape,
  session,
}: {
  circuit: Circuit;
  results?: Result[];
  tape?: RaceTape;
  session?: Session;
}) {
  const { driverById, teamById } = useUniverse();
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState('lando-norris');
  const [geometry, setGeometry] = useState<{ x: number; y: number }[]>([]);
  const path = useRef<SVGPathElement>(null);
  const duration = tape?.frames.length ?? 0;
  const frame = tape?.frames[Math.min(index, duration - 1)];
  const finished = index >= duration - 1;
  useEffect(() => {
    if (!path.current) return;
    const p = path.current,
      l = p.getTotalLength();
    setGeometry(
      Array.from({ length: 1000 }, (_, i) => {
        const pt = p.getPointAtLength((i * l) / 1000);
        return { x: pt.x, y: pt.y };
      }),
    );
  }, [tape]);
  useEffect(() => {
    if (!running || finished) return;
    const timer = setInterval(() => setIndex((i) => Math.min(duration - 1, i + 1)), 1200 / speed);
    return () => clearInterval(timer);
  }, [running, speed, finished, duration]);
  if (!tape || !frame)
    return (
      <section className="panel padded">
        <EmptyState
          title={results ? 'Resultado legado sem telemetria' : 'A pista espera sua próxima sessão.'}
          text="Complete uma sessão para acompanhar suas voltas, clima, energia, pneus e incidentes no replay."
        />
      </section>
    );
  const active = frame.cars.find((c) => c.id === selected) ?? frame.cars[0];
  const events = tape.events
    .filter((e) => e.lap <= frame.lap)
    .slice(-8)
    .reverse();
  return (
    <section className="panel race-view">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            REPLAY DA SIMULAÇÃO · {session} · SEED {tape.seed}
          </span>
          <h2>Race control / {circuit.name}</h2>
        </div>
        <Badge tone={frame.control === 'GREEN' ? 'green-tag' : 'amber-tag'}>{frame.control}</Badge>
      </div>
      <div className="race-controls">
        <div className="race-laps">
          <small>VOLTA</small>
          <strong>
            {String(frame.lap).padStart(2, '0')}
            <span> / {tape.laps}</span>
          </strong>
        </div>
        <div className="race-control-buttons">
          <button
            className="button primary"
            disabled={finished}
            onClick={() => setRunning(!running)}
          >
            {running && !finished ? <Pause size={15} /> : <Play size={15} />}{' '}
            {running && !finished ? 'Pausar' : 'Reproduzir'}
          </button>
          <button
            className="icon-button"
            aria-label="Reiniciar animação"
            onClick={() => {
              setIndex(0);
              setRunning(false);
            }}
          >
            <RotateCcw size={18} />
          </button>
          <label>
            Velocidade
            <select
              aria-label="Velocidade da corrida"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[1, 4, 12].map((v) => (
                <option value={v} key={v}>
                  {v}×
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <input
        className="replay-timeline"
        type="range"
        min="0"
        max={duration - 1}
        value={index}
        aria-label="Volta do replay"
        onChange={(e) => {
          setIndex(Number(e.target.value));
          setRunning(false);
        }}
      />
      <div className="race-body">
        <div className="race-track-stage">
          <div className="race-track-label">
            <span className="eyebrow">
              {frame.weather.condition.toUpperCase()} · PISTA {frame.weather.track.toFixed(1)}°C
            </span>
            <h3>{circuit.name}</h3>
          </div>
          <CircuitMap>
            <path d={trackPath} ref={path} fill="none" stroke="none" />
            {geometry.length > 0 &&
              frame.cars.map((c) => {
                const offset =
                  (((frame.lap * 0.07 - c.gap / ((circuit.km / 230) * 3600)) % 1) + 1) % 1;
                const p = geometry[Math.floor(offset * 999)];
                return (
                  <g
                    className="race-car-dot"
                    key={c.id}
                    transform={'translate(' + p.x + ',' + p.y + ')'}
                    onClick={() => setSelected(c.id)}
                  >
                    <circle
                      r={c.id === selected ? 7 : 4.5}
                      fill={
                        c.status === 'RUNNING' ? teamById[driverById[c.id].teamId].color : '#555'
                      }
                    />
                    <title>
                      {driverById[c.id].name} · P{c.position}
                    </title>
                  </g>
                );
              })}
          </CircuitMap>
          <p className="micro">
            Traçado conceitual. Espaçamento visual estimado a partir dos gaps registrados por volta.
          </p>
          <div className="race-telemetry">
            <strong>{driverById[active.id].name}</strong>
            <p>
              P{active.position} · +{active.gap.toFixed(3)} s · {active.status}
            </p>
            <p>
              Pneu {active.tyre}: desgaste {active.tyreWear.toFixed(1)}% /{' '}
              {active.tyreTemp.toFixed(1)}°C
            </p>
            <p>
              Bateria {active.battery.toFixed(1)}% · {active.energy} · {active.aero} · {active.pits}{' '}
              pits
            </p>
          </div>
        </div>
        <div className="race-timing">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>POS</th>
                  <th>PILOTO</th>
                  <th>GAP / STATUS</th>
                  <th>PNEU</th>
                  <th>ERS</th>
                  <th>PITS</th>
                </tr>
              </thead>
              <tbody>
                {frame.cars.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={c.id === selected ? 'selected' : ''}
                  >
                    <td>{c.position}</td>
                    <td>{driverById[c.id].short}</td>
                    <td>{c.status === 'RUNNING' ? '+' + c.gap.toFixed(2) : c.status}</td>
                    <td>
                      {c.tyre} · {c.tyreWear.toFixed(0)}%
                    </td>
                    <td>{c.battery.toFixed(0)}%</td>
                    <td>{c.pits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="career-events">
        <h3>Direção de prova</h3>
        <p>
          {frame.weather.condition} · água na pista {(frame.weather.water * 100).toFixed(0)}% ·
          umidade {frame.weather.humidity.toFixed(0)}% · aderência {frame.weather.grip.toFixed(1)}%
          · previsão {frame.weather.forecast.toFixed(0)}%
        </p>
        {events.length ? (
          events.map((e, i) => (
            <p key={i}>
              <b>
                V{e.lap} · {driverById[e.driverId].short}
              </b>{' '}
              — {e.detail}
            </p>
          ))
        ) : (
          <p>Nenhum incidente registrado até esta volta.</p>
        )}
      </div>
    </section>
  );
}
