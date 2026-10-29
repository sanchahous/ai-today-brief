/**
 * Changed path → checks map for `npm run check:affected` (scripts/check-affected.mjs).
 *
 * Every changed path is matched against RULES; the checks of every matching rule are
 * unioned. Two safety valves keep this from ever weakening the gate silently:
 *
 *   - BROAD paths (deps, toolchain config, the root layouts, i18n, this selector itself)
 *     switch to the FULL suite — the same set `npm run pr:check` runs.
 *   - A path that matches no rule at all is UNKNOWN and also switches to the full suite.
 *     A new top-level file or folder therefore costs a full run until someone maps it here.
 *
 * Two parts of the map are derived instead of hand-written, so they cannot rot:
 *   - `wiki` fires for every path the wiki sync contract watches (wiki/_meta/project-sync.json:
 *     watcher paths, fact source files, counted dirs).
 *   - `coverage` (the ≥70% logic gate) fires for paths inside vitest's LOGIC_INCLUDE;
 *     other code gets `vitest related` on just the changed files.
 *
 * CI uses the same map (`--ci`) but drops the checks another PR workflow already owns —
 * see CI_OWNED_ELSEWHERE.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { posixPath, uniquePaths } from './ssg-build-scope.mjs';

/** Execution order: cheap and decisive first, build + e2e last. */
export const CHECK_ORDER = [
  'wiki',
  'e2e-map',
  'design-raw',
  'script-tests',
  'typecheck',
  'lint',
  'unit',
  'coverage',
  'migrations',
  'build',
  'e2e',
];

/** `needsDeps: false` → runs without node_modules (lets CI skip `npm ci`). */
export const CHECKS = {
  wiki: { label: 'wiki:check (project↔wiki sync + lint --strict)', needsDeps: false },
  'e2e-map': { label: 'e2e:check (e2e coverage map)', needsDeps: true },
  'design-raw': { label: 'design:raw:check (raw design values ratchet)', needsDeps: true },
  'script-tests': { label: 'node --test scripts/*.test.mjs', needsDeps: true }, // e2e-affected.test imports typescript
  typecheck: { label: 'typecheck (tsc --noEmit, whole project)', needsDeps: true },
  lint: { label: 'eslint', needsDeps: true },
  unit: { label: 'vitest related (tests that import the changed files)', needsDeps: true },
  coverage: { label: 'ci:check (all unit tests + ≥70% logic coverage)', needsDeps: true },
  migrations: { label: 'migrations:check (origin/main vs prod)', needsDeps: true },
  build: { label: 'build:ci (minimal-prerender next build)', needsDeps: true },
  e2e: { label: 'e2e:affected (chromium, affected specs; builds when needed)', needsDeps: true },
};

/**
 * Owned by another PR workflow — `--ci` leaves them out here:
 * build + coverage + design ratchet → sonarqube.yml, Playwright → e2e.yml,
 * prod drift → migrations-drift.yml. `unit` is a subset of sonar's full coverage run.
 */
export const CI_OWNED_ELSEWHERE = new Set(['build', 'coverage', 'unit', 'design-raw', 'migrations', 'e2e']);

const CODE_RE = /\.[cm]?[jt]sx?$/;
const TS_RE = /\.[cm]?tsx?$/;
const TEST_RE = /\.test\.[cm]?[jt]sx?$/;

/**
 * Full suite. Dependencies, toolchain config, shared shells every page renders through,
 * and the selector itself (a gate cannot vouch for its own change).
 */
export const BROAD_RULES = [
  { match: /^package(-lock)?\.json$/, why: 'dependencies' },
  { match: /^\.(npmrc|nvmrc|node-version)$/, why: 'toolchain' },
  { match: /^tsconfig(\..+)?\.json$|^next-env\.d\.ts$/, why: 'TypeScript config' },
  { match: /^(next|eslint|vitest|playwright|postcss|tailwind)\.config\.[cm]?[jt]s$/, why: 'toolchain config' },
  { match: /^src\/app\/(\[lang\]\/)?layout\.tsx$/, why: 'root layout wraps every page' },
  { match: /^src\/app\/globals\.css$/, why: 'global styles + tokens' },
  { match: /^src\/lib\/i18n\.ts$/, why: 'i18n is imported by every route' },
  { match: /^src\/proxy\.ts$/, why: 'proxy runs on every request' },
  { match: /^src\/(test|types)\//, why: 'shared test setup / global types' },
  { match: /^scripts\/(check-scope|check-affected|ssg-build-scope)\.mjs$/, why: 'the check selector itself' },
];

/**
 * Targeted rules. `checks` may be a function of the path. A rule with `checks: []` is a
 * deliberate "nothing to run" — it still marks the path as known.
 */
export const RULES = [
  // --- knowledge + agent tooling --------------------------------------------------------
  { match: /^wiki\//, checks: ['wiki'], why: 'wiki page / tooling' },
  // Wiki pages cite raw/, artifacts/, experiments/ and library/ as sources — a move or
  // delete breaks a link that wiki:lint --strict checks. Cheap (≈3 s).
  { match: /^(raw|artifacts|experiments|library)\//, checks: ['wiki'], why: 'cited by wiki sources' },
  { match: /\.md$/, checks: ['wiki'], why: 'markdown' },
  { match: /^\.(cursor|agents|claude)\//, checks: [], why: 'agent rules / skills — no runtime effect' },
  {
    match: /^(\.gitignore|\.gitattributes|\.editorconfig|LICENSE|\.prettierrc|\.prettierignore|\.mcp\.json|skills-lock\.json|sonar-project\.properties)$/,
    checks: [],
    why: 'repo metadata',
  },
  { match: /^(vercel\.json|\.vercelignore)$/, checks: [], why: 'deploy config — validated by the Vercel preview deploy' },
  { match: /^\.env\.example$/, checks: [], why: 'env template (wiki facts are derived below)' },
  { match: /^\.githooks\//, checks: [], why: 'git hook' },
  // The CI gates in workflows are pinned to this module by scripts/check-scope.test.mjs.
  { match: /^\.github\//, checks: ['script-tests'], why: 'CI config (gate regexes are unit-tested)' },

  // --- database -------------------------------------------------------------------------
  { match: /^supabase\/migrations\//, checks: ['migrations'], why: 'migration' },
  { match: /^supabase\/(tests\/|README\.md$)/, checks: [], why: 'SQL tests run by hand against a branch DB' },

  // --- scripts --------------------------------------------------------------------------
  {
    match: /^scripts\//,
    checks: (p) => ['script-tests', ...(TS_RE.test(p) ? ['typecheck'] : []), ...(CODE_RE.test(p) ? ['lint'] : [])],
    why: 'repo script',
  },
  { match: /^scripts\/e2e-(affected|server-url)\.ts$/, checks: ['e2e-map', 'e2e'], why: 'e2e selector / server URL' },
  {
    match: /^scripts\/(report-raw-design-values\.ts|raw-design-values\.baseline\.json|check-design-tokens\.ts)$/,
    checks: ['design-raw'],
    why: 'design ratchet',
  },
  { match: /^scripts\/(check-prod-migrations\.ts)$/, checks: ['migrations'], why: 'migration drift check' },
  {
    match: /^scripts\/(run-minimal-prerender-build|vercel-should-build)\.mjs$/,
    checks: ['build'],
    why: 'build wrapper',
  },

  // --- e2e specs ------------------------------------------------------------------------
  {
    match: /^e2e\//,
    checks: (p) => ['e2e-map', 'e2e', ...(TS_RE.test(p) ? ['typecheck', 'lint'] : [])],
    why: 'e2e spec / helper',
  },

  // --- pipeline (logic, never renders the site) -----------------------------------------
  {
    match: /^pipeline\//,
    // Non-code (prompts, fixtures) is read by code under test → run the whole suite.
    checks: (p) => (CODE_RE.test(p) ? ['typecheck', 'lint', 'unit'] : ['coverage']),
    why: 'pipeline',
  },

  // --- site -----------------------------------------------------------------------------
  {
    match: /^src\//,
    checks: (p) => {
      if (CODE_RE.test(p)) {
        const site = TEST_RE.test(p) ? [] : ['build', 'e2e'];
        return ['typecheck', 'lint', 'unit', ...site];
      }
      if (/\.json$/.test(p)) return ['typecheck', 'build', 'e2e']; // resolveJsonModule imports
      return ['build', 'e2e']; // css, svg, content, …
    },
    why: 'site source',
  },
  { match: /^src\/(app|components)\//, checks: (p) => (TEST_RE.test(p) ? [] : ['design-raw', 'e2e-map']), why: 'UI tree' },
  { match: /^src\/lib\/design-system\//, checks: ['design-raw'], why: 'design tokens' },
  { match: /^src\/lib\/supabase-migration-drift\.ts$/, checks: ['migrations'], why: 'migration drift logic' },
  { match: /^public\//, checks: ['build', 'e2e'], why: 'static asset' },
];

// --- derived: wiki sync contract ----------------------------------------------------------

/**
 * Paths whose change can fail `wiki:sync`. `null` when the contract cannot be read —
 * callers then run wiki:check for every change (it is cheap; correctness wins).
 */
export function wikiWatchedPaths(contractJson) {
  try {
    const contract = typeof contractJson === 'string' ? JSON.parse(contractJson) : contractJson;
    const out = [];
    for (const w of contract.watchers ?? []) out.push(...(w.paths ?? []));
    for (const f of contract.facts ?? []) if (f.fromFile) out.push(f.fromFile);
    for (const c of contract.counts ?? []) if (c.globDir) out.push(c.globDir);
    return uniquePaths(out).map((p) => p.replace(/\/+$/, ''));
  } catch {
    return null;
  }
}

const underAny = (path, prefixes) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

// --- derived: vitest logic-coverage scope -------------------------------------------------

/** LOGIC_INCLUDE globs from vitest.config.ts source, or `null` when the block can't be parsed. */
export function parseCoverageGlobs(vitestConfigSource) {
  const block = String(vitestConfigSource ?? '').match(/const LOGIC_INCLUDE\s*=\s*\[([\s\S]*?)\];/);
  if (!block) return null;
  const globs = [...block[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  return globs.length > 0 ? globs : null;
}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

// --- planning -----------------------------------------------------------------------------

/**
 * @param {string[]} changed repo-relative paths (deleted files included — a deleted module
 *   still breaks its importers, so it still triggers typecheck).
 * @param {object} [opts]
 * @param {boolean} [opts.all] force the full suite.
 * @param {boolean} [opts.ci] drop CI_OWNED_ELSEWHERE.
 * @param {boolean} [opts.e2e] include the e2e step (default true).
 * @param {string[]|null} [opts.wikiPaths] from wikiWatchedPaths(); null → wiki always runs.
 * @param {string[]|null} [opts.coverageGlobs] from parseCoverageGlobs(); null → any code → coverage.
 * @param {(path: string) => boolean} [opts.exists] for file-argument checks (lint, unit).
 */
export function planChecks(changed, opts = {}) {
  const {
    all = false,
    ci = false,
    e2e = true,
    wikiPaths = null,
    coverageGlobs = null,
    exists = (p) => existsSync(p),
  } = opts;
  const files = uniquePaths(changed.map(posixPath));
  const coverageRes = coverageGlobs ? coverageGlobs.map(globToRegExp) : null;

  const wanted = new Set();
  const lintFiles = [];
  const unitFiles = [];
  const lines = []; // human-readable "path → checks" trail
  const fullReasons = [];

  for (const path of files) {
    const broad = BROAD_RULES.find((r) => r.match.test(path));
    if (broad) {
      fullReasons.push(`${path} (${broad.why})`);
      lines.push(`${path} → FULL (${broad.why})`);
      continue;
    }

    const matched = RULES.filter((r) => r.match.test(path));
    const checks = new Set();
    for (const r of matched) {
      for (const c of typeof r.checks === 'function' ? r.checks(path) : r.checks) checks.add(c);
    }
    // Derived edges.
    const wikiHit = wikiPaths === null ? true : underAny(path, wikiPaths);
    if (wikiHit) checks.add('wiki');
    if (checks.has('unit')) {
      const inScope = coverageRes === null || coverageRes.some((re) => re.test(path));
      if (inScope && !TEST_RE.test(path)) {
        checks.delete('unit');
        checks.add('coverage');
      }
    }

    if (matched.length === 0 && !(wikiPaths !== null && wikiHit)) {
      fullReasons.push(`${path} (unknown path — not in scripts/check-scope.mjs)`);
      lines.push(`${path} → FULL (unknown path)`);
      continue;
    }

    for (const c of checks) wanted.add(c);
    if (checks.has('lint') && exists(path)) lintFiles.push(path);
    if ((checks.has('unit') || checks.has('coverage')) && CODE_RE.test(path) && exists(path)) unitFiles.push(path);
    lines.push(`${path} → ${checks.size ? [...checks].join(', ') : 'nothing (no runtime effect)'}`);
  }

  const full = all || fullReasons.length > 0;
  let ids;
  if (full) {
    // Full = everything; full coverage already runs every unit test.
    ids = CHECK_ORDER.filter((id) => id !== 'unit');
  } else {
    if (wanted.has('coverage')) wanted.delete('unit');
    if (wanted.has('lint') && lintFiles.length === 0) wanted.delete('lint'); // only deletions
    if (wanted.has('unit') && unitFiles.length === 0) wanted.delete('unit');
    ids = CHECK_ORDER.filter((id) => wanted.has(id));
  }
  if (ci) ids = ids.filter((id) => !CI_OWNED_ELSEWHERE.has(id));
  if (!e2e) ids = ids.filter((id) => id !== 'e2e');

  return { files, full, fullReasons, checks: ids, lintFiles, unitFiles, lines };
}

/** Script test files run by the `script-tests` check (every scripts/*.test.mjs). */
export function scriptTestFiles(dir = 'scripts') {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.test.mjs'))
      .sort()
      .map((f) => `${dir}/${f}`);
  } catch {
    return [];
  }
}

/** argv for one planned check. Lint/unit get the changed files unless the plan is full. */
export function commandFor(id, plan) {
  switch (id) {
    case 'wiki':
      return ['npm', 'run', 'wiki:check'];
    case 'e2e-map':
      return ['npm', 'run', 'e2e:check'];
    case 'design-raw':
      return ['npm', 'run', 'design:raw:check'];
    case 'script-tests':
      return ['node', '--test', ...scriptTestFiles()];
    case 'typecheck':
      return ['npm', 'run', 'typecheck'];
    case 'lint':
      return plan.full ? ['npm', 'run', 'lint'] : ['npx', 'eslint', '--no-warn-ignored', ...plan.lintFiles];
    case 'unit':
      return ['npx', 'vitest', 'related', '--run', '--passWithNoTests', ...plan.unitFiles];
    case 'coverage':
      return ['npm', 'run', 'ci:check'];
    case 'migrations':
      return ['npm', 'run', 'migrations:check'];
    case 'build':
      return ['npm', 'run', 'build:ci'];
    case 'e2e':
      return ['npm', 'run', 'e2e:affected'];
    default:
      throw new Error(`unknown check ${id}`);
  }
}

/** Reads the two derived inputs from the working tree. */
export function loadDerivedInputs(root = '.') {
  let wikiPaths = null;
  let coverageGlobs = null;
  try {
    wikiPaths = wikiWatchedPaths(readFileSync(`${root}/wiki/_meta/project-sync.json`, 'utf8'));
  } catch {
    wikiPaths = null;
  }
  try {
    coverageGlobs = parseCoverageGlobs(readFileSync(`${root}/vitest.config.ts`, 'utf8'));
  } catch {
    coverageGlobs = null;
  }
  return { wikiPaths, coverageGlobs };
}

// --- CI gates pinned to this module -------------------------------------------------------

/**
 * Path gates that live inside PR workflows as `grep -qE` / `grep -qvE` (a workflow-level
 * `paths:` filter would leave required checks stuck on "Expected"). The test suite reads
 * each workflow and fails if its grep drifts from the regex here.
 */
export const WORKFLOW_GATES = {
  // Site-affecting = NOT docs/ops. Mirrors SKIP_SSG_PATH_RE (scripts/ssg-build-scope.mjs).
  'e2e.yml':
    "^(wiki/|raw/|artifacts/|experiments/|library/|scripts/|supabase/migrations/|\\.github/|pipeline/|\\.cursor/|\\.agents/|\\.claude/|\\.gitignore$|\\.gitattributes$|\\.editorconfig$|LICENSE$)|\\.md$",
  // Same skip set minus pipeline/ — Sonar scans pipeline code.
  'sonarqube.yml':
    "^(wiki/|raw/|artifacts/|experiments/|library/|scripts/|supabase/migrations/|\\.github/|\\.cursor/|\\.agents/|\\.claude/|\\.gitignore$|\\.gitattributes$|\\.editorconfig$|LICENSE$)|\\.md$",
  // Install from lockfile only when the dependency manifest (or this gate) changed.
  'deps-integrity.yml': '^(package\\.json|package-lock\\.json|\\.npmrc|\\.nvmrc|\\.github/workflows/deps-integrity\\.yml)$',
  // Prod drift on a PR only when it adds a migration or changes the checker.
  'migrations-drift.yml':
    '^(supabase/migrations/|scripts/check-prod-migrations\\.ts$|src/lib/supabase-migration-drift\\.ts$|\\.github/workflows/migrations-drift\\.yml$)',
};
