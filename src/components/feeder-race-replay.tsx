'use client';
import { useEffect, useMemo, useState } from 'react';
import type { FeederEvent } from '../domain/universe/formula-two';
import { feederReplay } from '../presentation/feeder-replay';
import { PersonPortrait } from './person-portrait';

type Props={
  event:FeederEvent;
  session:'sprint'|'feature';
  seed:number;
  season:number;
  category:'F2'|'F3';
  names:Record<string,string>;
  reducedMotion:boolean;
};
export function FeederRaceReplay(props:Props){
  const {event,session,seed,season,category,names,reducedMotion}=props;
  const frames=useMemo(()=>feederReplay(event,session,seed,season,category),[event,session,seed,season,category]);
  const [lap,setLap]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [focused,setFocused]=useState<string|null>(null);
  const [systemReduced,setSystemReduced]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReduced(media.matches);
    const onChange=(event:MediaQueryListEvent)=>setSystemReduced(event.matches);
    media.addEventListener('change',onChange);
    return ()=>media.removeEventListener('change',onChange);
  },[]);
  const noAutoMotion=reducedMotion||systemReduced;
  const frame=frames[Math.min(lap,frames.length-1)];
  useEffect(()=>{
    if(!playing||noAutoMotion||!frames.length)return;
    const timer=window.setInterval(()=>{
      if(document.hidden)return;
      setLap((current)=>{
        if(current+1>=frames.length){setPlaying(false);return frames.length-1;}
        return current+1;
      });
    },1100);
    return ()=>window.clearInterval(timer);
  },[playing,noAutoMotion,frames.length]);
  if(!frame)return null;
  const focusId=frame.running.some((r)=>r.driverId===focused)?focused:null;
  const visible=frame.running.slice(0,12);
  const feed=frame.changes.slice(0,3);
  return <section className="feeder-replay panel padded" aria-label={`Reconstituição visual da ${category}`}>
    <div className="feeder-replay-head">
      <div><span className="eyebrow">REPLAY ILUSTRATIVO · {category}</span>
        <h3>{event.circuitName} · {session==='sprint'?'Sprint':'Corrida principal'}</h3>
        <p>Posições entre a largada e a bandeirada reconstruídas. Não representam telemetria real volta a volta.</p>
      </div>
      <div className="feeder-replay-counter" aria-live="polite"><b>{lap===0?'GRID':lap===frame.totalLaps?'FIM':`V${lap}`}</b><small>{frame.totalLaps} voltas ilustrativas</small></div>
    </div>
    <div className="feeder-replay-controls">
      <button type="button" className="button secondary" onClick={()=>{setPlaying(false);setLap(0);}}>Reiniciar</button>
      <button type="button" className="button secondary" disabled={lap===0} onClick={()=>{setPlaying(false);setLap((n)=>n-1);}}>Volta anterior</button>
      <button type="button" className="button secondary" disabled={lap>=frame.totalLaps} onClick={()=>{setPlaying(false);setLap((n)=>n+1);}}>Próxima volta</button>
      <button type="button" className="button secondary" disabled={noAutoMotion||lap>=frame.totalLaps} aria-pressed={playing}
        onClick={()=>setPlaying((p)=>!p)}>{playing?'Pausar':noAutoMotion?'Auto desativado':'Reproduzir'}</button>
      <label className="feeder-replay-slider">Ir para volta
        <input aria-label="Volta da reconstrução" type="range" min="0" max={frame.totalLaps} value={lap}
          onChange={(e)=>{setPlaying(false);setLap(Number(e.target.value));}}/>
      </label>
    </div>
    <div className="feeder-replay-grid" role="list" aria-label="Ordem reconstruída dos doze primeiros">
      {visible.map((entry)=>
        <button type="button" role="listitem" key={entry.driverId} className={`feeder-replay-driver ${focused===entry.driverId?'focused':''}`}
          onClick={()=>setFocused(entry.driverId===focused?null:entry.driverId)} aria-pressed={focused===entry.driverId}>
          <b className="feeder-replay-position">{entry.position}</b>
          <PersonPortrait personId={entry.driverId} name={names[entry.driverId]??entry.driverId} fictional size={35}/>
          <span className="feeder-replay-name">{names[entry.driverId]??entry.driverId}<small>Grid P{entry.grid}</small></span>
          <span className={`feeder-replay-delta ${entry.moved>0?'up':entry.moved<0?'down':''}`}>{entry.moved>0?`↑${entry.moved}`:entry.moved<0?`↓${-entry.moved}`:'•'}</span>
        </button>)}
    </div>
    {frame.retired.length>0&&<div className="feeder-replay-retired">Abandonos: {frame.retired.map((r)=>names[r.driverId]??r.driverId).join(' · ')}</div>}
    {focusId&&<p className="feeder-replay-focus">Acompanhando {names[focusId]??focusId}: P{frame.running.find((r)=>r.driverId===focusId)?.position}</p>}
    <div className="feeder-replay-feed" aria-live="polite">{feed.length?feed.map((line,i)=><small key={`${lap}-${i}`}>{line.replace(/junior-\d{4}-\d+/g,(id)=>names[id]??id)}</small>):<small>Sem mudança relevante nesta passagem.</small>}</div>
    <p className="feeder-replay-note">O resultado oficial desta etapa é exclusivamente a classificação do campeonato. Esta animação não altera o save, não calcula tempos nem registra ultrapassagens reais.</p>
  </section>;
}
