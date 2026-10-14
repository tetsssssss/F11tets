'use client';
import { useUniverse } from './save-provider';
import { CountryFlag } from './country-flag';
import { PersonPortrait } from './person-portrait';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, TrendingUp, TrendingDown, Minus, Radio } from 'lucide-react';
import type { Dynamic, Driver, Engineer, Ratings, Team } from '../domain/types';

import { driverStandings, teamStandings, teamPoints } from '../domain/selectors';
import { useSave } from './save-provider';
import { DriverPortrait, CarIllustration } from './visuals';
export const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <div className="eyebrow red">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
export function SectionHead({
  title,
  sub,
  href,
  label = 'Ver todos',
}: {
  title: string;
  sub?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-head">
      <div>
        {sub && <span className="eyebrow">{sub}</span>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {label}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function TrendIndicator({ value }: { value: number }) {
  return (
    <span className={`trend ${value > 0 ? 'up' : value < 0 ? 'down' : 'flat'}`}>
      {value > 0 ? (
        <TrendingUp size={13} />
      ) : value < 0 ? (
        <TrendingDown size={13} />
      ) : (
        <Minus size={13} />
      )}
      <span>
        {value > 0 ? '+' : ''}
        {Number(value.toFixed(1))}
      </span>
    </span>
  );
}
export function RatingBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rating-row">
      <div>
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
export function DynamicRating({ item }: { item: Dynamic }) {
  return (
    <div className="dynamic-row">
      <span>{item.label}</span>
      <strong>{Math.round(item.value)}</strong>
      <TrendIndicator value={item.trend} />
    </div>
  );
}
export function RatingGroups({
  groups,
  ratings,
  color,
}: {
  groups: Record<string, string[]>;
  ratings: Ratings;
  color?: string;
}) {
  return (
    <div className="attribute-groups">
      {Object.entries(groups).map(([name, labels], i) => (
        <details key={name} open={i === 0}>
          <summary>
            <span>{name}</span>
            <strong>
              {Math.round(labels.reduce((n, l) => n + ratings[l], 0) / labels.length)}
            </strong>
            <ChevronRight size={16} />
          </summary>
          <div className="attribute-content">
            {labels.map((l) => (
              <RatingBar key={l} label={l} value={ratings[l]} color={color} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
export function StatRadar({
  values,
  labels,
  color = '#f06455',
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const coord = (i: number, r: number) => [
    150 + Math.sin((i * 2 * Math.PI) / values.length) * r,
    140 - Math.cos((i * 2 * Math.PI) / values.length) * r,
  ];
  return (
    <svg
      className="stat-radar"
      viewBox="0 0 300 290"
      role="img"
      aria-label={labels.map((l, i) => `${l}: ${values[i]}`).join(', ')}
    >
      {[25, 50, 75, 100].map((r) => (
        <polygon
          key={r}
          points={values.map((_, i) => coord(i, r).join(',')).join(' ')}
          fill="none"
          stroke="#343b44"
        />
      ))}
      {values.map((_, i) => (
        <line
          key={i}
          x1="150"
          y1="140"
          x2={coord(i, 100)[0]}
          y2={coord(i, 100)[1]}
          stroke="#343b44"
        />
      ))}
      <polygon
        points={values.map((v, i) => coord(i, v).join(',')).join(' ')}
        fill={color}
        fillOpacity=".18"
        stroke={color}
        strokeWidth="2"
      />
      {labels.map((l, i) => (
        <text
          key={l}
          x={coord(i, 123)[0]}
          y={coord(i, 123)[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#a8afb9"
          fontSize="10"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}
export function TeamMark({ team }: { team: Team }) {
  return (
    <span className="team-mark" style={{ color: team.color, borderColor: `${team.color}50` }}>
      {team.short}
    </span>
  );
}
export function DriverCard({ driver }: { driver: Driver }) {
  const { teamById } = useUniverse();
  const t = teamById[driver.teamId];
  return (
    <Link
      href={`/pilotos/${driver.id}`}
      className="driver-card"
      style={{ '--team': t.color } as React.CSSProperties}
    >
      <div className="driver-card-art">
        <DriverPortrait driver={driver} />
        <span className="driver-card-rating">
          {driver.rating}
          <small>OVR</small>
        </span>
      </div>
      <div className="driver-card-info">
        <span className="eyebrow" style={{ color: t.color }}>
          {t.name}
        </span>
        <h3>{driver.name}</h3>
        <div className="flex-between">
          <span className="muted">
            <CountryFlag value={driver.flag} /> {driver.country} <span className="dot">·</span> #
            {driver.number}
          </span>
          <ArrowUpRight size={17} />
        </div>
      </div>
    </Link>
  );
}
export function TeamCard({ team }: { team: Team }) {
  const { drivers, powerScore, tires } = useUniverse();
  return (
    <Link
      href={`/equipes/${team.id}`}
      className="team-card"
      style={{ '--team': team.color } as React.CSSProperties}
    >
      <div className="flex-between">
        <TeamMark team={team} />
        <span className="rating-number">
          {powerScore(team).power}
          <small>PWR</small>
        </span>
      </div>
      <CarIllustration color={team.color} />
      <h3>{team.name}</h3>
      <p>
        {team.engine} <span className="dot">/</span> {team.tires}
      </p>
      <div className="team-drivers">
        {drivers
          .filter((d) => d.teamId === team.id)
          .map((d) => (
            <span key={d.id}>
              <CountryFlag value={d.flag} /> {d.name}
            </span>
          ))}
      </div>
    </Link>
  );
}
export function EngineerCard({ engineer: e }: { engineer: Engineer }) {
  const { driverById, teamById } = useUniverse();
  const d = driverById[e.driverId];
  const t = teamById[e.teamId];
  return (
    <Link href={`/engenheiros/${e.id}`} className="panel engineer-card">
      <div className="flex-between">
        <PersonPortrait
          personId={e.id}
          name={e.name}
          fictional={e.fictional}
          showTeamAccent={t.color}
        />
        <strong className="rating-number">
          {e.rating}
          <small>OVR</small>
        </strong>
      </div>
      <span className="eyebrow">{t.name}</span>
      <h3>{e.name}</h3>
      <p>Engenheiro de {d.name}</p>
      <div className="flex-between">
        <Badge>IDENTIDADE FICTÍCIA</Badge>
        <span className="green">{e.synergy} SYN</span>
      </div>
    </Link>
  );
}
export function ChampionshipTable({
  type = 'drivers',
  limit,
}: {
  type?: 'drivers' | 'teams';
  limit?: number;
}) {
  const { drivers, teamById } = useUniverse();
  const { save } = useSave();
  const isDrivers = type === 'drivers';
  const items = isDrivers ? driverStandings(save) : teamStandings(save);
  const points = (id: string) => (isDrivers ? save.driverPoints[id] : teamPoints(save, id));
  const hasPoints = items.some((i) => points(i.id) > 0);
  return (
    <div className="table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>POS</th>
            <th>{isDrivers ? 'PILOTO / EQUIPE' : 'CONSTRUTORA'}</th>
            <th>FORMA</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, limit).map((item, i) => {
            const team = isDrivers ? teamById[(item as Driver).teamId] : (item as Team);
            return (
              <tr key={item.id}>
                <td className="position">{hasPoints ? String(i + 1).padStart(2, '0') : '—'}</td>
                <td>
                  <Link
                    href={`/${isDrivers ? 'pilotos' : 'equipes'}/${item.id}`}
                    className="standing-name"
                  >
                    <i style={{ background: team.color }} />
                    {isDrivers && (
                      <PersonPortrait
                        personId={item.id}
                        name={item.name}
                        size={38}
                        fictional={item.id.startsWith('junior-')}
                      />
                    )}
                    <div>
                      <strong>{item.name}</strong>
                      {isDrivers && <small>{team.name}</small>}
                    </div>
                  </Link>
                </td>
                <td>
                  <TrendIndicator value={item.dynamics[0].trend} />
                </td>
                <td className="points">{points(item.id)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!hasPoints && (
        <p className="table-note">Sem posições definidas. Ordem alfabética • todos com 0 pontos.</p>
      )}
    </div>
  );
}
export function PowerRankingCard({ team, index }: { team: Team; index: number }) {
  const { powerScore } = useUniverse();
  const s = powerScore(team);
  return (
    <Link href={`/equipes/${team.id}`} className="power-ranking">
      <span className="power-position">{String(index + 1).padStart(2, '0')}</span>
      <TeamMark team={team} />
      <div className="power-name">
        <strong>{team.name}</strong>
        <div className="meter">
          <i style={{ width: `${s.power}%`, background: team.color }} />
        </div>
      </div>
      <strong className="power-value">{s.power}</strong>
      <TrendIndicator value={team.dynamics[1].trend} />
    </Link>
  );
}
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">—</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          className={value === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function ProjectionNote({ children }: { children?: React.ReactNode }) {
  return (
    <div className="provenance">
      <span className="status-dot amber" />
      {children ??
        'PROJEÇÕES EDITORIAIS • Ratings, tendências e vínculos são provisórios neste universo fictício.'}
    </div>
  );
}
