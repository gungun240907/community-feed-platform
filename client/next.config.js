/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Firebase disallows phone auth from localhost; local dev must run on 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    domains: ['localhost', 'via.placeholder.com', 'images.unsplash.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs', 'jsonwebtoken'],
  },
};

module.exports = nextConfig;
