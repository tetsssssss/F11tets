/** Visual framing only; offsets do not affect simulation or car positions. */
export function tvCameraOffset(compact: boolean) {
  return compact
    ? { back: 6, side: 2.4, height: 3.3, lookAhead: 2.4 }
    : { back: 9, side: 5, height: 5.5, lookAhead: 4 };
}

/** Keep the duel above the lower mobile driver card, not under it. */
export function battleCameraLookAhead(compact: boolean) {
  return compact ? -1.2 : -0.5;
}

/** A spin must travel through every authored revolution; normal steering takes the short arc. */
export function incidentYawDelta(current: number, target: number, spinning: boolean) {
  return spinning ? target - current : Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

/** Fade only nearby scenery in close shots so cars remain visible through pit structures. */
export function sceneryVisibility(distance: number, camera: 'tv' | 'aerea' | 'onboard' | 'duelo' | 'pit', name = ''): number {
  // A dedicated battle shot must never put a grandstand between the lens and the duel.
  if (camera === 'duelo' && /^(?:pit_|grandstand)/.test(name)) return 0;
  // Pit roofs are tall enough to fill a narrow mobile viewport even when faded; the pit camera keeps garages as backdrop.
  if (camera !== 'aerea' && camera !== 'pit' && /^pit_(?:building|roof)/.test(name)) return 0;
  if (camera === 'aerea' || !Number.isFinite(distance)) return 1;
  if (distance <= 8) return 0.12;
  if (distance >= 14) return 1;
  return 0.12 + ((distance - 8) / 6) * 0.88;
}
