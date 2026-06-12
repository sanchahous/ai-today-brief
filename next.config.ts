import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Hero images are the source articles' og:image — arbitrary publisher
    // hosts by nature (news aggregation), so allow any https origin and let
    // the image optimizer proxy/resize them.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async redirects() {
    return [
      {
        // Brief + item slugs were renamed after Google had already discovered
        // the original URL (GSC 404 of 2026-06-12).
        source:
          '/:lang(en|uk)/ai-agents-in-the-wild-new-tools-behaviors/openai-s-codex-enables-browser-based-ios-app-development-and-testing',
        destination:
          '/:lang/ai-agents-systems-and-apple-intelligence/openai-codex-now-supports-in-browser-ios-app-development-and-testing',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
