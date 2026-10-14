'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSave, useUniverse } from '../components/save-provider';
import { PersonPortrait } from '../components/person-portrait';
import { PageTitle,SectionHead } from '../components/ui';
import { assessSeat, eligibleReplacements, replaceDriverSeat, seatChangeWindow } from '../domain/universe/driver-seats';
import { canManage } from '../domain/universe/market';

export default function DriverSeatsPage(){
  const {save,update,notify}=useSave();
  const {teamById}=useUniverse();
  const [selection,setSelection]=useState<Record<string,string>>({});
  const rank=(danger:string|undefined)=>danger==='critical'?0:danger==='watch'?1:2;
  const assessments=save.game.drivers.map((d)=>({d,review:assessSeat(save,d.id)}))
    .sort((a,b)=>rank(a.review?.danger)-rank(b.review?.danger)||a.d.name.localeCompare(b.d.name));
  const actionable=canManage(save)&&seatChangeWindow(save);
  return <section className="f2-universe" aria-label="Gestão de assentos da F1">
    <PageTitle eyebrow={`MERCADO DE ASSENTOS · ${save.season}`} title="Ninguém tem lugar garantido."
      subtitle="Avaliação comparativa de desempenho, negociação com reservas aptos e substituições entre fins de semana." />
    <div className="f2-banner panel padded"><div><span className="eyebrow">AUDITORIA ESPORTIVA</span><h2>O paddock observa cada resultado.</h2>
      <p>Risco calculado dos últimos cinco GPs disputados por ambos os pilotos de cada equipe. A IA revisa vagas em intervalos controlados após a oitava corrida. A substituição não apaga pontos antigos.</p>
      <div className="f2-actions"><Link className="button secondary" href="/f2">Talentos F2 →</Link><Link className="button secondary" href="/f3">Talentos F3 →</Link>
        <Link className="button secondary" href="/silly-season">Contratos →</Link></div>
    </div><div className="f2-headline-stats"><div><b>{assessments.filter((x)=>x.review?.danger==='critical').length}</b><span>RISCO ALTO</span></div>
      <div><b>{save.world.transfers.filter((t)=>t.season===save.season&&t.kind==='driver').length}</b><span>TROCAS NESTE ANO</span></div></div></div>
    <div className="f2-layout"><section className="panel padded"><SectionHead title="Assentos em avaliação" sub="APENAS CORRIDAS CONCLUÍDAS" />
      <div className="f2-standing" role="list">{assessments.map(({d,review})=>{
        const reserves=eligibleReplacements(save,d.teamId);
        const replacement=reserves.find((r)=>r.id===selection[d.id])??reserves[0];
        const own=d.teamId===save.managedTeam;
        return <article key={d.id} className={`f2-driver seat-card seat-${review?.danger??'safe'}`} role="listitem" style={{'--accent':teamById[d.teamId]?.color??'#789'} as React.CSSProperties}>
          <PersonPortrait personId={d.id} name={d.name} size={58}/><div className="f2-driver-info"><strong>{d.name}</strong>
          <small>{teamById[d.teamId]?.name} · {review?.starts??0} GPs comparáveis · {review?.lastFive??0} pts recentes</small>
          <small>{review?.danger==='critical'?'RISCO ALTO':review?.danger==='watch'?'EM OBSERVAÇÃO':'SITUAÇÃO ESTÁVEL'}{review?.reasons.length?` · ${review.reasons.join('; ')}`:''}</small>
          {own&&save.career.mode==='constructor'&&<div className="f2-actions"><select aria-label={`Reserva para ${d.name}`}
            value={replacement?.id??''} onChange={(e)=>setSelection((old)=>({...old,[d.id]:e.target.value}))}>
              {reserves.length===0&&<option value="">Sem reserva apto</option>}
              {reserves.map((r)=><option key={r.id} value={r.id}>{r.name} · GER {r.rating}</option>)}
            </select><button type="button" className="button secondary" disabled={!actionable||!replacement}
              onClick={()=>{
                if(!replacement)return;
                const next=replaceDriverSeat(save,d.id,replacement.id);
                if(next===save){notify('Troca não permitida agora: revise o calendário, licença e orçamento.');return;}
                update(()=>next);notify(`${replacement.name} assume a vaga de ${d.name}. Histórico preservado.`);
              }}>Substituir titular</button></div>}
          </div></article>;
      })}</div></section><aside className="f2-side"><section className="panel padded"><SectionHead title="Transferências da temporada" sub="EVENTOS REAIS DO SAVE" />
        {save.world.transfers.filter((t)=>t.season===save.season&&t.kind==='driver').length
          ?save.world.transfers.filter((t)=>t.season===save.season&&t.kind==='driver').slice().reverse().map((t)=><p key={t.id}>
            <b>GP {t.round}</b> · {t.personId} · {t.detail}</p>)
          :<p>Nenhuma contratação definitiva registrada nesta temporada.</p>}
        <p>Trocas por lesão e participações de novatos no TL1 são temporárias e seguem regras próprias.</p>
        {!actionable&&<p>Decisões de gestão disponíveis para carreira de construtor com CEO empregado, entre fins de semana.</p>}</section></aside></div>
  </section>;
}
