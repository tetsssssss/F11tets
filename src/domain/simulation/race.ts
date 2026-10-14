import type { Save, Session, Result } from '../types';
import type { Decision, RaceControl, RaceEvent, RaceTape, Telemetry, PenaltyKind } from './types';
import { clamp, mean, rng, round, seedFor, snapshotRng } from './random';
import { newTyres, tyreStep, powerStep, performance, weatherAt, suitableTyre } from './mechanics';
import type { RaceState, RaceCar } from '../gameplay/types';
import { controlledIds } from '../gameplay/career';
import { commandDecision, applyCommand, brakingOpportunity } from '../gameplay/commands';
import { pairKey } from './world';
import { raceModifiers } from '../gameplay/settings';
import { confirmedOnTrackPasses } from './overtaking';
import { enforceTrackOrder } from './track-order';
const penalties: Record<PenaltyKind, number> = {
  '5s': 5,
  '10s': 10,
  '15s': 15,
  'Drive Through': 23,
  'Stop-Go': 33,
  'Grid Penalty': 0,
  DSQ: 0,
};
export function applyPenalty(save: Save, id: string, kind: PenaltyKind) {
  const seconds = penalties[kind];
  save.game.penalties.push({
    season: save.season,
    round: save.round,
    driverId: id,
    kind,
    seconds,
    points: kind === 'DSQ' ? 4 : 2,
  });
  save.game.discipline[id] += kind === 'DSQ' ? 4 : 2;
  if (kind === 'Grid Penalty') save.game.gridPenalties[id] = (save.game.gridPenalties[id] ?? 0) + 3;
  return seconds;
}
export function sessionDecisions(
  save: Save,
  ids: string[],
  seed: number,
): Record<string, Decision> {
  const g = save.game;
  const random = rng(seed);
  return Object.fromEntries(
    ids.map((id) => {
      const d = g.drivers.find((d) => d.id === id)!;
      const p = g.philosophies[d.teamId];
      const e = g.engineers.find((e) => e.driverId === id)!;
      return [
        id,
        controlledIds(save).includes(id)
          ? { ...g.decisions[id] }
          : {
              ...g.decisions[id],
              energy: p.risk > 75 ? 'Attack' : p.risk < 40 ? 'Save' : 'Race',
              regen: p.risk > 75 ? 1 : 3,
              compound: random() < p.risk / 120 ? 'S' : 'M',
              aero: p.risk > 70 ? 'Straight' : 'Flow',
              pace: p.ambition > 95 ? 'Atacar' : 'Equilibrado',
              orders: e.attributes['Gestão estratégica'] > 90,
              pitLap: 0,
            },
      ];
    }),
  );
}
export function createRaceState(save: Save, session: Session, ids: string[]): RaceState {
  const g = save.game;
  const c = g.circuits[save.round - 1];
  const seed = seedFor(g.seasonSeed, save.season, save.round, session, 'race');
  const stream = snapshotRng(seed);
  const random = stream.next;
  const race = session === 'GP' || session === 'Sprint';
  const practice = session.startsWith('TL');
  const m = raceModifiers(save, session);
  const fullLaps =
    session === 'GP'
      ? c.laps
      : session === 'Sprint'
        ? Math.max(12, Math.round(c.laps * 0.3))
        : practice
          ? 6
          : 3;
  // Race distance: fewer laps, with wear, fuel and pit windows rescaled by the same setting.
  const laps = m.distance === 1 ? fullLaps : Math.max(5, Math.round(fullLaps * m.distance));
  const decisions = sessionDecisions(save, ids, seed);
  let weather = weatherAt(c, seed, 0, undefined, m.weather);
  const events: RaceEvent[] = [];
  let control: RaceControl = 'GREEN';
  let neutralLaps = 0;
  const cars: RaceCar[] = ids.map((id, i) => {
    const d = g.drivers.find((d) => d.id === id)!;
    const car = g.cars[id];
    car.battery = 90;
    car.fuel = laps * 2.1;
    car.temperature = 90;
    car.batteryTemperature = 35;
    const dec = decisions[id];
    if (!race) dec.compound = weather.water > 0.17 ? suitableTyre(weather) : practice ? 'M' : 'S';
    if (
      (!controlledIds(save).includes(d.id) || save.world.settings.autoTyre) &&
      weather.water > 0.17
    )
      dec.compound = suitableTyre(weather);
    const launch =
      (100 - d.attributes.Largada) * 0.009 +
      (100 - g.teams.find((t) => t.id === d.teamId)!.attributes.Tração) * 0.004 +
      (i % 2 ? 0.15 : 0) +
      (100 - d.attributes['Controle do carro']) * 0.003 +
      random() * 0.2;
    return {
      id,
      elapsed: race ? i * 0.24 + launch : 0,
      best: 1e9,
      lap: 0,
      tyre: newTyres(dec.compound),
      pits: 0,
      status: 'RUNNING' as Telemetry['status'],
      penalty: 0,
      overtakes: 0,
      last: 0,
      tyreAge: 0,
      pitPhase: 'TRACK',
    };
  });
  return {
    version: 1,
    session,
    round: save.round,
    seed,
    rngState: stream.state(),
    ids: [...ids],
    laps,
    lap: 0,
    sector: 1,
    status: 'RUNNING',
    paused: true,
    speed: 1,
    autoEvents: 'slow',
    weather,
    control,
    neutralLaps,
    cars,
    decisions,
    baseDecisions: structuredClone(decisions),
    commands: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          kind: 'NORMAL',
          remaining: 0,
          acknowledged: true,
          noAttack: false,
          yieldTo: null,
          holdUntil: 0,
        },
      ]),
    ),
    pitCalls: {},
    events,
    frames: [],
    recordFrames: save.world.settings.telemetry === 'full',
    battles: {},
    restart: 'standing',
    radio: [],
    commandSequence: 0,
    forcedRain: null,
    dev: false,
  };
}
export function stepRaceLap(save: Save, state: RaceState) {
  if (state.status === 'FINISHED') return;
  state.sector = 3;
  const g = save.game,
    c = g.circuits[state.round - 1];
  const { seed, session, laps, cars, events, frames, decisions } = state;
  const stream = snapshotRng(state.rngState),
    random = stream.next;
  const lap = state.lap + 1;
  const race = session === 'GP' || session === 'Sprint',
    practice = session.startsWith('TL');
  const m = raceModifiers(save, session);
  let { weather, control, neutralLaps } = state;
  weather = weatherAt(
    state.forcedRain === null ? c : { ...c, rain: state.forcedRain },
    seed,
    lap,
    weather,
    m.weather,
  );
  if (state.forcedRain === 100)
    weather = {
      ...weather,
      condition: 'chuva forte',
      intensity: 1,
      water: Math.max(0.6, weather.water),
      grip: 55,
    };
  if (neutralLaps > 0) neutralLaps--;
  else control = 'GREEN';
  const previous = cars
    .map((x) => ({ ...x }))
    .sort(
      (a, b) =>
        (a.status !== 'RUNNING' ? 1 : 0) - (b.status !== 'RUNNING' ? 1 : 0) ||
        a.elapsed - b.elapsed,
    );
  const pitThisLap = new Set<string>();
  const pitDrivers = new Set<string>();
  const successfulMoves = new Set<string>();
  const humans = new Set(controlledIds(save));
  for (const x of cars) {
    if (x.status !== 'RUNNING') continue;
    const d = g.drivers.find((d) => d.id === x.id)!;
    const t = g.teams.find((t) => t.id === d.teamId)!;
    const e = g.engineers.find((e) => e.driverId === d.id)!;
    if (race && !humans.has(d.id) && state.commands[d.id].remaining === 0) {
      const i = previous.findIndex((p) => p.id === d.id),
        ahead = previous[i - 1],
        behind = previous[i + 1];
      // A sharper AI protects tyres and battery sooner; an aggressive one attacks from further.
      const kind =
        g.cars[d.id].battery < 18 + m.sharpness * 6 || x.tyre.wear > 72 - m.sharpness * 6
          ? 'SAVE'
          : ahead && x.elapsed - ahead.elapsed < 1.5 * m.aggression
            ? brakingOpportunity(save, d.id, state).available &&
              rng(seedFor(seed, lap, d.id, 'command'))() < 0.2
              ? 'BRAKING_ATTACK'
              : 'ATTACK'
            : behind && behind.elapsed - x.elapsed < 1
              ? 'DEFEND'
              : 'NORMAL';
      // A weaker AI sometimes misses the call. Own stream: the race RNG is never disturbed.
      const missed =
        m.hesitation > 0 && rng(seedFor(seed, lap, d.id, 'hesitation'))() < m.hesitation;
      if (kind !== 'NORMAL' && !missed) applyCommand(save, state, d.id, kind, 2, 'ai');
    }
    const dec = commandDecision(state, d.id);
    decisions[d.id] = dec;
    const command = state.commands[d.id];
    const car = g.cars[d.id];
    const neutral = control !== 'GREEN';
    const desired = suitableTyre(weather);
    const weatherPit =
      (desired === 'W' && x.tyre.compound !== 'W') ||
      (desired === 'I' && !['I', 'W'].includes(x.tyre.compound)) ||
      (weather.water < 0.08 && ['I', 'W'].includes(x.tyre.compound));
    const frontIndex = previous.findIndex((a) => a.id === x.id) - 1;
    const ahead = previous[frontIndex];
    const gap = ahead ? previous.find((p) => p.id === x.id)!.elapsed - ahead.elapsed : 99;
    // AI strategy quality shifts how well the pit wall reads the race, not anyone's ratings.
    const strategy =
      mean([
        e.attributes['Gestão estratégica'],
        e.attributes['Leitura de corrida'],
        e.attributes['Gestão de pneus'],
        e.attributes['Reação sob pressão'],
      ]) + (humans.has(d.id) ? 0 : m.strategy);
    const undercut = gap > 0 && gap < 2.5 && x.tyre.wear > 44 && strategy > 84 && c.overtaking < 55;
    const called = state.pitCalls[d.id];
    const hold = command.holdUntil >= lap;
    const pit =
      race &&
      ((called && called.lap <= lap) ||
        ((!humans.has(d.id) || save.world.settings.autoPit) &&
          lap < laps - 2 &&
          !hold &&
          (lap === dec.pitLap ||
            weatherPit ||
            x.tyre.wear > 68 + (strategy - 80) * 0.35 ||
            (neutral && x.tyre.wear > 38 && strategy > 75) ||
            undercut ||
            car.damage.frontWing > 45)));
    if (pit) {
      const crew = save.world.organizations[t.id].crew;
      let loss =
        18 +
        3.8 -
        (t.attributes['Pit stops'] - 75) * 0.03 +
        (neutral ? -8 : 0) +
        crew.fatigue * 0.008 -
        (crew.skill + crew.equipment - 150) * 0.003;
      if (pitThisLap.has(t.id)) {
        loss += 3;
        events.push({
          lap,
          driverId: d.id,
          type: 'double-stack',
          detail: 'Espera atrás do companheiro no box.',
        });
      }
      pitThisLap.add(t.id);
      pitDrivers.add(d.id);
      const errorRisk = (100 - t.attributes['Pit stops']) / 900;
      if (random() < errorRisk) {
        const wheel = random() < 0.18;
        loss += wheel ? 12 : 4;
        events.push({
          lap,
          driverId: d.id,
          type: wheel ? 'wheel failure' : 'pit error',
          detail: wheel ? 'Problema na fixação da roda.' : 'Atraso na troca de pneus.',
        });
        if (wheel && random() < 0.15) {
          x.status = 'DNF';
          events.push({
            lap,
            driverId: d.id,
            type: 'retirement',
            detail: 'Roda insegura após o pit stop.',
            severity: 'terminal',
          });
        }
      }
      if (random() < (100 - t.attributes['Operação geral']) / 4000) {
        const severity = random();
        const kind: PenaltyKind =
          severity < 0.04 ? 'Stop-Go' : severity < 0.15 ? 'Drive Through' : '5s';
        x.penalty += applyPenalty(save, d.id, kind);
        events.push({
          lap,
          driverId: d.id,
          type: 'unsafe release',
          detail: `Liberação insegura: ${kind}.`,
        });
      }
      x.elapsed += loss;
      x.pits++;
      x.tyre = newTyres(
        called?.compound ?? (weather.water > 0.17 ? desired : x.tyre.compound === 'H' ? 'M' : 'H'),
      );
      x.tyreAge = 0;
      x.pitPhase = 'EXIT';
      delete state.pitCalls[d.id];
      car.damage.frontWing = 0;
      g.setups[d.id].setsUsed++;
      events.push({
        lap,
        driverId: d.id,
        type: 'pit',
        detail: `Pit ${x.pits}: ${x.tyre.compound}, perda ${round(loss)} s.`,
      });
    }
    if (!pit) x.pitPhase = called ? 'CALLED' : 'TRACK';
    x.tyreAge++;
    const wornBefore = x.tyre.wear;
    x.tyre = tyreStep(x.tyre, d, save, c, weather, dec, neutral);
    if (m.wear !== 1) {
      const wear = clamp(wornBefore + (x.tyre.wear - wornBefore) * m.wear);
      x.tyre = {
        ...x.tyre,
        wear: round(wear),
        life: round(100 - wear),
        punctureRisk: Math.max(0, wear - 82) / 1500,
      };
    }
    const boost = powerStep(car, d, save, c, weather, dec, neutral);
    let time =
      performance(save, d, c, weather, dec, x.tyre, boost, !race && !practice).lap +
      car.fuel * 0.003 +
      // Energy difficulty: running the battery flat costs more (or less) lap time.
      Math.max(0, 22 - car.battery) * 0.01 * (m.energy - 1);
    if (!race && !practice && random() < (100 - e.attributes['Leitura de corrida']) / 180) {
      time += 0.3 + random() * 0.9;
      events.push({
        lap,
        driverId: d.id,
        type: 'qualifying traffic',
        detail: 'Tráfego compromete a volta rápida.',
      });
    }
    const consistency =
      (d.attributes.Consistência +
        d.attributes.Concentração +
        d.attributes['Inteligência de corrida']) /
      3;
    time += (random() - 0.5) * (100 - consistency) * 0.045;
    if (command.kind === 'DEFEND') time += 0.12;
    if (
      gap < 1.5 &&
      ahead &&
      race &&
      !neutral &&
      !(command.noAttack && g.drivers.find((d) => d.id === ahead.id)!.teamId === d.teamId)
    ) {
      time += dec.aero === 'Follow' ? 0.08 : 0.4;
      const defender = g.drivers.find((d) => d.id === ahead.id)!;
      const relation = g.relationships[pairKey(d.id, defender.id)];
      const battleKey = pairKey(d.id, defender.id);
      state.battles ??= {};
      const battle = (state.battles[battleKey] ??= {
        attacker: d.id,
        defender: defender.id,
        pressure: 0,
        attempts: 0,
        defenderAdaptation: 0,
        lastLap: lap,
        startLap: lap,
        batteryDifference: 0,
        tyreDifference: 0,
        relationship: relation.Rivalidade,
      });
      battle.attacker = d.id;
      battle.defender = defender.id;
      battle.pressure = clamp(battle.pressure + 8);
      battle.attempts++;
      battle.defenderAdaptation = clamp(battle.defenderAdaptation + 4);
      battle.lastLap = lap;
      battle.batteryDifference = car.battery - g.cars[defender.id].battery;
      battle.tyreDifference = ahead.tyre.wear - x.tyre.wear;
      const tyreDelta = ahead.tyre.wear - x.tyre.wear;
      const attack =
        0.1 +
        c.overtaking * 0.003 +
        (d.attributes.Ultrapassagem - defender.attributes.Defesa) * 0.006 +
        boost * 0.08 +
        tyreDelta * 0.002 +
        (dec.aero === 'Follow' ? 0.07 : 0) +
        (d.attributes.Agressividade - 70) * 0.002 +
        (command.kind === 'ATTACK'
          ? 0.12
          : command.kind === 'BRAKING_ATTACK'
            ? (d.attributes.Frenagem + d.attributes['Controle do carro']) / 1000
            : 0) -
        (state.commands[ahead.id].kind === 'DEFEND' ? 0.16 : 0) -
        battle.defenderAdaptation * 0.001;
      const cooperate =
        state.commands[ahead.id].yieldTo === d.id ||
        (defender.teamId === d.teamId &&
          dec.orders &&
          relation['Obediência à equipe'] + relation.Cooperação + relation.Confiança > 195);
      if (
        cooperate ||
        random() < clamp(attack * (humans.has(d.id) ? 1 : m.aggression), 0.02, 0.85)
      ) {
        successfulMoves.add(`${d.id}:${defender.id}`);
        time -= command.kind === 'BRAKING_ATTACK' ? 0.7 : 0.4;
        events.push({
          lap,
          driverId: d.id,
          otherId: defender.id,
          type: cooperate ? 'team order' : 'attack',
          detail: cooperate
            ? 'Companheiros cooperam sob ordem de equipe.'
            : 'Ataque construído com energia, pneus e espaço na pista.',
        });
      } else {
        time += 0.35;
        if (command.kind === 'BRAKING_ATTACK') {
          const error =
            random() +
            (dec.brakes === 'Conservadora' ? 0.08 : dec.brakes === 'Agressiva' ? -0.08 : 0);
          if (
            error <
            (100 - d.attributes.Frenagem + 100 - d.attributes['Controle do carro'] + x.tyre.wear) /
              260
          ) {
            time += 2.5;
            x.tyre.wear = clamp(x.tyre.wear + 3);
            events.push({
              lap,
              driverId: d.id,
              otherId: defender.id,
              type: 'braking lock-up',
              detail: 'Ataque na freada falhou: travamento e perda de tempo.',
              severity: 'leve',
            });
          } else
            events.push({
              lap,
              driverId: d.id,
              type: 'braking aborted',
              detail: 'Freada abortada: adversário protegeu a entrada.',
            });
        }
      }
      const contactRisk =
        (relation.Rivalidade +
          relation.Tensão +
          relation['Agressividade mútua'] +
          relation['Memória de conflitos'] -
          relation.Respeito -
          relation.Confiança -
          relation.Cooperação) /
        60000;
      if (random() < Math.max(0.0002, contactRisk) * (weather.water + 1) * m.incidents) {
        car.damage.frontWing = clamp(car.damage.frontWing + 35 * m.damage);
        time += 5;
        events.push({
          lap,
          driverId: d.id,
          otherId: defender.id,
          type: 'contact',
          detail: 'Contato em disputa; asa dianteira danificada.',
          severity: 'moderado',
        });
        if (random() < 0.3)
          x.penalty += applyPenalty(
            save,
            d.id,
            relation['Memória de conflitos'] > 90 ? '15s' : '10s',
          );
      }
    }
    const humanRisk =
      ((100 -
        d.attributes['Controle do carro'] +
        100 -
        d.attributes.Concentração +
        100 -
        d.attributes.Frenagem) /
        22000) *
      (1 + weather.water * 3) *
      (dec.pace === 'Atacar' ? 1.3 : 0.8) *
      (command.kind === 'BRAKING_ATTACK' ? 1.2 : 1) *
      m.errors;
    if (random() < humanRisk) {
      const roll = random();
      const type = roll < 0.5 ? 'lock-up' : roll < 0.8 ? 'wide' : 'spin';
      time += type === 'spin' ? 9 : 2;
      x.tyre.wear = clamp(x.tyre.wear + 2);
      events.push({
        lap,
        driverId: d.id,
        type,
        detail: 'Erro humano condicionado por aderência, pressão e controle.',
        severity: 'leve',
      });
      if (type === 'wide') {
        car.damage.floor = clamp(car.damage.floor + 3 * m.damage);
        if (random() < 0.12) x.penalty += applyPenalty(save, d.id, '5s');
      }
      if (type === 'spin' && random() < 0.15) {
        x.status = 'DNF';
        car.damage.suspension = 100;
        car.damage.rearWing = 65;
        if (race) applyPenalty(save, d.id, 'Grid Penalty');
        events.push({
          lap,
          driverId: d.id,
          type: 'collision',
          detail: 'Saída de pista com dano terminal.',
          severity: 'terminal',
        });
        control = weather.water > 0.65 ? 'RED' : 'SC';
        neutralLaps = control === 'RED' ? 0 : 3;
      }
    }
    if (random() < x.tyre.punctureRisk) {
      time += 12;
      car.damage.tyre = 60;
      events.push({
        lap,
        driverId: d.id,
        type: 'puncture',
        detail: 'Furo causado por desgaste excessivo.',
        severity: 'grave',
      });
      x.tyre = newTyres(desired);
      x.pits++;
    }
    const reliability =
      (t.attributes.Confiabilidade +
        g.engines.find((en) => en.name === t.engine)!.attributes.Confiabilidade) /
      2;
    const failure =
      (100 - reliability) * 0.000012 +
      car.wear * 0.000004 +
      Math.max(0, car.temperature - 110) * 0.00004 +
      car.mileage * 0.000000003;
    if (random() < failure * m.failures) {
      x.status = 'DNF';
      if (random() < 0.25) car.damage.battery = 100;
      else car.damage.powerUnit = 100;
      events.push({
        lap,
        driverId: d.id,
        type: 'mechanical failure',
        detail: 'Falha sob desgaste, quilometragem e temperatura.',
        severity: 'terminal',
      });
      // The modifier only weighs the call after a real incident; it never invents a Safety Car.
      control =
        random() < Math.min(0.95, (c.safetyCar / 100) * m.safetyCar)
          ? 'SC'
          : random() < 0.6
            ? 'VSC'
            : 'DOUBLE YELLOW';
      neutralLaps = 2;
    }
    if (x.status === 'RUNNING') {
      x.lap = lap;
      time *= neutral ? (control === 'VSC' ? 1.2 : 1.4) : 1;
      x.elapsed += time;
      x.best = Math.min(x.best, time);
      x.last = time;
    }
  }
  // Sector timing alone must not teleport cars through traffic. Successful
  // close-range attempts, actual pit stops and retirements can change order;
  // all other free-air pace advantages are paid as time lost behind traffic.
  if (race) {
    // Also enforce the starting grid on lap 1. Launch performance and explicit
    // successful attacks can change positions; pure lap pace cannot teleport
    // thirty cars past one another at the first timing line.
    const bestBefore = new Map(previous.map((car) => [car.id, car.best]));
    enforceTrackOrder(previous, cars, successfulMoves, pitDrivers);
    for (const car of cars) {
      if (car.status === 'RUNNING') car.best = Math.min(bestBefore.get(car.id) ?? car.best, car.last);
    }
  }
  let ranked = [...cars].sort(
    (a, b) =>
      (a.status !== 'RUNNING' ? 1 : 0) - (b.status !== 'RUNNING' ? 1 : 0) ||
      b.lap - a.lap ||
      a.elapsed - b.elapsed,
  );
  if (race) {
    const passes = confirmedOnTrackPasses(previous, ranked, pitDrivers, lap, control, c.overtaking);
    for (const pass of passes) {
      const car = cars.find((entry) => entry.id === pass.driverId);
      if (car) car.overtakes++;
      events.push(pass);
    }
  }
  if (control === 'SC' || control === 'RED') {
    const first = ranked[0].elapsed;
    ranked.forEach((x, i) => {
      if (x.status === 'RUNNING') x.elapsed = first + i * 0.6;
    });
  }
  if (control === 'RED') {
    events.push({
      lap,
      driverId: ranked[0].id,
      type: 'red flag',
      detail: 'Sessão suspensa por 300 s. Reinício agrupado; equipes podem trocar pneus.',
    });
    ranked.forEach((x) => {
      if (x.status === 'RUNNING') {
        x.elapsed += 300;
        x.tyre = newTyres(suitableTyre(weather));
      }
    });
  }
  if (state.recordFrames !== false)
    frames.push({
      lap,
      control,
      weather: { ...weather },
      cars: ranked.map((x, i) => ({
        id: x.id,
        position: i + 1,
        elapsed: round(x.elapsed),
        gap: round(Math.max(0, x.elapsed - ranked[0].elapsed)),
        tyre: x.tyre.compound,
        tyreWear: x.tyre.wear,
        tyreTemp: x.tyre.temperature,
        battery: g.cars[x.id].battery,
        pits: x.pits,
        status: x.status,
        lap: x.lap,
        energy: decisions[x.id].energy,
        aero: decisions[x.id].aero,
        tyreAge: x.tyreAge,
        lastLap: round(x.last),
        command: state.commands[x.id].kind,
        pit: x.pitPhase,
        sector: 3,
        relativeSpeed: x.last ? c.averageSpeed / (x.last / ((c.km / c.averageSpeed) * 3600)) : 0,
      })),
    });

  for (const [id, call] of Object.entries(state.pitCalls))
    if (call.lap <= lap) {
      delete state.pitCalls[id];
      const car = state.cars.find((c) => c.id === id);
      if (car) car.pitPhase = 'TRACK';
    }
  for (const command of Object.values(state.commands)) {
    if (command.remaining > 0) command.remaining--;
    if (command.remaining === 0) {
      command.kind = 'NORMAL';
      command.noAttack = false;
      command.yieldTo = null;
    }
  }
  Object.assign(state, { lap, sector: 1, weather, control, neutralLaps, rngState: stream.state() });
  g.weather = weather;
  if (lap >= laps) state.status = 'FINISHED';
}
export function finishRace(save: Save, state: RaceState): { results: Result[]; tape: RaceTape } {
  const g = save.game;
  const { cars, session, ids, seed, frames, events, decisions, laps } = state;
  const race = session === 'GP' || session === 'Sprint';
  // Disciplinary escalation is applied before classification and points.
  for (const x of cars) {
    if (g.discipline[x.id] >= 12) {
      x.status = 'DSQ';
      applyPenalty(save, x.id, 'DSQ');
      save.world.people[x.id].suspendedUntil = save.round + 1;
      g.discipline[x.id] = 0;
    }
  }
  const ranked = [...cars].sort(
    (a, b) =>
      (a.status === 'DSQ' ? 2 : a.status === 'DNF' ? 1 : 0) -
        (b.status === 'DSQ' ? 2 : b.status === 'DNF' ? 1 : 0) ||
      b.lap - a.lap ||
      (race ? a.elapsed + a.penalty - b.elapsed - b.penalty : a.best - b.best),
  );
  const fastest = race
    ? ranked.filter((x) => x.status === 'RUNNING').sort((a, b) => a.best - b.best)[0]?.id
    : null;
  const results = ranked.map((x, i): Result => ({
    driverId: x.id,
    teamId: g.drivers.find((d) => d.id === x.id)!.teamId,
    position: i + 1,
    time: round(race ? x.elapsed + x.penalty : x.best < 1e9 ? x.best : 999),
    points: 0,
    fastestLap: session === 'GP' && x.id === fastest,
    gain: ids.indexOf(x.id) - i,
    status: x.status === 'RUNNING' ? 'FINISHED' : x.status,
    laps: x.lap,
    overtakes: x.overtakes,
    penalty: x.penalty,
  }));
  return {
    results,
    tape: { seed, frames, events, decisions, laps, compact: state.recordFrames === false },
  };
}
export function simulateSession(
  save: Save,
  session: Session,
  ids: string[],
): { results: Result[]; tape: RaceTape } {
  const state = createRaceState(save, session, ids);
  while (state.status === 'RUNNING') stepRaceLap(save, state);
  return finishRace(save, state);
}
