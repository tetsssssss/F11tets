import type { Save } from '../domain/types';

export type PitwallSignal = { level: 'urgent' | 'watch' | 'info'; title: string; detail: string };

/** Read-only race-control briefing. All signals come from the current save/race. */
export function pitwallLive(save: Pick<Save, 'race' | 'game'>, driverId: string | null, max = 4): PitwallSignal[] {
  const race = save.race;
  if (!race || !driverId) return [];
  const car = race.cars.find((car) => car.id === driverId);
  if (!car) return [];
  const signals: PitwallSignal[] = [];
  const add = (level: PitwallSignal['level'], title: string, detail: string) => signals.push({ level, title, detail });
  if (race.control !== 'GREEN' && race.control !== 'CHEQUERED')
    add('urgent', 'Direção de prova', `Bandeira ${race.control}. Ritmo e estratégia sujeitos à neutralização.`);
  if (car.status !== 'RUNNING') {
    add('urgent', 'Carro fora da disputa', `Status oficial: ${car.status}.`);
    return signals.slice(0, Math.max(0, max));
  }
  const wet = race.weather.water > 0.17;
  const onWetTyres = car.tyre.compound === 'I' || car.tyre.compound === 'W';
  if (wet !== onWetTyres)
    add('urgent', 'Pneus fora da janela', wet ? 'Pista molhada com pneus de seco.' : 'Pista seca com pneus de chuva.');
  if (car.tyre.wear >= 75)
    add('urgent', 'Desgaste crítico', `${Math.round(car.tyre.wear)}% de desgaste. Reavaliar a parada.`);
  else if (car.tyre.wear >= 55)
    add('watch', 'Janela de pneus', `${Math.round(car.tyre.wear)}% de desgaste no ${car.tyre.compound}.`);
  const battery = save.game.cars[driverId]?.battery;
  if (typeof battery === 'number' && battery < 20)
    add('watch', 'Energia baixa', `Bateria em ${Math.round(battery)}%. Considere preservar energia.`);
  const pit = race.pitCalls[driverId];
  if (pit)
    add('info', 'Box confirmado', `Parada agendada na volta ${pit.lap}, composto ${pit.compound}.`);
  const opponents = [...race.cars].filter((c) => c.status === 'RUNNING')
    .sort((a,b) => b.lap - a.lap || a.elapsed - b.elapsed);
  const position = opponents.findIndex((c) => c.id === driverId);
  if (position > 0 && race.control === 'GREEN') {
    const ahead = opponents[position - 1];
    const gap = car.elapsed - ahead.elapsed;
    if (car.lap === ahead.lap && Number.isFinite(gap) && gap >= 0 && gap <= 1.5)
      add('info', 'Disputa próxima', `${gap.toFixed(1)} s para o carro à frente. P${position + 1}.`);
  }
  if (race.status === 'FINISHED') add('info', 'Bandeirada', 'Resultado da sessão confirmado pelo motor esportivo.');
  return signals.slice(0, Math.max(0, Math.min(8, Math.trunc(max))));
}
