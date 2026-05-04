import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Wire OpenNext's Cloudflare bindings into `next dev`
// (no-op in production builds — it's the OpenNext build that produces the worker).
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
