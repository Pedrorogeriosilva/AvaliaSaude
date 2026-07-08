import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  webpack(config) {
    config.output = config.output || {};
    config.output.chunkLoadTimeout = 120000;
    return config;
  },
};

export default nextConfig;
