import type { Save } from '../types';
import { sessions } from '../../data/regulations';
export function validRaceState(save: Save): boolean {
  try {
    const r = save.race!;
    if (
      r.version !== 1 ||
      !sessions.includes(r.session) ||
      r.round !== save.round ||
      !['RUNNING', 'FINISHED'].includes(r.status) ||
      !Number.isInteger(r.lap) ||
      r.lap < 0 ||
      r.lap > r.laps ||
      r.laps < 1 ||
      r.laps > 160 ||
      ![1, 2, 3].includes(r.sector) ||
      ![0.5, 0.75, 1, 2, 4, 8, 16].includes(r.speed) ||
      typeof r.paused !== 'boolean' ||
      !['off', 'slow', 'pause'].includes(r.autoEvents) ||
      !['GREEN', 'SC', 'VSC', 'RED', 'YELLOW', 'DOUBLE YELLOW', 'CHEQUERED'].includes(r.control) ||
      !Number.isInteger(r.rngState) ||
      !Array.isArray(r.cars) ||
      r.cars.length !== (r.session === 'Q2' ? 20 : r.session === 'Q3' ? 10 : 32) ||
      new Set(r.cars.map((c) => c.id)).size !== r.cars.length ||
      r.ids.length !== r.cars.length ||
      new Set(r.ids).size !== r.cars.length ||
      r.frames.length !== (r.recordFrames === false ? 0 : r.lap) ||
      typeof r.weather.condition !== 'string' ||
      !Number.isFinite(r.weather.water)
    )
      return false;
    if (
      !Number.isInteger(r.seed) ||
      !Number.isInteger(r.commandSequence) ||
      typeof r.dev !== 'boolean' ||
      !Number.isInteger(r.neutralLaps) ||
      r.weather.water < 0 ||
      r.weather.water > 1
    )
      return false;
    if (
      ['air', 'track', 'wind', 'humidity', 'intensity', 'grip', 'forecast'].some(
        (key) => !Number.isFinite(r.weather[key as keyof typeof r.weather]),
      )
    )
      return false;
    const w = save.weekends.find((w) => w.round === save.round);
    if (
      (!w && r.session !== 'TL1') ||
      sessions.slice(0, sessions.indexOf(r.session)).some((s) => !w?.results[s])
    )
      return false;
    if (r.status === 'RUNNING' && w?.results[r.session]) return false;
    if (r.status === 'FINISHED' && (!w?.results[r.session] || r.lap !== r.laps)) return false;
    for (const car of r.cars) {
      if (
        ![...save.game.drivers, ...save.world.pool].some((d) => d.id === car.id) ||
        !r.ids.includes(car.id) ||
        !['RUNNING', 'DNF', 'DSQ'].includes(car.status) ||
        !['TRACK', 'CALLED', 'EXIT'].includes(car.pitPhase) ||
        !['H', 'M', 'S', 'I', 'W'].includes(car.tyre.compound)
      )
        return false;
      for (const value of [
        car.elapsed,
        car.best,
        car.lap,
        car.tyreAge,
        car.pits,
        car.last,
        car.overtakes,
        car.penalty,
        ...Object.values(car.tyre).filter((v) => typeof v === 'number'),
      ])
        if (!Number.isFinite(value)) return false;
      const cmd = r.commands[car.id],
        dec = r.baseDecisions[car.id];
      if (
        !cmd ||
        !['NORMAL', 'ATTACK', 'DEFEND', 'BRAKING_ATTACK', 'SAVE'].includes(cmd.kind) ||
        !Number.isInteger(cmd.remaining) ||
        cmd.remaining < 0 ||
        cmd.remaining > 3 ||
        typeof cmd.noAttack !== 'boolean' ||
        typeof cmd.acknowledged !== 'boolean' ||
        !Number.isFinite(cmd.holdUntil) ||
        !dec ||
        !['Save', 'Race', 'Attack', 'Boost', 'Overtake'].includes(dec.energy) ||
        !['Economy', 'Race', 'Quali'].includes(dec.engineMap) ||
        !['Corner', 'Flow', 'Straight', 'Follow'].includes(dec.aero) ||
        !['Conservar', 'Equilibrado', 'Atacar'].includes(dec.pace) ||
        !['H', 'M', 'S', 'I', 'W'].includes(dec.compound) ||
        typeof dec.orders !== 'boolean' ||
        [
          dec.regen,
          dec.wing,
          dec.balance,
          dec.pitLap,
          car.tyre.wear,
          car.tyre.temperature,
          car.tyre.graining,
          car.tyre.overheating,
          car.tyre.life,
          car.tyre.punctureRisk,
        ].some((v) => !Number.isFinite(v)) ||
        dec.regen < 1 ||
        dec.regen > 4 ||
        dec.wing < 0 ||
        dec.wing > 100 ||
        dec.balance < 0 ||
        dec.balance > 100 ||
        car.tyre.wear < 0 ||
        car.tyre.wear > 100 ||
        (cmd.yieldTo !== null && !r.ids.includes(cmd.yieldTo))
      )
        return false;
    }
    for (const [id, pit] of Object.entries(r.pitCalls))
      if (
        !r.ids.includes(id) ||
        !Number.isInteger(pit.lap) ||
        pit.lap <= r.lap ||
        pit.lap > r.laps ||
        !['H', 'M', 'S', 'I', 'W'].includes(pit.compound)
      )
        return false;
    if (
      !Array.isArray(r.radio) ||
      !r.radio.every((line) => r.ids.includes(line.driverId) && typeof line.text === 'string') ||
      !Array.isArray(r.events) ||
      !r.events.every((e) => r.ids.includes(e.driverId) && typeof e.detail === 'string')
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
