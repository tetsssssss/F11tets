'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSave, useUniverse } from '../components/save-provider';
import { PersonPortrait } from '../components/person-portrait';
import { controlledIds } from '../domain/gameplay/career';
import {
  circuitGeometry,
  quarterTurn,
  trackBounds,
  trackLength,
} from '../presentation/circuit-geometry';
import { presentRace, raceOrder } from '../presentation/race-presentation';
import {
  battles,
  CAMERA_MODES,
  frameShot,
  pickShot,
  type CameraMode,
  type Shot,
} from '../presentation/race-camera';
import {
  fanOut,
  MARKER_LABELS,
  MARKER_MODES,
  planMarkers,
  type MarkerMode,
} from '../presentation/map-markers';
import { surfaceOf, TrackArt } from './track-art';
import { RaceScene3D } from './race-scene-3d';
import LiveRaceBabylon, { type RaceBabylonCamera, type RaceBabylonQuality, type RaceBabylonShot } from './live-race-babylon';
import { BABYLON_CAMERA_CHOICES, BABYLON_CAMERA_LABELS, babylonShotFor } from '../presentation/broadcast-director';
import type { RaceViewMode } from '../presentation/race-view-preference';
import { settingsOf } from '../domain/gameplay/settings';
import { pickPhotoSrc, resolvePersonPhoto, type Photo } from '../presentation/person-photo';
import { battleFocus, visualRaceAngle } from '../presentation/race-visual-focus';
import { safetyCarPose } from '../presentation/race-ceremony';
import type { RaceIncidentPose } from '../presentation/race-incident-visual';
const MARKERS_KEY = 'f1-universe:map-markers';
/** Masters already decoded once; markers keep the card on screen until theirs is in here. */
const readyMasters = new Set<string>();
type Camera = CameraMode;
const CAMERAS = CAMERA_MODES;
const CAMERA_LABELS: Record<Camera, string> = {
  'FULL TRACK': 'FULL',
  'FOLLOW DRIVER': 'FOLLOW',
  'FOLLOW LEADER': 'LÍDER',
  BATTLE: 'BATTLE',
  AUTO: 'AUTO',
};
const DUEL_LABELS: Record<string, string> = {
  ATTACK: 'ATTACK',
  DEFEND: 'DEFEND',
  'SIDE BY SIDE': 'SIDE BY SIDE',
  LOCKUP: 'LOCKUP',
  WIDE: 'WIDE',
  CONTACT: 'CONTACT',
  'OVERTAKE COMPLETE': 'OVERTAKE COMPLETE',
  'OVERTAKE FAILED': 'OVERTAKE FAILED',
};
/** Dark or light text, whichever reads on this team colour. */
function ink(hex: string) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16),
    l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.58 ? '#0a1014' : '#fff';
}
type Toast = { id: number; text: string; tone: 'info' | 'warn' | 'alert' | 'own' };
export default function LiveMap({
  renderMode = '2d',
  full = false,
  clean = false,
  selected,
  onSelect,
  onFull,
  onRenderMode,
  onBabylonError,
}: {
  renderMode?: RaceViewMode;
  /** Fullscreen map: wheel and pinch zoom, largest photo files. */
  full?: boolean;
  /** Clean view: nothing floats over the circuit but the essentials. */
  clean?: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onFull?: () => void;
  onRenderMode?: (mode: RaceViewMode) => void;
  onBabylonError?: (reason: string) => void;
}) {
  const { save } = useSave(),
    { driverById, teamById } = useUniverse(),
    r = save.race!,
    c = save.game.circuits[r.round - 1];
  const [view, setView] = useState({ w: 800, h: 480, dpr: 1 });
  // A tall canvas gets the circuit turned a quarter, so a wide track still fills the screen.
  const tall = view.h > view.w * 1.12,
    geometry = useMemo(() => {
      const g = circuitGeometry(c);
      return tall ? quarterTurn(g) : g;
    }, [c.id, c.corners, tall]),
    // Fit-to-track: the box hugs the asphalt and pit lane, with room for kerbs only.
    bounds = useMemo(() => trackBounds(geometry, 18), [geometry]),
    lapLength = useMemo(() => trackLength(geometry), [geometry]);
  const step = r.lap * 3 + r.sector;
  const [frame, setPhase] = useState({ step, t: 0 }),
    [, setLoads] = useState(0),
    [camera, setCamera] = useState<Camera>(
      settingsOf(save).assists.autoCamera ? 'AUTO' : 'FULL TRACK',
    ),
    // Until the player touches the camera, the first lap gets the opening sequence.
    [touched, setTouched] = useState(false),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [cam, setCam] = useState({ x: bounds.cx, y: bounds.cy, z: 1 }),
    [quality, setQuality] = useState('medium'),
    [babylonCamera, setBabylonCamera] = useState<RaceBabylonCamera>('auto'),
    [babylonQuality, setBabylonQuality] = useState<RaceBabylonQuality>('medio'),
    [autoQuality, setAutoQuality] = useState(false),
    [qualityNotice, setQualityNotice] = useState(''),
    [isoBattleView, setIsoBattleView] = useState(false),
    [markers, setMarkers] = useState<MarkerMode>('cars'),
    [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MARKERS_KEY) as MarkerMode | null;
      if (stored && MARKER_MODES.includes(stored)) setMarkers(stored);
    } catch {}
  }, []);
  useEffect(() => {
    try { setAutoQuality(localStorage.getItem('f1.babylon.autoQuality') === '1'); } catch {}
  }, []);
  function chooseAutoQuality(value: boolean) {
    setAutoQuality(value);
    setQualityNotice('');
    try { localStorage.setItem('f1.babylon.autoQuality', value ? '1' : '0'); } catch {}
  }
  // An economical default keeps the tactical map responsive on small touch screens.
  // The user can still raise quality manually from the view toolbar.
  useEffect(() => {
    if (window.matchMedia('(max-width: 680px)').matches) {
      setQuality('low');
      setBabylonQuality('baixo');
    }
  }, []);
  function chooseMarkers(value: MarkerMode) {
    setMarkers(value);
    try {
      localStorage.setItem(MARKERS_KEY, value);
    } catch {}
  }
  const drag = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    pinch = useRef<{ distance: number; zoom: number } | null>(null),
    canvas = useRef<SVGSVGElement>(null),
    onAir = useRef<Shot | undefined>(undefined),
    babylonOnAir = useRef<Shot | undefined>(undefined),
    aim = useRef({ x: 0, y: 0, z: 1 }),
    ticks = useRef<{
      seed: number;
      step: number;
      lap: number;
      gaps: Record<string, number>;
      /** Gaps of the lap before, while this lap's glide is still playing. */
      from?: Record<string, number>;
    } | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The real size of the canvas drives fit-to-track and how large markers are drawn.
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      setView((v) =>
        Math.abs(v.w - w) < 1 && Math.abs(v.h - h) < 1 && v.dpr === dpr ? v : { w, h, dpr },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const own = controlledIds(save),
    reduced = save.preferences.reducedMotion;
  useEffect(() => {
    if (reduced) return;
    // Camera easing: quick enough to keep up with a car, slow enough never to teleport.
    let id = 0,
      last = performance.now();
    const ease = (now: number) => {
      const k = 1 - Math.exp(-Math.min(100, now - last) / 240);
      last = now;
      setCam((c) => {
        const g = aim.current;
        if (c.x === g.x && c.y === g.y && c.z === g.z) return c;
        if (drag.current) return g;
        const n = { x: c.x + (g.x - c.x) * k, y: c.y + (g.y - c.y) * k, z: c.z + (g.z - c.z) * k };
        return Math.abs(n.x - g.x) < 0.05 &&
          Math.abs(n.y - g.y) < 0.05 &&
          Math.abs(n.z - g.z) < 0.002
          ? g
          : n;
      });
      id = requestAnimationFrame(ease);
    };
    id = requestAnimationFrame(ease);
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  useEffect(() => {
    setPhase({ step, t: 0 });
    if (r.paused || r.status === 'FINISHED' || r.control === 'RED' || reduced) return;
    let id = 0,
      last = 0;
    const start = performance.now(),
      duration = 1800 / r.speed,
      fps = quality === 'high' ? 60 : quality === 'low' ? 20 : 30;
    const draw = (now: number) => {
      if (now - last >= 1000 / fps) {
        setPhase({ step, t: Math.min(0.999, (now - start) / duration) });
        last = now;
      }
      if (now - start < duration) id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [r.lap, r.sector, r.paused, r.speed, r.status, r.control, reduced, quality]);
  // A frame left over from the previous sector must not be replayed on the new one.
  const phase = frame.step === step ? frame.t : 0,
    moving = !r.paused && r.status === 'RUNNING' && r.control !== 'RED' && !reduced;
  if (!ticks.current || ticks.current.seed !== r.seed || ticks.current.step !== step) {
    const order = raceOrder(r),
      lead = order[0]?.elapsed ?? 0,
      last = ticks.current,
      continuous = !!last && last.seed === r.seed && step === last.step + 1;
    ticks.current = {
      seed: r.seed,
      step,
      lap: r.lap,
      gaps: Object.fromEntries(order.map((x) => [x.id, Math.max(0, x.elapsed - lead)])),
      // Gaps only change when the engine resolves a lap; the glide then spans two sectors.
      from: !continuous ? undefined : last!.lap !== r.lap ? last!.gaps : last!.from,
    };
  }
  if (!moving) ticks.current.from = undefined;
  // Each car glides from last lap's gap to the new one, so a pass is seen happening.
  const glide = Math.min(1, (r.sector - 1 + phase) / 2),
    cars = presentRace(
      r,
      geometry,
      (c.km / c.averageSpeed) * 3600,
      phase,
      moving && ticks.current.from && glide < 1
        ? { gaps: ticks.current.from, t: glide }
        : undefined,
    ),
    chosen = cars.find((x) => x.id === selected);
  // Fit-to-track: the largest scale that shows this circuit's own bounding box in this canvas.
  // On wide screens the view bar floats over the top edge, so that strip is kept clear.
  const floatingBar = view.w > 700 && !clean,
    inset = floatingBar ? 46 : 0,
    fit = Math.min(view.w / bounds.w, (view.h - inset) / bounds.h);
  // The director only reads the race; the shot it returns moves the camera and nothing else.
  const opening = camera === 'FULL TRACK' && !touched && r.lap <= 1 && r.status === 'RUNNING';
  let shot = pickShot(opening ? 'AUTO' : camera, {
    r,
    cars,
    own,
    selected,
    now: typeof performance === 'undefined' ? 0 : performance.now(),
    previous: onAir.current,
  });
  if (opening && shot.kind !== 'start') shot = pickShot('FULL TRACK', { r, cars, own, selected, now: 0 });
  onAir.current = shot;
  const framed = frameShot(shot, {
      r,
      lapT: (r.sector - 1 + phase) / 3,
      cars,
      geometry,
      bounds,
      view: { w: view.w / fit, h: (view.h - inset) / fit },
    }),
    goal = {
      x: framed.x + pan.x,
      y: framed.y + pan.y,
      z: Math.max(1, Math.min(6, framed.z * zoom)),
    };
  aim.current = goal;
  // Reduced motion and dragging cut straight to the goal; otherwise the camera eases to it.
  const eye = reduced || drag.current ? goal : cam,
    z = eye.z,
    scale = fit * z,
    w = view.w / scale,
    h = view.h / scale;
  const cx = eye.x,
    cy = eye.y - inset / 2 / scale;
  const fights = r.lap > 0 ? battles(r, cars) : [];
  // Babylon broadcast director: AUTO reuses pickShot's own decisions; a manual camera ignores them.
  const babylonBattle = fights[0] ? [fights[0].attacker.id, fights[0].defender.id] : null;
  let babylonShot: RaceBabylonShot = { kind: 'tv', ids: [], label: 'TV' };
  if (renderMode === 'babylon') {
    const nowMs = typeof performance === 'undefined' ? 0 : performance.now();
    const auto = babylonCamera === 'auto'
      ? pickShot('AUTO', { r, cars, own, selected, now: nowMs, previous: babylonOnAir.current })
      : pickShot('FULL TRACK', { r, cars, own, selected, now: nowMs });
    if (babylonCamera === 'auto') babylonOnAir.current = auto;
    const follow = pickShot('FOLLOW DRIVER', { r, cars, own, selected, now: nowMs });
    babylonShot = babylonShotFor(babylonCamera, { auto, follow, battleIds: babylonBattle, cars, selected, own });
  }
  const cameraFight = ((renderMode === 'iso' && isoBattleView) || (renderMode === 'babylon' && babylonShot.kind === 'duelo')) && fights[0] &&
      battleFocus(cars, [fights[0].attacker.id, fights[0].defender.id]) ? fights[0] : undefined,
    duel =
      cameraFight ?? (shot.ids.length > 1 && /battle|overtake/.test(shot.kind)
        ? fights.find((b) => shot.ids.includes(b.attacker.id) && shot.ids.includes(b.defender.id))
        : undefined) ??
      // The player's own fight is always worth a small card, whatever the camera shows.
      fights.find((b) =>
        [b.attacker.id, b.defender.id].some((id) => own.includes(id) || id === selected),
      );
  const water = r.weather.water,
    wet = surfaceOf(water),
    // A real incident event from this lap lights its sector yellow; nothing is invented here.
    trouble = r.events.findLast(
      (e) =>
        e.lap === r.lap && /collision|contact|retirement|puncture|mechanical failure/.test(e.type),
    ),
    incident = trouble && cars.find((x) => x.id === trouble.driverId);
  // Small temporary notices instead of banners: new engine events, flags and rain.
  const seen = useRef({ seed: r.seed, events: r.events.length, control: r.control, wet: water > 0.08 }),
    toastId = useRef(0);
  useEffect(() => {
    const last = seen.current,
      fresh: Omit<Toast, 'id'>[] = [];
    const code = (id?: string) => (id && driverById[id]?.short) || '—';
    if (last.seed === r.seed) {
      for (const e of r.events.slice(last.events)) {
        const mine = own.includes(e.driverId) || (!!e.otherId && own.includes(e.otherId)),
          tone = mine ? 'own' : 'info',
          front = (cars.find((x) => x.id === e.driverId)?.position ?? 99) <= 10;
        if (e.type === 'overtake' && (mine || front))
          fresh.push({ text: `OVERTAKE — ${code(e.driverId)} > ${code(e.otherId)}`, tone });
        else if (e.type === 'pit' && (mine || front))
          fresh.push({ text: `PIT — ${code(e.driverId)}`, tone });
        else if (e.type === 'contact' || e.type === 'collision')
          fresh.push({
            text: `CONTACT — ${code(e.driverId)}${e.otherId ? ' × ' + code(e.otherId) : ''}`,
            tone: 'warn',
          });
        else if (e.type === 'braking lock-up' && (mine || front))
          fresh.push({ text: `LOCKUP — ${code(e.driverId)}`, tone });
        else if (/retirement|mechanical failure|puncture/.test(e.type))
          fresh.push({
            text: `${e.type === 'puncture' ? 'PUNCTURE' : 'OUT'} — ${code(e.driverId)}`,
            tone: 'warn',
          });
        else if (e.type === 'unsafe release' && mine)
          fresh.push({ text: `UNSAFE RELEASE — ${code(e.driverId)}`, tone: 'warn' });
      }
      if (last.control !== r.control)
        fresh.push({
          text:
            r.control === 'SC'
              ? 'SAFETY CAR'
              : r.control === 'VSC'
                ? 'VIRTUAL SAFETY CAR'
                : r.control === 'RED'
                  ? 'RED FLAG'
                  : r.control === 'GREEN'
                    ? 'GREEN FLAG'
                    : r.control,
          tone: r.control === 'GREEN' ? 'info' : 'alert',
        });
      if (last.wet !== water > 0.08)
        fresh.push({ text: water > 0.08 ? 'RAIN STARTING' : 'TRACK DRYING', tone: 'alert' });
    }
    seen.current = { seed: r.seed, events: r.events.length, control: r.control, wet: water > 0.08 };
    if (!fresh.length) return;
    const added = fresh.slice(-3).map((t) => ({ ...t, id: ++toastId.current }));
    setToasts((list) => [...list, ...added].slice(-3));
    const timer = setTimeout(
      () => setToasts((list) => list.filter((t) => !added.some((a) => a.id === t.id))),
      4200,
    );
    return () => clearTimeout(timer);
  }, [r.events.length, r.control, water > 0.08, r.seed]);
  const cameraTo = (next: Camera) => {
    setTouched(true);
    setPan({ x: 0, y: 0 });
    setCamera(next);
  };
  const zoomBy = (factor: number) => {
    setTouched(true);
    setZoom((v) => Math.max(0.56, Math.min(4, v * factor)));
  };
  const fitTrack = () => {
    setTouched(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCamera('FULL TRACK');
  };
  const follow = (id?: string) => {
    if (id) onSelect(id);
    cameraTo(camera === 'FOLLOW DRIVER' && !id ? 'FULL TRACK' : 'FOLLOW DRIVER');
  };
  const photosOnly = markers === 'photos',
    plan =
      markers === 'cars'
        ? planMarkers(cars, { mode: 'hybrid', scale, own, selected })
        : planMarkers(cars, { mode: markers, scale, own, selected });
  // Markers hold a size on screen: larger maps and higher zoom grow them only moderately.
  const facePx = Math.max(17, Math.min(34, view.w * 0.03)) * Math.pow(z, 0.4),
    badgePx = photosOnly ? facePx : Math.max(17, facePx * 0.8),
    richPx = photosOnly ? facePx : Math.min(72, facePx * 1.22),
    tilePx = (view.w < 600 ? 12.5 : 14.5) * Math.pow(z, 0.22),
    carPx = Math.max(17, Math.min(25, view.w * 0.018)) * Math.pow(z, 0.35),
    px = (id: string) =>
      markers === 'cars'
        ? carPx
        : plan[id].tier === 0
          ? tilePx
          : plan[id].tier === 1
            ? badgePx
            : richPx;
  // Display-only fan-out, one pass per kind of marker so each gets the room it needs.
  const layout = { at: geometry.at, length: lapLength, maxShift: r.lap === 0 ? 40 : 1.5 },
    spread =
      markers === 'cars'
        ? fanOut(cars, { w: carPx / scale, h: carPx / scale }, layout)
        : {
            ...fanOut(
              cars.filter((v) => plan[v.id].tier === 0),
              { w: (tilePx * 1.95) / scale, h: (tilePx * 1.12) / scale },
              layout,
            ),
            ...fanOut(
              cars.filter((v) => plan[v.id].tier > 0),
              { w: badgePx / scale, h: (badgePx * 1.22) / scale },
              layout,
            ),
          };
  /** Where a marker is drawn relative to its true point: fan-out lane plus any fight move. */
  const shift = (v: (typeof cars)[number]) => {
    const fan = spread[v.id],
      a = (v.angle * Math.PI) / 180,
      // A fight moves the car sideways by about one marker; a tile is wider than it is tall.
      side = ((v.duel?.side ?? 0) + (v.incident?.side ?? 0)) * (px(v.id) * (plan[v.id].tier === 0 && markers !== 'cars' ? 1.15 : 0.95)) / scale;
    return {
      x: (fan?.x ?? 0) - Math.sin(a) * side,
      y: (fan?.y ?? 0) + Math.cos(a) * side,
      tether: !!fan && !fan.stretched,
    };
  };
  const portraits = Object.fromEntries(
    (markers === 'cars' ? [] : cars)
      .filter((v) => plan[v.id].tier > 0)
      .map((v) => {
        const photo = resolvePersonPhoto(v.id, v.id.startsWith('junior-')),
          shown = px(v.id) * plan[v.id].scale,
          // Fullscreen always shows the largest file there is; the small map takes what it needs.
          best = pickPhotoSrc(
            photo,
            full ? Infinity : (shown * view.dpr) / (photo.face?.size ?? 1),
          ),
          href = best !== photo.card && best && !readyMasters.has(best) ? photo.card : best;
        return [v.id, { photo, best, href }];
      }),
  );
  const pending = Object.values(portraits)
    .filter((p) => p.best && p.href !== p.best)
    .map((p) => p.best)
    .join('|');
  useEffect(() => {
    if (!pending) return;
    let live = true;
    for (const url of pending.split('|')) {
      const img = new Image();
      img.onload = () => {
        readyMasters.add(url);
        if (live) setLoads((n) => n + 1);
      };
      img.src = url;
    }
    return () => {
      live = false;
    };
  }, [pending]);
  // DOM order stays fixed (by driver) so a pass animates instead of re-inserting the node;
  // the player's, selected and fighting cars are drawn last, on top of the pack.
  const drawn = [...cars].sort(
    (a, b) => plan[a.id].priority - plan[b.id].priority || a.id.localeCompare(b.id),
  );
  const ringOf = (v: (typeof cars)[number]) =>
    selected === v.id
      ? '#fff'
      : own.includes(v.id)
        ? '#88ecff'
        : v.battle || v.duel
          ? '#ffc466'
          : undefined;
  const carNode = (v: (typeof cars)[number]) => {
    const d = driverById[v.id],
      t = teamById[d.teamId],
      p = plan[v.id],
      at = shift(v),
      ring = ringOf(v),
      size = px(v.id) * p.scale,
      pit = v.pitStage === 'STOP' ? ' BOX' : '';
    return (
      <g
        key={v.id}
        data-driver={v.id}
        data-tier={markers === 'cars' ? 'car' : p.tier}
        className="live-car"
        transform={`translate(${v.point.x},${v.point.y})`}
        opacity={v.car.status === 'RUNNING' ? 1 : 0.38}
        onClick={() => onSelect(v.id)}
        onDoubleClick={() => follow(v.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(v.id);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Selecionar ${d.name}, P${v.position}`}
      >
        <title>
          {d.name} · P{v.position} · {v.pitStage === 'TRACK' ? v.car.status : v.pitStage}
        </title>
        {markers === 'cars' ? (
          <>
          <IncidentEffects incident={v.incident} offset={at} units={size / scale} paused={r.paused || reduced} />
          <CarMarker
            offset={at}
            units={size / scale}
            angle={visualRaceAngle(v)}
            color={t.color}
            secondary={t.secondary}
            ring={ring}
            dashed={own.indexOf(v.id) === 1}
            label={p.label ? d.short + pit : ''}
            textUnits={(view.w < 600 ? 9.5 : 10.5) / scale}
          />
          </>
        ) : p.tier === 0 ? (
          <TileMarker
            offset={at}
            units={size / scale}
            color={t.color}
            ring={ring}
            dashed={own.indexOf(v.id) === 1}
            position={p.showPosition ? v.position : undefined}
            label={d.short}
            pit={!!pit}
          />
        ) : (
          <PhotoMarker
            {...portraits[v.id]}
            offset={at}
            tether={at.tether && photosOnly}
            units={size / scale}
            px={size}
            color={t.color}
            ring={ring}
            dashed={own.indexOf(v.id) === 1}
            position={p.showPosition ? v.position : undefined}
            tag={p.label}
            tucked={!p.priority && p.crowd > 2}
            label={d.short + pit}
          />
        )}
      </g>
    );
  };
  const sc = safetyCarPose(r.control, cars, geometry.at)?.point,
    following = camera === 'FOLLOW DRIVER';
  return (
    <div
      className={
        'live-map ' +
        (renderMode !== '2d' ? 'map-3d ' : '') +
        (full ? 'theater-map ' : '') +
        (reduced ? 'no-motion ' : '') +
        'markers-' +
        markers
      }
    >
      {!clean && (
        <div className="view-bar" role="toolbar" aria-label="Visualização do mapa">
          {renderMode === '2d' && <div className="marker-toggle seg" role="group" aria-label="Marcadores do mapa">
            {MARKER_MODES.map((id) => (
              <button
                key={id}
                className={markers === id ? 'selected' : ''}
                aria-pressed={markers === id}
                title={
                  id === 'auto'
                    ? 'Um nível para todo o pelotão, conforme zoom e densidade'
                    : id === 'hybrid'
                      ? 'Carro a carro: pelotão compacto, pilotos isolados com foto'
                      : id === 'compact'
                        ? 'Sempre sigla, cor da equipe e posição'
                        : id === 'photos'
                          ? 'Sempre retratos'
                          : 'Mini-carros'
                }
                onClick={() => chooseMarkers(id)}
              >
                {MARKER_LABELS[id]}
              </button>
            ))}
          </div>}
          {renderMode === '2d' && <label className="view-camera">
            <span>CÂMERA</span>
            <select
              aria-label="Câmera 2D"
              value={camera}
              onChange={(e) => cameraTo(e.target.value as Camera)}
            >
              {CAMERAS.map((v) => (
                <option key={v} value={v}>
                  {CAMERA_LABELS[v]}
                </option>
              ))}
            </select>
          </label>}
          {renderMode !== 'babylon' && <div className="seg" role="group" aria-label="Zoom">
            <button
              aria-label="Afastar mapa"
              title="Zoom −"
              disabled={goal.z <= 1.001 && zoom <= 1}
              onClick={() => zoomBy(1 / 1.3)}
            >
              −
            </button>
            <button aria-label="Aproximar mapa" title="Zoom +" onClick={() => zoomBy(1.3)}>
              +
            </button>
            <button title="Enquadrar o circuito inteiro" onClick={fitTrack}>
              AJUSTAR
            </button>
          </div>}
          {renderMode !== 'babylon' && <button
            className={following ? 'selected' : ''}
            aria-pressed={following}
            title="Seguir o piloto selecionado (ou o seu)"
            onClick={() => follow()}
          >
            SEGUIR
          </button>}
          <div className="seg race-render-mode" role="group" aria-label="Modo gráfico da corrida">
            <button type="button" className={renderMode === '2d' ? 'selected' : ''} aria-pressed={renderMode === '2d'} onClick={() => onRenderMode?.('2d')} title="Mapa 2D tático original">2D TÁTICO</button>
            <button type="button" className={renderMode === 'iso' ? 'selected' : ''} aria-pressed={renderMode === 'iso'} onClick={() => onRenderMode?.('iso')} title="Câmera 2.5D isométrica">2.5D</button>
            <button type="button" className={renderMode === 'babylon' ? 'selected' : ''} aria-pressed={renderMode === 'babylon'} onClick={() => onRenderMode?.('babylon')} title="Cena WebGL real em Babylon.js">3D BABYLON</button>
          </div>
          {renderMode === 'babylon' && <label className="view-camera"><span>CÂMERA 3D</span><select aria-label="Câmera Babylon" value={babylonCamera} onChange={e => setBabylonCamera(e.target.value as RaceBabylonCamera)}>{BABYLON_CAMERA_CHOICES.map(choice => <option key={choice} value={choice}>{BABYLON_CAMERA_LABELS[choice]}</option>)}</select></label>}
          {renderMode === 'babylon' && <label className="view-auto-quality" title="Reduz a qualidade 3D sozinho se a fluidez cair por vários segundos"><input type="checkbox" checked={autoQuality} onChange={e => chooseAutoQuality(e.target.checked)} /><span>AUTO-QUALIDADE</span></label>}
          {renderMode === 'babylon' && qualityNotice && <span className="view-quality-notice" role="status">{qualityNotice}</span>}
          {renderMode === 'babylon' && <label className="view-quality"><span>QUALIDADE 3D</span><select aria-label="Qualidade Babylon" value={babylonQuality} onChange={e => setBabylonQuality(e.target.value as RaceBabylonQuality)}><option value="baixo">Baixa</option><option value="medio">Média</option><option value="alto">Alta</option><option value="ultra">Ultra</option></select></label>}
          {renderMode === '2d' && <label className="view-quality">
            <span>FPS</span>
            <select
              aria-label="Qualidade 2D"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>}
          {onFull && !full && (
            <button className="view-full" aria-label="Tela cheia do mapa" onClick={onFull}>
              ⛶ TELA CHEIA DO MAPA
            </button>
          )}
        </div>
      )}
      <div className="race-stage">
        {renderMode === 'iso' && <RaceScene3D
          geometry={geometry}
          cars={cars}
          selected={selected}
          own={own}
          colors={Object.fromEntries(cars.map((v) => [v.id, teamById[driverById[v.id].teamId].color]))}
          codes={Object.fromEntries(cars.map((v) => [v.id, driverById[v.id].short]))}
          onSelect={onSelect}
          zoom={zoom}
          reduced={reduced}
          opening={r.lap === 0}
          battleIds={fights[0] ? [fights[0].attacker.id, fights[0].defender.id] : null}
          battleView={isoBattleView}
          onBattleView={setIsoBattleView}
          control={r.control}
          paused={r.paused}
        />}
        {renderMode === 'babylon' && <LiveRaceBabylon
          geometry={geometry}
          cars={cars}
          colors={Object.fromEntries(cars.map(v => [v.id, teamById[driverById[v.id].teamId].color]))}
          teamIds={Object.fromEntries(cars.map(v => [v.id, driverById[v.id].teamId]))}
          rotated={tall}
          selected={selected}
          own={own}
          camera={babylonCamera}
          shot={babylonShot}
          battleIds={babylonBattle}
          quality={babylonQuality}
          autoQuality={autoQuality}
          onQualityDowngrade={(next) => { setBabylonQuality(next); setQualityNotice(`Qualidade 3D reduzida para ${next === 'baixo' ? 'Baixa' : 'Média'} para manter a fluidez.`); }}
          wet={water > 0.08}
          paused={r.paused || r.status !== 'RUNNING' || r.control === 'RED'}
          reduced={reduced}
          control={r.control}
          onSelect={onSelect}
          onFailure={(reason) => onBabylonError?.(reason)}
        />}
        <svg
          ref={canvas}
          className={'race-canvas' + (renderMode !== '2d' ? ' race-canvas-hidden' : '')}
          viewBox={`${cx - w / 2} ${cy - h / 2} ${w} ${h}`}
          onWheel={(e) => {
            if (full) zoomBy(e.deltaY < 0 ? 1.15 : 0.87);
          }}
          role="img"
          aria-label={`Mapa da corrida com ${cars.length} carros · ${c.name} · ${wet}`}
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) {
              const [a, b] = [...pointers.current.values()];
              pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom };
              drag.current = null;
              return;
            }
            if ((e.target as Element).closest('[data-driver]')) return;
            drag.current = { x: e.clientX, y: e.clientY, pan };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (pointers.current.has(e.pointerId))
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch.current && pointers.current.size >= 2) {
              const [a, b] = [...pointers.current.values()],
                ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance;
              setTouched(true);
              setZoom(Math.max(0.56, Math.min(4, pinch.current.zoom * ratio)));
              return;
            }
            if (!drag.current) return;
            const unit = 1 / scale,
              dx = e.clientX - drag.current.x,
              dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) setTouched(true);
            setPan({ x: drag.current.pan.x - dx * unit, y: drag.current.pan.y - dy * unit });
          }}
          onPointerUp={(e) => {
            pointers.current.delete(e.pointerId);
            pinch.current = null;
            drag.current = null;
          }}
          onPointerCancel={(e) => {
            pointers.current.delete(e.pointerId);
            pinch.current = null;
            drag.current = null;
          }}
        >
          <defs>
            <pattern id="rain-pattern" width="22" height="28" patternUnits="userSpaceOnUse">
              <path d="M3 2l-3 7M18 17l-3 7" stroke="#a8dbe7" opacity=".3" />
            </pattern>
            <clipPath id="face-clip">
              <circle r="10" />
            </clipPath>
          </defs>
          <TrackArt
            geometry={geometry}
            water={water}
            control={r.control}
            yellowAt={incident?.lapProgress}
            unit={1 / scale}
          />
          {water > 0.08 && (
            <rect
              x="-3000"
              y="-3000"
              width="6800"
              height="6480"
              fill="url(#rain-pattern)"
              pointerEvents="none"
            />
          )}
          {sc && (
            <g
              transform={`translate(${sc.x},${sc.y}) scale(${Math.max(1, 1.3 / scale)})`}
              data-testid="safety-car"
              className={reduced || r.paused ? '' : 'race-safety-beacon'}
            >
              <rect x="-10" y="-5" width="20" height="10" rx="3" fill="#ffce45" />
              <circle cy="-5" r="2.5" fill="#fff2a8" />
              <text y="-11" fill="#ffce45" fontSize="11">
                SC
              </text>
            </g>
          )}
          {drawn.map(carNode)}
          {r.control === 'RED' && (
            <rect
              data-testid="red-flag-overlay"
              x="-3000"
              y="-3000"
              width="6800"
              height="6480"
              fill="#d94545"
              opacity=".16"
              pointerEvents="none"
            />
          )}
        </svg>
        <div className="map-notes" aria-live="polite">
          {!photosOnly && !clean && (shot.kind !== 'full' || camera === 'BATTLE') && (
            <div className="shot-chip" role="status">
              {camera === 'AUTO' ? 'AUTO · ' : ''}
              {shot.label}
            </div>
          )}
          {!clean && own.map((id) => {
            // Read-only pit status: the engine's real call and the presentation stage, never an invented duration.
            const call = r.pitCalls[id], c = cars.find((x) => x.id === id);
            if (!call && (!c || c.pitStage === 'TRACK')) return null;
            const stage = c && c.pitStage !== 'TRACK' ? { ENTRY: 'ENTRADA NO BOX', STOP: 'PARADA', EXIT: 'SAÍDA' }[c.pitStage] : null;
            return (
              <div key={'pit-' + id} className="shot-chip pit-chip" role="status">
                {driverById[id]?.short ?? id} · BOX{call ? ` V${call.lap} · ${call.compound}` : ''}
                {stage ? ` · ${stage}` : ''}
              </div>
            );
          })}
          {toasts.slice(photosOnly ? -2 : -3).map((t) => (
            <div key={t.id} className={'map-toast tone-' + t.tone}>
              {t.text}
            </div>
          ))}
        </div>
        {duel && (
          <div className="battle-card" aria-label="Disputa em foco">
            {(
              [
                ['ATACANTE', duel.attacker],
                ['DEFENSOR', duel.defender],
              ] as const
            ).map(([role, v], i) => (
              <span
                key={role}
                className={i ? 'defender' : 'attacker'}
                title={role}
                style={{ borderColor: teamById[driverById[v.id].teamId].color }}
              >
                <strong>{driverById[v.id].short}</strong> P{v.position}
              </span>
            ))}
            <b>{Math.abs(duel.attacker.gap - duel.defender.gap).toFixed(1)}s</b>
            {duel.attacker.duel && (
              <small>
                {DUEL_LABELS[duel.attacker.duel.state]}
                {/ATTACK|SIDE/.test(duel.attacker.duel.state)
                  ? duel.attacker.duel.line === 'inside'
                    ? ' · POR DENTRO'
                    : ' · POR FORA'
                  : ''}
              </small>
            )}
          </div>
        )}
        {r.lap === 0 && (
          <div className="start-lights" aria-label="Largada">
            <span />
            <span />
            <span />
            <span />
            <span />
            <small>{r.paused ? 'GRID PRONTO' : 'LARGADA'}</small>
          </div>
        )}
        {chosen && (
          <div className="selected-driver-panel">
            <PersonPortrait
              personId={chosen.id}
              name={driverById[chosen.id].name}
              size={full && view.w > 700 ? 76 : 56}
              focus="face"
              quality={full ? 'master' : 'auto'}
              showTeamAccent={teamById[driverById[chosen.id].teamId].color}
              eager
              fictional={chosen.id.startsWith('junior-')}
            />
            <div>
              <strong>
                P{chosen.position} · {driverById[chosen.id].name}
              </strong>
              <small>{teamById[driverById[chosen.id].teamId].name}</small>
              <small>
                {chosen.position === 1 ? 'LÍDER' : '+' + chosen.gap.toFixed(1) + 's'} · Pneu{' '}
                {chosen.car.tyre.compound} {chosen.car.tyreAge}V · Bateria{' '}
                {save.game.cars[chosen.id].battery.toFixed(0)}%
              </small>
            </div>
            <button
              className={following ? 'selected' : ''}
              aria-pressed={following}
              onClick={() => follow(following ? undefined : chosen.id)}
            >
              SEGUIR
            </button>
            <button aria-label="Fechar piloto selecionado" onClick={() => onSelect(null)}>
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
type Offset = { x: number; y: number };
const place = (offset: Offset, k: number) => ({
  transform: `translate(${offset.x.toFixed(2)}px, ${offset.y.toFixed(2)}px) scale(${k.toFixed(3)})`,
});
function IncidentEffects({ incident, offset, units, paused }: { incident: RaceIncidentPose | null; offset: Offset; units: number; paused: boolean }) {
  if (!incident) return null;
  const k = units / 18;
  return <g className={'map-incident-effects' + (paused ? '' : ' is-animated')} style={place(offset, k)} aria-hidden="true">
    {incident.dust && <g className="map-incident-dust"><circle cx="-8" cy="5" r="7"/><circle cx="5" cy="7" r="5"/></g>}
    {incident.smoke && <g className="map-incident-smoke"><circle cx="-4" cy="-7" r="6"/><circle cx="2" cy="-14" r="8"/></g>}
    {incident.sparks && <g className="map-incident-sparks">{[0,1,2,3].map((i) => <line key={i} x1="2" y1="0" x2={14 + i * 3} y2={(i - 1.5) * 5}/>)}</g>}
  </g>;
}
/** Mini car: shows which side of the track a car is on better than any other marker. */
function CarMarker({
  offset,
  units,
  angle,
  color,
  secondary,
  ring,
  dashed,
  label,
  textUnits,
}: {
  offset: Offset;
  /** Car length in track units. */
  units: number;
  angle: number;
  color: string;
  secondary: string;
  ring?: string;
  dashed: boolean;
  label: string;
  textUnits: number;
}) {
  const k = units / 18;
  return (
    <>
      <g className="photo-marker car-marker" style={place(offset, k)}>
        <circle r="13" fill="transparent" />
        {ring && (
          <circle
            r="12.5"
            stroke={ring}
            strokeWidth={ring === '#ffc466' ? 1 : 1.7}
            strokeDasharray={dashed ? '3 3' : undefined}
            fill="none"
            opacity=".9"
          />
        )}
        <g transform={`rotate(${angle})`}>
          <path
            d="M-9-4h7l6-2 7 6-7 6-6-2h-7Z"
            fill={color}
            stroke={ring ?? secondary}
            strokeWidth="1.3"
          />
          <path d="M-6-6v12M5-7v14" stroke={secondary} strokeWidth="3" />
          <path d="M-3 0h6" stroke="white" strokeWidth="2" />
        </g>
      </g>
      {label && (
        <text
          className="car-label"
          x={offset.x + units * 0.62}
          y={offset.y - units * 0.55}
          fontSize={textUnits}
          fontWeight="700"
          fill="#f0f3f4"
          stroke="#10181b"
          strokeWidth={textUnits * 0.26}
          paintOrder="stroke"
        >
          {label}
        </text>
      )}
    </>
  );
}
/** Compact tile for the far view: driver code on the team colour, position when there is room. */
function TileMarker({
  offset,
  units,
  color,
  ring,
  dashed,
  position,
  label,
  pit,
}: {
  offset: Offset;
  /** Tile height in track units. */
  units: number;
  color: string;
  ring?: string;
  dashed: boolean;
  position?: number;
  label: string;
  pit: boolean;
}) {
  const k = units / 10,
    tab = position === undefined ? 0 : String(position).length > 1 ? 9.5 : 7,
    width = 18.5 + tab,
    left = -width / 2;
  return (
    <g className="photo-marker tile-marker" style={place(offset, k)}>
      <g className="marker-layer">
        <rect x={left - 2} y="-7" width={width + 4} height="14" fill="transparent" />
        <rect
          x={left}
          y="-5"
          width={width}
          height="10"
          rx="2.4"
          fill={color}
          stroke="#0a1014"
          strokeWidth=".9"
        />
        {tab > 0 && (
          <>
            <path
              d={`M${left + 2.4} -5h${tab - 2.4}v10h-${tab - 2.4}a2.4 2.4 0 0 1-2.4-2.4v-5.2a2.4 2.4 0 0 1 2.4-2.4Z`}
              fill="#0a1014"
            />
            <text
              x={left + tab / 2}
              y="2.3"
              textAnchor="middle"
              fontSize="6.2"
              fontWeight="800"
              fill="#ffcf70"
            >
              {position}
            </text>
          </>
        )}
        <text
          x={left + tab + 9.25}
          y="2.4"
          textAnchor="middle"
          fontSize="6.6"
          fontWeight="800"
          letterSpacing=".2"
          fill={ink(color)}
        >
          {label}
        </text>
        {ring && (
          <rect
            x={left - 1.3}
            y="-6.3"
            width={width + 2.6}
            height="12.6"
            rx="3.4"
            fill="none"
            stroke={ring}
            strokeWidth="1.2"
            strokeDasharray={dashed ? '3 2' : undefined}
          />
        )}
        {pit && (
          <text y="-7" textAnchor="middle" fontSize="4.6" fontWeight="800" fill="#dbc080">
            BOX
          </text>
        )}
      </g>
    </g>
  );
}
/**
 * Broadcast-style portrait, drawn on a 10-unit radius and scaled to the size wanted on screen.
 * `offset` is a display-only shift; with `tether` a dot stays on the real track position.
 */
function PhotoMarker({
  photo,
  href,
  offset,
  tether,
  units,
  px,
  color,
  ring,
  dashed,
  position,
  tag,
  tucked,
  label,
}: {
  photo: Photo;
  href?: string;
  offset: Offset;
  tether: boolean;
  units: number;
  px: number;
  color: string;
  ring?: string;
  dashed: boolean;
  position?: number;
  tag: boolean;
  /** In a dense group the tag sits under the chin instead of below the face. */
  tucked: boolean;
  label: string;
}) {
  const k = units / 20,
    side = 20 / (photo.face?.size ?? 1),
    width = (label.length + (position === undefined ? 0 : String(position).length + 1)) * 3.4 + 4;
  return (
    <>
      {tether && (
        <>
          <line x2={offset.x} y2={offset.y} stroke={color} strokeWidth={k * 0.8} opacity=".75" />
          <circle r={k * 1.7} fill={color} stroke="#0a1014" strokeWidth={k * 0.5} />
        </>
      )}
      <g className="photo-marker" style={place(offset, k)}>
        <g className="marker-layer">
          <circle r="12.5" fill="transparent" />
          <circle r="11.1" cy="1.3" fill="#000" opacity=".45" />
          {ring && (
            <circle
              r="12.5"
              fill="none"
              stroke={ring}
              strokeWidth="1.3"
              strokeDasharray={dashed ? '3 2' : undefined}
            />
          )}
          <circle r="10" fill="#17212c" />
          <image
            href={href}
            x={-10 - (photo.face?.x ?? 0) * side}
            y={-10 - (photo.face?.y ?? 0) * side}
            width={side}
            height={side}
            clipPath="url(#face-clip)"
          />
          <circle r="10" fill="none" stroke={color} strokeWidth="1.3" />
          {tag && !(tucked && px < 20) && (
            <g
              transform={`translate(0 ${tucked ? 6.6 : 10.4}) scale(${Math.max(1, 26 / px).toFixed(3)})`}
            >
              <rect
                x={-width / 2}
                width={width}
                height="7.4"
                rx="1.8"
                fill="#0a1014"
                fillOpacity=".92"
                stroke={color}
                strokeWidth=".45"
              />
              <text y="5.5" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#f3f6f7">
                {position !== undefined && <tspan fill="#ffcf70">{position} </tspan>}
                {label}
              </text>
            </g>
          )}
        </g>
      </g>
    </>
  );
}
