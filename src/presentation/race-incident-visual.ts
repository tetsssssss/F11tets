import type { RaceEvent } from '../domain/simulation/types';

export type RaceIncidentKind = 'IMPACT' | 'SPIN' | 'OFF_TRACK' | 'STOPPED';
export type RaceIncidentPose = {
  kind: RaceIncidentKind;
  /** Lateral displacement measured in car widths. */
  side: number;
  /** Extra yaw in degrees. */
  yaw: number;
  dust: boolean;
  sparks: boolean;
  smoke: boolean;
};

const relevant = /collision|contact|spin|wide|retirement|mechanical failure|puncture/;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/**
 * Converts authoritative engine events into a display-only pose. It never mutates the event,
 * car or race and returns null rather than filling a missing incident with invented motion.
 */
export function raceIncidentPose(
  events: readonly RaceEvent[],
  driverId: string,
  status: string,
  lap: number,
  phase: number,
): RaceIncidentPose | null {
  const sameLap = events.filter((e) => e.driverId === driverId && e.lap === lap && relevant.test(e.type));
  const historicalTerminal = status !== 'RUNNING'
    ? events.findLast((e) => e.driverId === driverId && relevant.test(e.type))
    : undefined;
  const incident = sameLap.findLast((e) => e.type === 'collision') ?? sameLap.at(-1) ?? historicalTerminal;
  if (!incident) return null;

  const t = clamp(phase);
  if (/mechanical failure|retirement|puncture/.test(incident.type)) {
    return { kind: 'STOPPED', side: 2.1 * ease(t / .7), yaw: 8, dust: false, sparks: false, smoke: true };
  }
  if (incident.type === 'collision') {
    if (status !== 'RUNNING' && t >= .58)
      return { kind: 'STOPPED', side: 2.65, yaw: 72, dust: true, sparks: false, smoke: true };
    return {
      kind: 'IMPACT', side: 2.65 * ease(t / .5), yaw: 74 * ease(t / .45),
      dust: t > .22, sparks: true, smoke: status !== 'RUNNING' && t > .42,
    };
  }
  if (incident.type === 'contact') {
    return { kind: 'IMPACT', side: 1.15 * ease(t / .48), yaw: 18 * ease(t / .42), dust: false, sparks: t > .2 && t < .68, smoke: false };
  }
  if (incident.type === 'spin') {
    return { kind: 'SPIN', side: 1.1 * Math.sin(Math.PI * t), yaw: 420 * ease(t / .78), dust: t > .18, sparks: false, smoke: false };
  }
  if (incident.type === 'wide') {
    return { kind: 'OFF_TRACK', side: 2.8 * Math.sin(Math.PI * clamp(t / .9)), yaw: 0, dust: t > .16, sparks: false, smoke: false };
  }
  return null;
}
