import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHECKS,
  CHECK_ORDER,
  CI_OWNED_ELSEWHERE,
  WORKFLOW_GATES,
  commandFor,
  globToRegExp,
  loadDerivedInputs,
  parseCoverageGlobs,
  planChecks,
  scriptTestFiles,
  wikiWatchedPaths,
} from './check-scope.mjs';
import { SKIP_SSG_PATH_RE } from './ssg-build-scope.mjs';

// Real derived inputs from the repo, so the tests also prove the contract/config still parse.
const derived = loadDerivedInputs();
const exists = () => true;
const plan = (files, opts = {}) => planChecks(files, { ...derived, exists, ...opts });

describe('derived inputs', () => {
  it('parses the wiki sync contract and the vitest logic scope from the repo', () => {
    assert.ok(derived.wikiPaths?.includes('supabase/migrations'));
    assert.ok(derived.wikiPaths?.includes('.env.example'));
    assert.ok(derived.coverageGlobs?.includes('pipeline/**/*.ts'));
    assert.ok(derived.coverageGlobs?.includes('src/lib/site.ts'));
  });

  it('returns null on unreadable input so callers fall back to the safe side', () => {
    assert.equal(wikiWatchedPaths('{not json'), null);
    assert.equal(parseCoverageGlobs('export default {}'), null);
  });

  it('globToRegExp handles ** and *', () => {
    assert.ok(globToRegExp('pipeline/**/*.ts').test('pipeline/rank.ts'));
    assert.ok(globToRegExp('pipeline/**/*.ts').test('pipeline/providers/vision.ts'));
    assert.ok(globToRegExp('src/lib/content-sim/**/*.ts').test('src/lib/content-sim/a/b.ts'));
    assert.ok(!globToRegExp('src/lib/site.ts').test('src/lib/site.tsx'));
    assert.ok(!globToRegExp('src/lib/*.ts').test('src/lib/ui/x.ts'));
  });
});

describe('planChecks — small changes run little', () => {
  it('wiki-only → wiki:check and nothing else', () => {
    const p = plan(['wiki/now.md', 'wiki/tasks/atb-90.md']);
    assert.equal(p.full, false);
    assert.deepEqual(p.checks, ['wiki']);
  });

  it('agent rules only → nothing at all', () => {
    const p = plan(['.cursor/rules/pr-gate.mdc', '.claude/launch.json']);
    assert.equal(p.full, false);
    assert.deepEqual(p.checks, []);
  });

  it('one component → static checks on that file + design ratchet + affected e2e', () => {
    const p = plan(['src/components/brand/brand-stage.tsx']);
    assert.equal(p.full, false);
    assert.deepEqual(p.checks, [
      'e2e-map',
      'design-raw',
      'typecheck',
      'lint',
      'unit',
      'build',
      'e2e',
    ]);
    assert.deepEqual(p.lintFiles, ['src/components/brand/brand-stage.tsx']);
    assert.deepEqual(commandFor('lint', p), [
      'npx',
      'eslint',
      '--no-warn-ignored',
      'src/components/brand/brand-stage.tsx',
    ]);
    assert.deepEqual(commandFor('unit', p).slice(0, 3), ['npx', 'vitest', 'related']);
    assert.ok(!p.checks.includes('wiki'));
    assert.ok(!p.checks.includes('coverage'));
    assert.ok(!p.checks.includes('migrations'));
  });

  it('a component CSS module → design ratchet + e2e, no TypeScript checks', () => {
    const p = plan(['src/components/home/hero.module.css']);
    assert.deepEqual(p.checks, ['e2e-map', 'design-raw', 'build', 'e2e']);
  });

  it('a logic file inside the coverage scope → full coverage instead of `vitest related`', () => {
    const p = plan(['src/lib/site.ts']);
    assert.ok(p.checks.includes('coverage'));
    assert.ok(!p.checks.includes('unit'));
  });

  it('a unit test file → related tests + typecheck + lint, no build or e2e', () => {
    const p = plan(['src/lib/items-nav.test.ts']);
    assert.deepEqual(p.checks, ['typecheck', 'lint', 'unit']);
    assert.deepEqual(p.unitFiles, ['src/lib/items-nav.test.ts']);
  });

  it('pipeline code → typecheck, lint, coverage — never build or e2e', () => {
    const p = plan(['pipeline/rank.ts']);
    assert.deepEqual(p.checks, ['typecheck', 'lint', 'coverage']);
  });

  it('a pipeline prompt (non-code) → the whole unit suite', () => {
    assert.deepEqual(plan(['pipeline/prompts/editor.md']).checks, ['wiki', 'coverage']);
  });

  it('a migration → migrations:check + wiki (the contract counts migrations)', () => {
    const p = plan(['supabase/migrations/20261029000000_x.sql']);
    assert.deepEqual(p.checks, ['wiki', 'migrations']);
  });

  it('a file the wiki contract watches pulls in wiki:check', () => {
    assert.ok(plan(['pipeline/card-image.ts']).checks.includes('wiki'));
    assert.ok(plan(['.env.example']).checks.includes('wiki'));
  });

  it('an e2e spec → e2e map + that spec + static checks', () => {
    const p = plan(['e2e/smoke.spec.ts']);
    assert.deepEqual(p.checks, ['e2e-map', 'typecheck', 'lint', 'e2e']);
  });

  it('a workflow change → the gate-sync tests', () => {
    assert.deepEqual(plan(['.github/workflows/e2e.yml']).checks, ['script-tests']);
  });

  it('deleted files still trigger typecheck but are not handed to eslint/vitest', () => {
    const p = planChecks(['src/lib/gone.ts'], { ...derived, exists: () => false });
    assert.ok(p.checks.includes('typecheck'));
    assert.ok(!p.checks.includes('lint'));
    assert.ok(!p.checks.includes('unit'));
  });
});

describe('planChecks — broad or unknown runs everything', () => {
  const FULL = CHECK_ORDER.filter((id) => id !== 'unit');

  for (const file of [
    'package.json',
    'package-lock.json',
    'next.config.ts',
    'tsconfig.json',
    'eslint.config.mjs',
    'vitest.config.ts',
    'playwright.config.ts',
    'src/lib/i18n.ts',
    'src/app/layout.tsx',
    'src/app/[lang]/layout.tsx',
    'src/app/globals.css',
    'src/proxy.ts',
    'scripts/check-scope.mjs',
    'scripts/check-affected.mjs',
  ]) {
    it(`${file} → full suite`, () => {
      const p = plan([file]);
      assert.equal(p.full, true);
      assert.deepEqual(p.checks, FULL);
      assert.deepEqual(commandFor('lint', p), ['npm', 'run', 'lint']);
    });
  }

  it('an unknown path → full suite, and says why', () => {
    const p = plan(['wiki/now.md', 'brand-new-dir/thing.txt']);
    assert.equal(p.full, true);
    assert.match(p.fullReasons.join('\n'), /brand-new-dir\/thing\.txt \(unknown path/);
  });

  it('--all → full suite even for a wiki-only diff', () => {
    assert.deepEqual(plan(['wiki/now.md'], { all: true }).checks, FULL);
  });

  it('an unreadable wiki contract → wiki:check runs for every path', () => {
    const p = planChecks(['pipeline/rank.ts'], { ...derived, wikiPaths: null, exists });
    assert.ok(p.checks.includes('wiki'));
  });

  it('an unparseable coverage scope → any code change runs full coverage', () => {
    const p = planChecks(['src/components/x.tsx'], { ...derived, coverageGlobs: null, exists });
    assert.ok(p.checks.includes('coverage'));
  });
});

describe('planChecks — flags', () => {
  it('--no-e2e drops only Playwright', () => {
    const p = plan(['src/components/brand/brand-stage.tsx'], { e2e: false });
    assert.ok(!p.checks.includes('e2e'));
    assert.ok(p.checks.includes('build'));
  });

  it('--ci drops what other PR workflows already run', () => {
    const p = plan(['package.json'], { ci: true });
    assert.deepEqual(p.checks, ['wiki', 'e2e-map', 'script-tests', 'typecheck', 'lint']);
    for (const id of p.checks) assert.ok(!CI_OWNED_ELSEWHERE.has(id));
  });

  it('--ci on a wiki-only PR needs no npm install', () => {
    const p = plan(['wiki/now.md'], { ci: true });
    assert.deepEqual(p.checks, ['wiki']);
    assert.equal(CHECKS.wiki.needsDeps, false);
  });
});

describe('script-tests', () => {
  it('collects every scripts/*.test.mjs, including this file', () => {
    const files = scriptTestFiles();
    assert.ok(files.includes('scripts/check-scope.test.mjs'));
    assert.ok(files.includes('scripts/ssg-build-scope.test.mjs'));
  });
});

describe('CI gates stay in sync with this module', () => {
  const grepOf = (workflow) => {
    const text = readFileSync(`.github/workflows/${workflow}`, 'utf8');
    const m = text.match(/grep -qv?E '([^']+)'/);
    assert.ok(m, `${workflow} has no grep -qE/-qvE gate`);
    return m[1];
  };

  for (const [workflow, regex] of Object.entries(WORKFLOW_GATES)) {
    it(`${workflow} gate matches WORKFLOW_GATES`, () => {
      assert.equal(grepOf(workflow), regex);
    });
  }

  it('the e2e gate is SKIP_SSG_PATH_RE (the Vercel / build:ci skip set)', () => {
    assert.equal(WORKFLOW_GATES['e2e.yml'], SKIP_SSG_PATH_RE.source.replaceAll('\\/', '/'));
  });

  it('the sonar gate is the same set minus pipeline/', () => {
    assert.equal(
      WORKFLOW_GATES['sonarqube.yml'],
      WORKFLOW_GATES['e2e.yml'].replace('pipeline/|', ''),
    );
  });

  it('the deps and migration gates select what they claim', () => {
    const deps = new RegExp(WORKFLOW_GATES['deps-integrity.yml']);
    assert.ok(deps.test('package-lock.json'));
    assert.ok(!deps.test('src/package.json'));
    const mig = new RegExp(WORKFLOW_GATES['migrations-drift.yml']);
    assert.ok(mig.test('supabase/migrations/20261029000000_x.sql'));
    assert.ok(!mig.test('supabase/tests/x.sql'));
  });
});
