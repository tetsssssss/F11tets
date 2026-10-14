'use client';
import { useUniverse } from './save-provider';
import { PersonPortrait } from './person-portrait';
import { useId, useState } from 'react';
import { trackPath } from '../data/circuits';
import type { CarPart, Driver, Team } from '../domain/types';

export function CarIllustration({
  color = '#f06047',
  number = '29',
  className = '',
}: {
  color?: string;
  number?: string;
  className?: string;
}) {
  const id = useId().replaceAll(':', '');
  return (
    <svg
      className={`car-art ${className}`}
      viewBox="0 0 1000 350"
      role="img"
      aria-label="Monoposto conceitual 2029, ilustração provisória"
    >
      <defs>
        <linearGradient id={`${id}body`} x1="0" y1="0" x2="0.5" y2="1">
          <stop stopColor="#fff" stopOpacity=".85" />
          <stop offset=".12" stopColor={color} />
          <stop offset=".48" stopColor={color} />
          <stop offset="1" stopColor="#16191e" />
        </linearGradient>
        <linearGradient id={`${id}carbon`} x2="0.3" y2="1">
          <stop stopColor="#52555b" />
          <stop offset=".35" stopColor="#22262c" />
          <stop offset="1" stopColor="#080a0d" />
        </linearGradient>
        <radialGradient id={`${id}tire`}>
          <stop offset=".3" stopColor="#252932" />
          <stop offset=".55" stopColor="#101318" />
          <stop offset=".88" stopColor="#06080a" />
          <stop offset="1" stopColor="#363a40" />
        </radialGradient>
        <radialGradient id={`${id}shadow`}>
          <stop stopColor="#000" stopOpacity=".8" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="510" cy="290" rx="470" ry="44" fill={`url(#${id}shadow)`} />
      <g transform="translate(18,-8)">
        <path
          d="M166 155 L350 186 M192 190 L359 218 M680 155 L795 186 M680 211 L832 200"
          fill="none"
          stroke="#4e555e"
          strokeWidth="8"
        />
        <g opacity=".9">
          <ellipse cx="219" cy="199" rx="43" ry="57" fill={`url(#${id}tire)`} />
          <ellipse cx="777" cy="199" rx="43" ry="57" fill={`url(#${id}tire)`} />
        </g>
        <path
          d="M82 198 L185 176 L384 186 L461 132 L562 140 L639 178 L794 183 L888 224 L840 247 L249 265 L89 232 Z"
          fill={`url(#${id}carbon)`}
          stroke="#535960"
          strokeWidth="1"
        />
        <path
          d="M115 203 L206 184 L383 195 L485 150 L583 153 L664 193 L822 202 L844 218 L664 233 L287 240 L183 222 Z"
          fill={`url(#${id}body)`}
        />
        <path
          d="M232 213 L371 198 L496 150 L551 144 L608 175 L612 216 L563 235 L403 243 L350 229 Z"
          fill={`url(#${id}body)`}
          stroke={color}
        />
        <path d="M365 217 L418 179 L455 166 L528 159 L563 174 L505 207 Z" fill="#11151b" />
        <path
          d="M368 213 Q414 157 491 150 L534 152 Q553 152 570 179"
          fill="none"
          stroke="#454a50"
          strokeWidth="12"
        />
        <path
          d="M368 209 Q414 153 491 146 L534 148 Q553 148 570 175"
          fill="none"
          stroke={color}
          strokeWidth="5"
        />
        <path d="M485 150 L479 208" stroke="#4c535c" strokeWidth="7" />
        <ellipse cx="464" cy="176" rx="22" ry="17" fill="#d8dde1" />
        <path d="M444 175 L481 171 L485 181 L448 185 Z" fill="#212a35" />
        <path d="M559 150 L572 119 L597 130 L630 170" fill={`url(#${id}body)`} />
        <path d="M572 124 L591 130 L594 141 L571 137 Z" fill="#090c10" />
        <path d="M588 172 L625 182 L636 210 L588 218 L553 213 Z" fill="#101318" />
        <path
          d="M598 179 L622 185 M594 186 L626 193 M590 193 L628 201"
          stroke="#363d45"
          strokeWidth="3"
        />
        <path
          d="M258 242 L633 231 L736 216 L835 228 L824 239 L637 254 L281 261 Z"
          fill="#090c0e"
          stroke="#494e55"
        />
        <path d="M95 179 L173 172 L198 192 L198 244 L170 259 L96 237 Z" fill={`url(#${id}body)`} />
        <path
          d="M89 169 L171 161 L187 174 L105 186 Z M92 186 L175 178 L188 190 L104 202 Z"
          fill="#20262b"
          stroke="#656b70"
        />
        <path d="M118 182 L119 225 M169 182 L170 231" stroke="#080a0e" strokeWidth="6" />
        <path
          d="M774 214 L894 222 L938 255 L859 275 L754 246 Z"
          fill={`url(#${id}carbon)`}
          stroke="#666b70"
        />
        <path
          d="M788 226 L895 235 L921 251 L855 264 M786 238 L893 247"
          stroke={color}
          strokeWidth="5"
          fill="none"
        />
        <path d="M859 247 L901 230 L919 259 L862 279 Z" fill={`url(#${id}body)`} />
        <path
          d="M210 219 L360 217 M674 218 L790 215 M666 207 L783 247"
          fill="none"
          stroke="#a1a5aa"
          strokeWidth="5"
        />
        {[
          { x: 230, y: 238, r: 67 },
          { x: 766, y: 246, r: 62 },
        ].map(({ x, y, r }) => (
          <g key={x}>
            <ellipse cx={x + 9} cy={y - 4} rx={r + 3} ry={r + 3} fill="#07090b" />
            <ellipse cx={x} cy={y} rx={r} ry={r} fill={`url(#${id}tire)`} />
            <circle
              cx={x}
              cy={y}
              r={r * 0.77}
              fill="none"
              stroke={color}
              strokeWidth="2"
              opacity=".9"
            />
            <circle cx={x} cy={y} r={r * 0.53} fill="#181d23" stroke="#484f55" strokeWidth="2" />
            {Array.from({ length: 10 }, (_, i) => (
              <path
                key={i}
                d={`M ${x - 4} ${y - 7} L ${x - 6} ${y - r * 0.5} L ${x + 3} ${y - r * 0.5} Z`}
                fill="#737b82"
                transform={`rotate(${i * 36} ${x} ${y})`}
              />
            ))}
            <circle cx={x} cy={y} r="10" fill="#353c43" />
            <circle cx={x} cy={y} r="4" fill={color} />
          </g>
        ))}
        <text
          x="564"
          y="206"
          fill="white"
          fontFamily="Arial,sans-serif"
          fontSize="23"
          fontWeight="900"
          fontStyle="italic"
        >
          {number}
        </text>
        <text
          x="352"
          y="236"
          fill="white"
          opacity=".8"
          fontFamily="Arial,sans-serif"
          fontSize="10"
          letterSpacing="3"
        >
          UNIVERSE
        </text>
        <path d="M632 229 L701 223 M299 250 L606 245" stroke={color} strokeWidth="2" />
      </g>
    </svg>
  );
}
export function CircuitMap({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 480 330"
      className={`circuit-map ${className}`}
      role="img"
      aria-label="Traçado conceitual simplificado, não geográfico"
    >
      <defs>
        <pattern id="track-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 22 0 L 0 0 0 22" fill="none" stroke="currentColor" strokeOpacity=".05" />
        </pattern>
      </defs>
      <rect width="480" height="330" fill="url(#track-grid)" />
      <path
        d={trackPath}
        fill="none"
        stroke="currentColor"
        opacity=".08"
        strokeWidth="23"
        strokeLinejoin="round"
      />
      <path
        d={trackPath}
        fill="none"
        stroke="currentColor"
        opacity=".65"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M90 198 L139 160" fill="none" stroke="#f15c50" strokeWidth="5" />
      <path d="M90 188 L108 208" stroke="white" strokeWidth="4" strokeDasharray="3 3" />
      <text x="63" y="237" fill="#f3786c" fontSize="12" fontFamily="monospace">
        START / FINISH
      </text>
      <text x="175" y="33" fill="#7d8590" fontSize="11" fontFamily="monospace">
        S1
      </text>
      <text x="409" y="149" fill="#7d8590" fontSize="11" fontFamily="monospace">
        S2
      </text>
      <text x="226" y="314" fill="#7d8590" fontSize="11" fontFamily="monospace">
        S3
      </text>
      {children}
    </svg>
  );
}
export function DriverPortrait({ driver, small = false }: { driver: Driver; small?: boolean }) {
  const { teamById } = useUniverse();
  const team = teamById[driver.teamId];
  return (
    <div
      className={`driver-portrait ${small ? 'small' : ''}`}
      style={{ '--team': team.color } as React.CSSProperties}
    >
      <span className="portrait-number">{driver.number}</span>
      <PersonPortrait
        personId={driver.id}
        name={driver.name}
        size="100%"
        focus={small ? 'face' : 'full'}
        showTeamAccent={team.color}
        fictional={driver.id.startsWith('junior-')}
      />
      {!small && (
        <span className="portrait-caption">
          {driver.id.startsWith('junior-') ? 'PERSONAGEM FICTÍCIO' : 'F1 UNIVERSE · 2029'}
        </span>
      )}
    </div>
  );
}
const hotspots: { part: CarPart; label: string; x: number; y: number; detail: string }[] = [
  {
    part: 'FrontWing',
    label: 'Asa dianteira',
    x: 88,
    y: 71,
    detail:
      'Aero ativa para equilibrar carga na entrada de curva. Projeto de baixo arrasto em estudo.',
  },
  {
    part: 'Suspension',
    label: 'Suspensão',
    x: 70,
    y: 61,
    detail: 'Geometria mecânica para tração e estabilidade. Sem assistência eletrônica ao piloto.',
  },
  {
    part: 'Sidepod',
    label: 'Sidepod',
    x: 59,
    y: 50,
    detail: 'Refrigeração integrada ao escoamento lateral. Janela térmica define eficiência.',
  },
  {
    part: 'Battery',
    label: 'Bateria',
    x: 48,
    y: 66,
    detail:
      'Armazenamento híbrido de alta potência. Densidade, regeneração e gestão térmica independentes do motor.',
  },
  {
    part: 'Engine',
    label: 'Motor V8',
    x: 34,
    y: 51,
    detail:
      'V8 híbrido com projeto próprio da fornecedora. Potência, eficiência, confiabilidade e integração elétrica entram no motor de simulação.',
  },
  {
    part: 'Floor',
    label: 'Assoalho',
    x: 53,
    y: 79,
    detail:
      'Principal plataforma de eficiência aerodinâmica. Sensível à altura e ao equilíbrio do carro.',
  },
  {
    part: 'RearWing',
    label: 'Asa traseira',
    x: 15,
    y: 46,
    detail: 'Aerodinâmica ativa com Corner, Flow e Straight Mode. Não utiliza DRS tradicional.',
  },
];
export function CarShowroom({ team }: { team: Team }) {
  const [active, setActive] = useState(hotspots[0]);
  return (
    <section className="panel showroom">
      <div className="section-head">
        <div>
          <span className="eyebrow">TECHNICAL STUDIO</span>
          <h2>
            {team.short}-29 <span className="muted">/ Concept car</span>
          </h2>
        </div>
        <span className="tag">SVG • PROVISÓRIO</span>
      </div>
      <div className="showroom-stage">
        <span className="showroom-watermark">{team.short}</span>
        <CarIllustration color={team.color} />
        {hotspots.map((h) => (
          <button
            key={h.part}
            className={`hotspot ${active.part === h.part ? 'active' : ''}`}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            onClick={() => setActive(h)}
            aria-label={h.label}
            aria-pressed={active.part === h.part}
          >
            +
          </button>
        ))}
      </div>
      <div className="hotspot-tabs">
        {hotspots.map((h) => (
          <button
            key={h.part}
            onClick={() => setActive(h)}
            className={active.part === h.part ? 'selected' : ''}
          >
            {h.label}
          </button>
        ))}
      </div>
      <div className="technical-note">
        <span className="eyebrow">{active.part}</span>
        <h3>{active.label}</h3>
        <p>{active.detail}</p>
      </div>
    </section>
  );
}
