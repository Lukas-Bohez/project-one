import type { NextConfig } from 'next';

const portfolioBasePath = '/portfolio';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: portfolioBasePath,
  assetPrefix: `${portfolioBasePath}/`,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
