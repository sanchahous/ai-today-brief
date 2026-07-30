import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Logic-only coverage gate (≥70%). UI routes/components and Supabase IO are out of scope. */
const LOGIC_INCLUDE = [
  'src/lib/consent.ts',
  'src/lib/beehiiv-config.ts',
  'src/lib/site.ts',
  'src/lib/category-meta.ts',
  'src/lib/concept-meta.ts',
  'src/lib/news-filters.ts',
  'src/lib/sitemap-dates.ts',
  'src/lib/analytics-config.ts',
  'src/lib/analytics-client.ts',
  'src/lib/preferred-lang.ts',
  'src/lib/indexnow.ts',
  'src/lib/telegram-custom.ts',
  'src/lib/facts-visual.ts',
  'src/lib/prompt-lint.ts',
  'src/lib/prompt-lint-rules.ts',
  'src/lib/settings-builder.ts',
  'src/lib/settings-builder-rules.ts',
  'src/lib/tools-mentioned.ts',
  'pipeline/**/*.ts',
];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'src/test/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'pipeline/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: LOGIC_INCLUDE,
      exclude: [
        '**/*.test.ts',
        '**/__fixtures__/**',
        'pipeline/run-daily.ts',
        'pipeline/custom-news.ts',
        'pipeline/scripts/indexnow-backfill.ts',
        'pipeline/scripts/dedup-scan.ts',
        'pipeline/scripts/auto-publish.ts',
        'pipeline/publish.ts',
        'pipeline/summarize.ts',
        'pipeline/db.ts',
        'pipeline/log.ts',
        'pipeline/notify.ts',
        'pipeline/telegram.ts',
        'pipeline/sources/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
