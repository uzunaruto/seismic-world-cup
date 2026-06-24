'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface GalleryItem {
  id: string;
  handle: string;
  display_name: string;
  pfp_url: string;
  magnitude: number | null;
  composite_url: string;
  submitted_at: string;
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gallery')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setItems(d.gallery || []);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="gallery">
      <header className="gallery__header">
        <h1 className="gallery__title">Hall of Champions</h1>
        <p className="gallery__sub">Every selfie on this wall was reviewed and approved by a Seismic curator.</p>
      </header>

      {error && (
        <div className="status-banner status-banner--rejected" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          ⚠️ {error}
        </div>
      )}

      {!items && !error && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading the gallery…
        </div>
      )}

      {items && items.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <p>No champions yet. <Link href="/" style={{ color: 'var(--copper-bright)' }}>Be the first →</Link></p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="gallery__grid">
          {items.map((item) => (
            <article key={item.id} className="gallery__card">
              {item.composite_url && <img src={item.composite_url} alt={`@${item.handle}`} />}
              <div className="gallery__card-body">
                <img src={item.pfp_url} alt={item.handle} />
                <div>
                  <div className="gallery__card-name">{item.display_name || item.handle}</div>
                  <div className="gallery__card-handle">
                    @{item.handle}
                    {item.magnitude && ` · M${item.magnitude}`}
                  </div>
                </div>
              </div>
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
