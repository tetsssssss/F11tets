/** Deterministic, display-only tag layout for the isometric race camera.
 * Never changes physics, car positions, classification, or save state. */
export type RaceTag = { id: string; x: number; y: number; position: number; priority: number };
export type PositionedTag = { x: number; y: number };
export const TAG_W = 57;
export const TAG_H = 22;

export function layoutRaceTags(
  items: readonly RaceTag[], width: number, height: number, limit = 12,
): Record<string, PositionedTag> {
  const result: Record<string, PositionedTag> = {};
  const used: { x: number; y: number }[] = [];
  if (width < TAG_W + 12 || height < TAG_H + 12) return result;
  const offsets: [number, number][] = [];
  for (const dy of [-12, -38, 17, -65, 43, 70, -91, 94])
    for (const dx of [15, -70, 40, -94, 75, -128]) offsets.push([dx, dy]);
  const ordered = [...items].sort((a, b) =>
    a.priority - b.priority || a.position - b.position || a.id.localeCompare(b.id),
  );
  for (const item of ordered.slice(0, Math.max(0, limit))) {
    for (const [dx, dy] of offsets) {
      const x = Math.round(item.x + dx);
      const y = Math.round(item.y + dy - 15);
      if (x < 5 || y < 5 || x + TAG_W > width - 5 || y + TAG_H > height - 5) continue;
      if (used.some((p) =>
        x < p.x + TAG_W + 4 && x + TAG_W + 4 > p.x &&
        y < p.y + TAG_H + 4 && y + TAG_H + 4 > p.y
      )) continue;
      result[item.id] = { x, y };
      used.push({ x, y });
      break;
    }
  }
  return result;
}
