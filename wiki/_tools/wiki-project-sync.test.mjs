import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractFact,
  extractIndexStatuses,
  resolveWatchedFiles,
  runProjectSync,
  toPosix,
} from './lib/project-sync.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('project-sync helpers', () => {
  it('toPosix normalizes separators', () => {
    assert.equal(toPosix('a\\b\\c.md'), 'a/b/c.md');
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
