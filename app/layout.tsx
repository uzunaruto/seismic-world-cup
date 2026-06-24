import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://seismic-world-cup.vercel.app';
const TITLE = 'Seismic World Cup - Your card. Your team.';
const DESCRIPTION = 'Build a Panini-style trading card with the Seismic moderators as your team. Connect Discord, pick a position, choose your kit, write your motto. The album is permanent.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Seismic World Cup',
  keywords: ['Seismic', 'World Cup', 'Panini card', 'Discord', 'Web3', 'community', 'trading card', 'Magnitude'],
  authors: [{ name: 'Archanist' }],
  creator: 'Archanist',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Seismic World Cup',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Seismic World Cup - Panini-style community trading card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
    creator: '@ArchanistETH',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#8a6f50',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Cinzel:wght@500;600;700&family=Caveat:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
