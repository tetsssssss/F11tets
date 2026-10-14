/** Camera-only framing: read the existing race presentation, never change car state. */
type VisibleCar = {
  id: string;
  point: { x: number; y: number };
  angle: number;
  car: { status: string };
  pitStage: string;
};

export function battleFocus(cars: VisibleCar[], ids: readonly string[] | null | undefined) {
  if (!ids || ids.length < 2) return null;
  const first = cars.find((car) => car.id === ids[0]);
  const second = cars.find((car) => car.id === ids[1]);
  if (!first || !second || first.id === second.id) return null;
  if ([first, second].some((car) => car.car.status !== 'RUNNING' || car.pitStage !== 'TRACK')) return null;
  // A historical battle event is not an excuse to point the camera at empty asphalt.
  if (Math.hypot(first.point.x - second.point.x, first.point.y - second.point.y) > 80) return null;
  return {
    x: (first.point.x + second.point.x) / 2,
    y: (first.point.y + second.point.y) / 2,
    angle: first.angle,
  };
}

export function battleMagnification(viewportWidth: number) {
  return viewportWidth < 600 ? 2.35 : 1.7;
}

/** Turn the engine-authored duel line into a lateral display offset in both visual modes. */
export function visualRacePoint(car: { point: { x: number; y: number }; angle: number; duel?: { side: number }; incident?: { side: number } | null }) {
  const duel = Number.isFinite(car.duel?.side) ? Math.max(-1.5, Math.min(1.5, car.duel!.side)) : 0;
  const incident = Number.isFinite(car.incident?.side) ? Math.max(-3, Math.min(3, car.incident!.side)) : 0;
  const shift = (duel + incident) * 6.5;
  if (!shift) return car.point;
  const angle = car.angle * Math.PI / 180;
  return { x: car.point.x - Math.sin(angle) * shift, y: car.point.y + Math.cos(angle) * shift };
}

export function visualRaceAngle(car: { angle: number; incident?: { yaw: number } | null }) {
  return car.angle + (Number.isFinite(car.incident?.yaw) ? car.incident!.yaw : 0);
}
