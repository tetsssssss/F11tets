import type { Save } from '../types';
import { cloneState } from '../simulation/world';
import { clamp } from '../simulation/random';
import { runNextSession, tickLive } from '../simulation';
export function devAction(save: Save, action: string, id: string, value = 50): Save {
  if (action === 'skip') {
    if (save.race?.status === 'RUNNING') return devAction(save, 'finish', id);
    return runNextSession(save);
  }
  if (!save.race || save.race.status !== 'RUNNING') return save;
  let n = cloneState(save);
  const r = n.race!,
    car = r.cars.find((c) => c.id === id);
  r.dev = true;
  if (action === 'rain') r.forcedRain = value >= 50 ? 100 : 0;
  else if (action === 'SC' || action === 'VSC') {
    r.control = action;
    r.neutralLaps = 3;
  } else if (action === 'DNF' && car) {
    car.status = 'DNF';
    r.events.push({
      lap: r.lap + 1,
      driverId: id,
      type: 'dev retirement',
      detail: 'DNF provocado pelo painel de teste.',
      severity: 'terminal',
    });
  } else if ((action === 'spin' || action === 'wide' || action === 'crash') && car) {
    const type = action === 'crash' ? 'collision' : action;
    if (action === 'crash') {
      car.status = 'DNF';
      n.game.cars[id].damage.suspension = 100;
      n.game.cars[id].damage.rearWing = Math.max(65, n.game.cars[id].damage.rearWing);
      r.control = 'SC';
      r.neutralLaps = 3;
    }
    r.events.push({
      lap: r.lap,
      driverId: id,
      type,
      detail: action === 'spin' ? 'DEV: rodada para inspeção visual.' : action === 'wide' ? 'DEV: saída dos limites para inspeção visual.' : 'DEV: impacto terminal para inspeção visual.',
      severity: action === 'crash' ? 'terminal' : 'leve',
    });
  } else if (action === 'battery' && car) n.game.cars[id].battery = clamp(value);
  else if (action === 'tyre' && car) car.tyre.wear = clamp(value);
  else if (action === 'gap' && car) {
    const front = [...r.cars].sort((a, b) => a.elapsed - b.elapsed).find((c) => c.id !== id)!;
    car.elapsed = front.elapsed + 0.6;
    r.sector = 2;
  } else if (action === 'finish' || action === 'result') {
    if (action === 'result' && car) car.elapsed = Math.min(...r.cars.map((c) => c.elapsed)) - 999;
    while (n.race?.status === 'RUNNING') n = tickLive(n, true);
  }
  return n;
}
