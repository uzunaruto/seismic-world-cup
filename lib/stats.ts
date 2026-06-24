// =============================================================================
// Panini-style stats generation
// =============================================================================
// Stats are deterministic per Discord ID (same user always gets same stats)
// and biased by position. Range 60-99 with position-specific base ranges.

export type Position = 'forward' | 'midfielder' | 'defender' | 'goalkeeper' | 'captain' | 'coach';
export type Kit = 'home' | 'away' | 'foil';

export interface CardStats {
  pac: number;   // Pace
  sho: number;   // Shooting
  pas: number;   // Passing
  dri: number;   // Dribbling
  ovr: number;   // Overall (average)
}

// Position base templates (mid-range stat for each skill)
const POSITION_TEMPLATES: Record<Position, { pac: number; sho: number; pas: number; dri: number }> = {
  forward:     { pac: 84, sho: 86, pas: 72, dri: 80 },
  midfielder:  { pac: 76, sho: 70, pas: 88, dri: 84 },
  defender:    { pac: 70, sho: 55, pas: 70, dri: 66 },
  goalkeeper:  { pac: 58, sho: 45, pas: 62, dri: 68 },
  captain:     { pac: 78, sho: 80, pas: 80, dri: 80 },
  coach:       { pac: 50, sho: 50, pas: 92, dri: 60 },
};

// Deterministic hash from Discord ID → seed in [0, 1)
function hashToSeed(discordId: string): number {
  let h = 2166136261;     // FNV offset basis
  for (let i = 0; i < discordId.length; i++) {
    h ^= discordId.charCodeAt(i);
    h = Math.imul(h, 16777619);   // FNV prime
  }
  // Map to [0, 1) via unsigned right shift
  return ((h >>> 0) % 100000) / 100000;
}

// Mulberry32 PRNG seeded by [0, 1) → returns deterministic random in [-1, 1)
function mulberry32FromSeed(seed: number): () => number {
  const s = Math.floor(seed * 0xffffffff);
  let a = s;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStats(discordId: string, position: Position): CardStats {
  const base = POSITION_TEMPLATES[position];
  const rng = mulberry32FromSeed(hashToSeed(discordId + position));

  // Each stat gets ±8 from base, clamped to [50, 99]
  const pac = clamp(base.pac + Math.round((rng() - 0.5) * 16));
  const sho = clamp(base.sho + Math.round((rng() - 0.5) * 16));
  const pas = clamp(base.pas + Math.round((rng() - 0.5) * 16));
  const dri = clamp(base.dri + Math.round((rng() - 0.5) * 16));
  const ovr = Math.round((pac + sho + pas + dri) / 4);

  return { pac, sho, pas, dri, ovr };
}

function clamp(v: number, min = 50, max = 99): number {
  return Math.max(min, Math.min(max, v));
}

// -----------------------------------------------------------------------------
// Position display
// -----------------------------------------------------------------------------
export const POSITION_LABELS: Record<Position, string> = {
  forward: 'Forward',
  midfielder: 'Midfielder',
  defender: 'Defender',
  goalkeeper: 'Goalkeeper',
  captain: 'Captain',
  coach: 'Coach',
};

export const POSITION_SHORT: Record<Position, string> = {
  forward: 'FW',
  midfielder: 'MF',
  defender: 'DF',
  goalkeeper: 'GK',
  captain: 'C',
  coach: 'CO',
};

// -----------------------------------------------------------------------------
// Kit display
// -----------------------------------------------------------------------------
export const KIT_LABELS: Record<Kit, string> = {
  home: 'Home Kit',
  away: 'Away Kit',
  foil: 'Limited Foil',
};

// Magnitude color for the jersey number / tier badge
export const MAG_COLORS: Record<number, string> = {
  1: '#D5D1C4', 2: '#5BB5A2', 3: '#2AA346', 4: '#75E300', 5: '#659E0F',
  6: '#C19200', 7: '#A87504', 8: '#9C1515', 9: '#0693CD',
};
