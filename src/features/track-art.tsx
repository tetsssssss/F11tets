'use client';
import { useMemo } from 'react';
import type { Track2DGeometry, TrackPoint } from '../presentation/circuit-geometry';
import type { RaceControl } from '../domain/simulation/types';
const ASPHALT = { DRY: '#40474d', DAMP: '#343b41', WET: '#2a3944', 'HEAVY WET': '#22323e' };
export type Surface = keyof typeof ASPHALT;
export const surfaceOf = (water: number): Surface =>
  water > 0.65 ? 'HEAVY WET' : water > 0.3 ? 'WET' : water > 0.08 ? 'DAMP' : 'DRY';
/** A stretch of the lap drawn by dashing the full path, so no extra geometry is built. */
const stretch = (from: number, length: number) => ({
  pathLength: 1,
  strokeDasharray: `${length} 1`,
  strokeDashoffset: -from,
});
/** Kerbs only where the track really turns: runs of the centreline with enough curvature. */
function kerbRuns(points: TrackPoint[]) {
  const n = points.length,
    span = 6,
    bends = points.map((p, i) => {
      const a = points[(i - span + n) % n],
        b = points[(i + span) % n],
        turn = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x),
        wrapped = Math.atan2(Math.sin(turn), Math.cos(turn));
      return Math.abs(wrapped) > 0.16;
    });
  let d = '';
  for (let i = 0; i < n; i++) {
    if (!bends[i]) continue;
    let end = i;
    while (end + 1 < n && bends[end + 1]) end++;
    if (end - i >= 8)
      d +=
        'M' +
        points
          .slice(i, end + 1)
          .map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1))
          .join('L');
    i = end;
  }
  return d;
}
/**
 * Scenery for the 2D race: a couple of dozen SVG shapes built from the circuit centreline.
 * Purely visual. `unit` is one screen pixel in track units, so labels keep their size at any zoom.
 */
export function TrackArt({
  geometry,
  water,
  control,
  yellowAt,
  unit,
  showSectors = true,
}: {
  geometry: Track2DGeometry;
  water: number;
  control: RaceControl;
  /** Lap fraction of a live incident; its sector gets a light yellow tint. */
  yellowAt?: number;
  unit: number;
  showSectors?: boolean;
}) {
  const art = useMemo(() => {
    const across = (f: number, half: number) => {
      const p = geometry.at(f),
        q = geometry.at(f + 0.0006),
        len = Math.hypot(q.x - p.x, q.y - p.y) || 1,
        nx = -(q.y - p.y) / len,
        ny = (q.x - p.x) / len;
      return {
        p,
        nx,
        ny,
        x1: p.x - nx * half,
        y1: p.y - ny * half,
        x2: p.x + nx * half,
        y2: p.y + ny * half,
      };
    };
    const lane = geometry.pitLane,
      line = (pts: TrackPoint[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return {
      kerbs: kerbRuns(geometry.points),
      start: across(0, 10),
      grid: across(0.0015, 10),
      sectors: geometry.sectors.map((f) => across(f, 13)),
      lane: line(lane),
      box: line(lane.slice(24, 36)),
      boxAt: lane[30],
      entry: lane[6],
      exit: lane[54],
    };
  }, [geometry]);
  const surface = surfaceOf(water),
    neutral = control === 'SC' || control === 'VSC',
    yellow = control === 'YELLOW' || control === 'DOUBLE YELLOW',
    sector = yellowAt === undefined ? -1 : Math.min(2, Math.floor((((yellowAt % 1) + 1) % 1) * 3)),
    text = (size: number) => ({ fontSize: size * unit, fontWeight: 700 as const }),
    d = geometry.path;
  return (
    <g className="track-art" pointerEvents="none">
      <defs>
        <pattern id="grass" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="#12271f" />
          <path d="M0 13h13M13 0v13" stroke="#16302a" strokeWidth="13" opacity=".55" />
        </pattern>
      </defs>
      <rect x="-3000" y="-3000" width="6800" height="6480" fill="url(#grass)" />
      {/* Barrier line, runoff, then gravel traps at the three heavy braking zones. */}
      <path d={d} fill="#152c25" stroke="#0a1512" strokeWidth="60" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#2c3f37" strokeWidth="56" strokeLinejoin="round" />
      {geometry.brakingZones.map((f) => (
        <path
          key={f}
          d={d}
          fill="none"
          stroke="#8d7c56"
          strokeWidth="56"
          opacity=".5"
          {...stretch(f - 0.004, 0.034)}
        />
      ))}
      <path d={d} fill="none" stroke="#1d2e29" strokeWidth="30" strokeLinejoin="round" />
      {/* Pit lane: its own colour, a marked box zone, entry and exit. */}
      <polyline
        points={art.lane}
        fill="none"
        stroke="#0a1512"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <polyline
        points={art.lane}
        fill="none"
        stroke="#5b6b78"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <polyline points={art.box} fill="none" stroke="#dbc080" strokeWidth="8" />
      <polyline
        points={art.box}
        fill="none"
        stroke="#19292a"
        strokeWidth="5"
        strokeDasharray="4 3"
      />
      {/* Red and white kerbs on the corners, white edge lines, then the asphalt itself. */}
      <path d={art.kerbs} fill="none" stroke="#d8dedb" strokeWidth="25" />
      <path d={art.kerbs} fill="none" stroke="#cf4b3c" strokeWidth="25" strokeDasharray="6 6" />
      {/* Neutralised or yellow: the edge lines turn amber, a light state that stays readable. */}
      <path
        d={d}
        fill="none"
        stroke={neutral || yellow ? '#ffce45' : '#cfd6d2'}
        strokeWidth={neutral || yellow ? 22 : 20}
        strokeLinejoin="round"
      />
      <path
        data-track
        d={d}
        fill="none"
        stroke={ASPHALT[surface]}
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {surface !== 'DRY' && surface !== 'DAMP' && (
        <path
          d={d}
          fill="none"
          stroke="#a9d3e6"
          strokeWidth={surface === 'HEAVY WET' ? 11 : 7}
          opacity={surface === 'HEAVY WET' ? 0.22 : 0.12}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="#dfe6e2"
        strokeWidth=".7"
        strokeDasharray="5 14"
        opacity=".55"
      />
      {sector >= 0 && control === 'GREEN' && (
        <path
          d={d}
          fill="none"
          stroke="#ffd24a"
          strokeWidth="18"
          opacity=".3"
          {...stretch(sector / 3, 1 / 3)}
        />
      )}
      {(neutral || yellow) && (
        <path
          data-testid="neutral-track"
          d={d}
          fill="none"
          stroke="#ffce45"
          strokeWidth="1.6"
          strokeDasharray={neutral ? '9 9' : undefined}
          opacity=".8"
        />
      )}
      {/* Start/finish: two offset dashed lines read as a chequered strip. */}
      <line {...lineOf(art.start)} stroke="#f4f6f5" strokeWidth="2.4" strokeDasharray="2.4 2.4" />
      <line
        {...lineOf(art.grid)}
        stroke="#f4f6f5"
        strokeWidth="2.4"
        strokeDasharray="2.4 2.4"
        strokeDashoffset="2.4"
      />
      {showSectors &&
        art.sectors.map((s, i) => (
          <g key={i} opacity=".8">
            {i > 0 && (
              <line
                {...lineOf(s)}
                stroke={['#f4f6f5', '#7fd1ff', '#ffd27a'][i]}
                strokeWidth="1.6"
              />
            )}
            <text
              x={s.p.x + s.nx * (20 + 12 * unit)}
              y={s.p.y + s.ny * (20 + 12 * unit) + 4 * unit}
              textAnchor="middle"
              fill="#c4d6d2"
              {...text(11)}
            >
              S{i + 1}
            </text>
          </g>
        ))}
      <text
        x={art.boxAt.x}
        y={art.boxAt.y - 9 - 3 * unit}
        textAnchor="middle"
        fill="#dbc080"
        {...text(10)}
      >
        BOX
      </text>
      <text
        x={art.entry.x}
        y={art.entry.y - 8 - 2 * unit}
        textAnchor="middle"
        fill="#93a5b1"
        {...text(8.5)}
      >
        PIT IN
      </text>
      <text
        x={art.exit.x}
        y={art.exit.y - 8 - 2 * unit}
        textAnchor="middle"
        fill="#93a5b1"
        {...text(8.5)}
      >
        PIT OUT
      </text>
    </g>
  );
}
const lineOf = (l: { x1: number; y1: number; x2: number; y2: number }) => ({
  x1: l.x1,
  y1: l.y1,
  x2: l.x2,
  y2: l.y2,
});
