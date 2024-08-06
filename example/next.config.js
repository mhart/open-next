/** @type {import('next').NextConfig} */
const nextConfig = {
  /// start
  swcMinify: false,
  experimental: {
    serverMinification: false,
  },
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
  /// end
  reactStrictMode: true,
  cleanDistDir: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "**.unsplash.com",
      },
    ],
  },
};

module.exports = nextConfig;
