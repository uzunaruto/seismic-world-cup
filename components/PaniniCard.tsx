'use client';

import { forwardRef } from 'react';
import { CardStats, Position, Kit, POSITION_SHORT, MAG_COLORS } from '@/lib/stats';

export interface PaniniCardProps {
  // Identity
  username: string;        // Discord handle
  displayName: string;     // Discord global_name or username
  pfpUrl: string;
  magnitude: number | null;

  // Card-specific
  position: Position;
  kit: Kit;
  motto: string;
  stats: CardStats;
  jerseyNumber: number;    // typically = magnitude, but for foil/others can be different
}

// Kit color tokens (parchment cream is always the text/light surface; pitch green is bg)
// Each kit is a full football pitch with mowed stripes, white lines, and a ball
const KIT_TOKENS: Record<Kit, { bg: string; accent: string; text: string; subtext: string; border: string; statBg: string; statText: string }> = {
  home: {
    bg: "url('/patterns/pitch-home.svg') center/cover no-repeat, linear-gradient(160deg, #4a8c3a 0%, #3d7a2c 50%, #2e6b25 100%)",
    accent: '#f5ebd7',         // parchment
    text: '#f5ebd7',
    subtext: 'rgba(245, 235, 215, 0.85)',
    border: '#f5ebd7',
    statBg: 'rgba(245, 235, 215, 0.95)',
    statText: '#1e4a18',
  },
  away: {
    bg: "url('/patterns/pitch-away.svg') center/cover no-repeat, linear-gradient(160deg, #1e4a18 0%, #163e12 50%, #0a2208 100%)",
    accent: '#c89208',         // bright copper
    text: '#f5ebd7',
    subtext: 'rgba(245, 235, 215, 0.75)',
    border: '#c89208',
    statBg: 'rgba(168, 117, 4, 0.20)',
    statText: '#f5ebd7',
  },
  foil: {
    bg: "url('/patterns/pitch-foil.svg') center/cover no-repeat, linear-gradient(135deg, #3a8528 0%, #4a8c3a 25%, #2e6b20 50%, #4a8c3a 75%, #3a8528 100%)",
    accent: '#fff5e0',
    text: '#1a140d',           // dark text on green to read against lighter foil
    subtext: 'rgba(26, 20, 13, 0.75)',
    border: '#fff5e0',
    statBg: 'rgba(255, 245, 224, 0.92)',
    statText: '#1e4a18',
  },
};

export const PaniniCard = forwardRef<HTMLDivElement, PaniniCardProps>(function PaniniCard(
  { username, displayName, pfpUrl, magnitude, position, kit, motto, stats, jerseyNumber },
  ref
) {
  const tokens = KIT_TOKENS[kit];
  const magColor = magnitude ? MAG_COLORS[magnitude] : '#A87504';
  const magLabel = magnitude ? `M${magnitude}` : 'M?';

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1620,
        padding: 32,
        background: tokens.bg,
        borderRadius: 36,
        border: `6px solid ${tokens.border}`,
        boxSizing: 'border-box',
        fontFamily: "'Outfit', system-ui, sans-serif",
        color: tokens.text,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Top banner: team name + tournament */}
      <div
        style={{
          width: '100%',
          background: tokens.accent,
          color: kit === 'foil' ? '#1a140d' : '#0a0806',
          padding: '12px 0',
          textAlign: 'center',
          fontFamily: "'Cinzel', 'Times New Roman', serif",
          fontWeight: 700,
          textTransform: 'uppercase',
          borderRadius: 10,
          marginBottom: 18,
          lineHeight: 1.15,
        }}
      >
        <div style={{ fontSize: 20, letterSpacing: '0.08em' }}>
          Seismic Magnitudes
        </div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.18em',
            opacity: 0.7,
            marginTop: 3,
          }}
        >
          World Cup 2026
        </div>
      </div>

      {/* Player photo */}
      <div
        style={{
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: tokens.accent,
          padding: 10,
          boxSizing: 'border-box',
          marginBottom: 24,
          boxShadow: `0 10px 32px rgba(0, 0, 0, ${kit === 'foil' ? '0.35' : '0.5'})`,
        }}
      >
        <img
          src={pfpUrl}
          alt={displayName}
          crossOrigin="anonymous"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* Name + handle */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: '0.02em',
            lineHeight: 1.05,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            fontSize: 28,
            color: tokens.subtext,
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          @{username}
        </div>
      </div>

      {/* Position badge */}
      <div
        style={{
          background: tokens.accent,
          color: kit === 'foil' ? '#1a140d' : '#0a0806',
          padding: '12px 32px',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 28,
        }}
      >
        {POSITION_SHORT[position]} {position === 'captain' ? '' : '· ' + position}
      </div>

      {/* Motto */}
      {motto && (
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontStyle: 'italic',
            fontSize: 32,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.3,
            color: tokens.text,
            marginBottom: 32,
            padding: '0 24px',
            minHeight: 84,
          }}
        >
          &ldquo;{motto}&rdquo;
        </div>
      )}

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          width: '100%',
          maxWidth: 920,
          marginBottom: 32,
        }}
      >
        {(['pac', 'sho', 'pas', 'dri'] as const).map((key) => (
          <div
            key={key}
            style={{
              background: tokens.statBg,
              color: tokens.statText,
              borderRadius: 16,
              padding: '20px 12px',
              textAlign: 'center',
              fontWeight: 800,
            }}
          >
            <div style={{ fontSize: 22, letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.7 }}>
              {key}
            </div>
            <div style={{ fontSize: 64, lineHeight: 1, marginTop: 4, fontFamily: "'Cinzel', serif" }}>
              {stats[key]}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar: jersey number + magnitude + year */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 36px',
          background: tokens.accent,
          color: kit === 'foil' ? '#1a140d' : '#0a0806',
          borderRadius: 16,
          marginTop: 'auto',
        }}
      >
        {/* Jersey number */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.6, letterSpacing: '0.1em' }}>NO.</span>
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1,
              color: magColor,
              textShadow: kit === 'foil' ? '0 2px 0 rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {jerseyNumber}
          </span>
        </div>

        {/* Magnitude badge */}
        <div
          style={{
            background: magColor,
            color: '#0a0806',
            padding: '10px 24px',
            borderRadius: 999,
            fontFamily: "'Cinzel', serif",
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}
        >
          {magLabel}
        </div>

        {/* Year */}
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 36,
            fontWeight: 700,
            opacity: 0.7,
            letterSpacing: '0.05em',
          }}
        >
          2026
        </div>
      </div>

      {/* Rocky watermark (subtle) */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          fontSize: 14,
          opacity: 0.4,
          letterSpacing: '0.15em',
          color: tokens.subtext,
        }}
      >
        ROCKY
      </div>
    </div>
  );
});
