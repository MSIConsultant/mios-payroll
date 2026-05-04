import React from 'react';

interface MiosLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  collapsed?: boolean;
}

const SIZES = {
  sm:  { mark: 28, font: 8,  wordmark: 12, sub: 8  },
  md:  { mark: 36, font: 10, wordmark: 15, sub: 9  },
  lg:  { mark: 52, font: 14, wordmark: 22, sub: 11 },
  xl:  { mark: 72, font: 20, wordmark: 30, sub: 13 },
};

function MiosMark({ size }: { size: number }) {
  const half = size / 2;
  const r = size * 0.12; // corner radius
  const f = size * 0.28; // font size
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Outer rounded square clip */}
      <defs>
        <clipPath id="mark-clip">
          <rect width={size} height={size} rx={r} ry={r} />
        </clipPath>
      </defs>

      {/* Four quadrants */}
      <g clipPath="url(#mark-clip)">
        {/* M — red top-left */}
        <rect x={0}    y={0}    width={half} height={half} fill="#E02020" />
        {/* I — blue top-right */}
        <rect x={half} y={0}    width={half} height={half} fill="#1B4FA8" />
        {/* O — green bottom-left */}
        <rect x={0}    y={half} width={half} height={half} fill="#2DB44A" />
        {/* S — dark bottom-right */}
        <rect x={half} y={half} width={half} height={half} fill="#111113" />

        {/* Letters */}
        <text x={half * 0.5} y={half * 0.72} textAnchor="middle"
          fontFamily="'Courier New', monospace" fontWeight="900"
          fontSize={f} fill="white">{`M`}</text>
        <text x={half + half * 0.5} y={half * 0.72} textAnchor="middle"
          fontFamily="'Courier New', monospace" fontWeight="900"
          fontSize={f} fill="white">{`I`}</text>
        <text x={half * 0.5} y={half + half * 0.72} textAnchor="middle"
          fontFamily="'Courier New', monospace" fontWeight="900"
          fontSize={f} fill="white">{`O`}</text>
        <text x={half + half * 0.5} y={half + half * 0.72} textAnchor="middle"
          fontFamily="'Courier New', monospace" fontWeight="900"
          fontSize={f} fill="#a1a1aa">{`S`}</text>

        {/* Thin divider lines */}
        <line x1={half} y1={0} x2={half} y2={size} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
        <line x1={0} y1={half} x2={size} y2={half} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      </g>

      {/* Outer border */}
      <rect width={size} height={size} rx={r} ry={r}
        stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
    </svg>
  );
}

export default function MiosLogo({ size = 'md', showWordmark = true, collapsed = false }: MiosLogoProps) {
  const s = SIZES[size];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      <MiosMark size={s.mark} />
      {showWordmark && !collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            color: '#f4f4f5',
            fontFamily: "'Courier New', monospace",
            fontWeight: 900,
            fontSize: s.wordmark,
            lineHeight: 1,
            letterSpacing: '0.06em',
          }}>MIOS</span>
          <span style={{
            color: '#3f3f46',
            fontFamily: "'Courier New', monospace",
            fontWeight: 400,
            fontSize: s.sub,
            lineHeight: 1,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>Payroll</span>
        </div>
      )}
    </div>
  );
}

export function MiosLogoAuth() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ filter: 'drop-shadow(0 0 24px rgba(27,79,168,0.35))' }}>
        <MiosMark size={64} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: '#f4f4f5',
          fontFamily: "'Courier New', monospace",
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: '0.1em',
          lineHeight: 1,
        }}>MIOS Payroll</div>
        <div style={{
          color: '#3f3f46',
          fontFamily: "'Courier New', monospace",
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          marginTop: 6,
        }}>Indonesian Accounting Platform</div>
      </div>
    </div>
  );
}
