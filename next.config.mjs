/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
      { protocol: 'https', hostname: 'media.discordapp.net' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // html-to-image generates data URLs / blobs in the browser; no special config needed
};

export default nextConfig;
