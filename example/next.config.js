/** @type {import('next').NextConfig} */
const nextConfig = {
  /// start
  swcMinify: false,
  experimental: {
    serverMinification: false,
    outputFileTracingIncludes: {
      "/pages/api/auth/[...nextauth]": [
        "../node_modules/preact/dist/preact.module.js",
        "../node_modules/preact-render-to-string/dist/index.module.js",
        "../node_modules/jose/dist/browser/**",
        "../node_modules/uuid/dist/esm-browser/**",
        "../node_modules/@panva/hkdf/dist/web/**",
      ],
    },
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
