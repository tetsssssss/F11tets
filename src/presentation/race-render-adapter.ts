/** F1 Universe presentation boundary: NEVER writes to career or race state. */
import type { Driver } from '../domain/types';
import type { Track2DGeometry } from './circuit-geometry';
import type { ReturnTypePresentRace } from './race-render-types';
export type RenderCar = { id:string; name:string; code:string; color:string; x:number; y:number; angle:number; position:number; running:boolean; pit:boolean };
export type FeederCar = {id:string;name:string;short:string;rating?:number};
/** Read-only projection of authoritative RaceEngine presentation data. */
export function renderFrameFromRace(cars:ReturnTypePresentRace, drivers:Driver[], color:(driver:Driver,index:number)=>string):RenderCar[] {
  const byId=new Map(drivers.map(driver=>[driver.id,driver]));
  return cars.flatMap(car=>{ const driver=byId.get(car.id);if(!driver)return [];
    return [{id:car.id,name:driver.name,code:driver.short,color:color(driver,car.position-1),x:car.point.x,y:car.point.y,angle:car.angle,position:car.position,running:car.car.status==='RUNNING',pit:car.pitStage!=='TRACK'}];
  });
}
/** Feeder demo only: roster is authentic, movement NOT an official result. */
export function renderFrameFromFeeder(drivers:readonly FeederCar[],geo:Pick<Track2DGeometry,'at'>,time:number,lapDuration:number,palette:readonly string[]):RenderCar[]{
  return drivers.map((driver,index)=>{const progress=((index*.018)+((time*(((driver.rating||70)/100)*.009+.12)+index*.23)/lapDuration))%1;
  const pt=geo.at(progress),next=geo.at(progress+.0004);
  return {id:driver.id,name:driver.name,code:driver.short,color:palette[index%palette.length],x:pt.x,y:pt.y,angle:Math.atan2(next.y-pt.y,next.x-pt.x)*180/Math.PI,position:index+1,running:true,pit:false};
  });
}
/** Smooth display points; rankings/events remain exclusively from engine snapshots. */
export function interpolateCars(previous:readonly RenderCar[],current:readonly RenderCar[],factor:number):RenderCar[]{
  const old=new Map(previous.map(c=>[c.id,c]));const alpha=Math.max(0,Math.min(1,factor));
  return current.map(c=>{const p=old.get(c.id);if(!p)return c;
    const delta=((c.angle-p.angle+540)%360)-180;
    return {...c,x:p.x+(c.x-p.x)*alpha,y:p.y+(c.y-p.y)*alpha,angle:p.angle+delta*alpha};
  });
}
