import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import yaml from 'js-yaml';

// GitHub rejects a workflow file that does not parse ("workflow file issue"): the check never
// reports, so a REQUIRED check sits on "Expected" and the PR is BLOCKED. 2026-10-30: a literal
// newline inside `printf '%s\n'` ended a `run: |` block scalar at column 0 and took out
// deps-integrity.yml + migrations-drift.yml. Other tests read workflows as text and missed it.

const DIR = '.github/workflows';
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

/** `bash -n` on a script with GitHub expressions neutralised; null when bash is unavailable. */
function bashSyntaxError(script) {
  const source = script.replace(/\$\{\{[\s\S]*?\}\}/g, 'X');
  const result = spawnSync('bash', ['-n'], { input: source, encoding: 'utf8' });
  if (result.error) return null;
  return result.status === 0 ? '' : result.stderr.trim();
}

describe('.github/workflows', () => {
  it('has workflows to check', () => {
    assert.ok(files.length > 0);
  });

  for (const file of files) {
    describe(file, () => {
      const text = readFileSync(join(DIR, file), 'utf8');
      let doc;

      it('parses as YAML', () => {
        doc = yaml.load(text);
        assert.equal(typeof doc, 'object');
        assert.ok(doc && !Array.isArray(doc), 'top level must be a mapping');
      });

      it('declares triggers and jobs, every step runs or uses something', () => {
        doc ??= yaml.load(text);
        assert.ok('on' in doc || true in doc, 'missing `on:` (YAML 1.1 reads it as boolean true)');
        assert.ok(doc.jobs && typeof doc.jobs === 'object', 'missing `jobs:`');
        for (const [name, job] of Object.entries(doc.jobs)) {
          if (job.uses) continue; // reusable-workflow call has no steps
          assert.ok(Array.isArray(job.steps) && job.steps.length > 0, `job ${name} has no steps`);
          for (const step of job.steps) {
            assert.ok(step.run || step.uses, `job ${name}: step "${step.name ?? '?'}" has neither run nor uses`);
          }
        }
      });

      it('every bash run block is syntactically valid', () => {
        doc ??= yaml.load(text);
        for (const [name, job] of Object.entries(doc.jobs ?? {})) {
          for (const step of job.steps ?? []) {
            const shell = step.shell ?? job.defaults?.run?.shell ?? doc.defaults?.run?.shell;
            if (!step.run || (shell && !/^bash/.test(shell))) continue;
            const error = bashSyntaxError(step.run);
            if (error === null) return; // no bash on this machine: parse check above still ran
            assert.equal(error, '', `job ${name}, step "${step.name ?? '?'}": ${error}`);
          }
        }
      });
    });
  }
});
