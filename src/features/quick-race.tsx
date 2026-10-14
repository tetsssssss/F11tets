'use client';
import { useState } from 'react';
import { SaveProvider, useSave } from '../components/save-provider';
import { createSave } from '../domain/save';
import { createRaceState } from '../domain/simulation/race';
import { configureCareer } from '../domain/gameplay/career';
import { PageTitle } from '../components/ui';
import LiveRace from './live-race';
import type { Save } from '../domain/types';
import { downloadData } from './universe';
function Session({ exit }: { exit: () => void }) {
  const { save } = useSave();
  return (
    <>
      <p className="projection-note">
        CORRIDA RÁPIDA · Sessão isolada. Os três slots da carreira não são lidos nem gravados.
      </p>
      <div className="universe-links">
        <button className="button secondary" onClick={exit}>
          Voltar à corrida rápida
        </button>
        <button
          className="button secondary"
          onClick={() =>
            downloadData('corrida-rapida.json', {
              provenance: 'SANDBOX_QUICK_RACE',
              race: save.race,
              results: save.weekends[0]?.results.GP,
            })
          }
        >
          Exportar esta corrida
        </button>
      </div>
      <LiveRace quickRace onQuickRaceExit={exit} />
    </>
  );
}
export default function QuickRacePage() {
  const [base] = useState(() => createSave(2029)),
    [circuit, setCircuit] = useState(base.game.circuits[0].id),
    [spectator, setSpectator] = useState(true),
    [seed, setSeed] = useState(2030),
    [session, setSession] = useState<Save | null>(null);
  function start() {
    let s = configureCareer(createSave(seed), 'driver', 'lando-norris');
    s.world.settings.sandbox = true;
    s.world.settings.spectator = spectator;
    s.game.circuits[0] = { ...s.game.circuits.find((c) => c.id === circuit)!, round: 1 };
    s.race = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    );
    setSession(s);
  }
  if (session)
    return (
      <SaveProvider initialSave={session} ephemeral>
        <Session exit={() => setSession(null)} />
      </SaveProvider>
    );
  return (
    <>
      <PageTitle
        eyebrow="CORRIDA RÁPIDA / ESPECTADOR"
        title="Um GP. Sem compromisso com a carreira."
        subtitle="O mesmo motor de corrida, com estado temporário e exportação própria."
      />
      <section className="panel padded">
        <div className="career-controls">
          <label>
            Circuito
            <select
              aria-label="Circuito da corrida rápida"
              value={circuit}
              onChange={(e) => setCircuit(e.target.value)}
            >
              {base.game.circuits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Semente
            <input
              type="number"
              min="0"
              max="2147483647"
              value={seed}
              onChange={(e) =>
                setSeed(Math.max(0, Math.min(2147483647, Math.floor(Number(e.target.value) || 0))))
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={spectator}
              onChange={(e) => setSpectator(e.target.checked)}
            />
            Espectador, com todos os carros controlados pela IA
          </label>
        </div>
        <button className="button primary" onClick={start}>
          Iniciar corrida rápida
        </button>
      </section>
    </>
  );
}
