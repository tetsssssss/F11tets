/** Race soundscape, presentation-only: never modifies the race engine or the save. */
import type { RaceEvent } from '../domain/simulation/types';
import type { RaceState } from '../domain/gameplay/types';

export type AudioCue = 'impact' | 'lockup' | 'pit' | 'pass' | 'failure' | 'flag' | 'finish' | 'radio' | 'shift';
export type AudioMix = 'broadcast' | 'cockpit';
export type SoundPreferences = {
  volume: number;
  engine: number;
  effects: number;
  ambient: number;
  radio: number;
  mix: AudioMix;
};
export const SOUND_STORAGE_KEY = 'f1-universe:race-audio:v1';
export const DEFAULT_SOUND: SoundPreferences = {
  volume: 68, engine: 70, effects: 78, ambient: 37, radio: 70, mix: 'broadcast',
};
export const clampAudio = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
export function sanitiseSound(value: unknown): SoundPreferences {
  const obj = value && typeof value === 'object' ? value as Partial<SoundPreferences> : {};
  return {
    volume: clampAudio(Number(obj.volume ?? DEFAULT_SOUND.volume)),
    engine: clampAudio(Number(obj.engine ?? DEFAULT_SOUND.engine)),
    effects: clampAudio(Number(obj.effects ?? DEFAULT_SOUND.effects)),
    ambient: clampAudio(Number(obj.ambient ?? DEFAULT_SOUND.ambient)),
    radio: clampAudio(Number(obj.radio ?? DEFAULT_SOUND.radio)),
    mix: obj.mix === 'cockpit' ? 'cockpit' : 'broadcast',
  };
}
export function readSoundPreferences(): SoundPreferences {
  try { return sanitiseSound(JSON.parse(localStorage.getItem(SOUND_STORAGE_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_SOUND }; }
}
export function writeSoundPreferences(value: SoundPreferences): void {
  try { localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(sanitiseSound(value))); }
  catch { /* Private browsing or unavailable storage: sound remains session-local. */ }
}

/** Only pronounce verified race events, never inferred collisions or overtakes. */
export function eventAudioCue(type: string): AudioCue | null {
  switch (type) {
    case 'collision': case 'contact': case 'unsafe release': return 'impact';
    case 'braking lock-up': case 'spin': return 'lockup';
    case 'pit': return 'pit';
    case 'overtake': return 'pass';
    case 'puncture': case 'mechanical failure': case 'retirement': return 'failure';
    default: return null;
  }
}
/** High impact first, focus-car relevance, and a strict per-tick voice budget. */
export function selectEventCues(events: readonly RaceEvent[], focusedId: string | null, limit = 2): AudioCue[] {
  if (limit <= 0) return [];
  const priority: Record<Exclude<AudioCue, 'flag' | 'finish' | 'radio' | 'shift'>, number> = {
    impact: 6, failure: 5, lockup: 4, pit: 3, pass: 2,
  };
  return events.map((event, index) => ({
    cue: eventAudioCue(event.type),
    own: !!focusedId && (event.driverId === focusedId || event.otherId === focusedId),
    index,
  })).filter((v): v is { cue: Exclude<AudioCue, 'flag' | 'finish' | 'radio' | 'shift'>; own: boolean; index: number } => !!v.cue)
    .sort((a, b) => priority[b.cue] + (b.own ? 3 : 0) - priority[a.cue] - (a.own ? 3 : 0) || b.index - a.index)
    .slice(0, Math.min(2, Math.floor(limit))).map(v => v.cue);
}
export type EngineAudioFrame = { active: boolean; pitch: number; load: number; wind: number; rain: number; neutral: boolean };
/** Synthesised motor load is an illustrative approximation; it is not measured RPM or telemetry. */
export function engineAudioFrame(r: RaceState, focusId: string | null): EngineAudioFrame {
  const car = r.cars.find(c => c.id === focusId) ?? r.cars.find(c => c.status === 'RUNNING');
  const active = r.status === 'RUNNING' && !r.paused && !!car && car.status === 'RUNNING' && r.control !== 'RED';
  const neutral = r.control !== 'GREEN';
  const command = car && r.commands[car.id]?.kind;
  const attack = command === 'ATTACK' || command === 'BRAKING_ATTACK';
  const saving = command === 'SAVE';
  const pit = car?.pitPhase !== 'TRACK';
  const sector = r.sector;
  const base = sector === 1 ? 0.73 : sector === 2 ? 0.93 : 0.81;
  const load = Math.max(0.1, Math.min(1, base + (attack ? .13 : 0) - (saving ? .22 : 0) - (neutral ? .35 : 0) - (pit ? .50 : 0)));
  return {
    active,
    pitch: 82 + load * 165 + Math.sin((r.lap * 3 + sector) * .8) * 9,
    load,
    wind: active ? Math.max(0.05, load * (neutral ? .25 : .7)) : 0,
    rain: Math.max(0, Math.min(1, r.weather.water * 1.4)),
    neutral,
  };
}

/** User-gesture-unlocked Web Audio synth with a single reused engine graph. */
export class RaceSoundEngine {
  private context: AudioContext;
  private master: GainNode;
  private motor: GainNode;
  private whine: GainNode;
  private atmosphere: GainNode;
  private engineLow: OscillatorNode;
  private engineHigh: OscillatorNode;
  private turbo: OscillatorNode;
  private air: AudioBufferSourceNode;
  private airFilter: BiquadFilterNode;
  private preferences: SoundPreferences = { ...DEFAULT_SOUND };
  private hidden = false;
  private lastOneShot = 0;
  constructor() {
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) throw new Error('Web Audio indisponível neste navegador.');
    const ctx = new AudioCtor();
    this.context = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.ratio.value = 7;
    compressor.attack.value = .004;
    compressor.release.value = .18;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.master.connect(compressor); compressor.connect(ctx.destination);
    this.motor = ctx.createGain(); this.motor.gain.value = 0;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1600;
    this.motor.connect(filter); filter.connect(this.master);
    this.whine = ctx.createGain(); this.whine.gain.value = 0;
    this.whine.connect(this.master);
    this.engineLow = ctx.createOscillator(); this.engineLow.type = 'sawtooth'; this.engineLow.frequency.value = 98;
    this.engineHigh = ctx.createOscillator(); this.engineHigh.type = 'triangle'; this.engineHigh.frequency.value = 202;
    const low = ctx.createGain(); low.gain.value = .20;
    const high = ctx.createGain(); high.gain.value = .13;
    this.engineLow.connect(low); low.connect(this.motor);
    this.engineHigh.connect(high); high.connect(this.motor);
    this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 650;
    this.turbo.connect(this.whine);
    this.engineLow.start(); this.engineHigh.start(); this.turbo.start();
    // Fixed cyclic noise source for road wind + rain; the same buffer is reused for the whole race.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + .035 * (Math.random() * 2 - 1)) / 1.035; data[i] = last * 3; }
    this.air = ctx.createBufferSource(); this.air.buffer = noise; this.air.loop = true;
    this.airFilter = ctx.createBiquadFilter(); this.airFilter.type = 'lowpass'; this.airFilter.frequency.value = 1250;
    this.atmosphere = ctx.createGain(); this.atmosphere.gain.value = 0;
    this.air.connect(this.airFilter); this.airFilter.connect(this.atmosphere); this.atmosphere.connect(this.master);
    this.air.start();
  }
  async unlock(): Promise<void> { await this.context.resume(); }
  setMix(value: SoundPreferences): void {
    this.preferences = sanitiseSound(value);
    const gain = this.preferences.volume / 100;
    this.master.gain.setTargetAtTime(this.hidden ? 0 : gain * .67, this.context.currentTime, .06);
  }
  setHidden(value: boolean): void { this.hidden = value; this.setMix(this.preferences); }
  update(frame: EngineAudioFrame): void {
    const time = this.context.currentTime;
    const cockpit = this.preferences.mix === 'cockpit';
    const volume = frame.active && !this.hidden ? this.preferences.engine / 100 : 0;
    const engineGain = volume * (cockpit ? .56 : .23) * (.35 + frame.load * .65);
    this.motor.gain.setTargetAtTime(engineGain, time, .12);
    this.whine.gain.setTargetAtTime(volume * (cockpit ? .042 : .013) * frame.load, time, .15);
    this.engineLow.frequency.setTargetAtTime(frame.pitch, time, .09);
    this.engineHigh.frequency.setTargetAtTime(frame.pitch * 1.99, time, .12);
    this.turbo.frequency.setTargetAtTime(420 + frame.load * 550, time, .1);
    this.atmosphere.gain.setTargetAtTime(this.hidden ? 0 : (this.preferences.ambient / 100) * (
      frame.rain * .14 + frame.wind * (cockpit ? .14 : .18)), time, .2);
    this.airFilter.frequency.setTargetAtTime(720 + frame.rain * 2700, time, .2);
  }
  /** Short event cues are rate-limited; no queued hundreds of sounds on 16x fast-forward. */
  play(cue: AudioCue): void {
    if (this.hidden || this.context.state !== 'running') return;
    const time = this.context.currentTime;
    if (cue !== 'radio' && cue !== 'finish' && time - this.lastOneShot < .34) return;
    this.lastOneShot = time;
    const radio = cue === 'radio';
    const amt = (radio ? this.preferences.radio : this.preferences.effects) / 100;
    if (amt <= 0) return;
    const tone = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequencies: Record<AudioCue, [number, number, number, OscillatorType]> = {
      impact: [140, 48, .31, 'sawtooth'], lockup: [690, 310, .34, 'sawtooth'],
      pit: [660, 930, .19, 'square'], pass: [440, 640, .17, 'triangle'],
      failure: [310, 110, .50, 'sawtooth'], flag: [720, 500, .34, 'square'],
      finish: [680, 980, .65, 'triangle'], radio: [940, 1080, .14, 'sine'],
      shift: [295, 210, .075, 'triangle'],
    };
    const [begin, end, duration, wave] = frequencies[cue];
    tone.type = wave; tone.frequency.setValueAtTime(begin, time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(30, end), time + duration);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, amt * (radio ? .10 : .12)), time + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    if (cue === 'pit' || cue === 'radio' || cue === 'finish') {
      // Multiple hits, not one continuous chirp: wheel-gun chatter, comms pips, victory signal.
      const hits = cue === 'pit' ? 4 : cue === 'radio' ? 2 : 3;
      const spacing = cue === 'pit' ? .047 : cue === 'radio' ? .066 : .205;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setValueAtTime(.0001, time);
      for (let i = 0; i < hits; i++) {
        const at = time + i * spacing;
        gain.gain.setValueAtTime(.0001, at);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0002, amt * .14), at + .007);
        gain.gain.exponentialRampToValueAtTime(.0001, at + (cue === 'finish' ? .16 : cue === 'pit' ? .042 : .046));
      }
    }
    if (['impact', 'lockup', 'pit', 'failure'].includes(cue) && this.air.buffer) {
      // Brief filtered-noise transient: collision thud, locked tyre, pneumatic pit gun or sputter.
      const blast = this.context.createBufferSource();
      blast.buffer = this.air.buffer;
      const band = this.context.createBiquadFilter();
      band.type = cue === 'impact' ? 'lowpass' : 'bandpass';
      band.frequency.value = cue === 'lockup' ? 2200 : cue === 'pit' ? 1400 : 450;
      const blastGain = this.context.createGain();
      const blastDuration = cue === 'pit' ? .19 : cue === 'lockup' ? .26 : .22;
      blastGain.gain.setValueAtTime(.0001, time);
      blastGain.gain.exponentialRampToValueAtTime(Math.max(.0002, amt * .32), time + .012);
      blastGain.gain.exponentialRampToValueAtTime(.0001, time + blastDuration);
      blast.connect(band); band.connect(blastGain); blastGain.connect(this.master);
      blast.onended = () => { blast.disconnect(); band.disconnect(); blastGain.disconnect(); };
      blast.start(time); blast.stop(time + blastDuration + .01);
    }
    tone.connect(gain); gain.connect(this.master);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    tone.start(time); tone.stop(time + duration + .01);
  }
  stop(): void { this.update({ active: false, pitch: 80, load: 0, wind: 0, rain: 0, neutral: false }); }
  suspend(): void { this.stop(); void this.context.suspend().catch(() => {}); }
  close(): void {
    try { this.air.stop(); this.engineLow.stop(); this.engineHigh.stop(); this.turbo.stop(); }
    catch { /* May already have stopped on unmount. */ }
    void this.context.close().catch(() => {});
  }
}
