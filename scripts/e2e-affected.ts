/**
 * Affected-spec selector for the e2e suite — with a DERIVED coverage map.
 *
 * Playwright's `--only-changed` is blind to our setup: specs drive a running server and
 * never *import* the components they exercise, so the module graph can't link "changed a
 * component" to "the spec that renders it". Instead of a hand-maintained map (which silently
 * rots), we derive the map every run:
 *
 *   1. Parse each spec for the `data-testid`s it asserts (`getByTestId('x')`,
 *      `[data-testid="x"]`) and the routes it visits (`/en/news`, …).
 *   2. Index `src/` for those testid string literals — catching both `data-testid="x"` and
 *      prop forms like `panelTestId="x"`. That yields `source file → spec` edges for free.
 *   3. Map visited routes to their `src/app/[lang]/<route>` page dir → `page file → spec` edges.
 *   4. A tiny OVERRIDES list covers the handful of specs that assert via ARIA roles / DOM
 *      structure (no testid) — the only thing left to maintain by hand.
 *
 * `--check` validates the map and FAILS (used by `pr:check` / CI) if a spec asserts a testid
 * that no longer exists in `src/` (drift), or a spec is unreachable by any source change. A
 * normal run validates first too, so you find out *before* the build what's missing.
 *
 * Selection rules:
 *   - Broad change (global layout/styles, config, shared e2e helpers, deps) → run ALL specs.
 *   - Derived edge (testid / route / override) → run just the covered specs.
 *   - Edited a spec → run that spec.
 *   - Unmapped but UI-affecting (`src/**`) change → run the smoke + layout canaries.
 *   - Only non-UI files → run NOTHING (exit 0).
 *
 * Everything runs on chromium; CI runs the full chromium+firefox+webkit matrix on the PR, so
 * even if a derived edge is missed, CI is the backstop.
 *
 * Run:   `npm run e2e:affected`           (select + run)
 *        `npm run e2e:affected -- --dry-run`   (show the plan, run nothing)
 *        `npm run e2e:check`              (validate the map only — fast, no build)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, type Dirent } from 'node:fs';

// --- named specs referenced by hand-written rules (the rest are auto-discovered) ----------
const SMOKE = 'e2e/smoke.spec.ts';
const LAYOUT = 'e2e/layout-regression.spec.ts';
const HEADER = 'e2e/header-layout.spec.ts';
const FOOTER = 'e2e/footer-newsletter.spec.ts';

/** Cheap canaries that visit many routes — the safety net for unmapped UI changes. */
const CORE = [SMOKE, LAYOUT];

// A changed path matching any BROAD pattern forces the whole chromium suite.
const BROAD: RegExp[] = [
  /^src\/app\/layout\.tsx$/, // root layout — wraps every page
  /^src\/app\/\[lang\]\/layout\.tsx$/, // locale layout — header/footer shell
  /^src\/app\/globals\.css$/, // global styles + the breakpoint tokens
  /^(next|postcss|tailwind)\.config\./,
  /^playwright\.config\./,
  /^e2e\/helpers\//, // shared test helpers (viewports, news-page, …)
  /^e2e\/consent-state\.json$/, // seeded storage state used by every spec
  /^src\/components\/icons\.tsx$/, // icon set used across the whole UI
  /^package(-lock)?\.json$/, // dependency bumps can ripple anywhere
];

// The ONLY hand-maintained edges: specs that assert via ARIA roles / DOM structure rather
// than a data-testid, so the derived testid index can't see them. `--check` tells you when a
// spec becomes unreachable and needs an entry here.
const OVERRIDES: Array<{ match: RegExp; specs: string[] }> = [
  { match: /^src\/components\/site-header(-chrome)?\.tsx$/, specs: [HEADER] },
  { match: /^src\/components\/header-search-field\.tsx$/, specs: [HEADER] },
  { match: /^src\/components\/site-footer\.tsx$/, specs: [FOOTER] },
  { match: /^src\/components\/home\/newsletter-(band|form)\.tsx$/, specs: [FOOTER] },
];

const LOCALES = 'en|uk'; // from src/lib/i18n.ts — matches the [lang] segment in routes

// --- tiny POSIX path helpers (git always emits forward slashes; readdir we normalise) -----
const toPosix = (p: string): string => p.replace(/\\/g, '/');
const dirOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const baseSpec = (p: string): string => p.replace(/^e2e\//, '');

function walk(dir: string, out: string[] = []): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// --- derive coverage from the specs + source ----------------------------------------------
const TESTID_RE = /getByTestId\(\s*['"`]([^'"`]+)['"`]|\[data-testid=['"]([^'"\]]+)['"]\]/g;
const ROUTE_RE = new RegExp(`(?<![\\w/])\\/(?:${LOCALES})(?![a-z0-9-])((?:\\/[a-z0-9-]+)*)`, 'g');

interface Coverage {
  specs: string[];
  specTestids: Map<string, string[]>; // spec → testids it asserts
  specRouteDirs: Map<string, string[]>; // spec → src/app dirs of the routes it visits
  testidToSpecs: Map<string, Set<string>>;
  routeDirToSpecs: Map<string, Set<string>>;
  testidToSources: Map<string, Set<string>>; // testid → src files that define it
  srcFiles: string[];
}

function buildCoverage(): Coverage {
  const specs = walk('e2e').filter((f) => /\.spec\.ts$/.test(f));
  const srcFiles = walk('src');
  const codeFiles = srcFiles.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !/\.test\.tsx?$/.test(f));

  const specTestids = new Map<string, string[]>();
  const specRouteDirs = new Map<string, string[]>();
  const testidToSpecs = new Map<string, Set<string>>();
  const routeDirToSpecs = new Map<string, Set<string>>();
  const allTestids = new Set<string>();

  for (const spec of specs) {
    const text = readFileSync(spec, 'utf8');
    const ids = new Set<string>();
    for (const m of text.matchAll(TESTID_RE)) ids.add(m[1] ?? m[2]);
    const dirs = new Set<string>();
    for (const m of text.matchAll(ROUTE_RE)) dirs.add(m[1] ? `src/app/[lang]${m[1]}` : 'src/app/[lang]');

    specTestids.set(spec, [...ids]);
    specRouteDirs.set(spec, [...dirs]);
    for (const id of ids) {
      allTestids.add(id);
      (testidToSpecs.get(id) ?? testidToSpecs.set(id, new Set()).get(id)!).add(spec);
    }
    for (const d of dirs) (routeDirToSpecs.get(d) ?? routeDirToSpecs.set(d, new Set()).get(d)!).add(spec);
  }

  // Index source for each asserted testid as a quoted string literal — matches both
  // `data-testid="x"` and prop forms (`panelTestId="x"`, `testId="x"`, `const X = 'x'`).
  const testidToSources = new Map<string, Set<string>>();
  for (const id of allTestids) testidToSources.set(id, new Set());
  for (const file of codeFiles) {
    const text = readFileSync(file, 'utf8');
    for (const id of allTestids) {
      if (text.includes(`"${id}"`) || text.includes(`'${id}'`) || text.includes(`\`${id}\``)) {
        testidToSources.get(id)!.add(file);
      }
    }
  }

  return { specs, specTestids, specRouteDirs, testidToSpecs, routeDirToSpecs, testidToSources, srcFiles };
}

/** Source file → specs it triggers, via the testids defined in it. */
function testidEdges(cov: Coverage): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const [id, sources] of cov.testidToSources) {
    const specs = cov.testidToSpecs.get(id) ?? new Set();
    for (const src of sources) {
      const set = edges.get(src) ?? edges.set(src, new Set()).get(src)!;
      for (const s of specs) set.add(s);
    }
  }
  return edges;
}

// --- validate the derived map -------------------------------------------------------------
function validate(cov: Coverage): string[] {
  const errors: string[] = [];
  const dirExists = (dir: string): boolean => cov.srcFiles.some((f) => f.startsWith(`${dir}/`));

  // Dangling: a spec asserts a testid that no source defines (renamed / removed).
  for (const [id, specs] of cov.testidToSpecs) {
    if ((cov.testidToSources.get(id)?.size ?? 0) === 0) {
      const who = [...specs].map(baseSpec).join(', ');
      errors.push(`testid "${id}" (asserted by ${who}) is not defined anywhere in src/ — renamed or removed?`);
    }
  }

  // Orphan: a spec that no source change can reach (no resolvable testid, route, or override).
  for (const spec of cov.specs) {
    const hasTestid = (cov.specTestids.get(spec) ?? []).some((id) => (cov.testidToSources.get(id)?.size ?? 0) > 0);
    const hasRoute = (cov.specRouteDirs.get(spec) ?? []).some(dirExists);
    const hasOverride = OVERRIDES.some((o) => o.specs.includes(spec));
    if (!hasTestid && !hasRoute && !hasOverride) {
      errors.push(
        `spec ${baseSpec(spec)} is unreachable by any source change — give it a data-testid it can assert, or add an OVERRIDES entry in scripts/e2e-affected.ts.`,
      );
    }
  }

  // Stale override: points at a spec file that no longer exists.
  for (const o of OVERRIDES) {
    for (const s of o.specs) {
      if (!cov.specs.includes(s)) errors.push(`OVERRIDES references missing spec ${baseSpec(s)} — remove or fix it.`);
    }
  }

  return errors;
}

// --- decide what to run -------------------------------------------------------------------
function plan(files: string[], cov: Coverage): { runAll: boolean; specs: string[]; reasons: string[] } {
  const edges = testidEdges(cov);
  const specs = new Set<string>();
  const reasons: string[] = [];
  let runAll = false;

  for (const f of files) {
    if (BROAD.some((r) => r.test(f))) {
      runAll = true;
      reasons.push(`${f} → ALL (broad)`);
      continue;
    }
    if (/^e2e\/.+\.spec\.ts$/.test(f)) {
      specs.add(f);
      reasons.push(`${f} → itself`);
      continue;
    }

    const hit = new Set<string>();
    for (const s of edges.get(f) ?? []) hit.add(s); // testid edges
    for (const s of cov.routeDirToSpecs.get(dirOf(f)) ?? []) hit.add(s); // route (page) edges
    for (const o of OVERRIDES) if (o.match.test(f)) o.specs.forEach((s) => hit.add(s));

    if (hit.size > 0) {
      hit.forEach((s) => specs.add(s));
      reasons.push(`${f} → ${[...hit].map(baseSpec).join(', ')}`);
    } else if (/^src\/.+\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f)) {
      CORE.forEach((s) => specs.add(s));
      reasons.push(`${f} → core net (smoke, layout)`);
    } else {
      reasons.push(`${f} → skip (no UI impact)`);
    }
  }

  return { runAll, specs: [...specs], reasons };
}

// --- git plumbing -------------------------------------------------------------------------
function git(args: string[]): string {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

function changedFiles(): string[] {
  // Override for previewing ("what would touching X run?") and for tests — comma/space separated.
  const override = process.env.E2E_AFFECTED_FILES;
  if (override) return [...new Set(override.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];

  const base = git(['merge-base', 'origin/main', 'HEAD']) || git(['merge-base', 'main', 'HEAD']) || 'HEAD';
  const out = [
    git(['diff', '--name-only', base, 'HEAD']), // committed since base
    git(['diff', '--name-only', 'HEAD']), // staged + unstaged (tracked)
    git(['ls-files', '--others', '--exclude-standard']), // new untracked
  ];
  return [...new Set(out.flatMap((s) => s.split('\n')).map((s) => toPosix(s.trim())).filter(Boolean))];
}

// --- server / build -----------------------------------------------------------------------
async function serverIsUp(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1000);
    await fetch('http://127.0.0.1:3000', { signal: ctrl.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

function runProductionBuild(): void {
  console.log('e2e:affected — no server on :3000; running production build first…\n');
  const b = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

function runPlaywright(playwrightArgs: string[]): never {
  const passthrough = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const args = ['playwright', 'test', ...playwrightArgs, '--project=chromium', ...passthrough];
  const r = spawnSync('npx', args, { stdio: 'inherit', shell: true });
  process.exit(r.status ?? 1);
}

// --- main ---------------------------------------------------------------------------------
async function main(): Promise<void> {
  const cov = buildCoverage();
  const errors = validate(cov);

  if (process.argv.includes('--check')) {
    if (errors.length > 0) {
      console.error('e2e:affected --check — coverage map is out of date:\n');
      for (const e of errors) console.error(`  ✗ ${e}`);
      console.error('');
      process.exit(1);
    }
    console.log(`e2e:affected --check — map OK (${cov.specs.length} specs, ${cov.testidToSpecs.size} testids).`);
    return;
  }

  // Normal/dry-run path. Surface drift before the build so you know what to fix.
  if (errors.length > 0) {
    console.error('e2e:affected — coverage map is out of date (run `npm run e2e:check` for detail):\n');
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('');
    process.exit(1);
  }

  const files = changedFiles();
  if (files.length === 0) {
    console.log('e2e:affected — no changes vs origin/main; skipping e2e.');
    return;
  }

  const { runAll, specs, reasons } = plan(files, cov);
  console.log(`e2e:affected — ${files.length} changed file(s):`);
  for (const r of reasons) console.log(`  ${r}`);
  console.log('');

  if (!runAll && specs.length === 0) {
    console.log('e2e:affected — no UI-affecting changes; skipping e2e.');
    return;
  }

  if (runAll) {
    console.log('e2e:affected — broad change detected → running the full chromium suite.\n');
  } else {
    console.log(`e2e:affected — running ${specs.length} spec(s) on chromium:\n  ${specs.join('\n  ')}\n`);
  }

  if (process.argv.includes('--dry-run')) {
    console.log('e2e:affected — --dry-run; not building or running anything.');
    return;
  }

  if (process.env.SKIP_BUILD === '1') {
    console.log('e2e:affected — SKIP_BUILD=1; assuming a server is reachable on :3000.\n');
  } else if (await serverIsUp()) {
    console.log('e2e:affected — reusing the server already on :3000 (skipping build).\n');
  } else {
    runProductionBuild();
  }

  runPlaywright(runAll ? [] : specs);
}

void main();
