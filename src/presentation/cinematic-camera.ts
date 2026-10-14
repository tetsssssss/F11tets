/** Pure animation timing and camera presets. Does not touch race physics or saved state. */
export const CINEMATIC_PRESETS = {
  broadcast: { yaw: -25, pitch: 54 },
  overhead: { yaw: 0, pitch: 85 },
  low: { yaw: -46, pitch: 38 },
} as const;

export function nextCinematicYaw(yaw: number, elapsedMs: number, speed = 14): number {
  if (!Number.isFinite(yaw) || !Number.isFinite(elapsedMs) || !Number.isFinite(speed)) return 0;
  const safeElapsed = Math.max(0, Math.min(200, elapsedMs));
  const safeSpeed = Math.max(-50, Math.min(50, speed));
  return (((yaw + safeElapsed * safeSpeed / 1000) % 360) + 540) % 360 - 180;
}
