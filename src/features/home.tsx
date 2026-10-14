'use client';
import { GameModes } from './new-game';
import { PersonPortrait } from '../components/person-portrait';
import { UniverseLinks } from './universe';
import { useUniverse } from '../components/save-provider';
import { CountryFlag } from '../components/country-flag';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CloudSun,
  Flag,
  MapPin,
  ChevronRight,
  Timer,
  Zap,
} from 'lucide-react';
import { useSave } from '../components/save-provider';
import {
  PageTitle,
  SectionHead,
  ChampionshipTable,
  PowerRankingCard,
  Badge,
} from '../components/ui';
import { CarIllustration, CircuitMap } from '../components/visuals';

import { news } from '../data/editorial';

import { completedRaces } from '../domain/selectors';
import type { Circuit } from '../domain/types';
export function CircuitCard({ circuit, compact = false }: { circuit: Circuit; compact?: boolean }) {
  return (
    <Link
      className={`panel circuit-card ${compact ? 'compact-circuit' : ''}`}
      href="/fim-de-semana"
    >
      <div className="flex-between">
        <Badge tone="red-tag">ROUND {String(circuit.round).padStart(2, '0')}</Badge>
        <span className="flag-emoji">
          <CountryFlag value={circuit.flag} />
        </span>
      </div>
      <h3>GP {circuit.country === 'Austrália' ? 'da Austrália' : `• ${circuit.country}`}</h3>
      <p>
        <MapPin size={13} />
        {circuit.name} · {circuit.city}
      </p>
      <CircuitMap />
      <div className="circuit-meta">
        <span>
          <strong>{circuit.km.toFixed(3)}</strong>
          <small>KM / VOLTA</small>
        </span>
        <span>
          <strong>{circuit.laps}</strong>
          <small>VOLTAS</small>
        </span>
        <span>
          <strong>{circuit.corners}</strong>
          <small>CURVAS</small>
        </span>
      </div>
    </Link>
  );
}
export function WeekendCard({ circuit }: { circuit: Circuit }) {
  const { save } = useSave();
  const completed = Object.keys(
    save.weekends.find((w) => w.round === save.round)?.results ?? {},
  ).length;
  const days = [3, 3, 3, 2, 2, 1, 1, 0, 0][completed];
  return (
    <section className="next-race panel">
      <div className="flex-between">
        <span className="eyebrow">
          <span className="status-dot" /> {save.round > save.game.circuits.length ? 'ÚLTIMA PARADA' : 'PRÓXIMA PARADA'}
        </span>
        <span className="eyebrow muted">R{String(circuit.round).padStart(2, '0')} / {save.game.circuits.length}</span>
      </div>
      <div className="next-race-title">
        <div>
          <h2>{circuit.country.toUpperCase()}</h2>
          <p>
            {circuit.name} <span className="dot">·</span> {circuit.city}
          </p>
        </div>
        <span className="flag-emoji">
          <CountryFlag value={circuit.flag} />
        </span>
      </div>
      <CircuitMap />
      <div className="race-weather">
        <span>
          <CloudSun size={20} />
          <strong>{circuit.temperature}°C</strong>
          <small>Parcialmente nublado</small>
        </span>
        <span>
          {circuit.rain}% <small>chuva</small>
        </span>
      </div>
      <div className="race-schedule">
        <div>
          <CalendarText date={circuit.date} />
          <small>14:00 UTC · Agenda do universo</small>
        </div>
        <Link className="square-button" href="/fim-de-semana" aria-label="Abrir fim de semana">
          <ArrowUpRight size={22} />
        </Link>
      </div>
      <div className="countdown-row">
        <span className="countdown">
          {save.round > save.game.circuits.length
            ? 'TEMPORADA ENCERRADA'
            : completed === 8
              ? 'GP CONCLUÍDO'
              : `D−${String(days).padStart(2, '0')}`}
        </span>
        <span className="micro">RELÓGIO DO SAVE · CLIMA SIMULADO</span>
      </div>
    </section>
  );
}
function CalendarText({ date }: { date: string }) {
  return (
    <strong>
      {new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        timeZone: 'UTC',
      })}{' '}
      <span className="muted">{new Date(date).getUTCFullYear()}</span>
    </strong>
  );
}
export function NewsCard({
  item,
  featured = false,
}: {
  item: (typeof news)[number];
  featured?: boolean;
}) {
  const { news } = useUniverse();
  return (
    <Link
      href={item.href}
      className={`news-card ${featured ? 'featured' : ''}`}
      style={{ '--story': item.color } as React.CSSProperties}
    >
      <div className="news-art">
        <div className="news-stripes" />
        <span>
          {item.id === 'verstappen'
            ? '03'
            : item.id === 'antonelli'
              ? '12'
              : item.id === 'norris'
                ? '01'
                : '29'}
        </span>
        {item.href.startsWith('/pilotos/') ? (
          <PersonPortrait personId={item.href.split('/')[2]} name={item.title} size={150} />
        ) : (
          <CarIllustration color={item.color} />
        )}
        <Badge>{item.category.split(' • ')[0]}</Badge>
      </div>
      <div className="news-copy">
        <span className="eyebrow" style={{ color: item.color }}>
          {item.category}
        </span>
        <h3>{item.title}</h3>
        <p>{item.lead}</p>
        <span className="text-link">
          Explorar história <ArrowUpRight size={14} />
        </span>
      </div>
    </Link>
  );
}
export default function Home() {
  const { driverById, teams, circuits, powerRankings, news, recentChampions } = useUniverse();
  const { save } = useSave();
  const races = completedRaces(save);
  const circuit = circuits[Math.min(save.round, circuits.length) - 1];
  return (
    <>
      <GameModes />
      <UniverseLinks />
      <PageTitle
        eyebrow={'SEASON CONTROL / 2029'.replaceAll('2029', String(save.season))}
        title="Central da temporada"
        subtitle="Um novo regulamento. Novas rivalidades. A mesma obsessão por vencer."
        action={
          <Link className="button primary" href="/fim-de-semana">
            Ir para o fim de semana <ArrowRight size={17} />
          </Link>
        }
      />
      {save.career.started && <div className="home-career-jump">
        <div><strong>Seu paddock, suas decisões</strong><span>Acompanhe contratos, pesquisa, pilotos e alertas reais da temporada.</span></div>
        <Link className="button secondary" href="/temporada">Abrir central estratégica →</Link>
      </div>}
      <div className="home-hero-grid">
        <section className="hero-billboard">
          <div className="hero-grid-lines" />
          <div className="hero-giant-year">{save.season}</div>
          <div className="hero-copy">
            <div className="hero-label">
              <span className="red-dash" /> BEM-VINDO À NOVA ERA
            </div>
            <h2>
              O FUTURO
              <br />
              NÃO ESPERA<span>.</span>
            </h2>
            <p>
              Mais potência. Menos limites.
              <br />O maior grid da história está pronto.
            </p>
            <Link href="/regulamento" className="hero-link">
              Conheça a revolução de 2029 <ArrowUpRight size={17} />
            </Link>
          </div>
          <CarIllustration color="#ed5947" number="29" />
          <div className="hero-bottom">
            <span>
              <strong>16</strong> EQUIPES
            </span>
            <span>
              <strong>32</strong> PILOTOS
            </span>
            <span>
              <strong>{circuits.length}</strong> GRANDES PRÊMIOS
            </span>
            <span className="hero-v8">
              <Zap size={16} /> V8 HYBRID
            </span>
          </div>
        </section>
        <WeekendCard circuit={circuit} />
      </div>
      <div className="season-strip">
        <div>
          <span className="status-dot" />
          <strong>
            {races === 0
              ? 'PRÉ-TEMPORADA ' + save.season
              : `TEMPORADA ${save.season} · ${races} GPs CONCLUÍDOS`}
          </strong>
          <span>
            {races === 0
              ? 'O próximo capítulo ainda está por ser escrito.'
              : 'Cada ponto conta uma nova história.'}
          </span>
        </div>
        <Link href="/temporada">
          Visão da temporada <ChevronRight size={15} />
        </Link>
      </div>
      <div className="home-standings">
        <section className="panel">
          <SectionHead
            title="Campeonato de pilotos"
            sub="WORLD DRIVERS’ CHAMPIONSHIP"
            href="/classificacao"
          />
          <ChampionshipTable limit={5} />
        </section>
        <section className="panel">
          <SectionHead
            title="Campeonato de construtores"
            sub="WORLD CONSTRUCTORS’ CHAMPIONSHIP"
            href="/classificacao"
          />
          <ChampionshipTable type="teams" limit={5} />
        </section>
      </div>
      <SectionHead
        title="Dentro do paddock"
        sub="HISTÓRIAS QUE MOVEM O GRID"
        href="/temporada"
        label="Todas as histórias"
      />
      <div className="home-news">
        {news.slice(1, 4).map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
      <div className="home-lower">
        <section className="panel">
          <SectionHead
            title="Quem chega mais forte?"
            sub="POWER RANKINGS • PROJEÇÃO"
            href="/estatisticas"
          />
          <div className="ranking-list">
            {powerRankings.slice(0, 4).map((t, i) => (
              <PowerRankingCard key={t.id} team={t} index={i} />
            ))}
          </div>
          <p className="table-note">
            Projeção editorial. Não representa a classificação do campeonato.
          </p>
        </section>
        <section className="panel champions">
          <SectionHead title="O legado. O próximo capítulo." sub="CAMPEÕES RECENTES DO UNIVERSO" />
          <div className="champion-list">
            {recentChampions.map((c) => (
              <div className="champion" key={c.year}>
                <span className="champion-year">{c.year}</span>
                <div>
                  <strong>{c.driver}</strong>
                  <small>
                    <i style={{ background: c.color }} />
                    {c.team}
                  </small>
                </div>
                <TrophyMark />
              </div>
            ))}
            <Link href="/regulamento" className="champion new-era">
              <span className="champion-year">2029</span>
              <div>
                <strong>NOVA ERA</strong>
                <small>A história começa aqui.</small>
              </div>
              <ArrowUpRight size={21} />
            </Link>
          </div>
        </section>
      </div>
      <div className="home-facts">
        <span>
          <Flag size={16} /> {races} / {circuits.length} GPs concluídos
        </span>
        <span>
          <Timer size={16} /> Último vencedor no save:{' '}
          {races
            ? driverById[save.weekends.filter((w) => w.results.GP).at(-1)!.results.GP![0].driverId]
                .name
            : 'sem histórico informado'}
        </span>
        <span>UNIVERSO FICTÍCIO • SAVE DEMONSTRATIVO</span>
      </div>
    </>
  );
}
function TrophyMark() {
  return (
    <svg width="22" height="25" viewBox="0 0 22 25" fill="none" aria-hidden="true">
      <path
        d="M6 3H16V10C16 16 6 16 6 10V3ZM6 5H2V9C2 12 5 13 7 12M16 5H20V9C20 12 17 13 15 12M11 15V21M6 23H16"
        stroke="#7d8794"
        strokeWidth="1.5"
      />
    </svg>
  );
}
