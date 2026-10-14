'use client';
import { useEffect, useRef, useState } from 'react';
import type { RaceState } from '../domain/gameplay/types';
import {
  DEFAULT_SOUND, RaceSoundEngine, engineAudioFrame, readSoundPreferences,
  selectEventCues, writeSoundPreferences, type SoundPreferences,
} from '../audio/race-sound';

/** Audio is strictly opt-in. No context or sound is created before a user clicks Ativar. */
export function RaceSoundControls({ race, focusedId }: { race: RaceState; focusedId: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [mix, setMix] = useState<SoundPreferences>(DEFAULT_SOUND);
  const [loaded, setLoaded] = useState(false);
  const director = useRef<RaceSoundEngine | null>(null);
  const seen = useRef({ seed: race.seed, events: race.events.length, radio: race.radio.at(-1)?.id ?? 0, control: race.control, status: race.status, step: race.lap * 3 + race.sector });
  useEffect(() => { setMix(readSoundPreferences()); setLoaded(true); }, []);
  useEffect(() => {
    if (!loaded) return;
    director.current?.setMix(mix);
    writeSoundPreferences(mix);
  }, [mix, loaded]);
  useEffect(() => {
    const onVisibility = () => director.current?.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      director.current?.close();
      director.current = null;
    };
  }, []);
  useEffect(() => {
    const sound = director.current;
    const last = seen.current;
    const step = race.lap * 3 + race.sector;
    const same = last.seed === race.seed;
    const events = same && race.events.length >= last.events ? race.events.slice(last.events) : [];
    const radio = same && (race.radio.at(-1)?.id ?? 0) > last.radio;
    const controlChanged = same && last.control !== race.control;
    const finished = same && last.status !== 'FINISHED' && race.status === 'FINISHED';
    const shifted = same && last.step !== step && step > last.step;
    seen.current = { seed: race.seed, events: race.events.length, radio: race.radio.at(-1)?.id ?? 0, control: race.control, status: race.status, step };
    if (!enabled || !sound) return;
    sound.setHidden(document.hidden);
    sound.update(engineAudioFrame(race, focusedId));
    // In fast-forward, prioritize the bigger moments over tiny repeated cues.
    if (finished) sound.play('finish');
    else if (controlChanged && race.control !== 'GREEN') sound.play('flag');
    else if (radio) sound.play('radio');
    else if (race.speed <= 4 || events.some(e => /collision|contact|mechanical failure|retirement/.test(e.type))) {
      const cue = selectEventCues(events, focusedId, 1)[0];
      if (cue) sound.play(cue);
      else if (shifted && race.speed <= 2 && race.status === 'RUNNING' && !race.paused && race.control === 'GREEN') sound.play('shift');
    }
  }, [race.seed, race.events.length, race.radio.at(-1)?.id, race.control, race.status,
    race.paused, race.lap, race.sector, race.speed, focusedId, enabled, mix]);

  async function toggle() {
    if (enabled) {
      director.current?.setHidden(true);
      director.current?.suspend();
      setEnabled(false);
      return;
    }
    setError('');
    try {
      const sound = director.current ?? new RaceSoundEngine();
      director.current = sound;
      await sound.unlock();
      sound.setMix(mix);
      sound.setHidden(document.hidden);
      sound.update(engineAudioFrame(race, focusedId));
      seen.current = { seed: race.seed, events: race.events.length, radio: race.radio.at(-1)?.id ?? 0, control: race.control, status: race.status, step: race.lap * 3 + race.sector };
      setEnabled(true);
      sound.play('radio');
    } catch (reason) {
      setEnabled(false);
      setError(reason instanceof Error ? reason.message : 'Falha ao ativar áudio.');
    }
  }
  function change(key: keyof SoundPreferences, value: number | string) {
    setMix(current => ({ ...current, [key]: value }));
  }
  return (
    <div className="race-sound" aria-label="Sonoplastia da corrida">
      <button type="button" className={'button secondary race-sound-toggle' + (enabled ? ' is-on' : '')}
        aria-pressed={enabled} onClick={toggle} title="Ativar ou silenciar os efeitos de corrida">
        {enabled ? '◖)) SOM ON' : '◖) ATIVAR SOM'}
      </button>
      <button type="button" className="button secondary race-sound-settings" aria-expanded={expanded}
        aria-label="Abrir mixagem de áudio" onClick={() => setExpanded(value => !value)}>ÁUDIO ⚙</button>
      {expanded && <div className="race-sound-panel" role="group" aria-label="Mixagem de áudio">
        <div className="race-sound-title"><strong>MIXAGEM DO GP</strong><span>{enabled ? 'AO VIVO' : 'DESLIGADO'}</span></div>
        <label>Perspectiva
          <select value={mix.mix} aria-label="Perspectiva sonora" onChange={event => change('mix', event.target.value)}>
            <option value="broadcast">Transmissão TV</option><option value="cockpit">Dentro do cockpit</option>
          </select>
        </label>
        {([
          ['volume','Volume geral'],['engine','Motores / turbo'],['effects','Pista / incidentes'],
          ['ambient','Vento / chuva'],['radio','Rádio / equipe'],
        ] as const).map(([key, title]) => <label key={key} className="race-sound-level">
          <span>{title}<b>{mix[key]}%</b></span>
          <input type="range" aria-label={title} min="0" max="100" step="5" value={mix[key]}
            onChange={event => change(key, Number(event.target.value))}/>
        </label>)}
        <p>Sons sintetizados e sincronizados aos eventos da simulação. O áudio só inicia por sua escolha e não altera o save.</p>
        <button type="button" className="button secondary" disabled={!enabled} onClick={() => director.current?.play('radio')}>TESTAR RÁDIO</button>
      </div>}
      {error && <span role="alert" className="race-sound-error">{error}</span>}
    </div>
  );
}
