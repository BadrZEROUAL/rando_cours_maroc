/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove standalone output for Vercel deployment
  // output: 'standalone', // Only needed for Docker

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'randocours-certifications.s3.me-south-1.amazonaws.com',
      },
    ],
  },

  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://randocours.ma',
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },

  // Transpile packages from monorepo
  transpilePackages: ['@randocours/shared', '@randocours/db'],
};

module.exports = nextConfig;
