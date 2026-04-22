/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Requis pour Dockerfile.web multi-stage (copie .next/standalone)
  output: 'standalone',
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'randocours.ma'] },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randocours-certifications.s3.me-south-1.amazonaws.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
