/** One DPR/profile rule for the Babylon canvas, shared by first paint and later quality changes. */
export type BabylonQuality = 'baixo' | 'medio' | 'alto' | 'ultra';
/** Rendered pixels per CSS pixel for each profile (never above the device's own DPR). */
export const QUALITY_RATIO: Record<BabylonQuality, number> = { baixo: 1, medio: 1.35, alto: 1.7, ultra: 2 };
export function hardwareScaling(quality: BabylonQuality, dpr: number): number {
  const ratio = QUALITY_RATIO[quality] ?? QUALITY_RATIO.medio;
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return Math.max(1, safeDpr / ratio);
}
/** Next lower profile for the optional automatic downgrade; null at the floor. */
export function lowerQuality(quality: BabylonQuality): BabylonQuality | null {
  return quality === 'ultra' ? 'alto' : quality === 'alto' ? 'medio' : quality === 'medio' ? 'baixo' : null;
}
/**
 * Sustained-FPS monitor: asks for a downgrade after `windowMs` below `minFps`, then waits `cooldownMs`.
 * Pure state machine so it can be tested without a GPU.
 */
export class FpsGovernor {
  private low = 0;
  private cooldown = 0;
  constructor(readonly minFps = 24, readonly windowMs = 6000, readonly cooldownMs = 15000) {}
  /** Feed one measured FPS sample covering `ms` milliseconds. Returns true when a downgrade is due. */
  sample(fps: number, ms: number): boolean {
    if (this.cooldown > 0) { this.cooldown = Math.max(0, this.cooldown - ms); this.low = 0; return false; }
    if (fps > 0 && fps < this.minFps) this.low += ms; else this.low = 0;
    if (this.low >= this.windowMs) { this.low = 0; this.cooldown = this.cooldownMs; return true; }
    return false;
  }
}
