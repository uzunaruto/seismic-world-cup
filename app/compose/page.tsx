'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface DiscordUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  pfp_url: string;
  magnitude: number | null;
  is_default_avatar: boolean;
}

type Status = 'idle' | 'submitting' | 'pending' | 'approved' | 'rejected';

const SCENES = [
  { id: 'podium-raise', label: 'Podium raise', icon: '🏆' },
  // future: { id: 'locker-room', label: 'Locker room', icon: '🚿' },
];

export default function Compose() {
  const router = useRouter();
  const params = useSearchParams();
  const detectedMag = params.get('mag');

  const [user, setUser] = useState<DiscordUser | null>(null);
  const [scene, setScene] = useState('podium-raise');
  const [magnitude, setMagnitude] = useState<number | null>(detectedMag ? parseInt(detectedMag, 10) : null);
  const [status, setStatus] = useState<Status>('idle');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/discord/session')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.push('/');
        else {
          setUser(d.user);
          if (d.user.magnitude && !detectedMag) setMagnitude(d.user.magnitude);
        }
      });
  }, [router, detectedMag]);

  // Poll for status if pending
  useEffect(() => {
    if (status !== 'pending' || !submissionId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status/${submissionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'approved') setStatus('approved');
      if (data.status === 'rejected') {
        setStatus('rejected');
        setError(data.rejection_reason || 'Rejected by moderator');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, submissionId]);

  const handleSubmit = async () => {
    if (user?.is_default_avatar) {
      setError('You need a custom Discord avatar for face-swap to work. Set one in Discord and try again.');
      return;
    }
    setError(null);
    setStatus('submitting');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnitude, baseScene: scene }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Submission failed');
      }
      const data = await res.json();
      setSubmissionId(data.submissionId);
      setCompositeUrl(data.compositeUrl);
      setStatus('pending');
    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (!user) {
    return (
      <main className="composer">
        <div className="composer__stage">
          <div className="loading"><div className="spinner" /> Loading…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="composer">
      <section className="composer__stage">
        {compositeUrl ? (
          <img src={compositeUrl} alt="Your composited podium photo" />
        ) : (
          <div className="loading">
            <div className="spinner" />
            {status === 'submitting' ? 'Generating your podium photo…' : 'Preview will appear here'}
          </div>
        )}
      </section>

      <aside className="composer__panel">
        <h1 className="composer__title">
          Join the <em>champions</em>
        </h1>

        <div className="user-card">
          <img src={user.pfp_url} alt={user.username} />
          <div>
            <div className="user-card__name">
              {user.global_name || user.username}
              {user.magnitude && (
                <span style={{ marginLeft: 8, color: 'var(--copper-bright)' }}>M{user.magnitude}</span>
              )}
            </div>
            <div className="user-card__handle">@{user.username}</div>
          </div>
        </div>

        <div className="field">
          <label className="field__label">Scene</label>
          <div className="scene-picker">
            {SCENES.map((s) => (
              <button
                key={s.id}
                className={`scene-chip ${scene === s.id ? 'scene-chip--active' : ''}`}
                onClick={() => setScene(s.id)}
                disabled={status === 'submitting' || status === 'pending'}
              >
                <span style={{ marginRight: 6 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Magnitude (optional)</label>
          <div className="scene-picker">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => (
              <button
                key={m}
                className={`scene-chip ${magnitude === m ? 'scene-chip--active' : ''}`}
                onClick={() => setMagnitude(magnitude === m ? null : m)}
                disabled={status === 'submitting' || status === 'pending'}
              >
                M{m}
              </button>
            ))}
          </div>
          {user.magnitude && (
            <div style={{ fontSize: 12, color: 'var(--parchment-dim)' }}>
              Auto-detected from your Seismic Discord role. Adjust if needed.
            </div>
          )}
        </div>

        {user.is_default_avatar && (
          <div className="status-banner status-banner--rejected">
            ⚠️ You need a custom Discord avatar. Face-swap can't work on the default colored circle.
          </div>
        )}

        {status === 'idle' && (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={user.is_default_avatar}
          >
            Submit to curator review →
          </button>
        )}
        {status === 'submitting' && (
          <button className="btn-primary" disabled>
            <div className="spinner" />
            Generating…
          </button>
        )}
        {status === 'pending' && (
          <div className="status-banner status-banner--pending">
            <div className="spinner" />
            Waiting for curator review. This usually takes &lt; 1 hour.
          </div>
        )}
        {status === 'approved' && (
          <div className="status-banner status-banner--approved">
            ✅ Approved! <Link href="/gallery" style={{ marginLeft: 'auto', textDecoration: 'underline' }}>View in gallery</Link>
          </div>
        )}
        {status === 'rejected' && (
          <div className="status-banner status-banner--rejected">
            ❌ Rejected{error ? `: ${error}` : ''}
          </div>
        )}

        {error && status === 'idle' && (
          <div className="status-banner status-banner--rejected">⚠️ {error}</div>
        )}

        <Link href="/" style={{ fontSize: 13, color: 'var(--parchment-dim)', textAlign: 'center' }}>
          ← Back to home
        </Link>
      </aside>
    </main>
  );
}
