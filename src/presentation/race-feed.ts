import type { RaceEvent } from '../domain/simulation/types';

export type RaceFeedMode = 'MINIMAL' | 'TV' | 'TECHNICAL';
export type RaceFeedItem = { event: RaceEvent; repeats: number };

/** Race direction keeps the original log. Only the visible feed is edited. */
const IMPORTANT = /overtake|pass|pit|safety|neutral|flag|retire|accident|contact|collision|puncture|mechanical|fail|penalt|red|rain|weather|storm|finish|win|yellow|SC|VSC|braking lock-up|double.stack|team order/i;
const VERY_IMPORTANT = /overtake|contact|collision|retire|accident|puncture|mechanical|fail|penalt|safety|flag|red|SC|VSC/i;

export function raceFeed(
  events: readonly RaceEvent[],
  mode: RaceFeedMode = 'TV',
  maximum = 12,
): RaceFeedItem[] {
  const limit = Math.max(0, Math.min(50, Math.trunc(Number.isFinite(maximum) ? maximum : 12)));
  if (!limit) return [];
  // Avoid rescanning a multi-season log on every rendered lap.
  const window = events.slice(-240);
  const output: RaceFeedItem[] = [];
  const seen = new Map<string, number>();
  for (const event of window) {
    if (mode === 'MINIMAL' && !VERY_IMPORTANT.test(event.type)) continue;
    if (mode === 'TV' && !IMPORTANT.test(event.type)) continue;
    // Same driver/action on the same lap is a single editorial headline.
    // Distinct opponents, incidents, or laps are never merged.
    const key = `${event.lap}|${event.type}|${event.driverId}|${event.otherId ?? ''}|${event.severity ?? ''}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      output[previous].repeats++;
    } else {
      seen.set(key, output.length);
      output.push({ event, repeats: 1 });
    }
  }
  // Latest first, preserving order among different factual events.
  return output.slice(-limit).reverse();
}
