'use client';
import { useState } from 'react';
import { SaveProvider } from '../components/save-provider';
import { createSave } from '../domain/save';
import { configureCareer } from '../domain/gameplay/career';
import { createRaceState } from '../domain/simulation/race';
import { devAction } from '../domain/gameplay/dev';
import { callPit } from '../domain/gameplay/commands';
import { tickLive } from '../domain/simulation';
import type { Save } from '../domain/types';
import LiveRace from './live-race';
const scenarios = [
  '32-car-start',
  'close-battle',
  'rain',
  'safety-car',
  'double-stack',
  'spin',
  'wide',
  'crash',
  'last-lap',
] as const;
export default function DevRace2D() {
  const [fixture, setFixture] = useState<{ save: Save; key: number } | null>(null);
  function start(scenario: string) {
    let s = configureCareer(createSave(2029), 'constructor', 'mclaren');
    s.world.settings.sandbox = true;
    s.race = createRaceState(
      s,
      'GP',
      s.game.drivers.map((d) => d.id),
    );
    s.race.dev = true;
    s.race.autoEvents = 'off';
    if (scenario === 'rain') {
      s = devAction(s, 'rain', 'lando-norris', 100);
      for (let i = 0; i < 3; i++) s = tickLive(s, true);
    }
    if (scenario === 'safety-car') s = devAction(s, 'SC', 'lando-norris');
    if (scenario === 'close-battle') {
      s = devAction(s, 'gap', 'arvid-lindblad');
      s.race!.battles = {
        fixture: {
          attacker: 'arvid-lindblad',
          defender: 'lando-norris',
          lastLap: 0,
          startLap: 0,
          attempts: 1,
          pressure: 70,
          defenderAdaptation: 0,
          batteryDifference: 0,
          tyreDifference: 0,
          relationship: 60,
        },
      };
      s.race!.events.push({
        lap: 0,
        driverId: 'arvid-lindblad',
        otherId: 'lando-norris',
        type: 'attack',
        detail: 'DEV: batalha preparada para inspeção visual.',
      });
    }
    if (scenario === 'double-stack') {
      for (const relation of Object.values(s.career.ceoRelations)) relation.Obediência = 100;
      s = callPit(s, 'lando-norris', 'now', 'H');
      s = callPit(s, 'arvid-lindblad', 'now', 'H');
      for (let i = 0; i < 3; i++) s = tickLive(s, true);
    }
    if (scenario === 'spin' || scenario === 'wide' || scenario === 'crash') s = devAction(s, scenario, 'lando-norris');
    if (scenario === 'last-lap') {
      s.race!.laps = 3;
      for (let i = 0; i < 6; i++) s = tickLive(s, true);
    }
    s.race!.paused = true;
    setFixture({ save: s, key: Date.now() });
  }
  return (
    <>
      <h1>Laboratório 2D</h1>
      <p>
        Fixtures isoladas em memória. Nenhum slot de carreira é gravado. DEV fica marcado nos
        eventos e na corrida.
      </p>
      <div className="career-actions">
        {scenarios.map((s) => (
          <button className="button secondary" key={s} onClick={() => start(s)}>
            {s}
          </button>
        ))}
      </div>
      {fixture && (
        <SaveProvider key={fixture.key} initialSave={fixture.save} ephemeral>
          <LiveRace />
        </SaveProvider>
      )}
    </>
  );
}
