import type { Save } from '../types';
import type { CommandKind, RaceState } from './types';
import type { Compound, Decision } from '../simulation/types';
import { cloneState, pairKey } from '../simulation/world';
import { clamp, mean, rng, seedFor } from '../simulation/random';
import { compoundModel } from '../simulation/mechanics';
import { controlledIds } from './career';
export function commandDecision(state: RaceState, id: string): Decision {
  const base = state.baseDecisions[id],
    cmd = state.commands[id];
  return {
    ...base,
    ...(cmd.kind === 'ATTACK'
      ? { energy: 'Attack' as const, pace: 'Atacar' as const }
      : cmd.kind === 'DEFEND'
        ? { energy: 'Attack' as const }
        : cmd.kind === 'BRAKING_ATTACK'
          ? { energy: 'Overtake' as const, pace: 'Atacar' as const }
          : cmd.kind === 'SAVE'
            ? {
                energy: 'Save' as const,
                regen: 4,
                pace: 'Conservar' as const,
                engineMap: 'Economy' as const,
              }
            : {}),
  };
}
export function brakingOpportunity(save: Save, id: string, r = save.race) {
  if (!r || r.status !== 'RUNNING') return { available: false, reason: 'Entre em uma corrida.' };
  if ((r.commands[id]?.cooldownUntil ?? 0) > r.lap)
    return {
      available: false,
      reason: 'Freada em recuperação. Aguarde duas voltas antes de tentar novamente.',
    };
  const order = [...r.cars]
    .filter((c) => c.status === 'RUNNING')
    .sort((a, b) => a.elapsed - b.elapsed);
  const i = order.findIndex((c) => c.id === id);
  if (i <= 0) return { available: false, reason: 'Nenhum adversário imediatamente à frente.' };
  const gap = order[i].elapsed - order[i - 1].elapsed;
  if (gap > 1.5)
    return { available: false, reason: 'Aproxime-se a menos de 1,5 s do carro à frente.' };
  if (r.sector < 2)
    return { available: false, reason: 'Aguarde a próxima zona de frenagem, no setor 2 ou 3.' };
  if (r.control !== 'GREEN')
    return { available: false, reason: 'Ultrapassagens suspensas pela direção de prova.' };
  return { available: true, reason: 'Zona de frenagem próxima. A ordem vale para esta volta.' };
}
function allowed(s: Save, id: string) {
  return (
    s.race?.status === 'RUNNING' &&
    controlledIds(s).includes(id) &&
    s.race.cars.some((c) => c.id === id && c.status === 'RUNNING')
  );
}
function attention(r: RaceState) {
  if (r.autoEvents === 'pause') r.paused = true;
  else if (r.autoEvents === 'slow') r.speed = 1;
}
function speak(s: Save, id: string, text: string, target: 'driver' | 'engineer' = 'engineer') {
  const r = s.race!;
  r.commandSequence++;
  r.radio.push({ id: r.commandSequence, driverId: id, target, lap: r.lap + 1, text });
  if (r.radio.length > 80) r.radio.shift();
}
function obedience(
  s: Save,
  id: string,
  controversial = false,
  state = s.race!,
  actor: 'human' | 'ai' = 'human',
) {
  if (s.career.mode === 'driver' && actor === 'human') return true;
  const rel = s.career.ceoRelations[id],
    d = s.game.drivers.find((d) => d.id === id)!;
  const teammate = s.game.drivers.find((x) => x.teamId === d.teamId && x.id !== d.id)!;
  const rival = s.game.relationships[pairKey(id, teammate.id)];
  const chance = clamp(
    mean(Object.values(rel)) * 0.7 +
      d.attributes['Inteligência de corrida'] * 0.25 +
      (100 - d.attributes.Agressividade) * 0.1 -
      (controversial ? rival.Rivalidade * 0.25 : 0),
    8,
    98,
  );
  return rng(seedFor(state.seed, id, state.commandSequence, 'obedience'))() * 100 < chance;
}
export function issueCommand(save: Save, id: string, kind: CommandKind, duration = 2): Save {
  if (
    !allowed(save, id) ||
    !['NORMAL', 'ATTACK', 'DEFEND', 'BRAKING_ATTACK', 'SAVE'].includes(kind)
  )
    return save;
  if (kind === 'BRAKING_ATTACK' && !brakingOpportunity(save, id).available) return save;
  const n = cloneState(save),
    r = n.race!;
  applyCommand(n, r, id, kind, duration, 'human');
  attention(r);
  return n;
}
/** Both controllers use this transition; physics consumes only commands, never actor identity. */
export function applyCommand(
  n: Save,
  r: RaceState,
  id: string,
  kind: CommandKind,
  duration = 2,
  actor: 'human' | 'ai' = 'ai',
): boolean {
  if (
    r.status !== 'RUNNING' ||
    !r.cars.some((c) => c.id === id && c.status === 'RUNNING') ||
    !['NORMAL', 'ATTACK', 'DEFEND', 'BRAKING_ATTACK', 'SAVE'].includes(kind)
  )
    return false;
  if (kind === 'BRAKING_ATTACK' && !brakingOpportunity(n, id, r).available) return false;
  const accepted = obedience(n, id, false, r, actor);
  const c = r.commands[id];
  c.acknowledged = accepted;
  if (accepted) {
    c.kind = kind;
    c.remaining = kind === 'BRAKING_ATTACK' ? 1 : Math.max(1, Math.min(3, Math.round(duration)));
    if (kind === 'BRAKING_ATTACK') {
      c.cooldownUntil = r.lap + 3;
      c.brakingAttempts = (c.brakingAttempts ?? 0) + 1;
    }
  }
  const rel = n.career.ceoRelations[id];
  rel.Confiança = clamp(rel.Confiança + (accepted ? 0.2 : -1));
  rel.Satisfação = clamp(rel.Satisfação + (kind === 'SAVE' ? 1 : kind === 'ATTACK' ? -0.5 : 0));
  const response = accepted
    ? {
        NORMAL: 'Voltando ao plano normal.',
        ATTACK: 'Vou pressionar. Monitorando energia e temperatura.',
        DEFEND: 'Vou proteger a posição. Isso pode custar ritmo.',
        BRAKING_ATTACK: 'Vou tentar na próxima freada. Depende do espaço.',
        SAVE: 'Conservando pneus e carregando energia.',
      }[kind]
    : 'Não concordo com a ordem. Vou manter meu plano.';
  r.commandSequence++;
  if (actor === 'human') {
    r.radio.push({
      id: r.commandSequence,
      driverId: id,
      target: 'driver',
      lap: r.lap + 1,
      text: response,
    });
    if (r.radio.length > 80) r.radio.shift();
  }
  r.events.push({
    lap: r.lap + 1,
    driverId: id,
    type: accepted ? 'command' : 'command ignored',
    detail:
      actor.toUpperCase() + ': ' + kind + (accepted ? ' confirmado.' : ' recusado pelo piloto.'),
  });
  return accepted;
}
export function callPit(
  save: Save,
  id: string,
  when: 'now' | 'next' | 'cancel',
  compound: Compound,
): Save {
  if (!allowed(save, id) || !['H', 'M', 'S', 'I', 'W'].includes(compound)) return save;
  const n = cloneState(save),
    r = n.race!;
  const car = r.cars.find((c) => c.id === id)!;
  if (when === 'cancel') {
    if (!r.pitCalls[id]) return save;
    delete r.pitCalls[id];
    car.pitPhase = 'TRACK';
    speak(n, id, 'Chamada cancelada. Continue na pista.');
    return n;
  }
  const lap = r.lap + (when === 'now' ? 1 : 2);
  if (lap > r.laps) return save;
  r.pitCalls[id] = { lap, compound };
  car.pitPhase = 'CALLED';
  r.commands[id].holdUntil = 0;
  attention(r);
  speak(n, id, 'Box na volta ' + lap + '. Jogo ' + compound + ' preparado.');
  return n;
}
export const RADIO_CATEGORIES = [
  'PACE',
  'TYRES',
  'BATTERY',
  'WEATHER',
  'STRATEGY',
  'TEAM ORDERS',
  'CAR BALANCE',
] as const;
export type RadioCategory = (typeof RADIO_CATEGORIES)[number];
/** Every radio call: a question answered from the race state, or an order that maps to a command. */
export const radioCatalog: {
  category: RadioCategory;
  kind: 'ask' | 'order';
  label: string;
  message: string;
}[] = [
  { category: 'PACE', kind: 'ask', label: 'Posso atacar?', message: 'Posso atacar?' },
  { category: 'PACE', kind: 'order', label: 'PUSH', message: 'Aumente ritmo' },
  { category: 'PACE', kind: 'order', label: 'ATTACK', message: 'Ataque' },
  { category: 'PACE', kind: 'order', label: 'DEFEND', message: 'Defenda' },
  { category: 'TYRES', kind: 'ask', label: 'Como estão os pneus?', message: 'Como estão os pneus?' },
  { category: 'TYRES', kind: 'order', label: 'CONSERVE', message: 'Conserve pneus' },
  {
    category: 'BATTERY',
    kind: 'ask',
    label: 'Quanto falta de bateria?',
    message: 'Quanto falta de bateria?',
  },
  { category: 'BATTERY', kind: 'order', label: 'RECHARGE', message: 'Carregue bateria' },
  { category: 'BATTERY', kind: 'order', label: 'USE BATTERY', message: 'Use bateria' },
  { category: 'WEATHER', kind: 'ask', label: 'Chuva chegando?', message: 'Chuva chegando?' },
  {
    category: 'STRATEGY',
    kind: 'ask',
    label: 'Quando devemos parar?',
    message: 'Quando devemos parar?',
  },
  { category: 'STRATEGY', kind: 'order', label: 'BOX', message: 'Box agora' },
  { category: 'STRATEGY', kind: 'order', label: 'STAY OUT', message: 'Fique fora' },
  { category: 'TEAM ORDERS', kind: 'order', label: 'HOLD POSITION', message: 'Mantenha posição' },
  {
    category: 'TEAM ORDERS',
    kind: 'order',
    label: 'Não ataque companheiro',
    message: 'Não ataque companheiro',
  },
  { category: 'TEAM ORDERS', kind: 'order', label: 'Troquem posições', message: 'Troquem posições' },
  {
    category: 'CAR BALANCE',
    kind: 'ask',
    label: 'Como está o equilíbrio?',
    message: 'Como está o equilíbrio?',
  },
];
// Earlier wording stays valid, so nothing that already sends these breaks.
const RADIO_ALIASES: Record<string, string> = {
  'Como está a bateria?': 'Quanto falta de bateria?',
  'Dá para atacar?': 'Posso atacar?',
};
export const radioOptions: readonly string[] = [
  ...radioCatalog.map((x) => x.message),
  ...Object.keys(RADIO_ALIASES),
];
/** What the pit wall can actually see for one car, read straight from the race state. */
function radioContext(n: Save, id: string) {
  const r = n.race!,
    car = r.cars.find((c) => c.id === id)!,
    order = [...r.cars]
      .filter((c) => c.status === 'RUNNING')
      .sort((a, b) => b.lap - a.lap || a.elapsed - b.elapsed),
    i = order.indexOf(car),
    ahead = order[i - 1],
    behind = order[i + 1],
    code = (other: { id: string }) => n.game.drivers.find((d) => d.id === other.id)!.short,
    rate = Math.max(0.6, car.tyre.wear / Math.max(1, car.tyreAge)),
    life = Math.max(0, Math.floor((75 - car.tyre.wear) / rate));
  return {
    r,
    car,
    position: i + 1,
    battery: n.game.cars[id].battery,
    ahead: ahead && { code: code(ahead), gap: car.elapsed - ahead.elapsed },
    behind: behind && { code: code(behind), gap: behind.elapsed - car.elapsed },
    life,
    lapsLeft: Math.max(0, r.laps - r.lap),
    circuit: n.game.circuits[r.round - 1],
  };
}
const oneDecimal = (n: number) => n.toFixed(1).replace('.', ',');
/** The driver's reply to an order, with the numbers that make it worth hearing. */
function orderReply(n: Save, id: string, message: string) {
  const c = radioContext(n, id),
    bat = c.battery.toFixed(0),
    wear = c.car.tyre.wear.toFixed(0),
    front = c.ahead ? `${c.ahead.code} a ${oneDecimal(c.ahead.gap)}s` : 'pista livre à frente',
    back = c.behind ? `${c.behind.code} a ${oneDecimal(c.behind.gap)}s` : 'ninguém atrás';
  if (message === 'Aumente ritmo')
    return `Push confirmado. ${front}; pneus em ${wear}%, vou cobrar mais deles.`;
  if (message === 'Ataque' || message === 'Use bateria')
    return c.ahead && c.ahead.gap < 1.5
      ? `Atacando ${c.ahead.code}, ${oneDecimal(c.ahead.gap)}s. Bateria ${bat}% para gastar.`
      : `Usando energia para fechar: ${front}. Bateria ${bat}%.`;
  if (message === 'Defenda')
    return c.behind && c.behind.gap < 1.5
      ? `Defendendo de ${c.behind.code}, ${oneDecimal(c.behind.gap)}s atrás. Vai custar ritmo.`
      : `Cobrindo a linha, mas ${back}.`;
  if (message === 'Conserve pneus')
    return `Conservando: ${c.car.tyre.compound} com ${wear}% e ${c.car.tyreAge} volta(s). Alivio nas curvas rápidas.`;
  if (message === 'Carregue bateria')
    return `Recarregando: bateria em ${bat}%. Levanto o pé no fim das retas.`;
  if (message === 'Mantenha posição')
    return `Mantendo P${c.position}. ${back}; ${front}.`;
  return null;
}
export function radio(
  save: Save,
  id: string,
  message: string,
  target: 'driver' | 'engineer' = 'engineer',
): Save {
  if (!allowed(save, id) || !radioOptions.includes(message)) return save;
  message = RADIO_ALIASES[message] ?? message;
  const command: Record<string, [CommandKind, number]> = {
    'Conserve pneus': ['SAVE', 3],
    'Carregue bateria': ['SAVE', 3],
    'Use bateria': ['ATTACK', 2],
    'Aumente ritmo': ['ATTACK', 2],
    Ataque: ['ATTACK', 2],
    Defenda: ['DEFEND', 2],
    'Mantenha posição': ['NORMAL', 2],
  };
  if (command[message]) {
    const next = issueCommand(save, id, ...command[message]),
      line = next === save ? undefined : next.race!.radio.at(-1);
    // An accepted order is answered with real figures instead of a stock phrase.
    if (line && line.driverId === id && next.race!.commands[id].acknowledged)
      line.text = orderReply(next, id, message) ?? line.text;
    return next;
  }
  if (message === 'Box agora')
    return callPit(
      save,
      id,
      'now',
      save.race!.weather.water > 0.55 ? 'W' : save.race!.weather.water > 0.17 ? 'I' : 'H',
    );
  const n = cloneState(save),
    r = n.race!,
    car = r.cars.find((c) => c.id === id)!,
    d = n.game.drivers.find((d) => d.id === id)!,
    c = radioContext(n, id),
    bat = c.battery.toFixed(0),
    wear = car.tyre.wear.toFixed(0);
  let text = '';
  if (message === 'Como estão os pneus?') {
    const target = compoundModel[car.tyre.compound].target,
      heat = car.tyre.temperature - target,
      axle = c.circuit.frontWear >= c.circuit.rearWear ? 'Dianteiros' : 'Traseiros',
      state =
        car.tyre.wear < 25
          ? 'ainda inteiros'
          : car.tyre.wear < 50
            ? `${axle.toLowerCase()} começando a cair`
            : car.tyre.wear < 68
              ? `${axle.toLowerCase()} caindo de verdade`
              : 'no limite';
    text =
      `Pneu ${car.tyre.compound}, ${car.tyreAge} volta(s): ${wear}% de desgaste, ${state}. ` +
      `${car.tyre.temperature.toFixed(0)}°C` +
      (heat > 10 ? ', superaquecendo' : heat < -15 ? ', frio, fora da janela' : ', na janela') +
      (car.tyre.graining > 3 ? ', com graining' : '') +
      `. Estimamos mais ${Math.max(0, c.life - 2)}–${c.life + 2} voltas competitivas.`;
  } else if (message === 'Quanto falta de bateria?')
    text =
      `Carga em ${bat}%. Temperatura ${n.game.cars[id].batteryTemperature.toFixed(0)}°C. ` +
      `Modo ${commandDecision(r, id).energy}. ` +
      (c.battery < 20
        ? 'Recarregue antes de pensar em atacar.'
        : c.battery < 45
          ? 'Dá para uma tentativa curta, não duas.'
          : 'Temos energia para atacar ou defender.');
  else if (message === 'Posso atacar?')
    text =
      r.control !== 'GREEN'
        ? `Negativo: pista sob ${r.control}. Guarde bateria (${bat}%) para a relargada.`
        : !c.ahead
          ? `Você lidera. ${c.behind ? `${c.behind.code} está a ${oneDecimal(c.behind.gap)}s` : 'Pista livre'}: administre.`
          : c.ahead.gap > 2.5
            ? `${c.ahead.code} está a ${oneDecimal(c.ahead.gap)}s: fora de alcance. Feche o gap antes; bateria ${bat}%.`
            : c.battery > 25 && car.tyre.wear < 65
              ? `Pode. ${c.ahead.code} a ${oneDecimal(c.ahead.gap)}s, bateria ${bat}%, pneus ${wear}%. Não há garantia de passar.`
              : `Recomendo conservar: bateria ${bat}%, desgaste ${wear}%. ${c.ahead.code} está a ${oneDecimal(c.ahead.gap)}s.`;
  else if (message === 'Quando devemos parar?') {
    const est = pitEstimate(n, id),
      rejoin =
        1 +
        r.cars.filter(
          (x) => x.id !== id && x.status === 'RUNNING' && x.elapsed < car.elapsed + est.loss,
        ).length,
      wetTrack = r.weather.water > 0.17,
      onWets = ['I', 'W'].includes(car.tyre.compound);
    text = r.pitCalls[id]
      ? `Parada já marcada para a volta ${r.pitCalls[id].lap}, jogo ${r.pitCalls[id].compound}.`
      : wetTrack !== onWets
        ? `Agora: pneu errado para a pista. Parada custa ~${est.loss.toFixed(0)}s, voltamos perto de P${rejoin}.`
        : c.life >= c.lapsLeft
          ? `Não precisamos parar: faltam ${c.lapsLeft} volta(s) e o pneu aguenta ~${c.life}.`
          : `Janela entre as voltas ${r.lap + 1 + Math.max(0, c.life - 2)} e ${Math.min(r.laps, r.lap + 1 + c.life + 2)}. ` +
            `Parada custa ~${est.loss.toFixed(0)}s${r.control !== 'GREEN' ? ' (barata sob neutralização)' : ''}, voltamos perto de P${rejoin}` +
            (est.traffic ? ` com ${est.traffic} carro(s) por perto.` : ', com pista livre.');
  } else if (message === 'Chuva chegando?') {
    const w = r.weather,
      water = (w.water * 100).toFixed(0);
    text =
      w.water > 0.55
        ? `Chuva forte: ${water}% de água na pista. Pneu de chuva extrema é o certo.`
        : w.water > 0.17
          ? `Pista molhada, ${water}% de água. Intermediários; radar em ${w.forecast.toFixed(0)}%.`
          : w.intensity > 0.1
            ? `Começou a chover: ${water}% de água por enquanto. Prepare a troca; radar em ${w.forecast.toFixed(0)}%.`
            : w.forecast > 55
              ? `Pista seca agora, mas radar em ${w.forecast.toFixed(0)}%. Pode chover neste stint.`
              : `Pista seca, ${w.air.toFixed(0)}°C no ar e ${w.track.toFixed(0)}°C no asfalto. Radar em ${w.forecast.toFixed(0)}%: sem chuva à vista.`;
  } else if (message === 'Como está o equilíbrio?') {
    const state = n.game.cars[id],
      setup = n.game.setups[id],
      worst = Object.entries(state.damage).sort((a, b) => b[1] - a[1])[0],
      target = compoundModel[car.tyre.compound].target;
    text =
      (worst && worst[1] > 10
        ? `Dano de ${worst[1].toFixed(0)}% em ${worst[0]}: o carro perdeu carga e está nervoso. `
        : car.tyre.overheating > 2
          ? 'Traseira escorregando: pneus acima da janela. '
          : car.tyre.graining > 3 || car.tyre.temperature < target - 15
            ? 'Saindo de frente: pneus frios, com graining. '
            : car.tyre.wear > 55
              ? `Equilíbrio indo embora com ${wear}% de desgaste. `
              : 'Carro equilibrado. ') +
      `Confiança no acerto ${setup.confidence.toFixed(0)}%, pneus a ${car.tyre.temperature.toFixed(0)}°C (alvo ${target}°C).`;
  } else if (message === 'Fique fora') {
    delete r.pitCalls[id];
    r.commands[id].holdUntil = r.lap + 2;
    car.pitPhase = 'TRACK';
    text = `Ficamos fora nas próximas duas voltas. Pneu ${car.tyre.compound} com ${wear}%, ~${c.life} volta(s) de vida.`;
  } else {
    const other = n.game.drivers.find((x) => x.teamId === d.teamId && x.id !== id)!;
    const ok = obedience(n, id, true);
    const rel = n.career.ceoRelations[id];
    rel.Satisfação = clamp(rel.Satisfação - 5);
    rel.Lealdade = clamp(rel.Lealdade - 2);
    rel.Obediência = clamp(rel.Obediência + (ok ? 1 : -2));
    rel.Respeito = clamp(rel.Respeito + (ok ? 0.5 : -1));
    if (ok) {
      r.commands[id].remaining = 3;
      if (message === 'Não ataque companheiro') r.commands[id].noAttack = true;
      else r.commands[id].yieldTo = other.id;
      rel.Confiança = clamp(rel.Confiança + 1);
    } else rel.Confiança = clamp(rel.Confiança - 3);
    text = ok
      ? message === 'Troquem posições'
        ? 'Vou facilitar a troca quando ele se aproximar.'
        : 'Vou evitar disputa com meu companheiro.'
      : 'Negativo. Vou disputar minha posição.';
    r.events.push({
      lap: r.lap + 1,
      driverId: id,
      otherId: other.id,
      type: ok ? 'team order' : 'command ignored',
      detail: text,
    });
  }
  if (message === 'Troquem posições' || message === 'Não ataque companheiro') attention(r);
  speak(n, id, text, target);
  return n;
}
export function pitEstimate(save: Save, id: string) {
  const r = save.race!,
    d = save.game.drivers.find((d) => d.id === id)!,
    t = save.game.teams.find((t) => t.id === d.teamId)!,
    car = r.cars.find((c) => c.id === id)!;
  const loss = 21.8 - (t.attributes['Pit stops'] - 75) * 0.03 + (r.control === 'GREEN' ? 0 : -8);
  const traffic = r.cars.filter(
    (c) => c.id !== id && c.status === 'RUNNING' && Math.abs(c.elapsed - car.elapsed - loss) < 4,
  ).length;
  return {
    loss,
    traffic,
    window: Math.max(
      1,
      Math.round((70 - car.tyre.wear) / Math.max(0.6, car.tyre.wear / Math.max(1, car.tyreAge))),
    ),
  };
}
