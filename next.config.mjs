/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.discordapp.com' },     // Discord avatars
      { protocol: 'https', hostname: 'media.discordapp.net' },   // Discord CDN alt
      { protocol: 'https', hostname: '*.supabase.co' },          // Supabase storage
      { protocol: 'https', hostname: 'replicate.delivery' },     // Replicate output
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
