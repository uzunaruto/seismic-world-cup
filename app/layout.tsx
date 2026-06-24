import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seismic World Cup',
  description: 'Take a selfie with the Seismic moderators — group photo as World Cup champions.',
  openGraph: {
    title: 'Seismic World Cup',
    description: 'Take a selfie with the Seismic moderators.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Cinzel:wght@500;700&family=Caveat:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
