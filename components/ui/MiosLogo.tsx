import React from 'react';

interface MiosLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  collapsed?: boolean;
}

const SIZES = {
  sm:  { block: 20, gap: 1, font: 7,  wordmark: 11, sub: 8  },
  md:  { block: 28, gap: 1.5, font: 9, wordmark: 14, sub: 9 },
  lg:  { block: 40, gap: 2, font: 13, wordmark: 20, sub: 11 },
  xl:  { block: 56, gap: 3, font: 18, wordmark: 28, sub: 13 },
};

// M=Red, I=Blue, O=Green, S=dark-with-border
const BLOCKS = [
  { letter: 'M', bg: '#E02020', text: '#fff' },
  { letter: 'I', bg: '#1B4FA8', text: '#fff' },
  { letter: 'O', bg: '#2DB44A', text: '#fff' },
  { letter: 'S', bg: '#1A1A1C', text: '#e4e4e7', border: '#2D2D30' },
];

export default function MiosLogo({ size = 'md', showWordmark = true, collapsed = false }: MiosLogoProps) {
  const s = SIZES[size];
  const totalW = s.block * 4 + s.gap * 3;

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Icon — 4 colored blocks */}
      <div style={{ display: 'flex', gap: s.gap }}>
        {BLOCKS.map(({ letter, bg, text, border }) => (
          <div
            key={letter}
            style={{
              width: s.block,
              height: s.block,
              background: bg,
              border: border ? `1px solid ${border}` : 'none',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
            <span style={{
              color: text,
              fontFamily: "'Courier New', monospace",
              fontWeight: 900,
              fontSize: s.font,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>
              {letter}
            </span>
          </div>
        ))}
      </div>

      {/* Wordmark */}
      {showWordmark && !collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            color: '#f4f4f5',
            fontFamily: "'Courier New', monospace",
            fontWeight: 900,
            fontSize: s.wordmark,
            lineHeight: 1,
            letterSpacing: '0.08em',
          }}>
            MIOS
          </span>
          <span style={{
            color: '#52525b',
            fontFamily: "'Courier New', monospace",
            fontWeight: 400,
            fontSize: s.sub,
            lineHeight: 1,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            Payroll
          </span>
        </div>
      )}
    </div>
  );
}

// Auth pages (large centered logo)
export function MiosLogoAuth() {
  const s = SIZES.lg;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: s.gap }}>
        {BLOCKS.map(({ letter, bg, text, border }) => (
          <div key={letter} style={{
            width: s.block, height: s.block, background: bg,
            border: border ? `1px solid ${border}` : 'none',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: bg !== '#1A1A1C' ? `0 0 20px ${bg}55` : 'none',
          }}>
            <span style={{
              color: text, fontFamily: "'Courier New', monospace",
              fontWeight: 900, fontSize: s.font, lineHeight: 1,
            }}>{letter}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: '#f4f4f5', fontFamily: "'Courier New', monospace",
          fontWeight: 900, fontSize: 22, letterSpacing: '0.1em',
        }}>MIOS Payroll</div>
        <div style={{
          color: '#52525b', fontFamily: "'Courier New', monospace",
          fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 4,
        }}>Indonesian Accounting Platform</div>
      </div>
    </div>
  );
}
