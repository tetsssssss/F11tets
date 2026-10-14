'use client';
import { useUniverse } from '../components/save-provider';
import { ContractMarket, SupplierContracts, ActiveContracts } from './career';
import { startProject, projectCatalog } from '../domain/simulation/management';
import { useState } from 'react';
import { ArrowUpRight, FlaskConical, Cpu, Check, BatteryCharging, CircleDot } from 'lucide-react';
import { PageTitle, SectionHead, Badge, Tabs, RatingBar, ProjectionNote } from '../components/ui';
import { useSave } from '../components/save-provider';
import { developmentProjects } from '../data/editorial';
import { compounds } from '../data/suppliers';

export function DevelopmentProjectCard({
  project: p,
}: {
  project: (typeof developmentProjects)[number];
}) {
  const { teamById } = useUniverse();
  const { save, update, notify, ready } = useSave();
  const project = save.game.development.findLast(
    (x) => x.teamId === save.managedTeam && x.projectId === p.id,
  );
  const active = !!project;
  const progress = project?.progress ?? 0;
  const affordable = save.game.finances[save.managedTeam].cash >= p.cost;
  return (
    <article className={`panel development-card ${active ? 'active' : ''}`}>
      <div className="flex-between">
        <span className="part-icon">
          <FlaskConical size={22} />
        </span>
        <Badge tone={progress >= 100 ? 'green-tag' : active ? 'amber-tag' : ''}>
          {progress >= 100 ? 'CONCLUÍDO' : active ? 'EM DESENVOLVIMENTO' : 'CONCEITO'}
        </Badge>
      </div>
      <span className="eyebrow">{p.part.toUpperCase()} / CONCEPT PROGRAM</span>
      <h3>{p.name}</h3>
      <div className="development-progress">
        <div className="meter">
          <i style={{ width: `${progress}%` }} />
        </div>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <div className="project-data">
        <div>
          <small>INVESTIMENTO</small>
          <strong>${p.cost.toFixed(1)}M</strong>
        </div>
        <div>
          <small>GANHO / VALIDADO NA ENTREGA</small>
          <strong className="green">
            {project?.actual != null ? (-project.actual).toFixed(3) : '−' + p.gain.toFixed(2)} s
          </strong>
        </div>
        <div>
          <small>CONFIANÇA</small>
          <strong>{p.confidence}%</strong>
        </div>
        <div>
          <small>RISCO</small>
          <strong>{p.risk}</strong>
        </div>
      </div>
      <div className="project-deadline">
        <span>Previsão de entrega</span>
        <strong>{project ? 'GP ' + project.due : 'Conforme ATR e engenharia'}</strong>
      </div>
      <button
        className={`button ${active ? 'secondary' : 'primary'} full`}
        disabled={
          active ||
          !affordable ||
          !ready ||
          save.career.mode === 'driver' ||
          save.race?.status === 'RUNNING'
        }
        onClick={() => {
          update((s) => startProject(s, p.id));
          notify(p.name + ' iniciado. Investimento debitado do caixa da equipe.');
        }}
      >
        {active ? (
          <>
            <Check size={15} />
            {progress >= 100 ? 'Projeto concluído' : 'Em desenvolvimento'}
          </>
        ) : affordable ? (
          <>
            Iniciar projeto <ArrowUpRight size={15} />
          </>
        ) : (
          'Verba insuficiente'
        )}
      </button>
    </article>
  );
}
export function DevelopmentPage() {
  const { teamById } = useUniverse();
  const { save } = useSave();
  const team = teamById[save.managedTeam];
  const spent = save.game.development
    .filter((p) => p.teamId === save.managedTeam)
    .reduce((s, p) => s + p.cost, 0);
  return (
    <>
      <PageTitle
        eyebrow={'RESEARCH & DEVELOPMENT / 2029'.replaceAll('2029', String(save.season))}
        title="O próximo décimo começa aqui."
        subtitle={`Laboratório de desenvolvimento · ${team.name}`}
      />
      <ProjectionNote>
        DESENVOLVIMENTO DA CARREIRA • O caixa financia projetos reais. A correlação só é revelada na
        entrega; o ganho altera as voltas seguintes.
      </ProjectionNote>
      <div className="season-metrics">
        <div>
          <small>ATR DA EQUIPE</small>
          <strong>
            {save.game.atr[team.id]}
            <span>%</span>
          </strong>
        </div>
        <div>
          <small>COMPROMETIDO</small>
          <strong>
            ${spent.toFixed(1)}
            <span>M</span>
          </strong>
        </div>
        <div>
          <small>DISPONÍVEL</small>
          <strong>
            ${save.game.finances[team.id].cash.toFixed(1)}
            <span>M</span>
          </strong>
        </div>
        <div>
          <small>PROJETOS ATIVOS</small>
          <strong>
            {
              save.game.development.filter((p) => p.teamId === team.id && p.status === 'active')
                .length
            }
            <span> / 8</span>
          </strong>
        </div>
      </div>
      <div className="development-grid">
        {projectCatalog.map((p) => (
          <DevelopmentProjectCard project={p} key={p.id} />
        ))}
      </div>
    </>
  );
}
export function SupplierCard({
  name,
  type,
  attributes,
  subtitle,
}: {
  name: string;
  type: 'engine' | 'battery';
  attributes: Record<string, number>;
  subtitle: string;
}) {
  return (
    <details className="panel supplier-card">
      <summary>
        <span className="supplier-icon">
          {type === 'engine' ? <Cpu size={24} /> : <BatteryCharging size={24} />}
        </span>
        <div>
          <span className="eyebrow">{type === 'engine' ? 'POWER UNIT' : 'ENERGY SYSTEM'}</span>
          <h3>{name}</h3>
          <small>{subtitle}</small>
        </div>
        <span className="supplier-expand">+</span>
      </summary>
      <div className="supplier-ratings">
        {Object.entries(attributes).map(([l, v]) => (
          <RatingBar key={l} label={l} value={v} />
        ))}
      </div>
    </details>
  );
}
export function MarketPage() {
  const { save } = useSave();
  const { engines, batteries, tires } = useUniverse();
  const [tab, setTab] = useState('engines');
  return (
    <>
      <PageTitle
        eyebrow={'SUPPLIER ECOSYSTEM / ' + save.season}
        title="A performance tem muitas origens."
        subtitle="Explore os projetos de motor, a nova geração de baterias e as filosofias de pneus."
      />
      <ProjectionNote>
        ECOSSISTEMA DA CARREIRA • Parâmetros ficcionais de performance. Talentos e fornecedores
        podem ser contratados abaixo.
      </ProjectionNote>
      <ContractMarket />
      <ActiveContracts />
      <SupplierContracts />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'engines', label: 'Motores · 16' },
          { id: 'batteries', label: 'Baterias · 5' },
          { id: 'tires', label: 'Pneus · 4' },
        ]}
      />
      {tab === 'engines' && (
        <>
          <section className="supplier-banner">
            <Cpu size={38} />
            <div>
              <span className="eyebrow">16 PROJETOS INDEPENDENTES</span>
              <h2>V8. Híbrido. Sem uma receita única.</h2>
              <p>Cada fabricante tem sua própria arquitetura de performance no universo.</p>
            </div>
          </section>
          <div className="card-grid">
            {engines.map((e) => (
              <SupplierCard
                key={e.id}
                name={e.name}
                type="engine"
                attributes={e.attributes}
                subtitle={e.architecture}
              />
            ))}
          </div>
        </>
      )}
      {tab === 'batteries' && (
        <>
          <section className="supplier-banner">
            <BatteryCharging size={38} />
            <div>
              <span className="eyebrow">MERCADO INDEPENDENTE DO MOTOR</span>
              <h2>Energia é estratégia.</h2>
              <p>
                Oito dimensões de performance. Vínculos com as equipes ainda podem estar a definir.
              </p>
            </div>
          </section>
          <div className="card-grid">
            {batteries.map((b) => (
              <SupplierCard
                key={b.id}
                name={b.name}
                type="battery"
                attributes={b.attributes}
                subtitle="Bateria de alta potência"
              />
            ))}
          </div>
        </>
      )}
      {tab === 'tires' && (
        <>
          <div className="compound-strip">
            {compounds.map((c) => (
              <div key={c.id}>
                <span className="tire large" style={{ color: c.color }}>
                  {c.id}
                </span>
                <strong>{c.name}</strong>
              </div>
            ))}
          </div>
          <div className="two-col">
            {tires.map((t) => (
              <section key={t.name} className="panel tire-supplier">
                <span className="eyebrow">FILOSOFIA DO COMPOSTO</span>
                <h2 style={{ color: t.color }}>{t.name}</h2>
                <p>{t.strength}</p>
                {['Aquecimento', 'Estabilidade', 'Durabilidade', 'Janela térmica'].map((l, i) => (
                  <RatingBar key={l} label={l} value={t.values[i]} color={t.color} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
