import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Hero images are the source articles' og:image — arbitrary publisher
    // hosts by nature (news aggregation), so allow any https origin and let
    // the image optimizer proxy/resize them.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
