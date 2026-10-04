import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractFact,
  extractIndexStatuses,
  hasWorkingTreeChanges,
  resolveWatchedFiles,
  runProjectSync,
  toPosix,
  wikiLatestUnix,
  wikiTimestampPaths,
} from './lib/project-sync.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURE_GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'wiki-sync-test',
  GIT_AUTHOR_EMAIL: 'wiki-sync-test@example.com',
  GIT_COMMITTER_NAME: 'wiki-sync-test',
  GIT_COMMITTER_EMAIL: 'wiki-sync-test@example.com',
};

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    env: FIXTURE_GIT_ENV,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('project-sync helpers', () => {
  it('wikiTimestampPaths counts task fragments instead of forcing a now.md edit', () => {
    assert.deepEqual(wikiTimestampPaths(['pipeline/weekly-digest.md', 'now.md']), [
      'wiki/now.md',
      'wiki/pipeline/weekly-digest.md',
      'wiki/tasks',
    ]);
    assert.deepEqual(wikiTimestampPaths(['overview.md']), ['wiki/overview.md']);
  });

  it('toPosix normalizes separators', () => {
    assert.equal(toPosix('a\\b\\c.md'), 'a/b/c.md');
  });

  it('wikiLatestUnix treats uncommitted task fragments as fresh', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'));
    mkdirSync(join(root, 'wiki', 'tasks'), { recursive: true });
    writeFileSync(join(root, 'header.tsx'), 'export const x = 1;\n');
    writeFileSync(join(root, 'wiki', 'tasks', 'ah-4.4.md'), '# AH-4.4\n');
    git(root, ['init']);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'code']);
    writeFileSync(join(root, 'header.tsx'), 'export const x = 2;\n');
    git(root, ['add', 'header.tsx']);
    git(root, ['commit', '-m', 'newer code']);
    writeFileSync(join(root, 'wiki', 'tasks', 'ah-4.4.md'), '# AH-4.4\n\nupdated\n');
    assert.ok(hasWorkingTreeChanges(root, ['wiki/tasks']));
    const wikiTs = wikiLatestUnix(root, ['now.md'], 9_999_999_999);
    assert.equal(wikiTs, 9_999_999_999);
  });

  it('extractIndexStatuses splits ✅ and 📋 rows', () => {
    const body = `
| ✅ [pipeline/weekly-digest](pipeline/weekly-digest.md) | x |
| 📋 \`architecture/stack.md\` | y |
| 📋 \`seo/indexation\` | z |
`;
    const { existing, planned } = extractIndexStatuses(body);
    assert.deepEqual(existing, ['pipeline/weekly-digest.md']);
    assert.ok(planned.includes('architecture/stack.md'));
    assert.ok(planned.includes('seo/indexation.md'));
  });

  it('extractFact reads regex group from file', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'));
    writeFileSync(join(root, 'model.ts'), "export const DEFAULT = 'flux-2-klein-9b';\n");
    const result = extractFact(root, {
      fromFile: 'model.ts',
      regex: "DEFAULT\\s*=\\s*'([^']+)'",
    });
    assert.equal(result.ok, true);
    assert.equal(result.value, 'flux-2-klein-9b');
  });

  it('resolveWatchedFiles applies pathFilter', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'));
    mkdirSync(join(root, 'migrations'));
    writeFileSync(join(root, 'migrations', '20260101_weekly_digest.sql'), '--');
    writeFileSync(join(root, 'migrations', '20260102_other.sql'), '--');
    const files = resolveWatchedFiles(root, {
      paths: ['migrations'],
      pathFilter: 'weekly_digest',
    });
    assert.deepEqual(files, ['migrations/20260101_weekly_digest.sql']);
  });

  it('runProjectSync flags missing fact in wiki', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'));
    mkdirSync(join(root, 'wiki'), { recursive: true });
    writeFileSync(join(root, 'code.ts'), "export const V = 'must-appear';\n");
    writeFileSync(
      join(root, 'wiki', 'page.md'),
      '# T\n\nSummary: x\nSources: none\nLast updated: 2026-08-04\n\n---\n\nother\n',
    );
    writeFileSync(
      join(root, 'wiki', 'index.md'),
      '# Index\n\nSummary: x\nSources: none\nLast updated: 2026-08-04\n\n| ✅ [page](page.md) | |\n',
    );
    const findings = runProjectSync({
      repoRoot: root,
      wikiRoot: join(root, 'wiki'),
      contract: {
        watchers: [],
        facts: [
          {
            id: 'v',
            fromFile: 'code.ts',
            regex: "V\\s*=\\s*'([^']+)'",
            mustAppearIn: ['wiki/page.md'],
          },
        ],
        counts: [],
        index: { requireExistingForCheckmark: true, forbidExistingForPlanned: true },
      },
    });
    assert.ok(findings.some((f) => f.code === 'fact:v:missing-value'));
  });

  it('runProjectSync flags planned page that already exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-sync-'));
    mkdirSync(join(root, 'wiki', 'architecture'), { recursive: true });
    writeFileSync(
      join(root, 'wiki', 'index.md'),
      '# Index\n\nSummary: x\nSources: none\nLast updated: 2026-08-04\n\n| 📋 `architecture/stack.md` | |\n',
    );
    writeFileSync(
      join(root, 'wiki', 'architecture', 'stack.md'),
      '# Stack\n\nSummary: x\nSources: none\nLast updated: 2026-08-04\n',
    );
    const findings = runProjectSync({
      repoRoot: root,
      wikiRoot: join(root, 'wiki'),
      contract: {
        watchers: [],
        facts: [],
        counts: [],
        index: { requireExistingForCheckmark: true, forbidExistingForPlanned: true },
      },
    });
    assert.ok(findings.some((f) => f.code === 'index:planned-but-exists'));
  });
});
