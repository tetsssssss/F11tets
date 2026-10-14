'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { trackLength, type Track2DGeometry, type TrackPoint } from '../presentation/circuit-geometry';
import type { presentRace } from '../presentation/race-presentation';
import { fanOut } from '../presentation/map-markers';
import { layoutRaceTags } from '../presentation/race-tag-layout';
import { CINEMATIC_PRESETS, nextCinematicYaw } from '../presentation/cinematic-camera';
import { battleFocus, battleMagnification, visualRaceAngle, visualRacePoint } from '../presentation/race-visual-focus';
import { pitCrewVisible, safetyCarPose } from '../presentation/race-ceremony';

type Car = ReturnType<typeof presentRace>[number];
type Point3 = { x: number; y: number; z: number };

/** An orthographic 3D projection keeps every car sharp at any display density. */
export function RaceScene3D({
  geometry,
  cars,
  selected,
  own,
  colors,
  codes,
  onSelect,
  zoom,
  reduced,
  opening,
  battleIds,
  battleView,
  onBattleView,
  control,
  paused,
}: {
  geometry: Track2DGeometry;
  cars: Car[];
  selected: string | null;
  own: string[];
  colors: Record<string, string>;
  codes: Record<string, string>;
  onSelect: (id: string) => void;
  zoom: number;
  reduced: boolean;
  opening: boolean;
  battleIds: string[] | null;
  battleView: boolean;
  onBattleView: (value: boolean) => void;
  control: string;
  paused: boolean;
}) {
  const [yaw, setYaw] = useState(-25);
  const [pitch, setPitch] = useState(54);
  const [orbit, setOrbit] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!orbit || reduced || typeof document === 'undefined') return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = now - previous;
      previous = now;
      if (!document.hidden) setYaw((current) => nextCinematicYaw(current, elapsed));
    }, 90);
    return () => clearInterval(timer);
  }, [orbit, reduced]);
  const [viewport, setViewport] = useState({ width: 1000, height: 620 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, Math.round(entry.contentRect.width));
      const height = Math.max(300, Math.round(entry.contentRect.height));
      setViewport((v) => v.width === width && v.height === height ? v : { width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const WIDTH = viewport.width;
  const HEIGHT = viewport.height;
  const availableBattle = battleFocus(cars, battleIds);
  const focus = battleView ? availableBattle : null;
  const scene = useMemo(() => {
    const angle = (yaw * Math.PI) / 180;
    const tilt = (pitch * Math.PI) / 180;
    const rotate = (p: Point3) => ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: (p.x * Math.sin(angle) + p.y * Math.cos(angle)) * Math.sin(tilt) - p.z * Math.cos(tilt),
    });
    const raw = geometry.points.map((p) => rotate({ ...p, z: 0 }));
    const minX = Math.min(...raw.map((p) => p.x));
    const maxX = Math.max(...raw.map((p) => p.x));
    const minY = Math.min(...raw.map((p) => p.y));
    const maxY = Math.max(...raw.map((p) => p.y));
    const scale = Math.min((WIDTH - 90) / Math.max(1, maxX - minX), (HEIGHT - 130) / Math.max(1, maxY - minY)) * Math.max(1, zoom) * (focus ? battleMagnification(WIDTH) : 1);
    const focal = focus ? rotate({ ...focus, z: 0 }) : null;
    const cx = focal?.x ?? (minX + maxX) / 2;
    const cy = focal?.y ?? (minY + maxY) / 2;
    const project = (p: Point3) => {
      const q = rotate(p);
      return { x: WIDTH / 2 + (q.x - cx) * scale, y: HEIGHT / 2 + 28 + (q.y - cy) * scale };
    };
    const path = (points: TrackPoint[], z: number) =>
      points.map((p, i) => {
        const q = project({ ...p, z });
        return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      }).join(' ') + ' Z';
    const p0 = geometry.at(0);
    const p1 = geometry.at(0.0006);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    return {
      project,
      road: path(geometry.points, 0),
      under: path(geometry.points, -9),
      pit: geometry.pitLane.map((p, i) => {
        const q = project({ ...p, z: 1 });
        return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      }).join(' '),
      start: [project({ x: p0.x - nx * 11, y: p0.y - ny * 11, z: 2 }), project({ x: p0.x + nx * 11, y: p0.y + ny * 11, z: 2 })],
      roadWidth: Math.max(10, 19 * scale),
      curbWidth: Math.max(15, 25 * scale),
      scale,
    };
  }, [geometry, yaw, pitch, zoom, WIDTH, HEIGHT, focus?.x, focus?.y]);

  const spread = fanOut(cars, { w: 16, h: 6 }, {
    at: geometry.at,
    length: trackLength(geometry),
    maxLanes: 2,
    maxShift: opening ? 40 : 1.5,
  });
  // Deterministic track furniture. Every object derives from this circuit's existing
  // geometry, never from the race simulation or an external fabricated circuit.
  const scenery = useMemo(() => {
    const stands = [0.07, 0.28, 0.57, 0.82].map((f, i) => {
      const p = geometry.at(f);
      const q = geometry.at(f + 0.003);
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
      const ax = dx / d, ay = dy / d, nx = -ay, ny = ax;
      const side = i % 2 ? -1 : 1;
      const center = { x: p.x + nx * side * 49, y: p.y + ny * side * 49 };
      const corner = (fwd: number, wide: number, z: number) => scene.project({
        x: center.x + ax * fwd + nx * wide,
        y: center.y + ay * fwd + ny * wide,
        z,
      });
      return {
        base: [corner(-25,-12,0),corner(25,-12,0),corner(25,12,0),corner(-25,12,0)],
        facade: [corner(-25,-12,0),corner(25,-12,0),corner(25,-12,10),corner(-25,-12,10)],
        side: [corner(25,-12,0),corner(25,12,0),corner(25,12,10),corner(25,-12,10)],
        roof: [corner(-26,-13,10),corner(26,-13,10),corner(26,13,10),corner(-26,13,10)],
      };
    });
    const trees = Array.from({length: 26}, (_,i) => {
      const f = ((i * 0.61803398875 + 0.12) % 1);
      const p=geometry.at(f),q=geometry.at(f+0.001);
      const d=Math.hypot(q.x-p.x,q.y-p.y)||1;
      const side=i%2 ? -1 : 1;
      const dist=65+(i*19%40);
      const x=p.x-(q.y-p.y)/d*dist*side;
      const y=p.y+(q.x-p.x)/d*dist*side;
      const foot=scene.project({x,y,z:0}),crown=scene.project({x,y,z:8+(i%4)*2});
      return {foot,crown,r:Math.max(2,Math.min(8,scene.scale*5))};
    });
    return {stands, trees};
  }, [geometry, scene]);
  const carShapes = cars.map((car) => {
    const offset = spread[car.id];
    const visual = visualRacePoint(car);
    const point = { x: visual.x + (offset?.x ?? 0), y: visual.y + (offset?.y ?? 0) };
    const a = (visualRaceAngle(car) * Math.PI) / 180;
    const along = { x: Math.cos(a), y: Math.sin(a) };
    const across = { x: -along.y, y: along.x };
    const body = (front: number, side: number, height: number) => scene.project({
      x: point.x + along.x * front + across.x * side,
      y: point.y + along.y * front + across.y * side,
      z: height,
    });
    const footprint = (corners: [number,number,number][]) => corners.map(([f,s,h]) => body(f,s,h));
    const shadow = footprint([[-9,-5,0],[10,-5,0],[10,5,0],[-9,5,0]]);
    const floor = footprint([[-7,-2.4,1.0],[4,-2.7,1],[8,-.7,1],[8,.7,1],[4,2.7,1],[-7,2.4,1]]);
    const nose = footprint([[1.6,-1.3,3.3],[7.1,-.8,2.2],[8,.8,2.2],[1.6,1.3,3.3]]);
    const leftPod = footprint([[-4,-2.2,3.5],[1.2,-2.8,3.4],[1.2,-1.3,4.1],[-4,-1.5,4.5]]);
    const rightPod = footprint([[-4,2.2,3.5],[1.2,2.8,3.4],[1.2,1.3,4.1],[-4,1.5,4.5]]);
    const cover = footprint([[-6,-1.2,4.2],[-3.4,-1.2,6.4],[-1,0,7],[-3.4,1.2,6.4],[-6,1.2,4.2]]);
    const cockpit = footprint([[-1.6,-1.15,5],[2.0,-.9,4.5],[2.0,.9,4.5],[-1.6,1.15,5]]);
    const helmet = body(-.45,0,6.35);
    const halo = [body(-2,-1.25,6),body(1.5,-1.25,5.8),body(2,0,5.8),body(1.5,1.25,5.8),body(-2,1.25,6)];
    const fw = footprint([[7.7,-4.7,2],[8.7,-4.7,2],[8.7,4.7,2],[7.7,4.7,2]]);
    const rw = footprint([[-8.0,-4.0,7.2],[-7.0,-4.0,7.2],[-7.0,4.0,7.2],[-8.0,4.0,7.2]]);
    const rwFace = footprint([[-8.0,-4.0,7.2],[-8.0,4.0,7.2],[-8.0,4.0,5.9],[-8.0,-4.0,5.9]]);
    const wheels = ([-5.3,5.2] as const).flatMap((f) => ([-3.7,3.7] as const).map((side) => ({
      tread: footprint([[f-1.55,side-1.0,1.0],[f+1.55,side-1.0,1.0],[f+1.55,side+1.0,1.0],[f-1.55,side+1.0,1.0]]),
      upper: footprint([[f-1.5,side-1.0,2.8],[f+1.5,side-1.0,2.8],[f+1.5,side+1.0,2.8],[f-1.5,side+1.0,2.8]]),
      hub: body(f,side,2.86),
    })));
    const top = body(0,0,7);
    const important = car.id === selected || own.includes(car.id) || car.position <= 5 || !!car.battle;
    return { car, shadow, floor, nose, leftPod, rightPod, cover, cockpit, helmet, halo, fw, rw, rwFace, wheels, top, important };
  }).sort((a, b) => a.top.y - b.top.y);
  // Show the selected car, the player's cars, leaders and battles first.
  // When the pack is crowded, hide lower-priority tags instead of stacking them.
  // Every car remains selectable and identified by its accessible SVG title.
  const tags = layoutRaceTags(
    carShapes.filter((v) => focus
      ? battleIds?.includes(v.car.id) || (v.car.id === selected && Math.hypot(v.car.point.x - focus.x, v.car.point.y - focus.y) < 80)
      : v.important).map((v) => ({
      id: v.car.id, x: v.top.x, y: v.top.y, position: v.car.position,
      priority: v.car.id === selected ? 0 : own.includes(v.car.id) ? 1
        : v.car.position <= 5 ? 2 : 3,
    })), WIDTH, HEIGHT, 12,
  );

  const polygon = (points: {x: number; y: number}[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const safety = safetyCarPose(control, cars, geometry.at);
  const safetyScreen = safety && scene.project({ ...safety.point, z: 3 });
  return (
    <div ref={root} className="race-3d" data-testid="race-scene-3d" data-camera-view={focus ? 'battle' : 'track'}>
      <svg className="race-3d-canvas" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Pista em 3D isométrico com ${cars.length} carros`}>
        <defs>
          <radialGradient id="race-3d-grass"><stop stopColor="#315f43" /><stop offset="1" stopColor="#10282b" /></radialGradient>
          <pattern id="race-3d-grid" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M52 0H0V52" fill="none" stroke="#d8ebdc" strokeOpacity=".045" /></pattern>
          <linearGradient id="race-3d-asphalt" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#424d52"/><stop offset="1" stopColor="#283238"/></linearGradient>
          <linearGradient id="race-3d-roof" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c3d4d6"/><stop offset="1" stopColor="#68878b"/></linearGradient>
          <filter id="race-3d-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#race-3d-grass)" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#race-3d-grid)" />
        {scenery.trees.map((tree,i)=><g key={'tree'+i} opacity=".82">
          <ellipse cx={tree.foot.x+5} cy={tree.foot.y+7} rx={tree.r*1.55} ry={tree.r*.64} fill="#041d17" opacity=".42" />
          <line x1={tree.foot.x} y1={tree.foot.y} x2={tree.crown.x} y2={tree.crown.y} stroke="#5a5940" strokeWidth={Math.max(1,tree.r*.31)}/>
          <circle cx={tree.crown.x} cy={tree.crown.y} r={tree.r} fill={i%3===0?'#406f44':'#295b40'} stroke="#81a57b" strokeOpacity=".3" strokeWidth="1"/>
          <circle cx={tree.crown.x-tree.r*.25} cy={tree.crown.y-tree.r*.25} r={tree.r*.52} fill="#62915b" opacity=".4"/>
        </g>)}
        {scenery.stands.map((stand,i)=><g key={'stand'+i} opacity=".91" className="iso-grandstand">
          <polygon points={polygon(stand.base)} fill="#0a181b" opacity=".5" transform="translate(3 6)"/>
          <polygon points={polygon(stand.facade)} fill="#415b61" stroke="#1a2e34" strokeWidth="1"/>
          <polygon points={polygon(stand.side)} fill="#263f49" stroke="#1a2e34" strokeWidth="1"/>
          <polygon points={polygon(stand.roof)} fill="url(#race-3d-roof)" stroke="#b0c1c2" strokeWidth="1"/>
        </g>)}
        {/* The shadow, outer barrier and raised retaining edge share one path. */}
        <path d={scene.under} fill="none" stroke="#051517" strokeWidth={scene.curbWidth + 17} opacity=".68" filter="url(#race-3d-shadow)" />
        <path d={scene.under} fill="none" stroke="#0b1a22" strokeWidth={scene.curbWidth + 8} strokeLinejoin="round" />
        <path d={scene.under} fill="none" stroke="#465558" strokeWidth={scene.curbWidth + 2} strokeLinejoin="round" />
        <path d={scene.road} fill="none" stroke="#c8d4d2" strokeWidth={scene.curbWidth + 5} strokeLinejoin="round" />
        <path d={scene.road} fill="none" stroke="#c93337" strokeWidth={scene.curbWidth} strokeDasharray="18 18" strokeLinejoin="round" />
        <path d={scene.road} fill="none" stroke="url(#race-3d-asphalt)" strokeWidth={scene.roadWidth} strokeLinejoin="round" />
        <path d={scene.road} fill="none" stroke="#afbab8" strokeWidth="1.3" strokeDasharray="11 20" strokeOpacity=".55" />
        <path d={scene.pit} fill="none" stroke="#131d23" strokeWidth={Math.max(10,scene.roadWidth*.48)} strokeLinecap="round" />
        <path d={scene.pit} fill="none" stroke="#c7d1d0" strokeWidth="1.2" strokeOpacity=".75" />
        <path d={scene.pit} fill="none" stroke="#f5c75c" strokeWidth="1.5" strokeDasharray="5 8" />
        <line x1={scene.start[0].x} y1={scene.start[0].y} x2={scene.start[1].x} y2={scene.start[1].y} stroke="#152629" strokeWidth="6" />
        <line x1={scene.start[0].x} y1={scene.start[0].y} x2={scene.start[1].x} y2={scene.start[1].y} stroke="#fff" strokeWidth="4" strokeDasharray="5 5" />
        {safetyScreen && <g className={reduced || paused ? '' : 'race-safety-beacon'} data-testid="iso-safety-car" transform={`translate(${safetyScreen.x} ${safetyScreen.y})`}>
          <ellipse cy="5" rx="16" ry="8" fill="#061015" opacity=".55" />
          <rect x="-12" y="-6" width="24" height="12" rx="4" fill="#f2bc30" stroke="#fff2ad" strokeWidth="1.5" />
          <rect x="-5" y="-9" width="10" height="4" rx="2" fill="#142733" />
          <circle cx="0" cy="-9" r="2.7" fill="#ffcf4e" />
          <text x="0" y="-17" fill="#ffe083" textAnchor="middle" fontSize="11" fontWeight="900">SC</text>
        </g>}
        {carShapes.map(({ car, shadow, floor, nose, leftPod, rightPod, cover, cockpit, helmet, halo, fw, rw, rwFace, wheels, top }) => {
          const color = colors[car.id] ?? '#dedede';
          const isSelectedOrOwned = car.id === selected || own.includes(car.id);
          const tag = tags[car.id];
          return (
            <g key={car.id} role="button" tabIndex={0} data-driver={car.id} aria-label={`Selecionar ${codes[car.id]}, P${car.position}`} onClick={() => onSelect(car.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(car.id); } }} className="race-3d-car iso-formula-car" opacity={car.car.status === 'RUNNING' ? 1 : .4}>
              <title>{codes[car.id]} · P{car.position}</title>
              {focus && battleIds?.includes(car.id) && <circle className="iso-battle-ring" cx={top.x} cy={top.y} r="21" fill="none" stroke="#ffd36e" strokeWidth="2.8" strokeDasharray="8 3" opacity=".95" />}
              {isSelectedOrOwned && <circle cx={top.x} cy={top.y} r="17" fill="none" stroke={car.id === selected ? '#fff' : '#7eeaff'} strokeWidth="2.3" strokeDasharray="5 3" opacity=".9" />}
              <polygon points={polygon(shadow)} fill="#010d0f" opacity=".48" transform="translate(3 6)" />
              {car.incident?.dust && <g className={reduced || paused ? 'incident-dust' : 'incident-dust is-animated'} aria-hidden="true">
                <circle cx={top.x - 9} cy={top.y + 8} r="9" fill="#b89d72" opacity=".4" />
                <circle cx={top.x + 7} cy={top.y + 4} r="6" fill="#d0b889" opacity=".3" />
              </g>}
              {car.incident?.smoke && <g className={reduced || paused ? 'incident-smoke' : 'incident-smoke is-animated'} aria-hidden="true">
                <circle cx={top.x - 3} cy={top.y - 10} r="7" fill="#c9d0d0" opacity=".48" />
                <circle cx={top.x + 3} cy={top.y - 18} r="10" fill="#788287" opacity=".35" />
              </g>}
              {car.incident?.sparks && <g className={reduced || paused ? 'incident-sparks' : 'incident-sparks is-animated'} aria-hidden="true">
                {[0,1,2,3,4].map((spark) => <line key={spark} x1={top.x} y1={top.y} x2={top.x + 12 + spark * 4} y2={top.y + (spark - 2) * 5} stroke="#ffcc54" strokeWidth="2" />)}
              </g>}
              {wheels.map((w,i)=><g key={i}>
                <polygon points={polygon(w.tread)} fill="#101a20" stroke="#020607" strokeWidth="1.2"/>
                <polygon points={polygon(w.upper)} fill="#151d20" stroke="#667179" strokeWidth=".65"/>
                <circle cx={w.hub.x} cy={w.hub.y} r={Math.max(1.2,scene.scale*.9)} fill="#a4b5b8" stroke="#0b1317" strokeWidth=".6" />
              </g>)}
              <polygon points={polygon(floor)} fill={color} stroke="#111d21" strokeWidth="1.2" />
              <polygon points={polygon(leftPod)} fill={color} stroke="#ffffff" strokeOpacity=".3" strokeWidth=".5" />
              <polygon points={polygon(rightPod)} fill={color} stroke="#04161c" strokeWidth=".6" />
              <polygon points={polygon(cover)} fill={color} stroke="#d0e1e3" strokeOpacity=".65" strokeWidth=".7" />
              <polygon points={polygon(nose)} fill={color} stroke="#d4e4e6" strokeOpacity=".7" strokeWidth=".7" />
              <polygon points={polygon(cockpit)} fill="#091820" stroke="#c5d2d7" strokeWidth=".9" />
              <polyline points={polygon(halo)} fill="none" stroke="#17242a" strokeWidth={Math.max(1.2,scene.scale*.95)} strokeLinecap="round" />
              <circle cx={helmet.x} cy={helmet.y} r={Math.max(1.3,scene.scale*1.6)} fill="#f2f2e6" stroke="#34424a" strokeWidth=".6" />
              <polygon points={polygon(fw)} fill={color} stroke="#111e27" strokeWidth="1" />
              <polygon points={polygon(rwFace)} fill="#13252d" stroke="#d0e2e7" strokeWidth=".6" />
              <polygon points={polygon(rw)} fill={color} stroke="#111e27" strokeWidth="1" />
              {pitCrewVisible(car.pitStage) && <g className={reduced || paused ? 'iso-pit-crew' : 'iso-pit-crew is-animated'} data-testid={`iso-pit-crew-${car.id}`}>
                {[-1,1].flatMap((side) => [-1,1].map((front) => <g key={`${side}-${front}`} transform={`translate(${top.x + front * 12} ${top.y + side * 14})`}>
                  <circle r="4.3" fill="#f9c85a" stroke="#17232c" strokeWidth="1.5" />
                  <path d={`M0 ${-3 * side}v${-5 * side}`} stroke="#e8f1f0" strokeWidth="2" strokeLinecap="round" />
                </g>))}
                <text x={top.x} y={top.y - 25} fill="#fbe093" fontSize="10" fontWeight="900" textAnchor="middle">PIT STOP</text>
              </g>}
              {tag && <g className="race-3d-tag" transform={`translate(${tag.x} ${tag.y})`}>
                <line x1={top.x - tag.x} y1={top.y - tag.y} x2={tag.x > top.x ? 0 : 57} y2="11" stroke={color} strokeWidth="1.2" strokeOpacity=".8" />
                <rect x="0" y="0" width="57" height="22" rx="5" fill="#0a1419" stroke={color} strokeWidth="2" />
                <text x="5" y="15" fill="#fff" fontSize="12" fontWeight="800">{car.position} {codes[car.id]}</text>
              </g>}
            </g>
          );
        })}
      </svg>
      <div className="race-3d-view-switch" role="group" aria-label="Enquadramento 2.5D">
        <button onClick={() => onBattleView(false)} aria-pressed={!focus} aria-label="Mostrar circuito inteiro">PISTA</button>
        <button onClick={() => onBattleView(true)} aria-pressed={!!focus} disabled={!availableBattle} aria-label="Focar disputa real">DISPUTA</button>
      </div>
      <button className="race-3d-control-toggle" aria-label="Ajustes câmera 2.5D" aria-expanded={controlsOpen} aria-controls="iso-camera-controls" onClick={() => setControlsOpen((open) => !open)}>CÂMERA {controlsOpen ? '−' : '+'}</button>
      <div id="iso-camera-controls" className={'race-3d-controls' + (controlsOpen ? ' open' : '')} role="group" aria-label="Câmera 2.5D">
        <button onClick={() => setYaw((v) => v - 25)} aria-label="Girar câmera à esquerda">↶</button>
        <button onClick={() => setYaw((v) => v + 25)} aria-label="Girar câmera à direita">↷</button>
        <button onClick={() => setPitch((v) => Math.max(35, v - 10))} aria-label="Baixar câmera">↓</button>
        <button onClick={() => setPitch((v) => Math.min(90, v + 10))} aria-label="Elevar câmera">↑</button>
        <button onClick={() => { setYaw(CINEMATIC_PRESETS.overhead.yaw); setPitch(CINEMATIC_PRESETS.overhead.pitch); setOrbit(false); }} aria-label="Câmera aérea">AÉREA</button>
        <button onClick={() => { setYaw(CINEMATIC_PRESETS.low.yaw); setPitch(CINEMATIC_PRESETS.low.pitch); setOrbit(false); }} aria-label="Câmera baixa">BAIXA</button>
        <button onClick={() => setOrbit((v) => !v)} aria-pressed={orbit && !reduced} disabled={reduced} aria-label="Alternar câmera orbital automática">{orbit && !reduced ? 'PARAR TOUR' : 'AUTO TOUR'}</button>
        <button onClick={() => { setYaw(CINEMATIC_PRESETS.broadcast.yaw); setPitch(CINEMATIC_PRESETS.broadcast.pitch); setOrbit(false); }} aria-label="Restaurar câmera 3D">CENTRALIZAR</button>
      </div>
      <span className="race-3d-caption">CÂMERA 2.5D · {focus ? 'DISPUTA EM FOCO' : reduced ? 'MOVIMENTO REDUZIDO' : orbit ? 'TOUR AUTOMÁTICO' : 'CIRCUITO INTEIRO'}</span>
    </div>
  );
}
