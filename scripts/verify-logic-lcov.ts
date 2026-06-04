/**
 * Fails CI when a logic file in vitest coverage scope is missing from coverage/lcov.info.
 * Prevents Sonar "0% coverage on new code" surprises on PRs.
 *
 * Scope mirrors vitest.config.ts coverage.include.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LCOV_PATH = 'coverage/lcov.info';

const LOGIC_FILES = [
  'src/lib/consent.ts',
  'src/lib/beehiiv-config.ts',
  'src/lib/site.ts',
  'src/lib/category-meta.ts',
  'src/lib/concept-meta.ts',
  'src/lib/news-filters.ts',
  'src/lib/sitemap-dates.ts',
  'src/lib/analytics-config.ts',
  'src/lib/preferred-lang.ts',
] as const;

function lcovSourceFiles(lcov: string): Set<string> {
  const files = new Set<string>();
  for (const line of lcov.split('\n')) {
    if (!line.startsWith('SF:')) continue;
    files.add(line.slice(3).trim().replace(/\\/g, '/'));
  }
  return files;
}

function main(): void {
  let lcov: string;
  try {
    lcov = readFileSync(resolve(LCOV_PATH), 'utf8');
  } catch {
    console.error(`[verify-logic-lcov] Missing ${LCOV_PATH}. Run: npm run test:coverage`);
    process.exit(1);
  }

  const inLcov = lcovSourceFiles(lcov);
  const missing = LOGIC_FILES.filter((f) => !inLcov.has(f));

  if (missing.length > 0) {
    console.error('[verify-logic-lcov] Logic files not in lcov (Sonar may show 0% new coverage):');
    for (const f of missing) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.info(`[verify-logic-lcov] OK — ${LOGIC_FILES.length} logic file(s) present in ${LCOV_PATH}`);
}

main();
