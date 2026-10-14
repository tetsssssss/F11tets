'use client';
/** True Babylon.js WebGL renderer for the AUTHORITATIVE live race.
 * Display-only: no race ticks, simulated opponents, scoring or save writes.
 * Same presentRace snapshots used by the established 2D and SVG-isometric views.
 */
import { useEffect, useRef, useState } from 'react';
import type { Track2DGeometry } from '../presentation/circuit-geometry';
import { trackBounds } from '../presentation/circuit-geometry';
import type { presentRace } from '../presentation/race-presentation';
import { battleCameraLookAhead, incidentYawDelta, sceneryVisibility, tvCameraOffset } from '../presentation/babylon-camera';
import { battleFocus, visualRaceAngle, visualRacePoint } from '../presentation/race-visual-focus';
import { pitCrewVisible, safetyCarPose } from '../presentation/race-ceremony';

export type RaceBabylonCamera = 'tv' | 'duelo' | 'aerea' | 'onboard';
export type RaceBabylonQuality = 'baixo' | 'medio' | 'alto' | 'ultra';
type Car = ReturnType<typeof presentRace>[number];
export type LiveRaceBabylonProps = {
  geometry: Track2DGeometry;
  cars: Car[];
  colors: Record<string, string>;
  /** Maps existing driver IDs to one of the 16 actual constructors. */
  teamIds: Record<string, string>;
  /** Mobile geometry has been quarter-turned for the same authoritative race map. */
  rotated: boolean;
  selected: string | null;
  own: string[];
  camera: RaceBabylonCamera;
  battleIds: string[] | null;
  quality: RaceBabylonQuality;
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
function createScene(B:any, canvas: HTMLCanvasElement, geometry: Track2DGeometry, quality: RaceBabylonQuality) {
  const engine = new B.Engine(canvas, true, {preserveDrawingBuffer:false, stencil:false});
  engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / (
    quality === 'baixo' ? .75 : quality === 'medio' ? 1 : quality === 'alto' ? 1.5 : 2
  )));
  const scene = new B.Scene(engine);
  scene.useRightHandedSystem = true; // glTF meshes, track coordinates and renderer use the same axes.
  const hemi = new B.HemisphericLight('ambient', new B.Vector3(0,1,0), scene); hemi.intensity = .83;
  const sun = new B.DirectionalLight('sun', new B.Vector3(-.6,-1,.4), scene); sun.intensity = .9;
  const material = (name:string,hex:string) => {
    const m = new B.StandardMaterial(name,scene);
    m.diffuseColor = B.Color3.FromHexString(hex); m.specularColor = new B.Color3(.18,.2,.23);
    return m;
  };
  const grass=material('grass','#235338'), asphalt=material('track','#343c41'), white=material('white','#dde5df'),
    red=material('red','#cb343e'), garage=material('garage','#718e99'), roof=material('roof','#293a48'), rubber=material('rubber','#11171c');
  const bounds = trackBounds(geometry, 30);
  const ground = B.MeshBuilder.CreateGround('ground', {width:Math.max(120,bounds.w*.2),height:Math.max(92,bounds.h*.2)},scene);
  ground.material=grass;
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
  scene.clearColor=new B.Color4(.45,.64,.76,1);
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
  return {engine,scene,cam,bounds,material,rubber,fallbackTrack,scenery,
    safetyRoot,beacon,models:new Map<string,{root:any;wheels:any[];crew:any;effects:{smoke:any;dust:any;sparks:any[]};quality?:string}>(),
    teamAssets:new Map<string,Promise<any>>(),quality};
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
  }catch(error){console.warn('Circuito GLB indisponível, usando malha procedural:',id,error);}
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
  for(const x of [-1.24,1.24])for(const z of [-.79,1.0]){
    const torso=B.MeshBuilder.CreateCylinder('pit-mechanic',{diameter:.32,height:.53,tessellation:8},scene);
    torso.parent=crew;torso.position.set(x,.48,z);torso.material=suit;
    const helmet=B.MeshBuilder.CreateSphere('pit-helmet',{diameter:.32,segments:8},scene);
    helmet.parent=crew;helmet.position.set(x,.86,z);helmet.material=rt.material('pit-helmet-'+id,'#f6ca59');
  }
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
  rt.models.set(id,{root,wheels,crew,effects:{smoke,dust,sparks},quality});
  void loadTeamContainer(rt,B,teamId,quality).then((container:any)=>{
    if(rt.scene.isDisposed||rt.models.get(id)?.root!==root)return;
    const instance=container.instantiateModelsToScene((name:string)=>id+'-'+name, false);
    for(const node of instance.rootNodes)node.parent=root;
    // All instances are attached to the same simulation-driven root.
    for(const mesh of root.getChildMeshes()){
      if(mesh.name.startsWith('body')||mesh.name==='nose'||mesh.name==='front-wing'||mesh.name==='rear-wing'||mesh.name==='cockpit'||mesh.name==='halo'||mesh.name==='helmet'||mesh.name==='tyre')continue;
      mesh.metadata={...(mesh.metadata||{}),driverId:id};
    }
    const animatedWheels=root.getChildMeshes().filter((mesh:any)=>/Wheel_|Rim_|Hub_|Lock_/.test(mesh.name));
    for(const wheel of wheels)wheel.dispose();
    // Primitive fallback meshes are no longer needed once the GLB is visible.
    for(const mesh of [...root.getChildMeshes()]){
      if(mesh.name.startsWith('body')||['nose','front-wing','rear-wing','cockpit','halo','helmet'].includes(mesh.name))mesh.dispose();
    }
    const current=rt.models.get(id);
    if(current)current.wheels=animatedWheels;
  }).catch((error:any)=>console.warn('Modelo GLB indisponível, usando carro procedural:',teamId,error));
}
export default function LiveRaceBabylon(props:LiveRaceBabylonProps){
  const canvas=useRef<HTMLCanvasElement>(null), latest=useRef(props), onFailure=useRef(props.onFailure), onSelect=useRef(props.onSelect);
  const [ready,setReady]=useState(false),[fps,setFps]=useState(0);
  const duelVisible=props.camera==='duelo' && !!battleFocus(props.cars,props.battleIds);
  latest.current=props;onFailure.current=props.onFailure;onSelect.current=props.onSelect;
  useEffect(()=>{
    let cancelled=false;
    let rt: ReturnType<typeof createScene> | undefined;
    let resizeObserver:ResizeObserver|undefined;
    async function begin(){
      try {
        const B=await importBabylon();
        if(cancelled||!canvas.current) return;
        rt=createScene(B,canvas.current,props.geometry,latest.current.quality);
        const current=rt;
        if(cancelled){current.scene.dispose();current.engine.dispose();return;}
        void loadCircuitModel(current,B,props.geometry.circuitId,latest.current.rotated);
        let appliedQuality: RaceBabylonQuality = latest.current.quality;
        if(typeof ResizeObserver!=='undefined'){
          resizeObserver=new ResizeObserver(()=>current.engine.resize());
          resizeObserver.observe(canvas.current);
        }
        current.scene.onPointerObservable.add((event:any)=>{
          if(event.type!==B.PointerEventTypes.POINTERPICK)return;
          const id=event.pickInfo?.pickedMesh?.metadata?.driverId;
          if(typeof id==='string')onSelect.current(id);
        });
        let frame=0,from=performance.now(),prev=from;
        current.engine.runRenderLoop(()=>{
          if(cancelled || !rt)return;
          const p=latest.current,now=performance.now(),dt=Math.min(.06,Math.max(0,(now-prev)/1000));prev=now;
          if (p.quality !== appliedQuality) {
            appliedQuality = p.quality;
            const dpr = window.devicePixelRatio || 1;
            const targetRatio = appliedQuality === 'baixo' ? .75 : appliedQuality === 'medio' ? 1 : appliedQuality === 'alto' ? 1.5 : 2;
            current.engine.setHardwareScalingLevel(Math.max(1,dpr / targetRatio));
            current.engine.resize();
          }
          if(current.quality!==p.quality){
            current.quality=p.quality;
            current.engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/(p.quality==='baixo'?1:p.quality==='medio'?1.35:p.quality==='alto'?1.7:2)));
            current.engine.resize();
          }
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
            model.root.position.x+=(pos.x-model.root.position.x)*smoothing;
            model.root.position.z+=(pos.z-model.root.position.z)*smoothing;
            const diff=incidentYawDelta(model.root.rotation.y,yaw,car.incident?.kind==='SPIN');
            model.root.rotation.y+=diff*smoothing;
            model.root.setEnabled(car.car.status==='RUNNING' || car.pitStage!=='TRACK' || !!car.incident);
            model.crew.setEnabled(pitCrewVisible(car.pitStage));
            if(pitCrewVisible(car.pitStage) && !p.reduced && !p.paused)model.crew.position.y=.035*Math.sin(now/180);
            model.effects.smoke.setEnabled(!!car.incident?.smoke);
            model.effects.dust.setEnabled(!!car.incident?.dust);
            for(const spark of model.effects.sparks)spark.setEnabled(!!car.incident?.sparks);
            if(!p.reduced&&!p.paused){
              if(car.incident?.smoke){model.effects.smoke.position.y=1.18+.22*Math.sin(now/260);model.effects.smoke.scaling.setAll(.85+.18*Math.sin(now/310));}
              if(car.incident?.dust)model.effects.dust.scaling.setAll(.9+.2*Math.sin(now/170));
              if(car.incident?.sparks)for(let i=0;i<model.effects.sparks.length;i++)model.effects.sparks[i].scaling.z=.7+.5*Math.sin(now/80+i);
            }
            model.root.scaling.setAll(car.car.status==='RUNNING'?1:.89);
            if(!p.paused&&!p.reduced)for(const wheel of model.wheels)wheel.rotation.x+=dt*13;
          }
          for(const [id,model] of current.models)if(!positions.has(id)){
            model.root.getChildMeshes().forEach((mesh:any)=>mesh.dispose());model.root.dispose();current.models.delete(id);
          }
          const safety=safetyCarPose(p.control,p.cars,p.geometry.at);
          current.safetyRoot.setEnabled(!!safety);
          if(safety){
            const pos=xy(safety.point,current.bounds);
            current.safetyRoot.position.set(pos.x,.12,pos.z);
            current.safetyRoot.rotation.y=Math.PI/2-safety.angle;
            current.beacon.scaling.setAll(p.reduced||p.paused?1:.8+.35*Math.sin(now/130));
          }
          const fight=p.camera==='duelo'?battleFocus(p.cars,p.battleIds):null;
          const focus=p.cars.find(car=>car.id===p.selected) || p.cars.find(car=>p.own.includes(car.id)) || p.cars[0];
          if(focus){
            const pos=xy(fight ?? focus.point,current.bounds),ang=(fight?.angle ?? focus.angle)*Math.PI/180,dx=Math.cos(ang),dz=Math.sin(ang);
            let desired:any,target:any;
            if(p.camera==='aerea'){desired=new B.Vector3(0,78,-.01);target=new B.Vector3(0,0,0)}
            else if(p.camera==='onboard'){
              desired=new B.Vector3(pos.x-dx*.28,1.3,pos.z-dz*.28);
              target=new B.Vector3(pos.x+dx*14,.8,pos.z+dz*14);
            }else{
              const compact=(canvas.current?.clientWidth ?? window.innerWidth)<600;
              const shot=tvCameraOffset(compact);
              const duel=!!fight;
              desired=new B.Vector3(pos.x-dx*shot.back-dz*shot.side*(duel?1.2:1),shot.height*(duel?1.3:1),pos.z-dz*shot.back+dx*shot.side*(duel?1.2:1));
              const ahead=duel?battleCameraLookAhead(compact):shot.lookAhead;
              target=new B.Vector3(pos.x+dx*ahead,.65,pos.z+dz*ahead);
            }
            const lerp=p.reduced?1:(p.camera==='onboard'?.28:.09);
            current.cam.position=B.Vector3.Lerp(current.cam.position,desired,lerp);
            current.cam.setTarget(target);
          }
          for(const mesh of current.scenery){
            const distance=B.Vector3.Distance(current.cam.position,mesh.getBoundingInfo().boundingBox.centerWorld);
            mesh.visibility=sceneryVisibility(distance,p.camera,mesh.name);
          }
          current.scene.clearColor=p.wet?new B.Color4(.19,.27,.33,1):new B.Color4(.45,.64,.76,1);
          current.scene.fogMode=p.wet&&p.quality!=='baixo'?B.Scene.FOGMODE_EXP2:B.Scene.FOGMODE_NONE;
          current.scene.fogDensity=p.wet?.012:0;
          current.scene.fogColor=new B.Color3(.25,.33,.39);
          current.scene.render();
          frame++;if(now-from>1200){setFps(Math.round(1000*frame/(now-from)));frame=0;from=now;}
        });
        setReady(true);
      } catch(error){
        if(rt){try {rt.engine.stopRenderLoop();rt.scene.dispose();rt.engine.dispose();} catch {}}
        if(!cancelled)onFailure.current(error instanceof Error?error.message:String(error));
      }
    }
    void begin();
    return()=>{cancelled=true;resizeObserver?.disconnect();if(rt){rt.engine.stopRenderLoop();rt.scene.dispose();rt.engine.dispose();}};
  },[props.geometry]);
  return <div className="race-babylon" data-testid="race-babylon-webgl">
    <canvas ref={canvas} aria-label="Corrida real em Babylon.js WebGL" />
    {!ready && <div className="race-babylon-loading" role="status">Iniciando Babylon.js 3D…</div>}
    {ready && <div className="race-babylon-caption" aria-live="off">BABYLON.JS · 3D WEBGL · {duelVisible ? 'DISPUTA EM FOCO · ' : props.camera==='duelo' ? 'AGUARDANDO DISPUTA · ' : ''}{fps} FPS</div>}
  </div>;
}
