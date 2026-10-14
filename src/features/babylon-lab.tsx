'use client';
/** Independent graphics lab: no SaveProvider writes, no career-slot side effects.
 * F1 animation reads the real RaceEngine. F2/F3 are illustrative movements of real feeder rosters.
 * Babylon.js is loaded only after the user requests WebGL, with graceful SVG/Canvas fallback.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSave } from '../domain/save';
import { configureCareer } from '../domain/gameplay/career';
import { createRaceState } from '../domain/simulation/race';
import { tickLive } from '../domain/simulation';
import { feederEntrants } from '../domain/universe/formula-two';
import { formulaThreeEntrants } from '../domain/universe/formula-three';
import { circuitGeometry, trackBounds } from '../presentation/circuit-geometry';
import { presentRace } from '../presentation/race-presentation';
import { renderFrameFromRace, renderFrameFromFeeder, interpolateCars, type RenderCar } from '../presentation/race-render-adapter';
import type { Save, Driver } from '../domain/types';
import type { Track2DGeometry as Geometry } from '../presentation/circuit-geometry';

type Category = 'F1' | 'F2' | 'F3';
type Mode = '2d' | 'iso' | '3d';
type Camera = 'tv' | 'aerea' | 'onboard';
type Pace = 'normal' | 'ataque' | 'economia';
type CarView = RenderCar;
type Quality = 'baixo' | 'medio' | 'alto' | 'ultra';
type Control = { category: Category; mode: Mode; camera: Camera; pace: Pace; speed: number; paused: boolean; rain: boolean; selected: string | null; quality: Quality };
type BabylonRuntime = { B: any; engine: any; scene: any; camera: any; ground: any; cars: Map<string, { root: any; wheels: any[] }>; rainLines: any[]; disposed: boolean };
const WIDE = ['#ec354b', '#3baae5', '#f9aa25', '#40bc96', '#967aea', '#e9eaf1', '#d46ba2', '#b8cf4a'];
const TAU = Math.PI * 2;
const CDN = 'https://cdn.babylonjs.com/babylon.js';
// Official build uses bundled npm modules. Disconnected build retains CDN fallback.
async function loadBundledBabylon(): Promise<any> {
  const B = await import('@babylonjs/core');
  await import('@babylonjs/loaders');
  return B;
}

let sharedLoader: Promise<any> | undefined;
function loadBabylonFromCDN(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Navegador indisponível'));
  if ((window as any).BABYLON) return Promise.resolve((window as any).BABYLON);
  if (sharedLoader) return sharedLoader;
  sharedLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CDN; script.async = true; script.crossOrigin = 'anonymous';
    let settled = false;
    const timeout = window.setTimeout(() => fail('Tempo esgotado ao carregar Babylon.js. Modo 2D preservado.'), 12000);
    const ok = (runtime: any) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(runtime); };
    const fail = (message: string) => { if (settled) return; settled = true; clearTimeout(timeout); script.remove(); reject(new Error(message)); };
    script.onload = () => (window as any).BABYLON ? ok((window as any).BABYLON) : fail('Motor WebGL ausente');
    script.onerror = () => fail('Não foi possível carregar Babylon.js. Verifique a conexão de internet.');
    document.head.appendChild(script);
  }).catch((e) => { sharedLoader = undefined; throw e; });
  return sharedLoader;
}
async function loadBabylon(): Promise<any> {
  try { return await loadBundledBabylon(); }
  catch { return loadBabylonFromCDN(); }
}
function initialRace(): Save {
  const save = configureCareer(createSave(2029), 'constructor', 'mclaren');
  save.world.settings.sandbox = true;
  save.race = createRaceState(save, 'GP', save.game.drivers.map((driver) => driver.id));
  save.race.paused = false;
  save.race.autoEvents = 'off';
  // NO career slot writes. This state lives in a ref and is discarded on navigation.
  return save;
}
function driverColor(d: Driver, save: Save, index: number): string {
  return save.game.teams.find((team) => team.id === d.teamId)?.color || WIDE[index % WIDE.length];
}
function paintCar(ctx: CanvasRenderingContext2D, car: CarView, scale: number, selected: boolean, cat: Category) {
  const carScale = cat === 'F1' ? 1 : cat === 'F2' ? .92 : .85;
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle * Math.PI / 180 + Math.PI / 2); ctx.scale(scale * carScale, scale * carScale);
  if (selected) { ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.globalAlpha = car.running ? 1 : .55;
  ctx.fillStyle = '#07101588';ctx.fillRect(-5, -12, 11, 27);
  ctx.fillStyle = '#101316';
  for (const x of [-7.8, 5.2]) for (const y of [-9, 6]) ctx.fillRect(x, y, 3, 6);
  ctx.fillStyle = car.color;ctx.fillRect(-3.5,-10,7,22);ctx.fillRect(-7,-9,14,3);ctx.fillRect(-8,9,16,3);
  ctx.fillStyle='#111b25';ctx.fillRect(-2.5,-2,5,6);ctx.fillStyle='#e8f1f5';ctx.fillRect(-2,-5,4,3);
  ctx.restore();
}
function render2D(canvas: HTMLCanvasElement, cars: CarView[], geo: Geometry, ctrl: Control, bounds: ReturnType<typeof trackBounds>, time: number) {
  const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height;
  if (w < 1 || h < 1) return;
  const dpr = Math.min(window.devicePixelRatio || 1, ctrl.quality==='baixo'?1:ctrl.quality==='medio'?1.5:2), dw = Math.round(w * dpr), dh = Math.round(h * dpr);
  if (canvas.width !== dw || canvas.height !== dh) { canvas.width = dw; canvas.height = dh; }
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const paint = ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0,0,w,h);
  gradient.addColorStop(0,ctrl.rain?'#183c41':'#21583c');gradient.addColorStop(1,'#0d302c');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  const iso = ctrl.mode === 'iso';
  const s = Math.min((w-35)/(bounds.w*(iso?1.15:1)),(h-35)/(bounds.h*(iso?.70:1)));
  const toScreen = (x:number,y:number) => { const px=(x-bounds.cx)*s, py=(y-bounds.cy)*s; return iso?{x:w/2+px+py*.18,y:h/2+py*.65-px*.12}:{x:w/2+px,y:h/2+py}; };
  if(iso){ctx.save();ctx.globalAlpha=.30;ctx.fillStyle='#071a1c';ctx.beginPath();geo.points.forEach((pt,i)=>{const q=toScreen(pt.x,pt.y);i?ctx.lineTo(q.x+6,q.y+12):ctx.moveTo(q.x+6,q.y+12)});ctx.closePath();ctx.lineWidth=Math.max(13,28*s);ctx.strokeStyle='#091a18';ctx.stroke();ctx.restore();}
  function stroke(width:number,color:string,dash?:number[]){
    paint.beginPath();geo.points.forEach((pt,i)=>{const p=toScreen(pt.x,pt.y);i?paint.lineTo(p.x,p.y):paint.moveTo(p.x,p.y)});paint.closePath();
    paint.strokeStyle=color;paint.lineWidth=width;paint.lineJoin='round';paint.setLineDash(dash||[]);paint.stroke();paint.setLineDash([]);
  }
  stroke(Math.max(11,22*s),'#d2d6d1');stroke(Math.max(10,20*s),'#c93c40',[11,12]);stroke(Math.max(8,17*s),ctrl.rain?'#313b44':'#41464a');stroke(1,'#aeb3b3',[8,19]);
  const pitPoints=geo.pitLane.map(p=>toScreen(p.x,p.y));ctx.beginPath();pitPoints.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#b9c6c6';ctx.lineWidth=4;ctx.stroke();
  const sorted=[...cars].sort((a,b)=>a.position-b.position).reverse();
  for (const car of sorted){const p=toScreen(car.x,car.y);if(iso){ctx.beginPath();ctx.ellipse(p.x+3,p.y+5,Math.max(4,s*3.1),Math.max(2,s*1.1),-.25,0,TAU);ctx.fillStyle='#0008';ctx.fill()}paintCar(ctx,{...car,x:p.x,y:p.y},Math.max(.7,Math.min(1.25,s*2.8)),ctrl.selected===car.id,ctrl.category)}
  if(ctrl.rain){ctx.strokeStyle='#b8e7ff3d';ctx.lineWidth=1;for(let i=0;i<75;i++){const x=(i*93+time*.064)%w,y=(i*59+time*.15)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+11);ctx.stroke()}}
  canvas.dataset.rendered = iso?'iso-ready':'2d-ready';
}
const coord=(x:number,offset:number) => (x-offset)*.105;
function build3D(B:any, canvas:HTMLCanvasElement, geo:Geometry, bounds:ReturnType<typeof trackBounds>, quality:Quality):BabylonRuntime {
  const engine = new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false});
  engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio || 1) / (quality==='baixo'?1:quality==='medio'?1.4:quality==='alto'?1.8:2))); 
  const scene = new B.Scene(engine);scene.clearColor=new B.Color4(.45,.65,.76,1);
  const hemi=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);hemi.intensity=.8;
  const sun=new B.DirectionalLight('sun',new B.Vector3(-.65,-1,.4),scene);sun.intensity=1;
  const makeMat=(name:string,hex:string)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(hex);m.specularColor=new B.Color3(.13,.16,.19);return m};
  const grass=makeMat('grass','#2e6943'),asphalt=makeMat('track','#353e43'),red=makeMat('curb-red','#d54249'),white=makeMat('curb-white','#e5e9e1'),build=makeMat('pit','#6f8793'),dark=makeMat('roof','#203140');
  const ground=B.MeshBuilder.CreateGround('grassland',{width:120,height:90},scene);ground.material=grass;
  const left:any[]=[],right:any[]=[],width=1.35;
  for(let i=0;i<=geo.points.length;i++){
    const p=geo.points[i%geo.points.length],q=geo.points[(i+1)%geo.points.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
    const x=coord(p.x,bounds.cx),z=coord(p.y,bounds.cy),nx=-dy/len,nz=dx/len;
    left.push(new B.Vector3(x+nx*width,.05,z+nz*width));right.push(new B.Vector3(x-nx*width,.05,z-nz*width));
  }
  const track=B.MeshBuilder.CreateRibbon('track',{pathArray:[left,right],sideOrientation:B.Mesh.DOUBLESIDE},scene);track.material=asphalt;
  for(let i=0;i<geo.points.length;i+=12){
    const p=geo.points[i],q=geo.points[(i+1)%geo.points.length],a=Math.atan2(q.x-p.x,q.y-p.y);
    const ox=coord(p.x,bounds.cx),oz=coord(p.y,bounds.cy);
    for(const side of [-1,1]){
      const m=B.MeshBuilder.CreateBox('curb',{width:.36,height:.075,depth:.65},scene);
      m.position.set(ox+Math.cos(a)*side*1.3,.10,oz-Math.sin(a)*side*1.3);m.rotation.y=a;m.material=Math.floor(i/12)%2===0?red:white;
    }
  }
  for(let i=0;i<7;i++){
    const block=B.MeshBuilder.CreateBox('paddock',{width:5,height:1.65,depth:2.7},scene);
    block.position.set(-25+i*7,.85,-29);block.material=build;
    const roof=B.MeshBuilder.CreateBox('roof',{width:5.2,height:.15,depth:2.9},scene);
    roof.position.set(-25+i*7,1.72,-29);roof.material=dark;
  }
  const rainLines:any[]=[];
  if(quality!=='baixo'){for(let i=0;i<(quality==='medio'?70:quality==='alto'?145:260);i++){
    const xx=(Math.sin(i*17.13)*.5+.5)*90-45,zz=(Math.cos(i*27.1)*.5+.5)*65-32.5;
    const line=B.MeshBuilder.CreateLines('rain-visual',{points:[new B.Vector3(xx,3,zz),new B.Vector3(xx-.14,1.5,zz+.08)]},scene);line.color=new B.Color3(.59,.76,.90);line.isVisible=false;rainLines.push(line);
  }}
  const cam=new B.FreeCamera('tv-camera',new B.Vector3(0,42,-45),scene);cam.minZ=.05;cam.maxZ=350;cam.setTarget(new B.Vector3(0,0,0));scene.activeCamera=cam;
  return {B,engine,scene,camera:cam,ground,cars:new Map(),rainLines,disposed:false};
}
function addCar3D(rt:BabylonRuntime,car:CarView,category:Category){
  const {B,scene}=rt;
  const paint=new B.StandardMaterial('paint-'+car.id,scene);paint.diffuseColor=B.Color3.FromHexString(car.color);
  const rubber=new B.StandardMaterial('rubber-'+car.id,scene);rubber.diffuseColor=new B.Color3(.07,.08,.09);
  const root=new B.TransformNode('car-'+car.id,scene);
  const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:any)=>{
    const m=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);m.material=mat;m.parent=root;return m;
  };
  box('chassis',.75,.28,2.2,0,.38,0,paint);box('nose',.26,.2,.9,0,.32,1.2,paint);
  box('front-wing',1.55,.09,.32,0,.26,1.6,paint);box('rear-wing',1.4,.14,.3,0,.77,-1.05,paint);
  box('cockpit',.48,.3,.65,0,.61,-.26,rubber);box('halo',.10,.13,.65,0,.85,-.25,rubber);
  box('helmet',.35,.32,.35,0,.85,-.4,paint);
  const wheels:any[]=[];
  for(const x of [-.71,.71])for(const z of [-.76,.98]){
    const wheel=B.MeshBuilder.CreateCylinder('wheel',{diameter:.56,height:.26,tessellation:12},scene);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x,.34,z);wheel.material=rubber;wheel.parent=root;wheels.push(wheel);
  }
  const scale=category==='F1'?1:category==='F2'?.92:.85;root.scaling.setAll(scale);
  rt.cars.set(car.id,{root,wheels});
}
function sync3D(rt:BabylonRuntime,cars:CarView[],bounds:ReturnType<typeof trackBounds>,ctrl:Control,dt:number){
  const {B,scene,camera}=rt;
  const present=new Set(cars.map(c=>c.id));
  for(const [id,car] of rt.cars)if(!present.has(id)){car.root.getChildMeshes().forEach((m:any)=>m.dispose());car.root.dispose();rt.cars.delete(id)}
  for(const car of cars){
    if(!rt.cars.has(car.id))addCar3D(rt,car,ctrl.category);
    const model=rt.cars.get(car.id)!;
    model.root.position.set(coord(car.x,bounds.cx),0,coord(car.y,bounds.cy));
    const targetYaw=Math.PI/2-car.angle*Math.PI/180;
    model.root.rotation.y=targetYaw;
    for(const wheel of model.wheels)wheel.rotation.x+=dt*9*ctrl.speed;
  }
  const selected=cars.find(c=>c.id===ctrl.selected)||cars[0];
  if(selected){
    const pt=new B.Vector3(coord(selected.x,bounds.cx),0,coord(selected.y,bounds.cy));
    const a=selected.angle*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a);
    let from,target;
    if(ctrl.camera==='aerea'){from=new B.Vector3(0,80,-.01);target=new B.Vector3(0,0,0)}
    else if(ctrl.camera==='onboard'){from=new B.Vector3(pt.x-dx*.2,1.35,pt.z-dz*.2);target=new B.Vector3(pt.x+dx*15,1,pt.z+dz*15)}
    else{from=new B.Vector3(pt.x-dx*12-dz*8,7.2,pt.z-dz*12+dx*8);target=new B.Vector3(pt.x+dx*6,.7,pt.z+dz*6)}
    const easing=ctrl.camera==='onboard'?.3:.085;
    camera.position=B.Vector3.Lerp(camera.position,from,easing);camera.setTarget(target);
  }
  scene.clearColor=ctrl.rain?new B.Color4(.18,.25,.29,1):new B.Color4(.45,.65,.76,1);
  scene.fogMode=ctrl.rain&&ctrl.quality!=='baixo'?B.Scene.FOGMODE_EXP2:B.Scene.FOGMODE_NONE;
  scene.fogDensity=ctrl.rain?.008:0;scene.fogColor=new B.Color3(.29,.35,.39);
  for(const line of rt.rainLines)line.isVisible=ctrl.rain;
  scene.render();
}
export default function BabylonLab(){
  const source=useMemo(initialRace,[]);
  const f2=useMemo(()=>feederEntrants(source),[source]);
  const f3=useMemo(()=>formulaThreeEntrants(source),[source]);
  const geo=useMemo(()=>circuitGeometry(source.game.circuits[0]),[source]);
  const bounds=useMemo(()=>trackBounds(geo,26),[geo]);
  const ref=useRef<Save>(source),canvas2=useRef<HTMLCanvasElement>(null),canvas3=useRef<HTMLCanvasElement>(null);
  const runtime=useRef<BabylonRuntime | null>(null),frame=useRef(0),running=useRef(true),phase=useRef(0),feed=useRef(0),snapshot=useRef<CarView[]>([]);
  const [category,setCategory]=useState<Category>('F1'),[mode,setMode]=useState<Mode>('2d'),[camera,setCamera]=useState<Camera>('tv');
  const [pace,setPace]=useState<Pace>('normal'),[speed,setSpeed]=useState(1),[paused,setPaused]=useState(false),[rain,setRain]=useState(false);
  const [quality,setQuality]=useState<Quality>('medio'),[fps,setFps]=useState(0);
  const [selected,setSelected]=useState<string|null>(source.game.drivers[0].id),[loading,setLoading]=useState(false),[message,setMessage]=useState('2D ativo · F1 utiliza o motor real de simulação');
  const [hud,setHud]=useState({lap:0,sector:1,pos:1,cars:32,events:0,status:'GREEN'});
  const controls=useRef<Control>({category,mode,camera,pace,speed,paused,rain,selected,quality});
  controls.current={category,mode,camera,pace,speed,paused,rain,selected,quality};
  const roster=category==='F1'?source.game.drivers:category==='F2'?f2:f3;
  useEffect(()=>{setSelected((s)=>roster.some(d=>d.id===s)?s:roster[0]?.id||null);},[category]);
  useEffect(()=>{
    running.current=true;let last=0,lastHud=0,fpsFrames=0,fpsFrom=0;
    function loop(now:number){
      if(!running.current)return;
      const dt=Math.min(.07,(now-last)/1000||.016);last=now;
      const ctrl=controls.current;
      if(++fpsFrames>0&&now-fpsFrom>=1250){setFps(Math.round(fpsFrames*1000/(now-fpsFrom)));fpsFrames=0;fpsFrom=now;}
      if(!ctrl.paused){
        phase.current+=dt*ctrl.speed;
        if(ctrl.category==='F1'&&phase.current>=1.7){
          phase.current%=1.7;
          const current=ref.current;
          if(current.race?.status==='RUNNING'){
            const next=tickLive(current,true);next.race!.paused=false;next.race!.autoEvents='off';ref.current=next;
          }
        }
      }
      const runningSave=ref.current,r=runningSave.race!;
      const list:CarView[]=ctrl.category==='F1'
        ?renderFrameFromRace(presentRace(r,geo,(source.game.circuits[0].km/210)*3600,Math.min(.999,phase.current/1.7)), source.game.drivers, (driver,index)=>driverColor(driver,source,index))
        :renderFrameFromFeeder(ctrl.category==='F2'?f2:f3, geo, feed.current, ctrl.category==='F2'?36:34, WIDE);
      if(!ctrl.paused&&ctrl.category!=='F1')feed.current+=dt*ctrl.speed*(ctrl.pace==='ataque'?1.1:ctrl.pace==='economia'?.9:1);
      const shown=interpolateCars(snapshot.current,list,.58);
      snapshot.current=shown;
      if(ctrl.mode!=='3d'&&canvas2.current)render2D(canvas2.current,shown,geo,ctrl,bounds,now);
      if(ctrl.mode==='3d'&&runtime.current&&!runtime.current.disposed)sync3D(runtime.current,shown,bounds,ctrl,ctrl.paused?0:dt);
      if(now-lastHud>320){lastHud=now;
        const position=list.find(c=>c.id===ctrl.selected)?.position||1;
        setHud({lap:ctrl.category==='F1'?r.lap:Math.floor(feed.current/32),sector:ctrl.category==='F1'?r.sector:(Math.floor(feed.current*.15)%3)+1,pos:position,cars:list.length,events:ctrl.category==='F1'?r.events.length:0,status:r.control});
      }
      frame.current=requestAnimationFrame(loop);
    }
    frame.current=requestAnimationFrame(loop);
    return ()=>{running.current=false;cancelAnimationFrame(frame.current);};
  },[source,geo,bounds,f2,f3]);
  useEffect(()=>()=>{if(runtime.current){runtime.current.disposed=true;runtime.current.scene.dispose();runtime.current.engine.dispose();runtime.current=null;}},[]);
  async function switchMode(next:Mode){
    if(next==='2d'||next==='iso'){setMode(next);setMessage(next==='iso'?'2.5D isométrico ativo. Mesma corrida em projeção pseudo-3D.':'2D ativo. Mesmos dados da corrida, apresentação Canvas.');return}
    if(runtime.current){setMode('3d');setMessage('Babylon.js real ativo: WebGL');return}
    setLoading(true);setMessage('Carregando Babylon.js…');
    try{
      const B=await loadBabylon();if(!canvas3.current)return;
      const rt=build3D(B,canvas3.current,geo,bounds,quality);
      runtime.current=rt;
      setMode('3d');setMessage('Babylon.js WebGL ativo. Câmeras TV, aérea e onboard disponíveis.');
      requestAnimationFrame(() => rt.engine.resize());
    }catch(error){setMode('2d');setMessage(error instanceof Error?error.message:'Erro no WebGL');}
    finally{setLoading(false)}
  }
  useEffect(()=>{
    const handle=()=>runtime.current?.engine.resize();window.addEventListener('resize',handle);
    return ()=>window.removeEventListener('resize',handle);
  },[]);
  function selectAt2D(e:import('react').MouseEvent<HTMLCanvasElement>){
    const rect=e.currentTarget.getBoundingClientRect(),s=Math.min((rect.width-35)/bounds.w,(rect.height-35)/bounds.h);
    const px=(e.clientX-rect.left-rect.width/2)/s,py=(e.clientY-rect.top-rect.height/2)/s;
    const x=mode==='iso'?(px-.18*py/.65)/1.0332307692+bounds.cx:px+bounds.cx;
    const y=mode==='iso'?((py+.12*(x-bounds.cx))/.65)+bounds.cy:py+bounds.cy;
    const nearest=snapshot.current.map(c=>({id:c.id,dist:Math.hypot(c.x-x,c.y-y)})).sort((a,b)=>a.dist-b.dist)[0];
    if(nearest&&nearest.dist*s<22)setSelected(nearest.id);
  }
  function exportState(){
    const data={type:'f1-universe-babylon-lab',version:1,createdAt:new Date().toISOString(),category,mode,camera,pace,speed,paused,rain,selected,
      source:'Somente laboratório; nenhuma alteração no save da carreira',
      cars:snapshot.current.map(c=>({id:c.id,x:c.x,y:c.y,angle:c.angle,position:c.position}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='F1_UNIVERSE_LAB_ESTADO.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Estado do laboratório exportado. Save original preservado.');
  }
  return <section className="babylon-lab">
    <div className="babylon-heading"><div><small>LABORATÓRIO GRÁFICO / EXPERIMENTO ISOLADO</small><h1>F1 Universe · Babylon 2D/3D</h1><p>Compare animações na mesma pista. F1: motor real da corrida. F2/F3: apresentação visual demonstrativa dos elencos próprios.</p></div><a className="button secondary" href="/">Voltar ao universo</a></div>
    <div className="babylon-toolbar" role="group" aria-label="Categoria e renderizador">
      {(['F1','F2','F3'] as Category[]).map(c=><button key={c} className={'button '+(category===c?'primary':'secondary')} onClick={()=>setCategory(c)} aria-pressed={category===c}>{c}</button>)}
      <span className="babylon-divider"/>
      <button className={'button '+(mode==='2d'?'primary':'secondary')} onClick={()=>switchMode('2d')} aria-pressed={mode==='2d'}>Canvas 2D</button>
      <button className={'button '+(mode==='iso'?'primary':'secondary')} onClick={()=>switchMode('iso')} aria-pressed={mode==='iso'}>2.5D isométrico</button>
      <button className={'button '+(mode==='3d'?'primary':'secondary')} onClick={()=>switchMode('3d')} disabled={loading} aria-pressed={mode==='3d'}>{loading?'Carregando…':'Babylon.js 3D'}</button>
      <button className="button secondary" onClick={()=>setPaused(v=>!v)}>{paused?'▶ Continuar':'❚❚ Pausar'}</button>
    </div>
    <div className="babylon-stage">
      <canvas ref={canvas2} onClick={selectAt2D} aria-label="Mapa animado 2D com seleção de carro" style={{display:mode!=='3d'?'block':'none'}}/>
      <canvas ref={canvas3} aria-label="Cena Babylon.js WebGL 3D" style={{display:mode==='3d'?'block':'none'}} data-testid="babylon-webgl-canvas"/>
      <div className="babylon-hud babylon-top"><b>{category} · {mode==='3d'?'BABYLON.JS WEBGL':mode==='iso'?'2.5D ISOMÉTRICO':'CANVAS 2D'}</b><span>Volta {hud.lap+1} · setor {hud.sector}</span></div>
      <div className="babylon-hud babylon-bottom"><span>{hud.cars} carros · {fps} FPS</span><span>P{hud.pos} · {roster.find(d=>d.id===selected)?.short||'CARRO'}</span><span>{rain?'CHUVA':'SECO'} · {hud.events} eventos</span></div>
    </div>
    <div className="babylon-toolbar babylon-subcontrols">
      <label>Qualidade <select value={quality} onChange={e=>{setQuality(e.target.value as Quality);if(runtime.current){runtime.current.engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/(e.target.value==='baixo'?1:e.target.value==='medio'?1.4:e.target.value==='alto'?1.8:2)));runtime.current.engine.resize();}}}><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="ultra">Ultra</option></select></label>
      <label>Câmera <select value={camera} onChange={e=>setCamera(e.target.value as Camera)}><option value="tv">TV</option><option value="aerea">Aérea</option><option value="onboard">Cockpit</option></select></label>
      <label>Piloto <select value={selected||''} onChange={e=>setSelected(e.target.value)}>{roster.map(d=><option value={d.id} key={d.id}>{d.short} · {d.name}</option>)}</select></label>
      <button className="button secondary" onClick={()=>setRain(v=>!v)}>{rain?'Desligar chuva visual':'Ativar chuva visual'}</button>
      <button className={'button '+(pace==='ataque'?'primary':'secondary')} onClick={()=>setPace(p=>p==='ataque'?'normal':'ataque')}>Ritmo visual +10%</button>
      <button className={'button '+(pace==='economia'?'primary':'secondary')} onClick={()=>setPace(p=>p==='economia'?'normal':'economia')}>Ritmo visual −10%</button>
      <button className="button secondary" onClick={()=>setSpeed(s=>s===0.5?0.75:s===0.75?1:s===1?2:s===2?4:0.5)}>{speed===0.5?'0,50':speed===0.75?'0,75':speed}× velocidade</button>
      <button className="button secondary" onClick={()=>{ref.current=initialRace();phase.current=0;feed.current=0;snapshot.current=[];setMessage('Laboratório reiniciado. Carreira preservada.');}}>Reiniciar demo</button>
      <button className="button secondary" onClick={exportState}>Exportar estado</button>
    </div>
    <p className="babylon-status" role="status">{message}</p>
    <p className="babylon-warning">Ambiente experimental em memória: não grava no save da carreira. A F1 reproduz dados do RaceEngine; F2/F3 ilustram movimento, sem calcular resultados oficiais. Os ajustes de ritmo visual só se aplicam à prévia F2/F3. Os carros WebGL são protótipos geométricos. Em build oficial, Babylon vem do npm; a compilação offline alternativa utiliza CDN como reserva.</p>
  </section>;
}
