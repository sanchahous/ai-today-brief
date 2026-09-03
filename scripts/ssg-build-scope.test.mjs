import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSiteAffectingPath,
  shouldSkipVercelBuild,
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
  });
});
