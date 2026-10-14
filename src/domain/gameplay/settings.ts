import type { Save, Session } from '../types';
import type { RaceState } from './types';
import { rng, seedFor } from '../simulation/random';
export const PRESETS = ['CASUAL', 'NORMAL', 'PRO', 'SIMULATION', 'CUSTOM'] as const;
export type Preset = (typeof PRESETS)[number];
export const SLIDERS = [
  ['aiCompetitiveness', 'Competitividade da IA', 'IA menos otimizada', 'IA toma decisões melhores'],
  ['aiAggression', 'Agressividade da IA', 'Poucas tentativas', 'Mais ataques, defesa e risco'],
  ['driverErrors', 'Erros dos pilotos', 'Menos erros', 'Mais travadas, rodadas e saídas'],
  ['mechanicalFailures', 'Falhas mecânicas', 'Falhas raras', 'Mais falhas'],
  ['tyreWear', 'Desgaste dos pneus', '50%', '150%'],
  ['weatherVariability', 'Variação climática', 'Previsão estável', 'Mais mudanças'],
  ['incidents', 'Incidentes', 'Menos contatos', 'Mais contatos e rodadas'],
  ['damage', 'Severidade dos danos', 'Tolerante', 'Realista'],
  ['safetyCar', 'Frequência de Safety Car', 'Raro', 'Frequente'],
  ['energy', 'Gestão de energia', 'Permissiva', 'Uso errado pesa mais'],
  ['aiStrategy', 'Estratégia da IA', 'Paradas simples', 'Undercut, chuva e SC bem lidos'],
] as const;
export type SliderKey = (typeof SLIDERS)[number][0];
export const DISTANCES = [25, 50, 75, 100] as const;
export type Distance = (typeof DISTANCES)[number];
export const ASSISTS = [
  ['autoPauseEvents', 'Pausar em eventos importantes'],
  ['autoSlowBattle', 'Reduzir velocidade em batalhas'],
  ['autoSlowPit', 'Reduzir velocidade em pit stops'],
  ['autoSlowRain', 'Reduzir velocidade na chuva'],
  ['autoSlowSafetyCar', 'Reduzir velocidade no Safety Car'],
  ['autoCamera', 'Câmera automática'],
  ['engineerRecommendations', 'Recomendações do engenheiro'],
  ['autoPitAssist', 'Pit stop automático'],
  ['strategyAssist', 'Assistente de estratégia'],
] as const;
export type AssistKey = (typeof ASSISTS)[number][0];
export type CareerSettings = {
  preset: Preset;
  /** True once any value was changed by hand; it stays on the save for honesty. */
  custom: boolean;
  profile: 'watch' | 'moments' | 'manage';
  sliders: Record<SliderKey, number>;
  distance: Distance;
  sessions: {
    practice: 'watch' | 'simulate' | 'auto';
    qualifying: 'play' | 'simulate';
    sprint: 'play' | 'simulate';
    gp: 'play' | 'simulate' | 'highlights' | 'instant';
  };
  assists: Record<AssistKey, boolean>;
  radio: 'MINIMAL' | 'TV' | 'TECHNICAL';
  /** 0 means AUTO: the speed follows what is happening on track. */
  speed: 0 | 0.5 | 0.75 | 1 | 2 | 4 | 8 | 16;
  /** How exact the numbers shown to the player are. */
  information: 'precise' | 'estimated';
};
const base = (): CareerSettings => ({
  preset: 'NORMAL',
  custom: false,
  profile: 'moments',
  sliders: {
    aiCompetitiveness: 50,
    aiAggression: 50,
    driverErrors: 50,
    mechanicalFailures: 50,
    tyreWear: 100,
    weatherVariability: 50,
    incidents: 50,
    damage: 50,
    safetyCar: 50,
    energy: 50,
    aiStrategy: 50,
  },
  distance: 100,
  // Matches how the career already played: practice and qualifying simulated, races live.
  sessions: { practice: 'simulate', qualifying: 'simulate', sprint: 'play', gp: 'play' },
  assists: {
    autoPauseEvents: false,
    autoSlowBattle: true,
    autoSlowPit: true,
    autoSlowRain: true,
    autoSlowSafetyCar: true,
    autoCamera: false,
    engineerRecommendations: true,
    autoPitAssist: true,
    strategyAssist: true,
  },
  radio: 'TV',
  speed: 1,
  information: 'precise',
});
/** NORMAL is the engine exactly as it was: every modifier it produces is 1. */
export const defaultSettings = base;
export function presetSettings(preset: Exclude<Preset, 'CUSTOM'>): CareerSettings {
  const s = base();
  s.preset = preset;
  if (preset === 'CASUAL') {
    Object.assign(s.sliders, {
      aiCompetitiveness: 35,
      aiAggression: 40,
      driverErrors: 35,
      mechanicalFailures: 35,
      tyreWear: 80,
      damage: 35,
      incidents: 40,
      energy: 35,
      aiStrategy: 40,
    });
    s.assists.autoPauseEvents = true;
  }
  if (preset === 'PRO') {
    Object.assign(s.sliders, {
      aiCompetitiveness: 65,
      aiAggression: 60,
      damage: 70,
      energy: 60,
      aiStrategy: 75,
    });
    Object.assign(s.assists, { autoPitAssist: false, strategyAssist: false });
  }
  if (preset === 'SIMULATION') {
    Object.assign(s.sliders, {
      aiCompetitiveness: 80,
      aiAggression: 65,
      driverErrors: 55,
      mechanicalFailures: 60,
      tyreWear: 110,
      weatherVariability: 65,
      incidents: 55,
      damage: 85,
      safetyCar: 55,
      energy: 75,
      aiStrategy: 90,
    });
    Object.assign(s.assists, {
      autoSlowBattle: false,
      autoSlowPit: false,
      autoSlowRain: false,
      autoSlowSafetyCar: false,
      engineerRecommendations: false,
      autoPitAssist: false,
      strategyAssist: false,
    });
    s.radio = 'TECHNICAL';
    s.information = 'estimated';
  }
  return s;
}
/** The three opening profiles only pre-fill participation; everything stays editable. */
export function applyProfile(s: CareerSettings, profile: CareerSettings['profile']) {
  const next = { ...s, profile, sessions: { ...s.sessions }, assists: { ...s.assists } };
  if (profile === 'watch') {
    next.sessions = { practice: 'watch', qualifying: 'play', sprint: 'play', gp: 'play' };
    next.speed = 1;
  }
  if (profile === 'moments') {
    next.sessions = { practice: 'auto', qualifying: 'simulate', sprint: 'play', gp: 'highlights' };
    next.speed = 0;
    next.assists.autoCamera = true;
  }
  if (profile === 'manage') {
    next.sessions = { practice: 'auto', qualifying: 'simulate', sprint: 'simulate', gp: 'instant' };
    next.speed = 16;
  }
  return next;
}
export const settingsOf = (save: Pick<Save, 'career'>): CareerSettings =>
  save.career.settings ?? base();
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** Fills anything missing or out of range, so older saves and hand edits stay valid. */
export function normalizeSettings(input: unknown): CareerSettings {
  const d = base(),
    raw = (input && typeof input === 'object' ? input : {}) as Partial<CareerSettings>;
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T) =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const sliders = { ...d.sliders };
  for (const [key] of SLIDERS) {
    const v = Number(raw.sliders?.[key]);
    if (Number.isFinite(v))
      sliders[key] =
        key === 'tyreWear'
          ? Math.max(50, Math.min(150, Math.round(v)))
          : Math.round(clamp01(v / 100) * 100);
  }
  const assists = { ...d.assists };
  for (const [key] of ASSISTS)
    if (typeof raw.assists?.[key] === 'boolean') assists[key] = raw.assists[key];
  return {
    preset: pick(raw.preset, PRESETS, d.preset),
    custom: raw.custom === true,
    profile: pick(raw.profile, ['watch', 'moments', 'manage'] as const, d.profile),
    sliders,
    distance: pick(raw.distance, DISTANCES, d.distance),
    sessions: {
      practice: pick(
        raw.sessions?.practice,
        ['watch', 'simulate', 'auto'] as const,
        d.sessions.practice,
      ),
      qualifying: pick(
        raw.sessions?.qualifying,
        ['play', 'simulate'] as const,
        d.sessions.qualifying,
      ),
      sprint: pick(raw.sessions?.sprint, ['play', 'simulate'] as const, d.sessions.sprint),
      gp: pick(
        raw.sessions?.gp,
        ['play', 'simulate', 'highlights', 'instant'] as const,
        d.sessions.gp,
      ),
    },
    assists,
    radio: pick(raw.radio, ['MINIMAL', 'TV', 'TECHNICAL'] as const, d.radio),
    speed: pick(raw.speed, [0, 0.5, 0.75, 1, 2, 4, 8, 16] as const, d.speed),
    information: pick(raw.information, ['precise', 'estimated'] as const, d.information),
  };
}
/** 0-100 around 50 becomes a bounded factor that is exactly 1 at the default. */
const around = (value: number, low: number, high: number) =>
  value <= 50 ? low + ((1 - low) * value) / 50 : 1 + ((high - 1) * (value - 50)) / 50;
/**
 * What the engine actually reads. Sliders never touch driver or car ratings: they scale how often
 * things happen and how well the AI decides. Every factor is 1 (or 0 for shifts) on NORMAL at
 * 100% distance, which keeps existing saves and results identical.
 */
export function raceModifiers(save: Pick<Save, 'career'>, session?: Session) {
  const s = settingsOf(save),
    v = s.sliders,
    race = session === undefined || session === 'GP' || session === 'Sprint',
    distance = race ? s.distance / 100 : 1;
  return {
    distance,
    // A shorter race wears tyres faster so stints and pit windows keep their shape.
    wear: (v.tyreWear / 100) * Math.pow(1 / distance, 0.9),
    errors: around(v.driverErrors, 0.6, 1.5),
    failures: around(v.mechanicalFailures, 0.5, 1.6),
    incidents: around(v.incidents, 0.6, 1.5),
    safetyCar: around(v.safetyCar, 0.5, 1.5),
    damage: around(v.damage, 0.6, 1.4),
    weather: around(v.weatherVariability, 0.5, 1.6),
    energy: around(v.energy, 0.6, 1.5),
    aggression: around(v.aiAggression, 0.7, 1.35),
    /** Points added to the AI engineers' strategy reading (pit timing, undercut, SC, rain). */
    strategy: ((v.aiStrategy - 50) / 50) * 8,
    /** Chance an AI driver misses the right in-race call this lap. Zero from 50 upwards. */
    hesitation: Math.max(0, (50 - v.aiCompetitiveness) / 50) * 0.5,
    /** How much earlier a sharp AI reacts to worn tyres and low battery. */
    sharpness: Math.max(0, (v.aiCompetitiveness - 50) / 50),
  };
}
export type RaceModifiers = ReturnType<typeof raceModifiers>;
/** Value as the player is allowed to see it: exact, or a range that hides the true figure. */
export function shown(save: Pick<Save, 'career' | 'seed'>, value: number, key: string, unit = '%') {
  if (settingsOf(save).information === 'precise') return value.toFixed(0) + unit;
  const random = rng(seedFor(save.seed, 'estimate', key, Math.round(value / 3))),
    low = Math.max(0, Math.round(value - 2 - random() * 5)),
    high = Math.min(100, Math.round(value + 2 + random() * 5));
  return `${low}–${high}${unit}`;
}
const INTEREST = /pit|contact|collision|mechanical failure|overtake|puncture|retirement|red flag/;
/**
 * Speed for AUTO and for highlights: slow where something is worth watching, fast in between.
 * Reads the race only. `quiet` is the cruising speed (8 for AUTO, 16 for highlights).
 */
export function autoSpeed(save: Pick<Save, 'career'>, r: RaceState, own: string[], quiet: 8 | 16) {
  const order = [...r.cars]
    .filter((c) => c.status === 'RUNNING')
    .sort((a, b) => b.lap - a.lap || a.elapsed - b.elapsed);
  const close = (i: number) => i > 0 && order[i].elapsed - order[i - 1].elapsed < 1,
    mine = order.findIndex((c) => own.includes(c.id)),
    recent = r.events.filter((e) => e.lap >= r.lap - 1 && INTEREST.test(e.type));
  if (r.lap <= 1 || r.lap >= r.laps - 1) return 1;
  if (recent.some((e) => own.includes(e.driverId) || /collision|red flag/.test(e.type))) return 1;
  if (r.control === 'SC' || r.control === 'VSC') return 4;
  if (mine >= 0 && (close(mine) || (mine + 1 < order.length && close(mine + 1))))
    return quiet === 16 ? 2 : 1;
  if (close(1) || r.weather.water > 0.17 !== r.weather.intensity > 0.1 || recent.length) return 2;
  if (r.lap >= r.laps - 4) return 4;
  return quiet;
}
/** One line of advice from data the engineer already has. Never issues a command by itself. */
export function engineerAdvice(save: Save, id: string) {
  const r = save.race,
    car = r?.cars.find((c) => c.id === id);
  if (!r || !car || car.status !== 'RUNNING') return null;
  const order = [...r.cars]
      .filter((c) => c.status === 'RUNNING')
      .sort((a, b) => b.lap - a.lap || a.elapsed - b.elapsed),
    i = order.indexOf(car),
    battery = save.game.cars[id].battery,
    wet = r.weather.water > 0.17,
    onWets = ['I', 'W'].includes(car.tyre.compound);
  if (wet !== onWets && r.lap < r.laps - 1)
    return wet ? 'Pista molhada: pare para pneus de chuva.' : 'Pista secando: volte para slicks.';
  if (car.tyre.wear > 70 && r.lap < r.laps - 2) return 'Pneus no limite: pare nas próximas voltas.';
  if (battery < 20) return 'Bateria baixa: evite atacar até recarregar.';
  if (r.control !== 'GREEN') return 'Pista neutralizada: parada custa menos agora.';
  if (i > 0 && car.elapsed - order[i - 1].elapsed < 1) return 'Carro à frente ao alcance: ataque.';
  if (i + 1 < order.length && order[i + 1].elapsed - car.elapsed < 1)
    return 'Pressão atrás: defenda.';
  return 'Ritmo limpo: mantenha o plano.';
}
