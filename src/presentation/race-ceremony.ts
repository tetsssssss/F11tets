/** Display-only poses. No timing, classification or save state is changed here. */
export function podiumOrder<T extends { position: number }>(results: readonly T[]): T[] {
  const podium = results.filter((row) => row.position >= 1 && row.position <= 3);
  return [2, 1, 3].flatMap((position) => podium.filter((row) => row.position === position));
}

export function pitCrewVisible(stage: string): boolean {
  return stage === 'STOP';
}

export function safetyCarPose<T extends { position: number; progress: number }>(
  control: string,
  cars: readonly T[],
  at: (progress: number) => { x: number; y: number },
) {
  if (control !== 'SC') return null;
  const leader = cars.find((car) => car.position === 1);
  if (!leader) return null;
  const point = at(leader.progress + 0.025);
  const next = at(leader.progress + 0.026);
  return { point, angle: Math.atan2(next.y - point.y, next.x - point.x) };
}
