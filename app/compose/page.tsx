'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { PaniniCard, PaniniCardProps } from '@/components/PaniniCard';
import { generateStats, Position, Kit, POSITION_LABELS, KIT_LABELS } from '@/lib/stats';

interface DiscordUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  pfp_url: string;
  magnitude: number | null;
  is_default_avatar: boolean;
}

type Status = 'idle' | 'submitting' | 'pending' | 'approved' | 'rejected';

const POSITIONS: Position[] = ['forward', 'midfielder', 'defender', 'goalkeeper', 'captain', 'coach'];
const KITS: Kit[] = ['home', 'away', 'foil'];

const MAX_MOTTO = 80;

export default function Compose() {
  return (
    <Suspense fallback={
      <main className="composer">
        <div className="composer__stage">
          <div className="loading"><div className="spinner" /> Loading…</div>
        </div>
      </main>
    }>
      <ComposeInner />
    </Suspense>
  );
}

function ComposeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const detectedMag = params.get('mag');

  const [user, setUser] = useState<DiscordUser | null>(null);
  const [position, setPosition] = useState<Position>('midfielder');
  const [kit, setKit] = useState<Kit>('home');
  const [motto, setMotto] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/discord/session')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.push('/');
        else {
          setUser(d.user);
          if (d.user.magnitude && !detectedMag) {
            // Could pre-select position based on Magnitude, but leave choice to user
          }
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
    if (!user || !cardRef.current) return;
    if (user.is_default_avatar) {
      setError('You need a custom Discord avatar first. Set one in Discord and try again.');
      return;
    }
    if (!motto.trim()) {
      setError('Pick a motto for your card.');
      return;
    }
    if (motto.length > MAX_MOTTO) {
      setError(`Motto must be ${MAX_MOTTO} characters or less.`);
      return;
    }

    setError(null);
    setStatus('submitting');
    setRendering(true);

    try {
      // 1. Render the card to PNG
      const png = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 1620,
        backgroundColor: kit === 'away' ? '#0a0806' : kit === 'foil' ? '#A87504' : '#A87504',
        skipFonts: true,    // fonts already in DOM
      });

      // 2. Upload PNG to server
      const formData = new FormData();
      const blob = await (await fetch(png)).blob();
      formData.append('card', blob, 'card.png');
      formData.append('position', position);
      formData.append('kit', kit);
      formData.append('motto', motto.trim());

      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Submission failed');
      }
      const data = await res.json();
      setSubmissionId(data.submissionId);
      setCardUrl(data.cardUrl);
      setStatus('pending');
    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    } finally {
      setRendering(false);
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

  const stats = generateStats(user.discord_id, position);
  const jerseyNumber = user.magnitude ?? 7;
  const displayName = user.global_name || user.username;

  const cardProps: PaniniCardProps = {
    username: user.username,
    displayName,
    pfpUrl: user.pfp_url,
    magnitude: user.magnitude,
    position,
    kit,
    motto: motto.trim(),
    stats,
    jerseyNumber,
  };

  return (
    <main className="composer">
      <section className="composer__stage">
        <div className="card-preview-wrapper">
          <PaniniCard ref={cardRef} {...cardProps} />
        </div>
        {rendering && (
          <div className="card-rendering-overlay">
            <div className="spinner" />
            Rendering your card…
          </div>
        )}
      </section>

      <aside className="composer__panel">
        <h1 className="composer__title">
          Build your <em>card</em>
        </h1>

        <div className="user-card">
          <img src={user.pfp_url} alt={user.username} />
          <div>
            <div className="user-card__name">
              {displayName}
              {user.magnitude && (
                <span style={{ marginLeft: 8, color: 'var(--copper-bright)' }}>M{user.magnitude}</span>
              )}
            </div>
            <div className="user-card__handle">@{user.username}</div>
          </div>
        </div>

        <div className="field">
          <label className="field__label">Position</label>
          <div className="scene-picker">
            {POSITIONS.map((p) => (
              <button
                key={p}
                className={`scene-chip ${position === p ? 'scene-chip--active' : ''}`}
                onClick={() => setPosition(p)}
                disabled={status === 'submitting' || status === 'pending'}
              >
                {POSITION_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">Kit</label>
          <div className="scene-picker">
            {KITS.map((k) => (
              <button
                key={k}
                className={`scene-chip ${kit === k ? 'scene-chip--active' : ''}`}
                onClick={() => setKit(k)}
                disabled={status === 'submitting' || status === 'pending'}
              >
                {KIT_LABELS[k]}
                {k === 'foil' && <span style={{ marginLeft: 6, opacity: 0.7 }}>✨</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Motto</span>
            <span style={{ opacity: 0.6 }}>{motto.length}/{MAX_MOTTO}</span>
          </label>
          <input
            type="text"
            value={motto}
            onChange={(e) => setMotto(e.target.value.slice(0, MAX_MOTTO))}
            placeholder="We're going all the way"
            maxLength={MAX_MOTTO}
            disabled={status === 'submitting' || status === 'pending'}
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              color: 'var(--parchment)',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {user.is_default_avatar && (
          <div className="status-banner status-banner--rejected">
            ⚠️ You need a custom Discord avatar before submitting.
          </div>
        )}

        {status === 'idle' && (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={user.is_default_avatar || !motto.trim()}
          >
            Submit to curator review →
          </button>
        )}
        {status === 'submitting' && (
          <button className="btn-primary" disabled>
            <div className="spinner" />
            Rendering + uploading…
          </button>
        )}
        {status === 'pending' && (
          <div className="status-banner status-banner--pending">
            <div className="spinner" />
            Waiting for curator review. Usually &lt; 1 hour.
          </div>
        )}
        {status === 'approved' && (
          <div className="status-banner status-banner--approved">
            ✅ Approved!{' '}
            <Link href="/gallery" style={{ marginLeft: 'auto', textDecoration: 'underline' }}>
              See the album
            </Link>
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

        {cardUrl && (
          <a href={cardUrl} download={`seismic-card-${user.username}.png`} className="btn-secondary">
            ⬇ Download your card
          </a>
        )}

        <Link href="/" style={{ fontSize: 13, color: 'var(--parchment-dim)', textAlign: 'center' }}>
          ← Back to home
        </Link>
      </aside>
    </main>
  );
}
