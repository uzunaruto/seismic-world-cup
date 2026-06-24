'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildDiscordAuthUrl, readTokenFromHash, clearHash } from '@/lib/auth';
import { useSession } from '@/lib/use-session';

const REDIRECT_URI =
  typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:3000/';

export default function Home() {
  const router = useRouter();
  const { user, loading, backendReady, saveSession } = useSession();
  const [authError, setAuthError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Handle OAuth callback (token in URL hash)
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
        if (d.user) {
          saveSession(d.user);
          // Stay on landing so they see the post-login state
        }
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
    // Clear localStorage handled by useSession — caller should invoke clearSession,
    // but doing it inline here is also fine.
    try {
      localStorage.removeItem('swc_user');
    } catch {}
    router.refresh();
    window.location.reload();
  };

  return (
    <main className="hero">
      <span className="hero__badge">
        <span>🏆</span> Seismic World Cup 2026
      </span>

      <h1 className="hero__title">Your card. Your team. The album is waiting.</h1>
      <p className="hero__sub">
        Connect Discord, pick a position, choose your kit, write your motto.
        Your card joins the public squad album.
      </p>

      {authError && (
        <div className="status-banner status-banner--rejected" style={{ marginBottom: 16 }}>
          ⚠️ {authError}
        </div>
      )}

      {connecting && (
        <div className="status-banner status-banner--pending" style={{ marginBottom: 16 }}>
          <div className="spinner" />
          Verifying your Discord identity…
        </div>
      )}

      {!backendReady && !user && (
        <div className="status-banner status-banner--pending" style={{ marginBottom: 16 }}>
          ⚙️ Backend not configured yet. Discord auth works but submission/storage is disabled until Supabase + Discord webhook are set up.
        </div>
      )}

      {!connecting && !user && (
        <div className="btn-row">
          <button onClick={handleConnect} className="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.036.056a19.93 19.93 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .036-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Connect Discord to start
          </button>
          <Link href="/gallery" className="btn-secondary">
            See the album
          </Link>
        </div>
      )}

      {!connecting && user && (
        <>
          <div className="btn-row">
            <Link href="/compose" className="btn-primary">
              Build your card →
            </Link>
            <Link href="/gallery" className="btn-secondary">
              See the album
            </Link>
            <button onClick={handleSignOut} className="btn-secondary" style={{ fontSize: 13 }}>
              Sign out
            </button>
          </div>

          <div className="user-card" style={{ marginTop: 32 }}>
            <img src={user.pfp_url} alt={user.username} />
            <div>
              <div className="user-card__name">
                {user.global_name || user.username}
                {user.magnitude && (
                  <span style={{ marginLeft: 10, color: 'var(--copper-bright)', fontWeight: 700 }}>
                    M{user.magnitude}
                  </span>
                )}
              </div>
              <div className="user-card__handle">
                @{user.username}
                {user.is_default_avatar && ' · ⚠️ default avatar (set a custom one first)'}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="hero__features" style={{ marginTop: 64, maxWidth: 720, width: '100%' }}>
        <Link href="/compose" className="hero__feature hero__feature--clickable">
          <div className="hero__feature-icon">⚽</div>
          <div>
            <div className="hero__feature-title">Pick your position →</div>
            <div className="hero__feature-sub">Forward, midfielder, defender, GK, captain, or coach</div>
          </div>
        </Link>
        <Link href="/compose" className="hero__feature hero__feature--clickable">
          <div className="hero__feature-icon">🎨</div>
          <div>
            <div className="hero__feature-title">Three kits →</div>
            <div className="hero__feature-sub">Home copper, away obsidian, or limited foil</div>
          </div>
        </Link>
        <Link href="/gallery" className="hero__feature hero__feature--clickable">
          <div className="hero__feature-icon">🏟️</div>
          <div>
            <div className="hero__feature-title">Album is permanent →</div>
            <div className="hero__feature-sub">Browse the public squad page</div>
          </div>
        </Link>
      </div>
    </main>
  );
}