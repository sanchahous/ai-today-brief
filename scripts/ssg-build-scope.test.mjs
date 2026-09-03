import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSiteAffectingPath,
  parseGitNameOnly,
  shouldSkipLocalSiteBuild,
  shouldSkipVercelBuild,
  uniquePaths,
} from './ssg-build-scope.mjs';

describe('shouldSkipVercelBuild', () => {
  it('builds when src changes', () => {
    assert.equal(shouldSkipVercelBuild(['src/lib/items.ts', 'wiki/now.md']), false);
  });

  it('skips wiki-only and markdown-only', () => {
    assert.equal(shouldSkipVercelBuild(['wiki/now.md', 'wiki/log.md']), true);
    assert.equal(shouldSkipVercelBuild(['README.md']), true);
  });

  it('skips pipeline and migrations (site HTML unchanged)', () => {
    assert.equal(
      shouldSkipVercelBuild(['pipeline/rank.ts', 'supabase/migrations/20260101000000_x.sql']),
      true,
    );
  });

  it('skips gitignore, license, and scripts (no site HTML)', () => {
    assert.equal(
      shouldSkipVercelBuild(['.gitignore', 'library/tools/tts-generator/unpack_audio_scenes.js']),
      true,
    );
    assert.equal(shouldSkipVercelBuild(['LICENSE', 'scripts/ssg-build-scope.mjs']), true);
  });

  it('builds on an empty list (unknown diff — do not skip)', () => {
    assert.equal(shouldSkipVercelBuild([]), false);
  });
});

describe('isSiteAffectingPath', () => {
  it('treats public and package-lock as site-affecting', () => {
    assert.equal(isSiteAffectingPath('public/logo.png'), true);
    assert.equal(isSiteAffectingPath('package-lock.json'), true);
    assert.equal(isSiteAffectingPath('next.config.ts'), true);
  });

  it('ignores agent and experiment trees', () => {
    assert.equal(isSiteAffectingPath('.cursor/rules/00-core.mdc'), false);
    assert.equal(isSiteAffectingPath('experiments/run/report.md'), false);
    assert.equal(isSiteAffectingPath('.gitignore'), false);
    assert.equal(isSiteAffectingPath('scripts/ssg-build-scope.mjs'), false);
  });
});

describe('shouldSkipLocalSiteBuild', () => {
  it('skips a clean tree when git is ok', () => {
    assert.equal(shouldSkipLocalSiteBuild([], { gitOk: true }), true);
  });

  it('skips wiki-only the same way as Vercel', () => {
    assert.equal(shouldSkipLocalSiteBuild(['wiki/now.md'], { gitOk: true }), true);
  });

  it('builds when git is unknown or FORCE', () => {
    assert.equal(shouldSkipLocalSiteBuild(['wiki/now.md'], { gitOk: false }), false);
    assert.equal(shouldSkipLocalSiteBuild(['wiki/now.md'], { gitOk: true, force: true }), false);
  });

  it('builds when src changed', () => {
    assert.equal(shouldSkipLocalSiteBuild(['src/lib/items.ts'], { gitOk: true }), false);
  });
});

describe('parseGitNameOnly', () => {
  it('splits and posix-normalizes', () => {
    assert.deepEqual(parseGitNameOnly('wiki/now.md\r\nfoo\\bar.ts\n'), ['wiki/now.md', 'foo/bar.ts']);
    assert.deepEqual(uniquePaths(['a.ts', 'a.ts', './b.ts']), ['a.ts', 'b.ts']);
  });
});
