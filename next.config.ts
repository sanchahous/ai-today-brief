import type { NextConfig } from 'next';

/**
 * One-time repair of pre-dedup history (mirrors `brief_items.canonical_item_id`
 * as of 2026-06-12): stories republished before the cross-day dedup went live
 * redirect straight to their earliest copy's current URL. Real HTTP 308 at the
 * edge — the page-level `permanentRedirect` fallback streams through the
 * `[lang]` loading boundary and can only emit a meta refresh with status 200.
 * The set is closed: the pipeline's exact-URL guard + semantic dedup prevent
 * new duplicates.
 *
 * `dst` points at the 2026-07-24 category-scoped URL directly (not the old
 * pack-scoped one) — these predate that migration, so leaving them as
 * pack-scoped would mean every one of these hits a second 308 through the
 * `[lang]/[brief]/[item]` redirect shim for no reason.
 */
const CANONICAL_ITEM_REDIRECTS: ReadonlyArray<{ src: string; dst: string }> = [
  {
    src: '/anthropic-s-opus-4-8-and-dynamic-workflows-reshape-agentic-coding/codegraph-slash-tool-calls-for-agents',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/anthropic-s-opus-4-8-and-dynamic-workflows-reshape-agentic-coding/terminal-coding-agent-ide-intelligence',
    dst: '/news/tools-and-releases/oh-my-pi-terminal-ai-agent',
  },
  {
    src: '/codegraph-cuts-agent-tool-calls-by-94-and-anthropic-sandboxes-claude-c/codegraph-slashes-agent-tool-calls',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/codegraph-cuts-agent-tool-calls-by-94-and-anthropic-sandboxes-claude-c/stop-slop-remove-ai-phrases',
    dst: '/news/vibe-coding/stop-slop-prompt-skills',
  },
  {
    src: '/codegraph-cuts-tool-calls-by-ninety-four-percent-plus-stanford-claude-/anthropic-cybersecurity-agent-skills',
    dst: '/news/agents-and-mcp/anthropic-cybersecurity-skills-for-ai-agents',
  },
  {
    src: '/codegraph-cuts-tool-calls-by-ninety-four-percent-plus-stanford-claude-/codegraph-cuts-agent-tool-calls',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/cursor-plugins-and-codegraph-lead-today-s-developer-ai-breakthroughs/anthropic-cybersecurity-agent-skills',
    dst: '/news/agents-and-mcp/anthropic-cybersecurity-skills-for-ai-agents',
  },
  {
    src: '/cursor-plugins-and-codegraph-lead-today-s-developer-ai-breakthroughs/codegraph-agent-tool-call-reduction',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/cursor-plugins-and-codegraph-lead-today-s-developer-ai-breakthroughs/cursor-official-plugins-extension-ecosystem',
    dst: '/news/tools-and-releases/cursor-plugins-official-extensions',
  },
  {
    src: '/cursor-plugins-and-codegraph-optimize-claude-code-token-usage/anthropic-cybersecurity-skills-for-agents',
    dst: '/news/agents-and-mcp/anthropic-cybersecurity-skills-for-ai-agents',
  },
  {
    src: '/cursor-plugins-and-codegraph-optimize-claude-code-token-usage/codegraph-slashes-agent-tool-calls',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/cursor-plugins-and-codegraph-optimize-claude-code-token-usage/cursor-plugins-official-ide-extensions',
    dst: '/news/tools-and-releases/cursor-plugins-official-extensions',
  },
  {
    src: '/optimizing-agentic-workflows-reducing-tool-costs-and-controlling-deskt/anthropic-cybersecurity-agent-skills',
    dst: '/news/agents-and-mcp/anthropic-cybersecurity-skills-for-ai-agents',
  },
  {
    src: '/optimizing-agentic-workflows-reducing-tool-costs-and-controlling-deskt/codegraph-slashes-agent-tool-calls',
    dst: '/news/optimization/codegraph-slashes-agent-tool-calls',
  },
  {
    src: '/optimizing-agentic-workflows-reducing-tool-costs-and-controlling-deskt/oh-my-pi-terminal-agent',
    dst: '/news/tools-and-releases/oh-my-pi-terminal-ai-agent',
  },
];

const nextConfig: NextConfig = {
  // Baseline hardening for every response. Kept minimal on purpose: no CSP
  // yet (inline JSON-LD + GA/GTM need a nonce rollout of its own), and
  // X-Frame-Options is omitted in favour of the frame-ancestors-less default
  // until an embed use-case demands one.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
  experimental: {
    // Authenticated CMS uploads are validated again in the Server Action and
    // capped at 12 MB; multipart overhead requires a little extra headroom.
    serverActions: {
      bodySizeLimit: '13mb',
    },
  },
  // PDFKit, PDF.js and Sharp resolve fonts/native canvas at runtime. Keeping
  // them external prevents the bundler from parsing binaries, while the trace
  // includes ship the Linux canvas binding with server routes.
  serverExternalPackages: [
    '@napi-rs/canvas',
    'dejavu-fonts-ttf',
    'pdf-to-img',
    'pdfjs-dist',
    'pdfkit',
  ],
  outputFileTracingIncludes: {
    '/*': [
      'node_modules/@napi-rs/canvas/**/*',
      'node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      'node_modules/dejavu-fonts-ttf/ttf/*.ttf',
      'node_modules/pdfkit/js/data/**/*',
      // `pdf-to-img` delegates rendering to PDF.js. The package dynamically
      // locates these support files at runtime, so include them explicitly
      // when its modules are kept external in a Vercel function.
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      'node_modules/pdfjs-dist/cmaps/**/*',
      'node_modules/pdfjs-dist/standard_fonts/**/*',
    ],
  },
  images: {
    // Hero images are the source articles' og:image — arbitrary publisher
    // hosts by nature (news aggregation), so allow any https origin.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    // Vercel's optimizer is bypassed entirely: its quota ran out on 2026-08-14
    // and `/_next/image` started answering 402 for every image on the site
    // while the origin files were healthy. `src/lib/image-loader.ts` resizes
    // our own Supabase card images through Supabase Storage as WebP and passes
    // publisher images through untouched. See wiki/ops/vercel-image-quota.md.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async redirects() {
    return [
      {
        // Brief + item slugs were renamed after Google had already discovered
        // the original URL (GSC 404 of 2026-06-12).
        source:
          '/:lang(en|uk)/ai-agents-in-the-wild-new-tools-behaviors/openai-s-codex-enables-browser-based-ios-app-development-and-testing',
        destination: '/:lang/news/tools-and-releases/openai-codex-now-supports-in-browser-ios-app-development-and-testing',
        permanent: true,
      },
      ...CANONICAL_ITEM_REDIRECTS.map(({ src, dst }) => ({
        source: `/:lang(en|uk)${src}`,
        destination: `/:lang${dst}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
