'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AlbumCard {
  id: string;
  username: string;
  global_name: string | null;
  pfp_url: string;
  magnitude: number | null;
  position: string;
  kit: string;
  motto: string;
  card_png_url: string | null;
  stats: { pac?: number; sho?: number; pas?: number; dri?: number; ovr?: number };
  submitted_at: string;
}

export default function Gallery() {
  const [items, setItems] = useState<AlbumCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/album')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setItems(d.album || []);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="gallery">
      <Link href="/" className="gallery__back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to home
      </Link>

      <header className="gallery__header">
        <div className="bento__cell-label" style={{ marginBottom: 8 }}>The album</div>
        <h1 className="gallery__title">Squad cards, approved.</h1>
        <p className="gallery__sub">
          Every card on this page was reviewed and approved by a Seismic curator.
          New drops arrive weekly.
        </p>
      </header>

      {error && (
        <div className="status-banner status-banner--rejected" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading the album
        </div>
      )}

      {items && items.length === 0 && (
        <div className="empty-state">
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(168, 117, 4, 0.10)',
            border: '1px solid var(--line-strong)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--copper-bright)" strokeWidth="1.6">
              <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 4H3v3a3 3 0 0 0 3 3M19 4h2v3a3 3 0 0 1-3 3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="empty-state__title">No cards yet</div>
          <p style={{ marginTop: 4 }}>
            Be the first on the squad sheet.{' '}
            <Link href="/" style={{ color: 'var(--copper-bright)', fontWeight: 600 }}>
              Build your card
            </Link>
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="album-grid">
          {items.map((item) => (
            <article key={item.id} className={`album-card album-card--${item.kit}`}>
              {item.card_png_url ? (
                <a href={item.card_png_url} target="_blank" rel="noopener noreferrer">
                  <img src={item.card_png_url} alt={`@${item.username}`} className="album-card__png" />
                </a>
              ) : (
                <div className="album-card__fallback">
                  <img src={item.pfp_url} alt={item.username} />
                  <div className="album-card__position">{item.position.toUpperCase()}</div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}