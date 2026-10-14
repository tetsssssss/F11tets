import type { ReactNode } from 'react';
// Inline artwork avoids Windows' missing regional-indicator emoji support and external image requests.
export function CountryFlag({ value }: { value: string }) {
  const code = /^[A-Z]{2}$/.test(value)
    ? value
    : Array.from(value)
        .map((c) => String.fromCharCode((c.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
        .join('');
  const horizontal: Record<string, string[]> = {
    NL: ['#b34650', '#f4f1e9', '#41658e'],
    DE: ['#24272b', '#aa3b43', '#e5bf57'],
    BG: ['#f1ede3', '#408c72', '#b24a50'],
    HU: ['#b64d55', '#f1ede4', '#4e866c'],
    AT: ['#bf5260', '#f4f0e7', '#bf5260'],
    AR: ['#82b5d3', '#f4f1e9', '#82b5d3'],
    TH: ['#af4b55', '#f1ede4', '#394b77', '#394b77', '#f1ede4', '#af4b55'],
    ES: ['#ac414b', '#e6be58', '#e6be58', '#ac414b'],
    SG: ['#c95b66', '#f4f0e9'],
    MC: ['#c55862', '#f4f1e9'],
  };
  const vertical: Record<string, string[]> = {
    FR: ['#3b578d', '#f4f0e9', '#bd535d'],
    IT: ['#4c9378', '#f4f0e9', '#c15861'],
    BE: ['#27292c', '#e2c65e', '#bd535d'],
    MX: ['#47826e', '#f2eee4', '#b6535f'],
  };
  const union = (
    <g>
      <path d="M0 0L15 10M15 0L0 10" stroke="#edece9" strokeWidth="3" />
      <path d="M0 0L15 10M15 0L0 10" stroke="#bc505b" strokeWidth="1" />
      <path d="M7.5 0V10M0 5H15" stroke="#edece9" strokeWidth="4" />
      <path d="M7.5 0V10M0 5H15" stroke="#bc505b" strokeWidth="2" />
    </g>
  );
  const star = (x: number, y: number, r = 1) => (
    <path
      d={`M${x} ${y - r * 2}l${r * 0.6} ${r * 1.3} ${r * 1.4} ${r * 0.15}-${r} ${r} .3 ${r * 1.5}-${r * 1.3}-.7-${r * 1.3} .7 .3-${r * 1.5}-${r}-${r} ${r * 1.4}-.15Z`}
      fill="#f0e5bc"
    />
  );
  let art: ReactNode;
  if (horizontal[code])
    art = (
      <>
        {horizontal[code].map((c, i, a) => (
          <rect key={i} y={(20 * i) / a.length} width="30" height={20 / a.length + 0.1} fill={c} />
        ))}
        {code === 'AR' && <circle cx="15" cy="10" r="2" fill="#d5ae4c" />}
      </>
    );
  else if (vertical[code])
    art = (
      <>
        {vertical[code].map((c, i) => (
          <rect key={i} x={i * 10} width="10" height="20" fill={c} />
        ))}
        {code === 'MX' && <circle cx="15" cy="11" r="2" fill="#738064" />}
      </>
    );
  else if (code === 'GB' || code === 'AU' || code === 'NZ')
    art = (
      <>
        <rect width="30" height="20" fill="#344a76" />
        {code === 'GB' ? (
          <g transform="scale(2)">{union}</g>
        ) : (
          <>
            {union}
            {star(23, 5, 0.75)}
            {star(20, 13, 0.8)}
            {star(26, 16, 0.7)}
            {star(10, 15, 1)}
          </>
        )}
      </>
    );
  else if (code === 'BR')
    art = (
      <>
        <rect width="30" height="20" fill="#45876b" />
        <path d="M15 2L28 10L15 18L2 10Z" fill="#ddc265" />
        <circle cx="15" cy="10" r="5" fill="#3e5c87" />
        <path d="M10 9Q15 8 20 12" fill="none" stroke="#ecebe2" strokeWidth="1" />
      </>
    );
  else if (code === 'JP')
    art = (
      <>
        <rect width="30" height="20" fill="#f0ede8" />
        <circle cx="15" cy="10" r="5" fill="#b85661" />
      </>
    );
  else if (code === 'CN')
    art = (
      <>
        <rect width="30" height="20" fill="#b94f57" />
        {star(7, 6, 1.7)}
        {star(12, 3, 0.5)}
        {star(14, 6, 0.5)}
        {star(14, 9, 0.5)}
        {star(12, 12, 0.5)}
      </>
    );
  else if (code === 'US' || code === 'MY')
    art = (
      <>
        {Array.from({ length: 13 }, (_, i) => (
          <rect
            key={i}
            y={(20 * i) / 13}
            width="30"
            height={20 / 13 + 0.1}
            fill={i % 2 ? '#ecece6' : '#b25360'}
          />
        ))}
        <rect width="14" height="11" fill="#3b517b" />
        {[3, 7, 11].map((x) =>
          [2, 5, 8].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".7" fill="#edede5" />),
        )}
      </>
    );
  else if (code === 'FI' || code === 'SE')
    art = (
      <>
        <rect width="30" height="20" fill={code === 'FI' ? '#eeeee6' : '#41678e'} />
        <path d="M10 0V20M0 10H30" stroke={code === 'FI' ? '#476a92' : '#e2c363'} strokeWidth="4" />
      </>
    );
  else if (code === 'CA')
    art = (
      <>
        <rect width="30" height="20" fill="#f0ede7" />
        <path d="M0 0H7V20H0ZM23 0H30V20H23Z" fill="#bd535c" />
        <path d="M15 3L17 7L20 6L19 10L21 12L16 14V17H14V14L9 12L11 10L10 6L13 7Z" fill="#bd535c" />
      </>
    );
  else if (code === 'KR')
    art = (
      <>
        <rect width="30" height="20" fill="#eeeae5" />
        <circle cx="15" cy="10" r="5" fill="#b95463" />
        <path d="M10 10a5 5 0 0010 0q-2.5 5-5 0t-5 0" fill="#48678f" />
        <path d="M4 4l3-2M3 6l3-2M23 17l3-2M22 15l3-2" stroke="#333" strokeWidth="1.3" />
      </>
    );
  else if (code === 'IN')
    art = (
      <>
        <rect width="30" height="7" fill="#d99956" />
        <rect y="7" width="30" height="6" fill="#ecece3" />
        <rect y="13" width="30" height="7" fill="#4e8970" />
        <circle cx="15" cy="10" r="2.1" fill="none" stroke="#476188" strokeWidth=".8" />
      </>
    );
  else if (code === 'AE')
    art = (
      <>
        <rect width="30" height="7" fill="#488b73" />
        <rect y="7" width="30" height="6" fill="#eeeee8" />
        <rect y="13" width="30" height="7" fill="#292d34" />
        <rect width="8" height="20" fill="#b6515f" />
      </>
    );
  else if (code === 'QA' || code === 'BH')
    art = (
      <>
        <rect width="30" height="20" fill={code === 'QA' ? '#864555' : '#b8515e'} />
        <path d="M0 0H10L7 2L10 4L7 6L10 8L7 10L10 12L7 14L10 16L7 18L10 20H0Z" fill="#edece7" />
      </>
    );
  else if (code === 'TR')
    art = (
      <>
        <rect width="30" height="20" fill="#b7535e" />
        <circle cx="12" cy="10" r="5" fill="#eeeee6" />
        <circle cx="14" cy="9" r="4" fill="#b7535e" />
        {star(21, 10, 1.3)}
      </>
    );
  else if (code === 'PT')
    art = (
      <>
        <rect width="30" height="20" fill="#b1515c" />
        <rect width="12" height="20" fill="#468671" />
        <circle cx="12" cy="10" r="4" fill="#d8bd69" />
        <rect x="10" y="7" width="4" height="6" fill="#e9e6df" />
      </>
    );
  else if (code === 'SA')
    art = (
      <>
        <rect width="30" height="20" fill="#45836f" />
        <path d="M6 8h18M9 6v5M13 5v5M18 6v4M22 5v5M7 15h17" stroke="#e5e9df" strokeWidth="1" />
      </>
    );
  else if (code === 'ZA')
    art = (
      <>
        <rect width="30" height="10" fill="#b2525b" />
        <rect y="10" width="30" height="10" fill="#4d6086" />
        <path d="M0 0L14 10L0 20M14 10H30" stroke="#e6e6dc" strokeWidth="8" fill="none" />
        <path d="M0 0L14 10L0 20M14 10H30" stroke="#4b8870" strokeWidth="5" fill="none" />
        <path d="M0 4L8 10L0 16Z" fill="#292e33" />
      </>
    );
  else if (code === 'AZ')
    art = (
      <>
        <rect width="30" height="7" fill="#5d9cb4" />
        <rect y="7" width="30" height="6" fill="#b45560" />
        <rect y="13" width="30" height="7" fill="#568d6f" />
        <circle cx="15" cy="10" r="2.4" fill="#eee9df" />
        <circle cx="16" cy="9.6" r="2" fill="#b45560" />
      </>
    );
  else
    art = (
      <>
        <rect width="30" height="20" fill="#435464" />
        <text x="15" y="13" textAnchor="middle" fill="white" fontSize="8">
          {code}
        </text>
      </>
    );
  return (
    <svg viewBox="0 0 30 20" className="country-flag" role="img" aria-label={`Bandeira ${code}`}>
      {art}
    </svg>
  );
}
