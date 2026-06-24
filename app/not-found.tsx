import Link from 'next/link';

export const metadata = {
  title: 'Card not found - Seismic World Cup',
};

export default function NotFound() {
  return (
    <main className="notfound">
      <div className="notfound__inner">
        <div className="notfound__pitch">
          <svg viewBox="0 0 200 120" width="180" height="108" aria-hidden="true">
            <rect x="0" y="0" width="200" height="120" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <line x1="100" y1="0" x2="100" y2="120" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <circle cx="100" cy="60" r="14" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <rect x="0" y="20" width="30" height="80" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            <rect x="170" y="20" width="30" height="80" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
          </svg>
        </div>

        <div className="notfound__code">404</div>
        <h1 className="notfound__title">Off the pitch.</h1>
        <p className="notfound__sub">
          That page isn't on the squad list. Head back to the dressing room.
        </p>

        <div className="notfound__actions">
          <Link href="/" className="btn-primary">Back to kickoff</Link>
          <Link href="/gallery" className="btn-secondary">See the album</Link>
        </div>
      </div>
    </main>
  );
}
