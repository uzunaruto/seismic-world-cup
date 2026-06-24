'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toPng } from 'html-to-image';
import { PaniniCard, PaniniCardProps } from '@/components/PaniniCard';
import { generateStats, Position, Kit, POSITION_LABELS, POSITION_SHORT, KIT_LABELS, MAG_COLORS } from '@/lib/stats';
import { useSession } from '@/lib/use-session';

type Status = 'idle' | 'submitting' | 'pending' | 'approved' | 'rejected';

const POSITIONS: Position[] = ['forward', 'midfielder', 'defender', 'goalkeeper', 'captain', 'coach'];
const KITS: Kit[] = ['home', 'away', 'foil'];

const MAX_MOTTO = 80;

const KIT_META: Record<Kit, { name: string; sub: string; visualClass: string }> = {
  home: { name: 'Home', sub: 'Copper on cream', visualClass: 'kit-swatch__visual--home' },
  away: { name: 'Away', sub: 'Obsidian on copper', visualClass: 'kit-swatch__visual--away' },
  foil: { name: 'Foil', sub: 'Limited shimmer', visualClass: 'kit-swatch__visual--foil' },
};

export default function Compose() {
  return <ComposeInner />;
}

function ComposeInner() {
  const router = useRouter();

  const { user, loading } = useSession();
  const [position, setPosition] = useState<Position>('midfielder');
  const [kit, setKit] = useState<Kit>('home');
  const [motto, setMotto] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  // Dynamic card scale: fit 1080x1620 card into available stage space
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateScale = () => {
      const stageRect = stage.getBoundingClientRect();
      const padding = 24 * 2; // composer__stage padding
      const availW = stageRect.width - padding;
      const availH = stageRect.height - padding;
      // Card aspect ratio 1080:1620 = 2:3
      const scaleW = availW / 1080;
      const scaleH = availH / 1620;
      const scale = Math.max(0.18, Math.min(scaleW, scaleH));
      stage.style.setProperty('--card-scale', String(scale));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(stage);
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [loading, user, router]);

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
      const png = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 1620,
        backgroundColor: kit === 'away' ? '#0a0806' : kit === 'foil' ? '#A87504' : '#A87504',
        skipFonts: true,
      });

      const formData = new FormData();
      const blob = await (await fetch(png)).blob();
      formData.append('card', blob, 'card.png');
      formData.append('position', position);
      formData.append('kit', kit);
      formData.append('motto', motto.trim());

      const res = await fetch('/api/submit', { method: 'POST', body: formData });
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

  if (loading) {
    return (
      <main className="composer">
        <div className="composer__stage" style={{ gridColumn: '1 / -1', minHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--parchment-soft)' }}>
            <div className="spinner" /> Loading your session
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const stats = generateStats(user.discord_id, position);
  const jerseyNumber = user.magnitude ?? 7;
  const displayName = user.global_name || user.username;
  const userMagColor = user.magnitude ? MAG_COLORS[user.magnitude] : '#A87504';

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

  const locked = status === 'submitting' || status === 'pending';

  return (
    <main className="composer">
      {/* Top bar with back nav */}
      <div className="composer__top">
        <Link href="/" className="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <div className="user-card" style={{ marginTop: 0, maxWidth: 'none' }}>
          <img src={user.pfp_url} alt={user.username} />
          <div>
            <div className="user-card__name">{displayName}</div>
            <div className="user-card__handle">@{user.username}</div>
          </div>
          {user.magnitude && (
            <span className="magnitude-tag" style={{ color: userMagColor, borderColor: userMagColor }}>
              M{user.magnitude}
            </span>
          )}
        </div>
      </div>

      {/* Stage: live card preview */}
      <section className="composer__stage" aria-label="Card preview" ref={stageRef}>
        <div className="card-preview-wrapper">
          <PaniniCard ref={cardRef} {...cardProps} />
        </div>
        {rendering && (
          <div className="card-rendering-overlay">
            <div className="spinner" />
            Rendering your card
          </div>
        )}
      </section>

      {/* Panel: selectors */}
      <aside className="composer__panel" aria-label="Card options">
        <div>
          <div className="bento__cell-label" style={{ marginBottom: 4 }}>Step 1 / 3</div>
          <h1 className="composer__title">Pick your <em>position</em></h1>
        </div>

        <div className="field">
          <label className="field__label">
            Formation
            <span className="field__counter">{POSITION_LABELS[position]}</span>
          </label>
          <div className="positions" role="radiogroup" aria-label="Position">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={position === p}
                aria-label={POSITION_LABELS[p]}
                className={`position-chip ${position === p ? 'position-chip--active' : ''}`}
                onClick={() => setPosition(p)}
                disabled={locked}
              >
                <span className="position-chip__badge">{POSITION_SHORT[p]}</span>
                <span className="position-chip__name">{POSITION_LABELS[p]}</span>
                <span className="position-chip__pos">P{['forward', 'midfielder', 'defender', 'goalkeeper', 'captain', 'coach'].indexOf(p) + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Stats
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--copper-bright)' }}>
                M{user.magnitude ?? 7}
              </span>
            </span>
            <span className="field__counter">live</span>
          </label>
          <div className="stat-strip">
            {(['PAC', 'SHO', 'PAS', 'DRI', 'OVR'] as const).map((k) => (
              <div key={k} className="stat-cell">
                <span className="stat-cell__label">{k}</span>
                <span className="stat-cell__val">{stats[k.toLowerCase() as keyof typeof stats]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Step 2 / 3
              Kit
            </span>
            <span className="field__counter">{KIT_META[kit].name}</span>
          </label>
          <div className="kits" role="radiogroup" aria-label="Kit">
            {KITS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kit === k}
                className={`kit-swatch ${kit === k ? 'kit-swatch--active' : ''}`}
                onClick={() => setKit(k)}
                disabled={locked}
              >
                <div className={`kit-swatch__visual ${KIT_META[k].visualClass}`} />
                <div className="kit-swatch__name">{KIT_META[k].name}</div>
                <div className="kit-swatch__sub">{KIT_META[k].sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Step 3 / 3
              Motto
            </span>
            <span className="field__counter">{motto.length} / {MAX_MOTTO}</span>
          </label>
          <input
            type="text"
            value={motto}
            onChange={(e) => setMotto(e.target.value.slice(0, MAX_MOTTO))}
            placeholder="We're going all the way"
            maxLength={MAX_MOTTO}
            disabled={locked}
          />
        </div>

        {user.is_default_avatar && (
          <div className="status-banner status-banner--rejected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            You need a custom Discord avatar before submitting.
          </div>
        )}

        {status === 'idle' && (
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={user.is_default_avatar || !motto.trim()}
            style={{ alignSelf: 'stretch', justifyContent: 'center' }}
          >
            Submit to curator review
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {status === 'submitting' && (
          <button className="btn-primary" disabled style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
            <div className="spinner" />
            Rendering + uploading
          </button>
        )}
        {status === 'pending' && (
          <div className="status-banner status-banner--pending">
            <div className="spinner" />
            Waiting for curator review. Usually under 1 hour.
          </div>
        )}
        {status === 'approved' && (
          <div className="status-banner status-banner--approved">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Approved
            <Link href="/gallery" style={{ marginLeft: 'auto', textDecoration: 'underline', fontWeight: 600 }}>
              See the album
            </Link>
          </div>
        )}
        {status === 'rejected' && (
          <div className="status-banner status-banner--rejected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
            Rejected{error ? `: ${error}` : ''}
          </div>
        )}

        {error && status === 'idle' && (
          <div className="status-banner status-banner--rejected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {cardUrl && (
          <a href={cardUrl} download={`seismic-card-${user.username}.png`} className="btn-secondary" style={{ justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v14M5 10l7 7 7-7M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download your card
          </a>
        )}
      </aside>
    </main>
  );
}