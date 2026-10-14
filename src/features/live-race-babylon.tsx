'use client';
/** True Babylon.js WebGL renderer for the AUTHORITATIVE live race.
 * Display-only: no race ticks, simulated opponents, scoring or save writes.
 * Same presentRace snapshots used by the established 2D and SVG-isometric views.
 */
import { useEffect, useRef, useState } from 'react';
import type { Track2DGeometry } from '../presentation/circuit-geometry';
import { trackBounds } from '../presentation/circuit-geometry';
import type { presentRace } from '../presentation/race-presentation';
import { incidentYawDelta, sceneryVisibility } from '../presentation/babylon-camera';
import {
  CutFade, alternateAnchors, needsCut, planCamera, smoothingAlpha, steerAngle, wheelSpin,
  type BabylonCameraChoice, type BabylonShotKind, type CameraPlan, type FocusPoint,
} from '../presentation/broadcast-director';
import { FpsGovernor, hardwareScaling, lowerQuality, type BabylonQuality } from '../presentation/babylon-quality';
import { visualRaceAngle, visualRacePoint } from '../presentation/race-visual-focus';
import { layoutRaceTags, TAG_H, TAG_W } from '../presentation/race-tag-layout';
import { THEME_LOOK, sceneryPlan, themeFor, type SceneryItem, type SceneryKind } from '../presentation/scenery-plan';
import { pitCrewVisible, safetyCarPose } from '../presentation/race-ceremony';

export type RaceBabylonCamera = BabylonCameraChoice;
export type RaceBabylonQuality = BabylonQuality;
/** The shot the broadcast director resolved for this frame (ids are the cars the lens must hold). */
export type RaceBabylonShot = { kind: BabylonShotKind; ids: string[]; label: string };
type Car = ReturnType<typeof presentRace>[number];
export type LiveRaceBabylonProps = {
  geometry: Track2DGeometry;
  cars: Car[];
  colors: Record<string, string>;
  /** Driver short codes for the on-screen tags. */
  codes?: Record<string, string>;
  /** Maps existing driver IDs to one of the 16 actual constructors. */
  teamIds: Record<string, string>;
  /** Mobile geometry has been quarter-turned for the same authoritative race map. */
  rotated: boolean;
  selected: string | null;
  own: string[];
  camera: RaceBabylonCamera;
  shot: RaceBabylonShot;
  battleIds: string[] | null;
  quality: RaceBabylonQuality;
  /** Called when the optional FPS governor lowered the profile (only when `autoQuality`). */
  autoQuality?: boolean;
  onQualityDowngrade?: (next: RaceBabylonQuality) => void;
  wet: boolean;
  paused: boolean;
  reduced: boolean;
  control: string;
  onSelect: (id: string) => void;
  onFailure: (reason: string) => void;
};
const CDN = 'https://cdn.babylonjs.com/babylon.js';
const GLTF_CDN = 'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js';
let loadingCDN: Promise<any> | undefined;
let loadingGLTF: Promise<void> | undefined;
function ensureCDNGLTF():Promise<void>{
  if((window as any).__f1GltfLoaderReady)return Promise.resolve();
  if(!loadingGLTF)loadingGLTF=new Promise<void>((resolve)=>{
    const loader=document.createElement('script');loader.src=GLTF_CDN;loader.async=true;
    loader.onload=()=>{(window as any).__f1GltfLoaderReady=true;resolve();};
    loader.onerror=()=>{loadingGLTF=undefined;resolve();}; // leave procedural fallback available
    document.head.appendChild(loader);
  });
  return loadingGLTF;
}
// Official Vite/Next builds bundle the package. Offline alternative can fall back to CDN.
async function importBabylon(): Promise<any> {
  try {
    const B = await import('@babylonjs/core');
    await import('@babylonjs/loaders');
    return B;
  } catch {
    if (typeof window === 'undefined') throw new Error('Babylon.js requer navegador');
    if ((window as any).BABYLON){await ensureCDNGLTF();return (window as any).BABYLON;}
    if (!loadingCDN) loadingCDN = new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CDN; script.async = true; script.crossOrigin = 'anonymous';
      let finished = false;
      const fail = (message: string) => {
        if (finished) return; finished = true; clearTimeout(timer); script.remove(); reject(new Error(message));
      };
      const timer = window.setTimeout(() => fail('Babylon.js não carregou em 12 segundos'), 12000);
      script.onload = () => {
        if (finished) return;
        if (!(window as any).BABYLON) { fail('Biblioteca WebGL indisponível'); return; }
        // The lab may have loaded the Babylon core already; glTF is installed independently.
        void ensureCDNGLTF().then(()=>{
          if(finished)return;
          finished=true;clearTimeout(timer);resolve((window as any).BABYLON);
        });
      };
      script.onerror = () => fail('Não foi possível obter Babylon.js neste navegador');
      document.head.appendChild(script);
    }).catch((error) => { loadingCDN = undefined; throw error; });
    return loadingCDN;
  }
}
const xy = (point: {x:number;y:number}, bounds: ReturnType<typeof trackBounds>) => ({
  x: (point.x - bounds.cx) * .105,
  z: (point.y - bounds.cy) * .105,
});
type Wheel = { pivot: any; front: boolean; radius: number; spin: number };
type CarModel = {
  root: any; wheels: any[]; crew: any; effects: {smoke:any;dust:any;sparks:any[]}; quality?: string;
  /** Pivoted GLB wheels (spin + steer); empty while the procedural fallback is shown. */
  wheelRig: Wheel[]; shadow?: any; steer: number; lastYaw: number; level: 'mobile'|'high';
};
function createScene(B:any, canvas: HTMLCanvasElement, geometry: Track2DGeometry, quality: RaceBabylonQuality) {
  const engine = new B.Engine(canvas, true, {preserveDrawingBuffer:false, stencil:false});
  engine.setHardwareScalingLevel(hardwareScaling(quality, window.devicePixelRatio || 1));
  const scene = new B.Scene(engine);
  scene.useRightHandedSystem = true; // glTF meshes, track coordinates and renderer use the same axes.
  const hemi = new B.HemisphericLight('ambient', new B.Vector3(0,1,0), scene); hemi.intensity = .83;
  const sun = new B.DirectionalLight('sun', new B.Vector3(-.6,-1,.4), scene); sun.intensity = .9;
  const materials = new Map<string, any>();
  const material = (name:string,hex:string) => {
    const cached = materials.get(name);
    if (cached) return cached;
    const m = new B.StandardMaterial(name,scene);
    m.diffuseColor = B.Color3.FromHexString(hex); m.specularColor = new B.Color3(.18,.2,.23);
    materials.set(name, m);
    return m;
  };
  const grass=material('grass','#235338'), asphalt=material('track','#343c41'), white=material('white','#dde5df'),
    red=material('red','#cb343e'), garage=material('garage','#718e99'), roof=material('roof','#293a48'), rubber=material('rubber','#11171c');
  const bounds = trackBounds(geometry, 30);
  const theme = themeFor(geometry.circuitId), look = THEME_LOOK[theme];
  const ground = B.MeshBuilder.CreateGround('ground', {width:Math.max(120,bounds.w*.2),height:Math.max(92,bounds.h*.2)},scene);
  ground.material=theme==='park'?grass:material('ground-'+theme,look.ground);ground.isPickable=false;
  const fallbackTrack:any[]=[],scenery:any[]=[],left:any[]=[],right:any[]=[],pts=geometry.points;
  for(let i=0;i<=pts.length;i++){
    const p=pts[i%pts.length],q=pts[(i+1)%pts.length],d=Math.hypot(q.x-p.x,q.y-p.y)||1;
    const v=xy(p,bounds),nx=-(q.y-p.y)/d,nz=(q.x-p.x)/d;
    left.push(new B.Vector3(v.x+nx*1.564,.07,v.z+nz*1.564));
    right.push(new B.Vector3(v.x-nx*1.564,.07,v.z-nz*1.564));
  }
  const road=B.MeshBuilder.CreateRibbon('circuit', {pathArray:[left,right],sideOrientation:B.Mesh.DOUBLESIDE},scene); road.material=asphalt; fallbackTrack.push(road);
  for(let i=0;i<pts.length;i+=12){
    const p=pts[i],q=pts[(i+1)%pts.length],d=Math.hypot(q.x-p.x,q.y-p.y)||1;
    const nx=-(q.y-p.y)/d,nz=(q.x-p.x)/d,v=xy(p,bounds),yaw=Math.atan2(q.x-p.x,q.y-p.y);
    for(const side of [-1,1]){
      const curb=B.MeshBuilder.CreateBox('curb', {width:.26,height:.065,depth:.72},scene);
      curb.position.set(v.x+nx*side*1.535,.13,v.z+nz*side*1.535);
      curb.rotation.y=yaw;curb.material=i%24===0?red:white;fallbackTrack.push(curb);
    }
  }
  // Pit lane comes from the SAME track geometry used by the race renderer.
  const pit = geometry.pitLane.map(p=>{ const v=xy(p,bounds);return new B.Vector3(v.x,.075,v.z); });
  if (pit.length > 1) {const lane=B.MeshBuilder.CreateTube('pit-lane',{path:pit,radius:.36,tessellation:5},scene);lane.material=asphalt;fallbackTrack.push(lane);}
  // Even the emergency procedural fallback places garages relative to the mapped pit lane.
  if (pit.length > 4) for(let i=0;i<6;i++){
    const index=Math.floor(pit.length/2), mid=pit[index],d=pit[index+1].subtract(pit[index-1]).normalize();
    const normal=new B.Vector3(-d.z,0,d.x),at=mid.add(d.scale((i-2.5)*4.9)).add(normal.scale(4));
    const yaw=Math.atan2(d.x,d.z);
    const box=B.MeshBuilder.CreateBox('pit-building',{width:4.0,height:2,depth:4.7},scene);
    box.position.set(at.x,1,at.z);box.rotation.y=yaw;box.material=garage;fallbackTrack.push(box);scenery.push(box);
    const top=B.MeshBuilder.CreateBox('pit-roof',{width:4.3,height:.2,depth:5},scene);
    top.position.set(at.x,2.1,at.z);top.rotation.y=yaw;top.material=roof;fallbackTrack.push(top);scenery.push(top);
  }
  if(quality!=='baixo') for(let i=0;i<9;i++){
    const stand=B.MeshBuilder.CreateBox('grandstand',{width:6,height:1.5,depth:2.6},scene);
    stand.position.set(-32+i*8,.75,32);stand.material=garage;fallbackTrack.push(stand);scenery.push(stand);
  }
  const cam=new B.FreeCamera('tv',new B.Vector3(0,42,-50),scene);
  cam.minZ=.05; cam.maxZ=400;scene.activeCamera=cam;
  scene.clearColor=new B.Color4(look.sky[0],look.sky[1],look.sky[2],1);
  const safetyRoot=new B.TransformNode('safety-car',scene);
  const safetyPaint=material('safety-paint','#e9b538'),safetyGlass=material('safety-glass','#182f3f');
  const safetyBody=B.MeshBuilder.CreateBox('safety-body',{width:1.18,height:.42,depth:2.3},scene);
  safetyBody.parent=safetyRoot;safetyBody.position.y=.42;safetyBody.material=safetyPaint;
  const safetyCab=B.MeshBuilder.CreateBox('safety-cabin',{width:.87,height:.40,depth:.90},scene);
  safetyCab.parent=safetyRoot;safetyCab.position.set(0,.76,-.15);safetyCab.material=safetyGlass;
  const beacon=B.MeshBuilder.CreateSphere('safety-beacon',{diameter:.22,segments:8},scene);
  beacon.parent=safetyRoot;beacon.position.set(0,1.02,-.15);beacon.material=material('safety-amber','#ffe16d');
  for(const x of [-.53,.53])for(const z of [-.69,.69]){
    const wheel=B.MeshBuilder.CreateCylinder('safety-wheel',{diameter:.45,height:.18,tessellation:10},scene);
    wheel.parent=safetyRoot;wheel.position.set(x,.25,z);wheel.rotation.z=Math.PI/2;wheel.material=rubber;
  }
  safetyRoot.setEnabled(false);
  // One shared contact-shadow disc; each car gets a cheap instance of it.
  const shadowMat = new B.StandardMaterial('contact-shadow', scene);
  shadowMat.diffuseColor = new B.Color3(0,0,0); shadowMat.specularColor = new B.Color3(0,0,0);
  shadowMat.emissiveColor = new B.Color3(0,0,0); shadowMat.alpha = .38; shadowMat.disableLighting = true;
  const shadowSource = B.MeshBuilder.CreateDisc('contact-shadow-source', {radius:1, tessellation:16}, scene);
  shadowSource.rotation.x = Math.PI/2; shadowSource.bakeCurrentTransformIntoVertices();
  shadowSource.material = shadowMat; shadowSource.isPickable = false; shadowSource.setEnabled(false);
  const rt={engine,scene,cam,bounds,theme,sky:look.sky,material,rubber,fallbackTrack,scenery,shadowSource,sceneryKit:undefined as undefined|{dispose:()=>void;items:number;meshes:number},
    safetyRoot,beacon,models:new Map<string,CarModel>(),
    teamAssets:new Map<string,Promise<any>>(),quality};
  buildScenery(rt,B,geometry,quality);
  return rt;
}

/** Camera-first scenery kit: a handful of shared source meshes drawn as thin instances, split into
 * four spatial chunks so the frustum can cull what the lens cannot see. Presentation only. */
function buildScenery(rt:ReturnType<typeof createScene>, B:any, geometry:Track2DGeometry, quality:RaceBabylonQuality){
  rt.sceneryKit?.dispose();rt.sceneryKit=undefined;
  const look=THEME_LOOK[rt.theme];
  const half={x:Math.max(120,rt.bounds.w*.2)/2-1,z:Math.max(92,rt.bounds.h*.2)/2-1};
  const track=geometry.points.map(point=>xy(point,rt.bounds)),pit=geometry.pitLane.map(point=>xy(point,rt.bounds));
  const items=sceneryPlan(track,{circuitId:geometry.circuitId,quality,pitLane:pit,half});
  const root=new B.TransformNode('scenery-kit',rt.scene);
  const sources:any[]=[];
  const flat=(_name:string,mesh:any,y:number)=>{mesh.position.y=y;mesh.bakeCurrentTransformIntoVertices();mesh.isPickable=false;mesh.setEnabled(false);mesh.parent=root;sources.push(mesh);return mesh;};
  const mat=(name:string,hex:string,emissive=false)=>{const m=rt.material('kit-'+name,hex);if(emissive)m.emissiveColor=B.Color3.FromHexString(hex);return m;};
  const parts:Record<SceneryKind,{mesh:any;material:any;tinted:boolean}[]>={
    tree:[
      {mesh:flat('trunk',B.MeshBuilder.CreateCylinder('kit-trunk',{diameterTop:.18,diameterBottom:.28,height:.9,tessellation:5},rt.scene),.45),material:mat('trunk','#5b4430'),tinted:false},
      {mesh:flat('canopy',B.MeshBuilder.CreateCylinder('kit-canopy',{diameterTop:0,diameterBottom:1.9,height:2.5,tessellation:6},rt.scene),2.1),material:mat('canopy','#ffffff'),tinted:true},
    ],
    building:[{mesh:flat('building',B.MeshBuilder.CreateBox('kit-building',{size:1},rt.scene),.5),material:mat('building','#ffffff'),tinted:true}],
    lamp:[
      {mesh:flat('pole',B.MeshBuilder.CreateCylinder('kit-pole',{diameter:.09,height:2.7,tessellation:5},rt.scene),1.35),material:mat('pole','#4a535a'),tinted:false},
      {mesh:flat('lamp',B.MeshBuilder.CreateSphere('kit-lamp',{diameter:.3,segments:4},rt.scene),2.75),material:mat('lamp',look.tones.lamp[0],true),tinted:false},
    ],
    dune:[{mesh:flat('dune',B.MeshBuilder.CreateSphere('kit-dune',{diameter:1,segments:4},rt.scene),0),material:mat('dune','#ffffff'),tinted:true}],
  };
  const chunkOf=(item:SceneryItem)=>(item.x<0?0:1)+(item.z<0?0:2);
  const drawn:any[]=[];
  for(const kind of Object.keys(parts) as SceneryKind[]){
    const kindItems=items.filter(item=>item.kind===kind);
    if(!kindItems.length)continue;
    for(let chunk=0;chunk<4;chunk++){
      const group=kindItems.filter(item=>chunkOf(item)===chunk);
      if(!group.length)continue;
      const matrices=new Float32Array(group.length*16),colors=new Float32Array(group.length*4);
      group.forEach((item,index)=>{
        const lampYaw=item.rot;
        B.Matrix.Compose(new B.Vector3(item.sx,item.sy,item.sz),B.Quaternion.FromEulerAngles(0,lampYaw,0),new B.Vector3(item.x,kind==='dune'?.15:0,item.z)).copyToArray(matrices,index*16);
        const palette=look.tones[kind],hex=palette[item.tone%palette.length],c=B.Color3.FromHexString(hex);
        colors.set([c.r,c.g,c.b,1],index*4);
      });
      for(const part of parts[kind]){
        const mesh=part.mesh.clone(part.mesh.name+'-c'+chunk);
        mesh.parent=root;mesh.material=part.material;mesh.setEnabled(true);mesh.isPickable=false;
        mesh.thinInstanceSetBuffer('matrix',matrices,16,true);
        if(part.tinted)mesh.thinInstanceSetBuffer('color',colors,4,true);
        mesh.thinInstanceRefreshBoundingInfo(true);
        drawn.push(mesh);
      }
    }
  }
  rt.sceneryKit={dispose:()=>{drawn.forEach(mesh=>mesh.dispose());sources.forEach(mesh=>mesh.dispose());root.dispose();},items:items.length,meshes:drawn.length};
}

/** The GLBs are original stylized team models delivered in Marco 56000.
 * One cached container per constructor and quality; each driver gets its own transform.
 * On download/decoder errors, the existing procedural car remains drivable.
 */
const modelIds = new Set(['mclaren','ferrari','mercedes','redbull','williams','haas','audi','alpine','aston','cadillac','hyundai','kia','byd','porsche','jaguar','bugatti']);
function loadTeamContainer(rt:ReturnType<typeof createScene>, B:any, teamId:string, quality:RaceBabylonQuality):Promise<any>{
  if (!modelIds.has(teamId)) return Promise.reject(new Error('Construtora sem GLB próprio'));
  const level=quality==='baixo'||quality==='medio'?'mobile':'high';
  const filename=teamId+'_'+level+'.glb';
  const pending=rt.teamAssets.get(filename);
  if (pending) return pending;
  const request: Promise<any> = B.SceneLoader.LoadAssetContainerAsync('/assets/f1-3d/cars/',filename,rt.scene);
  rt.teamAssets.set(filename,request);
  return request;
}
async function loadCircuitModel(rt:ReturnType<typeof createScene>, B:any, id:string, rotated:boolean){
  if(!/^gp-(?:[1-9]|[12][0-9]|3[0-5])$/.test(id))return;
  try{
    const result=await B.SceneLoader.ImportMeshAsync('', '/assets/f1-3d/tracks/',id+'.glb',rt.scene);
    if(rt.scene.isDisposed){result.meshes.forEach((m:any)=>m.dispose());return;}
    const frame=new B.TransformNode('map-'+id,rt.scene);
    for(const mesh of result.meshes)if(!mesh.parent)mesh.parent=frame;
    // quarterTurn() rotates the same map 90 degrees for portrait devices.
    if(rotated)frame.rotation.y=-Math.PI/2;
    rt.fallbackTrack.forEach((m:any)=>m.dispose());rt.fallbackTrack.length=0;
    rt.scenery.length=0;
    rt.scenery.push(...result.meshes.filter((mesh:any)=>/^(?:pit_building|pit_roof|grandstand)/.test(mesh.name)));
    // glTF materials are opaque and shared, so mesh.visibility alone never fades them: give each
    // near-lens structure its own alpha-blended material so sceneryVisibility really works.
    for(const mesh of rt.scenery){
      if(!mesh.material||mesh.metadata?.fadeReady)continue;
      const own=mesh.material.clone(mesh.name+'-fade');
      own.transparencyMode=B.Material.MATERIAL_ALPHABLEND;own.backFaceCulling=false;
      mesh.material=own;mesh.metadata={...(mesh.metadata||{}),fadeReady:true};
    }
  }catch(error){console.warn('Circuito GLB indisponível, usando malha procedural:',id,error);}
}
/** The GLB wheels carry no pivot: group each corner's tyre/rim/hub/lock under a pivot at the tyre centre. */
function buildWheelRig(B:any, meshes:any[], id:string):Wheel[]{
  const corners=new Map<string,any[]>();
  for(const mesh of meshes){
    const m=/^(Front|Rear)(Left|Right)/.exec(mesh.name.replace(id+'-',''));
    if(!m)continue;
    const key=m[1]+m[2];corners.set(key,[...(corners.get(key)||[]),mesh]);
  }
  const rig:Wheel[]=[];
  for(const [key,group] of corners){
    const tyre=group.find((mesh:any)=>/Wheel_/.test(mesh.name));
    if(!tyre)continue;
    const box=tyre.getBoundingInfo().boundingBox;
    const center=box.center.clone();
    const radius=Math.max(.05,box.extendSize.y);
    const parent=tyre.parent;
    const pivot=new B.TransformNode('wheel-pivot-'+id+'-'+key,tyre.getScene());
    pivot.parent=parent;pivot.position.copyFrom(center);
    pivot.computeWorldMatrix(true);
    for(const mesh of group){mesh.computeWorldMatrix(true);mesh.setParent(pivot);}
    rig.push({pivot,front:key.startsWith('Front'),radius,spin:0});
  }
  return rig;
}
function createCar(rt:ReturnType<typeof createScene>, B:any, id:string, color:string, teamId:string, quality:RaceBabylonQuality) {
  const {scene, rubber}=rt;
  const root=new B.TransformNode('car-'+id,scene);
  root.metadata={driverId:id};
  const paint=rt.material('team-'+id,/^#[\da-f]{6}$/i.test(color)?color:'#dddddd');
  function box(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:any){
    const mesh=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    mesh.position.set(x,y,z);mesh.material=mat;mesh.parent=root;mesh.metadata={driverId:id};return mesh;
  }
  box('body',.78,.28,2.15,0,.38,0,paint);
  box('nose',.27,.18,.93,0,.33,1.12,paint);
  box('front-wing',1.55,.09,.35,0,.23,1.59,paint);
  box('rear-wing',1.4,.15,.31,0,.76,-1.03,paint);
  box('cockpit',.50,.32,.64,0,.60,-.25,rubber);
  box('halo',.10,.13,.68,0,.83,-.27,rubber);
  box('helmet',.32,.30,.34,0,.87,-.46,paint);
  const wheels:any[]=[];
  for(const x of [-.71,.71])for(const z of [-.75,.96]){
    const wheel=B.MeshBuilder.CreateCylinder('tyre',{diameter:.55,height:.25,tessellation:12},scene);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x,.34,z);wheel.material=rubber;wheel.parent=root;
    wheel.metadata={driverId:id};wheels.push(wheel);
  }
  const crew=new B.TransformNode('pit-crew-'+id,scene);
  crew.parent=root;
  const suit=rt.material('pit-suit-'+id,/^#[\da-f]{6}$/i.test(color)?color:'#d9e2e5');
  const helmetMat=rt.material('pit-helmet-'+id,'#f6ca59');
  // Crew size follows the graphics profile (4 to 12 actors); positions are around the car, in car space.
  const crewSpots:[number,number][]=[[-1.24,-.79],[1.24,-.79],[-1.24,1.0],[1.24,1.0],[0,-1.75],[0,2.05],[-1.9,.1],[1.9,.1],[-1.6,-1.5],[1.6,-1.5],[-1.6,1.9],[1.6,1.9]];
  const crewCount=quality==='baixo'?4:quality==='medio'?6:quality==='alto'?8:12;
  crewSpots.slice(0,crewCount).forEach(([x,z],index)=>{
    const actor=new B.TransformNode('pit-actor-'+index,scene);actor.parent=crew;actor.position.set(x,0,z);actor.metadata={phase:index*.9};
    const torso=B.MeshBuilder.CreateCylinder('pit-mechanic',{diameter:.32,height:.53,tessellation:8},scene);
    torso.parent=actor;torso.position.y=.48;torso.material=suit;torso.isPickable=false;
    const helmet=B.MeshBuilder.CreateSphere('pit-helmet',{diameter:.32,segments:8},scene);
    helmet.parent=actor;helmet.position.y=.86;helmet.material=helmetMat;helmet.isPickable=false;
  });
  crew.setEnabled(false);
  const smoke=B.MeshBuilder.CreateSphere('incident-smoke',{diameter:.72,segments:8},scene);
  smoke.parent=root;smoke.position.set(0,1.18,-.75);smoke.material=rt.material('incident-smoke-'+id,'#788287');smoke.visibility=.62;smoke.setEnabled(false);
  const dust=B.MeshBuilder.CreateSphere('incident-dust',{diameter:.82,segments:8},scene);
  dust.parent=root;dust.position.set(0,.36,-1.0);dust.material=rt.material('incident-dust-'+id,'#b89d72');dust.visibility=.52;dust.setEnabled(false);
  const sparks:any[]=[];
  for(let i=0;i<5;i++){
    const spark=B.MeshBuilder.CreateBox('incident-spark',{width:.05,height:.05,depth:.46+i*.08},scene);
    spark.parent=root;spark.position.set((i-2)*.12,.2,-1.18-i*.12);spark.rotation.y=(i-2)*.16;
    spark.material=rt.material('incident-spark-'+id+'-'+i,'#ffcc54');spark.setEnabled(false);sparks.push(spark);
  }
  const shadow=rt.shadowSource.createInstance('shadow-'+id);
  shadow.parent=root;shadow.position.y=.02-.15;shadow.scaling.set(.95,1,1.5);shadow.isPickable=false;
  rt.models.set(id,{root,wheels,crew,effects:{smoke,dust,sparks},quality,wheelRig:[],shadow,steer:0,lastYaw:NaN,level:quality==='baixo'||quality==='medio'?'mobile':'high'});
  void loadTeamContainer(rt,B,teamId,quality).then((container:any)=>{
    if(rt.scene.isDisposed||rt.models.get(id)?.root!==root)return;
    const instance=container.instantiateModelsToScene((name:string)=>id+'-'+name, false);
    for(const node of instance.rootNodes)node.parent=root;
    // All instances are attached to the same simulation-driven root.
    for(const mesh of root.getChildMeshes()){
      if(mesh.name.startsWith('body')||mesh.name==='nose'||mesh.name==='front-wing'||mesh.name==='rear-wing'||mesh.name==='cockpit'||mesh.name==='halo'||mesh.name==='helmet'||mesh.name==='tyre')continue;
      mesh.metadata={...(mesh.metadata||{}),driverId:id};
    }
    const wheelMeshes=root.getChildMeshes().filter((mesh:any)=>/Wheel_|Rim_|Hub_|Lock_/.test(mesh.name));
    for(const wheel of wheels)wheel.dispose();
    // Primitive fallback meshes are no longer needed once the GLB is visible.
    for(const mesh of [...root.getChildMeshes()]){
      if(mesh.name.startsWith('body')||['nose','front-wing','rear-wing','cockpit','halo','helmet'].includes(mesh.name))mesh.dispose();
    }
    const current=rt.models.get(id);
    if(current){
      current.wheels=wheelMeshes;
      current.wheelRig=buildWheelRig(B,wheelMeshes,id);
    }
  }).catch((error:any)=>console.warn('Modelo GLB indisponível, usando carro procedural:',teamId,error));
}
export default function LiveRaceBabylon(props:LiveRaceBabylonProps){
  const canvas=useRef<HTMLCanvasElement>(null), fade=useRef<HTMLDivElement>(null), tagLayer=useRef<HTMLDivElement>(null), latest=useRef(props), onFailure=useRef(props.onFailure), onSelect=useRef(props.onSelect), onDowngrade=useRef(props.onQualityDowngrade);
  const [ready,setReady]=useState(false),[fps,setFps]=useState(0);
  const duelVisible=props.shot.kind==='duelo' && props.shot.ids.length>1;
  latest.current=props;onFailure.current=props.onFailure;onSelect.current=props.onSelect;onDowngrade.current=props.onQualityDowngrade;
  useEffect(()=>{
    let cancelled=false;
    let rt: ReturnType<typeof createScene> | undefined;
    let resizeObserver:ResizeObserver|undefined;
    let lost:(event:Event)=>void=()=>{};
    let instrument:{dispose:()=>void}|undefined;
    const el=canvas.current;
    async function begin(){
      try {
        const B=await importBabylon();
        if(cancelled||!canvas.current) return;
        rt=createScene(B,canvas.current,props.geometry,latest.current.quality);
        const current=rt;
        if(cancelled){current.scene.dispose();current.engine.dispose();return;}
        lost=(event:Event)=>{event.preventDefault();if(!cancelled)onFailure.current('contexto WebGL perdido');};
        canvas.current.addEventListener('webglcontextlost',lost);
        void loadCircuitModel(current,B,props.geometry.circuitId,latest.current.rotated);
        if(typeof ResizeObserver!=='undefined'){
          resizeObserver=new ResizeObserver(()=>current.engine.resize());
          resizeObserver.observe(canvas.current);
        }
        current.scene.onPointerObservable.add((event:any)=>{
          if(event.type!==B.PointerEventTypes.POINTERPICK)return;
          const id=event.pickInfo?.pickedMesh?.metadata?.driverId;
          if(typeof id==='string')onSelect.current(id);
        });
        // Camera rig: exponential smoothing of position, look-at and FOV, with deliberate cuts for big jumps.
        const rig={ready:false,pos:new B.Vector3(),target:new B.Vector3(),fov:.9,kind:'' as string,subject:'',anchor:0,nextCheck:0,cut:new CutFade(false),pending:null as CameraPlan|null};
        (window as any).__f1BabylonScene=current.scene;
        const governor=new FpsGovernor();
        const instrumentation=new B.SceneInstrumentation(current.scene);instrumentation.captureRenderTime=true;instrument=instrumentation;
        const tmpRay=new B.Ray(B.Vector3.Zero(),B.Vector3.Up(),1);
        const obstruction=/^(?:barrier|grandstand|pit_)/;
        const blocked=(c:CameraPlan)=>{
          const from=new B.Vector3(c.target.x,c.target.y,c.target.z),to=new B.Vector3(c.position.x,c.position.y,c.position.z);
          const dir=to.subtract(from),len=dir.length();
          if(len<.1)return false;
          tmpRay.origin=from;tmpRay.direction=dir.scale(1/len);tmpRay.length=len;
          const hit=current.scene.pickWithRay(tmpRay,(m:any)=>obstruction.test(m.name)&&m.isEnabled()&&m.visibility>.5);
          return !!hit?.hit;
        };
        const projectRect=(model:any)=>{
          const view=current.engine.getRenderWidth(),viewH=current.engine.getRenderHeight(),cw=canvas.current?.clientWidth||1,ch=canvas.current?.clientHeight||1;
          const transform=current.scene.getTransformMatrix(),vp=current.cam.viewport.toGlobal(view,viewH),m=model.root.getWorldMatrix();
          let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
          for(const x of [-.8,.8])for(const y of [0,.9])for(const z of [-1.1,1.6]){
            const q=B.Vector3.Project(B.Vector3.TransformCoordinates(new B.Vector3(x,y,z),m),B.Matrix.IdentityReadOnly,transform,vp);
            minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
          }
          return {x:Math.round(minX*cw/view),y:Math.round(minY*ch/viewH),w:Math.round((maxX-minX)*cw/view),h:Math.round((maxY-minY)*ch/viewH)};
        };
        let frame=0,from=performance.now(),prev=from,debugAt=0,tagsAt=0;
        current.engine.runRenderLoop(()=>{
          if(cancelled || !rt)return;
          const p=latest.current,now=performance.now(),rawDt=Math.max(0,(now-prev)/1000),dt=Math.min(.06,rawDt),camDt=Math.min(.25,rawDt);prev=now;
          if(current.quality!==p.quality){
            const levelOf=(q:RaceBabylonQuality)=>q==='baixo'||q==='medio'?'mobile':'high';
            current.quality=p.quality;
            current.engine.setHardwareScalingLevel(hardwareScaling(p.quality,window.devicePixelRatio||1));
            current.engine.resize();
            buildScenery(current,B,props.geometry,p.quality);
            // GLB detail follows the profile: rebuild cars from the cached containers at the new level.
            for(const [id,model] of [...current.models])if(model.level!==levelOf(p.quality)){
              model.root.dispose();current.models.delete(id);
            }
          }
          const byId=new Map<string,any>(p.cars.map(car=>[car.id,car]));
          const positions=new Set<string>();
          for(const car of p.cars){
            positions.add(car.id);
            const pos=xy(visualRacePoint(car),current.bounds),yaw=Math.PI/2-visualRaceAngle(car)*Math.PI/180;
            if(!current.models.has(car.id)) {
              createCar(current,B,car.id,p.colors[car.id] || '#e2e8ef',p.teamIds[car.id] || '',p.quality);
              // Initialize at authoritative snapshot, never fly in from (0,0).
              const spawned=current.models.get(car.id)!;
              spawned.root.position.set(pos.x,.15,pos.z);
              spawned.root.rotation.y=yaw;
            }
            const model=current.models.get(car.id)!;
            const smoothing=p.reduced?1:Math.min(1,1-Math.exp(-dt*16));
            const px=model.root.position.x,pz=model.root.position.z,py=model.root.rotation.y;
            model.root.position.x+=(pos.x-px)*smoothing;
            model.root.position.z+=(pos.z-pz)*smoothing;
            const diff=incidentYawDelta(model.root.rotation.y,yaw,car.incident?.kind==='SPIN');
            model.root.rotation.y+=diff*smoothing;
            const running=car.car.status==='RUNNING';
            model.root.setEnabled(running || car.pitStage!=='TRACK' || !!car.incident);
            model.crew.setEnabled(pitCrewVisible(car.pitStage));
            if(pitCrewVisible(car.pitStage) && !p.reduced && !p.paused){
              // Procedural wheel-gun / jack motion: purely visual, no duration is implied.
              for(const actor of model.crew.getChildren()){actor.position.y=.04*Math.max(0,Math.sin(now/150+(actor.metadata?.phase??0)));}
            }
            model.effects.smoke.setEnabled(!!car.incident?.smoke);
            model.effects.dust.setEnabled(!!car.incident?.dust);
            for(const spark of model.effects.sparks)spark.setEnabled(!!car.incident?.sparks);
            if(!p.reduced&&!p.paused){
              if(car.incident?.smoke){model.effects.smoke.position.y=1.18+.22*Math.sin(now/260);model.effects.smoke.scaling.setAll(.85+.18*Math.sin(now/310));}
              if(car.incident?.dust)model.effects.dust.scaling.setAll(.9+.2*Math.sin(now/170));
              if(car.incident?.sparks)for(let i=0;i<model.effects.sparks.length;i++)model.effects.sparks[i].scaling.z=.7+.5*Math.sin(now/80+i);
            }
            model.root.scaling.setAll(running?1:.89);
            // Wheels turn with the distance the car actually travels on screen; steering follows path curvature.
            const travel=Math.hypot(model.root.position.x-px,model.root.position.z-pz);
            const animate=!p.paused&&!p.reduced&&running;
            if(model.wheelRig.length){
              const target=animate?steerAngle(incidentYawDelta(py,model.root.rotation.y,false),travel):0;
              model.steer+=(target-model.steer)*smoothingAlpha(dt,.09);
              for(const wheel of model.wheelRig){
                if(animate)wheel.spin+=wheelSpin(travel,wheel.radius);
                wheel.pivot.rotation.x=wheel.spin;
                wheel.pivot.rotation.y=wheel.front?model.steer:0;
              }
            }else if(animate)for(const wheel of model.wheels)wheel.rotation.x+=dt*13;
            const rumble=animate&&(car.duel?.state==='WIDE'||car.duel?.state==='LOCKUP'||!!car.incident);
            model.root.position.y=.15+(rumble?.012*Math.sin(now/21):0);
          }
          for(const [id,model] of current.models)if(!positions.has(id)){
            model.root.dispose();current.models.delete(id);
          }
          const safety=safetyCarPose(p.control,p.cars,p.geometry.at);
          current.safetyRoot.setEnabled(!!safety);
          if(safety){
            const pos=xy(safety.point,current.bounds);
            current.safetyRoot.position.set(pos.x,.12,pos.z);
            current.safetyRoot.rotation.y=Math.PI/2-safety.angle;
            current.beacon.scaling.setAll(p.reduced||p.paused?1:.8+.35*Math.sin(now/130));
          }
          // ---- broadcast camera ----
          const fallbackSubject=byId.get(p.selected||'')||p.cars.find(car=>p.own.includes(car.id))||p.cars[0];
          let focusCars=p.shot.ids.map(id=>byId.get(id)).filter(Boolean);
          if(!focusCars.length&&p.shot.kind!=='aerea'&&fallbackSubject)focusCars=[fallbackSubject];
          if(focusCars.length||p.shot.kind==='aerea'){
            const kind=p.shot.kind;
            const compact=(canvas.current?.clientWidth ?? window.innerWidth)<600;
            const points:FocusPoint[]=focusCars.map((car:any)=>{const v=xy(visualRacePoint(car),current.bounds);return {x:v.x,z:v.z,angle:car.angle*Math.PI/180};});
            const lead=focusCars[0]??{id:'',progress:0};
            const aheadPoint=kind==='onboard'||!focusCars.length?null:xy(p.geometry.at(lead.progress+.012),current.bounds);
            let pitAnchor:{x:number;z:number;nx:number;nz:number}|null=null;
            if(kind==='pit'&&p.geometry.pitLane.length>2){
              const lane=p.geometry.pitLane.map(q=>xy(q,current.bounds));
              let best=0,bd=Infinity;
              lane.forEach((q,i)=>{const d=Math.hypot(q.x-points[0].x,q.z-points[0].z);if(d<bd){bd=d;best=i;}});
              const a=lane[Math.max(0,best-1)],b=lane[Math.min(lane.length-1,best+1)],tx=b.x-a.x,tz=b.z-a.z,len=Math.hypot(tx,tz)||1;
              // Garages sit on the (-tz,tx) side of the lane; the lens stands on the track side.
              pitAnchor={x:lane[best].x,z:lane[best].z,nx:tz/len,nz:-tx/len};
            }
            let plan:CameraPlan=planCamera(kind,{points,compact,ahead:aheadPoint,pitAnchor});
            if(kind!=='aerea'&&kind!=='onboard'){
              if(now>=rig.nextCheck){
                rig.nextCheck=now+300;
                const alts=alternateAnchors(plan);
                const free=alts.findIndex(candidate=>!blocked(candidate));
                rig.anchor=free<0?0:free;
              }
              plan=alternateAnchors(plan)[rig.anchor]??plan;
            }
            const changed=rig.kind!==kind||rig.subject!==lead.id;
            const wantPos=new B.Vector3(plan.position.x,plan.position.y,plan.position.z);
            if(!rig.ready){rig.ready=true;rig.pos.copyFrom(wantPos);rig.target.set(plan.target.x,plan.target.y,plan.target.z);rig.fov=plan.fov;}
            else if(changed||B.Vector3.Distance(rig.pos,wantPos)>CUT_FAR){
              if(needsCut(rig.pos,plan.position,rig.kind!==kind)){
                if(p.reduced){rig.pos.copyFrom(wantPos);rig.target.set(plan.target.x,plan.target.y,plan.target.z);rig.fov=plan.fov;}
                else if(!rig.cut.active){rig.cut=new CutFade(false);rig.cut.start();}
              }
            }
            rig.kind=kind;rig.subject=lead.id;
            if(rig.cut.active){
              const step=rig.cut.step(camDt);
              if(fade.current)fade.current.style.opacity=String(step.alpha);
              if(step.jump){rig.pos.copyFrom(wantPos);rig.target.set(plan.target.x,plan.target.y,plan.target.z);rig.fov=plan.fov;}
            }else if(fade.current&&fade.current.style.opacity!=='0')fade.current.style.opacity='0';
            const aPos=p.reduced?1:smoothingAlpha(camDt,plan.tau),aTgt=p.reduced?1:smoothingAlpha(camDt,plan.targetTau);
            rig.pos.x+=(wantPos.x-rig.pos.x)*aPos;rig.pos.y+=(wantPos.y-rig.pos.y)*aPos;rig.pos.z+=(wantPos.z-rig.pos.z)*aPos;
            rig.target.x+=(plan.target.x-rig.target.x)*aTgt;rig.target.y+=(plan.target.y-rig.target.y)*aTgt;rig.target.z+=(plan.target.z-rig.target.z)*aTgt;
            rig.fov+=(plan.fov-rig.fov)*aPos;
            current.cam.position.copyFrom(rig.pos);
            current.cam.setTarget(rig.target);
            current.cam.fov=rig.fov;
          }
          const sceneryCamera=p.shot.kind==='seguir'?'tv':p.shot.kind;
          for(const mesh of current.scenery){
            // Distance to the nearest face of the box, so a long grandstand fades when its edge is at the lens.
            const box=mesh.getBoundingInfo().boundingBox,cp=current.cam.position;
            const distance=Math.hypot(Math.max(box.minimumWorld.x-cp.x,0,cp.x-box.maximumWorld.x),Math.max(box.minimumWorld.y-cp.y,0,cp.y-box.maximumWorld.y),Math.max(box.minimumWorld.z-cp.z,0,cp.z-box.maximumWorld.z));
            mesh.visibility=sceneryVisibility(distance,sceneryCamera,mesh.name);
          }
          current.scene.clearColor=p.wet?new B.Color4(.19,.27,.33,1):new B.Color4(current.sky[0],current.sky[1],current.sky[2],1);
          current.scene.fogMode=p.wet&&p.quality!=='baixo'?B.Scene.FOGMODE_EXP2:B.Scene.FOGMODE_NONE;
          current.scene.fogDensity=p.wet?.012:0;
          current.scene.fogColor=new B.Color3(.25,.33,.39);
          current.scene.render();
          frame++;
          if(now-from>1200){
            const measured=Math.round(1000*frame/(now-from));
            setFps(measured);
            if(p.autoQuality&&!document.hidden&&governor.sample(measured,now-from)){
              const next=lowerQuality(p.quality);
              if(next)onDowngrade.current?.(next);
            }
            frame=0;from=now;
          }
          // Driver tags: only the cars the lens is holding (plus the selected/own car), laid out so they never overlap.
          if(now-tagsAt>110&&tagLayer.current){
            tagsAt=now;
            const layer=tagLayer.current,cw=canvas.current?.clientWidth||1,ch=canvas.current?.clientHeight||1;
            const wanted=new Set<string>([...p.shot.ids,...(p.selected?[p.selected]:[]),...p.own].slice(0,6));
            const items:{id:string;x:number;y:number;position:number;priority:number}[]=[];
            for(const id of wanted){
              const model=current.models.get(id),car=byId.get(id);
              if(!model||!car||!model.root.isEnabled())continue;
              const r=projectRect(model);
              if(r.x+r.w<0||r.y+r.h<0||r.x>cw||r.y>ch)continue;
              items.push({id,x:r.x+r.w/2,y:r.y,position:car.position,priority:p.shot.ids.includes(id)?0:p.own.includes(id)?1:2});
            }
            const placed=layoutRaceTags(items,cw,ch,6);
            for(const el of Array.from(layer.children) as HTMLElement[])if(!placed[el.dataset.id||''])el.style.display='none';
            for(const item of items){
              const spot=placed[item.id];if(!spot)continue;
              let el=layer.querySelector(`[data-id="${item.id}"]`) as HTMLElement|null;
              if(!el){el=document.createElement('div');el.className='race-babylon-tag';el.dataset.id=item.id;layer.appendChild(el);}
              el.style.display='block';el.style.width=TAG_W+'px';el.style.minHeight=TAG_H+'px';
              el.style.transform=`translate(${spot.x}px,${spot.y}px)`;el.style.borderColor=p.colors[item.id]||'#fff';
              const text=`P${item.position} ${p.codes?.[item.id]??item.id.slice(0,3).toUpperCase()}`;
              if(el.textContent!==text)el.textContent=text;
            }
          }
          if(now-debugAt>400&&typeof window!=='undefined'){
            debugAt=now;
            // QA/diagnostics only: projected car rectangles and frame stats, read-only.
            const cw=canvas.current?.clientWidth||1,ch=canvas.current?.clientHeight||1;
            const rects:Record<string,{x:number;y:number;w:number;h:number}>={};
            for(const [id,model] of current.models)if(model.root.isEnabled())rects[id]=projectRect(model);
            // Sprint 03 diagnostics for focus cars: engine progress/elapsed vs the display-only lane offset.
            const diag:Record<string,{progress:number;elapsed:number;laneOffset:number}>={};
            for(const id of p.shot.ids){const car=byId.get(id);if(car)diag[id]={progress:Math.round(car.progress*10000)/10000,elapsed:Math.round(car.car.elapsed*1000)/1000,laneOffset:Math.round(((car.duel?.side??0)+(car.incident?.side??0))*100)/100};}
            (window as any).__f1Babylon={fps:Math.round(current.engine.getFps()),shot:p.shot,camera:p.camera,quality:p.quality,canvas:{w:cw,h:ch},
              drawCalls:instrumentation.drawCallsCounter.current,renderMs:Math.round(instrumentation.renderTimeCounter.average*10)/10,activeMeshes:current.scene.getActiveMeshes().length,
              diag,scenery:current.sceneryKit?{items:current.sceneryKit.items,meshes:current.sceneryKit.meshes,theme:current.theme}:null,cameraPos:rig.pos.asArray(),fov:rig.fov,cars:rects};
          }
        });
        setReady(true);
      } catch(error){
        if(rt){try {rt.engine.stopRenderLoop();rt.scene.dispose();rt.engine.dispose();} catch {}}
        if(!cancelled)onFailure.current(error instanceof Error?error.message:String(error));
      }
    }
    void begin();
    return()=>{cancelled=true;instrument?.dispose();resizeObserver?.disconnect();el?.removeEventListener('webglcontextlost',lost);if(rt){rt.engine.stopRenderLoop();rt.scene.dispose();rt.engine.dispose();}};
  },[props.geometry]);
  return <div className="race-babylon" data-testid="race-babylon-webgl">
    <canvas ref={canvas} aria-label="Corrida real em Babylon.js WebGL" />
    <div ref={tagLayer} className="race-babylon-tags" aria-hidden="true" />
    <div ref={fade} className="race-babylon-cut" aria-hidden="true" />
    {!ready && <div className="race-babylon-loading" role="status">Iniciando Babylon.js 3D…</div>}
    {ready && <div className="race-babylon-caption" aria-live="off">BABYLON.JS · 3D WEBGL · {duelVisible ? 'DISPUTA EM FOCO · ' : props.camera==='duelo' ? 'AGUARDANDO DISPUTA · ' : ''}{props.camera==='auto'?props.shot.label+' · ':''}{fps} FPS</div>}
  </div>;
}
const CUT_FAR=48;
