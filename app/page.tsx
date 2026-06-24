'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildDiscordAuthUrl, readTokenFromHash, clearHash } from '@/lib/auth';
import { useSession } from '@/lib/use-session';
import { PaniniCard } from '@/components/PaniniCard';
import { CardStats, MAG_COLORS, POSITION_SHORT } from '@/lib/stats';

const REDIRECT_URI =
  typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:3000/';

const SAMPLE_STATS: CardStats = { pac: 88, sho: 74, pas: 81, dri: 85, ovr: 82 };

const MAG_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Home() {
  const router = useRouter();
  const { user, loading, backendReady, saveSession } = useSession();
  const [authError, setAuthError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const tokenData = readTokenFromHash();
    if (!tokenData) return;

    setConnecting(true);
    setAuthError(null);
    fetch('/api/auth/discord/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: tokenData.token }),
    })
      .then(async (r) => {
        clearHash();
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || data.error || 'auth failed');
        }
        return r.json();
      })
      .then((d) => {
        if (d.user) saveSession(d.user);
        setConnecting(false);
      })
      .catch((err) => {
        setAuthError(err.message);
        setConnecting(false);
      });
  }, [saveSession]);

  const handleConnect = () => {
    window.location.href = buildDiscordAuthUrl(REDIRECT_URI);
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/discord/session', { method: 'DELETE' });
    try { localStorage.removeItem('swc_user'); } catch {}
    router.refresh();
    window.location.reload();
  };

  const userMag = user?.magnitude ?? 7;
  const sampleMag = MAG_COLORS[7] ?? '#A87504';

  return (
    <>
      {/* Top nav */}
      <nav className="nav" aria-label="Primary">
        <Link href="/" className="nav__brand">
          <svg className="nav__brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M16 4 L16 16 M16 16 L6 10 M16 16 L26 10 M16 16 L16 28" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
            <circle cx="16" cy="16" r="2.2" fill="currentColor" />
          </svg>
          Seismic World Cup
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/gallery" className="btn-ghost">Album</Link>
          {user ? (
            <Link href="/compose" className="btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>
              Build your card
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <button onClick={handleConnect} className="btn-primary" style={{ padding: '10px 18px', fontSize: 14 }}>
              Sign in
            </button>
          )}
        </div>
      </nav>

      <main id="main-content" className="hero">
        <div className="hero__split">
          {/* LEFT: copy + CTA */}
          <div className="hero__copy">
            <div className="hero__badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 4H3v3a3 3 0 0 0 3 3M19 4h2v3a3 3 0 0 1-3 3" strokeLinecap="round" />
              </svg>
              Community Drop 2026
            </div>

            <h1 className="hero__title">Your card.<br />Your team.<br />The album is waiting.</h1>
            <p className="hero__sub">
              Connect Discord, pick a position, choose your kit, write your motto.
              Your card joins the public squad album next to the moderators.
            </p>

            {authError && (
              <div className="status-banner status-banner--rejected" style={{ marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                {authError}
              </div>
            )}

            {connecting && (
              <div className="status-banner status-banner--pending" style={{ marginBottom: 16 }}>
                <div className="spinner" />
                Verifying your Discord identity
              </div>
            )}

            {!backendReady && !user && !connecting && (
              <div className="status-banner status-banner--pending" style={{ marginBottom: 16 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
                Backend not configured. Sign-in works; submission needs Supabase + Discord webhook.
              </div>
            )}

            {!connecting && !user && (
              <div className="btn-row">
                <button onClick={handleConnect} className="btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.056a19.93 19.93 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .036-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Connect Discord to start
                </button>
                <Link href="/gallery" className="btn-secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M3 9h18M9 3v18" strokeLinecap="round" />
                  </svg>
                  See the album
                </Link>
              </div>
            )}

            {!connecting && user && (
              <>
                <div className="btn-row">
                  <Link href="/compose" className="btn-primary">
                    Build your card
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  <Link href="/gallery" className="btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <path d="M3 9h18M9 3v18" strokeLinecap="round" />
                    </svg>
                    See the album
                  </Link>
                  <button onClick={handleSignOut} className="btn-ghost" style={{ padding: '14px 16px' }}>
                    Sign out
                  </button>
                </div>

                <div className="user-card">
                  <img src={user.pfp_url} alt={user.username} />
                  <div style={{ flex: 1 }}>
                    <div className="user-card__name">{user.global_name || user.username}</div>
                    <div className="user-card__handle">
                      @{user.username}
                      {user.is_default_avatar && ' - default avatar (set a custom one first)'}
                    </div>
                  </div>
                  {user.magnitude && <span className="magnitude-tag" style={{ color: MAG_COLORS[user.magnitude], borderColor: MAG_COLORS[user.magnitude] }}>M{user.magnitude}</span>}
                </div>
              </>
            )}
          </div>

          {/* RIGHT: sample Panini card preview */}
          <div className="hero__preview" aria-hidden="true">
            <div className="hero__preview-card">
              <div className="card-preview-wrapper">
                <PaniniCard
                  username="archanist"
                  displayName="Archanist"
                  pfpUrl="https://cdn.discordapp.com/embed/avatars/0.png"
                  magnitude={7}
                  position="midfielder"
                  kit="home"
                  motto="Run until they can't."
                  stats={SAMPLE_STATS}
                  jerseyNumber={7}
                />
              </div>
            </div>
            <div className="hero__preview-pill hero__preview-pill--top">
              <span className="dot" />
              Live preview
            </div>
            <div className="hero__preview-pill hero__preview-pill--bottom">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-5z" strokeLinejoin="round" />
              </svg>
              Seismic verified
            </div>
          </div>
        </div>
      </main>

      {/* Bento grid: how it works + what's inside */}
      <section className="bento" aria-labelledby="features-title">
        <div className="bento__head">
          <div>
            <div className="bento__cell-label" style={{ marginBottom: 6 }}>
              <span className="num">/01</span>
              What's inside
            </div>
            <h2 id="features-title" className="bento__head-title">Four things. One card.</h2>
          </div>
          <p className="bento__head-sub">
            Each card packs your Discord identity, a chosen role on the pitch, a kit, and a motto.
            Stats derive from your Magnitude tier so collectors know what they're trading.
          </p>
        </div>

        <div className="bento__grid">
          {/* Cell A: kits (large) */}
          <Link href="/compose" className="bento__cell bento__cell--a" style={{ textDecoration: 'none' }}>
            <div className="bento__cell-label"><span className="num">A</span>Three kits</div>
            <h3 className="bento__cell-title">Home, away, or limited foil</h3>
            <p className="bento__cell-sub">
              Each kit has its own mood. The foil variant shimmers and ships with a signed rarity badge.
            </p>
            <div className="kits-preview">
              <div className="kit-mini">
                <div className="kit-mini__swatch kit-mini__swatch--home" />
                <div className="kit-mini__name">Home</div>
                <div className="kit-mini__stripe" />
              </div>
              <div className="kit-mini">
                <div className="kit-mini__swatch kit-mini__swatch--away" />
                <div className="kit-mini__name">Away</div>
                <div className="kit-mini__stripe" />
              </div>
              <div className="kit-mini">
                <div className="kit-mini__swatch kit-mini__swatch--foil" />
                <div className="kit-mini__name">Foil</div>
                <div className="kit-mini__stripe" />
              </div>
            </div>
          </Link>

          {/* Cell B: stats */}
          <Link href="/compose" className="bento__cell bento__cell--b" style={{ textDecoration: 'none' }}>
            <div className="bento__cell-label"><span className="num">B</span>Six stats</div>
            <h3 className="bento__cell-title">Magnitude drives your numbers</h3>
            <p className="bento__cell-sub">Derived from your Discord role, never fabricated.</p>
            <div className="stat-bars">
              {([
                ['PAC', 88], ['SHO', 74], ['PAS', 81], ['DRI', 85], ['OVR', 82],
              ] as const).map(([label, val]) => (
                <div key={label} className="stat-bar">
                  <span className="stat-bar__label">{label}</span>
                  <div className="stat-bar__track">
                    <div className="stat-bar__fill" style={{ '--pct': val / 100 } as CSSProperties} />
                  </div>
                  <span className="stat-bar__val">{val}</span>
                </div>
              ))}
            </div>
          </Link>

          {/* Cell C: magnitude tier visual */}
          <Link href="/gallery" className="bento__cell bento__cell--c" style={{ textDecoration: 'none' }}>
            <div className="bento__cell-label"><span className="num">C</span>Magnitude</div>
            <h3 className="bento__cell-title">Nine tiers, one badge</h3>
            <p className="bento__cell-sub">Your Discord role paints the jersey number and accent.</p>
            <div className="mag-stack">
              {MAG_TIERS.map((m) => (
                <div key={m} className={`mag-row ${m === userMag ? 'mag-row--yours' : ''}`}>
                  <span className="mag-row__dot" style={{ background: MAG_COLORS[m], boxShadow: m === userMag ? `0 0 8px ${MAG_COLORS[m]}` : 'none' }} />
                  <span>M{m}</span>
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{m === 1 ? 'grey' : m === 9 ? 'sky' : m === 7 ? 'copper' : 'tier'}</span>
                </div>
              ))}
            </div>
          </Link>

          {/* Cell D: album preview */}
          <Link href="/gallery" className="bento__cell bento__cell--d" style={{ textDecoration: 'none' }}>
            <div className="bento__cell-label"><span className="num">D</span>Permanent album</div>
            <h3 className="bento__cell-title">Public, on-chain, yours forever</h3>
            <p className="bento__cell-sub">Every approved card lives in the squad album. Browse, collect, brag.</p>
            <div className="album-preview">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`album-thumb ${i === 2 ? 'album-thumb--foil' : ''}`}>
                  <svg className="album-thumb__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="12" cy="9" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round" />
                  </svg>
                  {i === 1 && <span className="album-thumb__count">07</span>}
                  {i === 3 && <span className="album-thumb__count">09</span>}
                </div>
              ))}
            </div>
          </Link>
        </div>
      </section>

      <footer className="footer">
        <p>
          A community drop by <a href="https://x.com/ArchanistETH" target="_blank" rel="noreferrer">@ArchanistETH</a>
          {' - '}
          <Link href="/gallery">Album</Link>
          {' - '}
          <Link href="/compose">Build your card</Link>
        </p>
      </footer>
    </>
  );
}