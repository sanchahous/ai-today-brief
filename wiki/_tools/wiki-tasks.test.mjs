import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { checkTaskFragments, renderRollup } from './lib/task-fragments.mjs';

const WIKI = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'fragment-test',
      GIT_AUTHOR_EMAIL: 'fragment-test@example.com',
      GIT_COMMITTER_NAME: 'fragment-test',
      GIT_COMMITTER_EMAIL: 'fragment-test@example.com',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('task status fragments', () => {
  it('preserves every moved block and the stable pointers', () => {
    const errors = checkTaskFragments(WIKI);
    assert.deepEqual(errors, []);
  });

  it('prints a rollup and does not write it into now.md', () => {
    const before = readFileSync(join(WIKI, 'now.md'), 'utf8');
    const rollup = renderRollup(WIKI);
    const after = readFileSync(join(WIKI, 'now.md'), 'utf8');
    assert.equal(after, before);
    assert.match(rollup, /`ah-3\.5`/);
    assert.match(rollup, /`atb-67`/);
    assert.doesNotMatch(rollup, /archive-shared-lines/);
  });

  it('merges two task branches that only add their own fragment', () => {
    const root = mkdtempSync(join(tmpdir(), 'wiki-fragment-merge-'));
    try {
      git(root, ['init', '-b', 'main']);
      writeFileSync(join(root, 'README.md'), 'base\n');
      git(root, ['add', 'README.md']);
      git(root, ['commit', '-m', 'base']);
      const base = git(root, ['rev-parse', 'HEAD']).trim();

      git(root, ['checkout', '-b', 'task-a', base]);
      mkdirSync(join(root, 'wiki', 'tasks'), { recursive: true });
      writeFileSync(join(root, 'wiki', 'tasks', 'task-a.md'), 'status A\n');
      git(root, ['add', 'wiki/tasks/task-a.md']);
      git(root, ['commit', '-m', 'task A fragment']);

      git(root, ['checkout', '-b', 'task-b', base]);
      mkdirSync(join(root, 'wiki', 'tasks'), { recursive: true });
      writeFileSync(join(root, 'wiki', 'tasks', 'task-b.md'), 'status B\n');
      git(root, ['add', 'wiki/tasks/task-b.md']);
      git(root, ['commit', '-m', 'task B fragment']);

      git(root, ['checkout', 'main']);
      git(root, ['merge', '--no-edit', 'task-a']);
      git(root, ['merge', '--no-edit', 'task-b']);

      const text = (name) => readFileSync(join(root, 'wiki', 'tasks', name), 'utf8').replace(/\r\n/g, '\n');
      assert.equal(text('task-a.md'), 'status A\n');
      assert.equal(text('task-b.md'), 'status B\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
