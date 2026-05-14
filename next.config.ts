import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 768, 1024, 1280, 1920],
    imageSizes: [64, 128, 256, 512],
    minimumCacheTTL: 31536000,
  },
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
