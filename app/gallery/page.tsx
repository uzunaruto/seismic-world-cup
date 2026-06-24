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
      <header className="gallery__header">
        <h1 className="gallery__title">The Album</h1>
        <p className="gallery__sub">
          Every card on this page was reviewed and approved by a Seismic curator.
        </p>
      </header>

      {error && (
        <div className="status-banner status-banner--rejected" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          ⚠️ {error}
        </div>
      )}

      {!items && !error && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading the album…
        </div>
      )}

      {items && items.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <p>
            No cards yet. <Link href="/" style={{ color: 'var(--copper-bright)' }}>Be the first to mint →</Link>
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

      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <Link href="/" className="btn-secondary">← Back to home</Link>
      </div>
    </main>
  );
}
