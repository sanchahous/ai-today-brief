// Preserve hashes and summaries of ignored local evidence; never include environment files.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const files = [
  'artifacts/_local/ah-1-5-before/manifest.json',
  'artifacts/_local/ah-1-5-after/manifest.json',
  'artifacts/_local/ah-1.5-type-matrix-before.json',
  'artifacts/_local/ah-1.5-type-matrix-after.json',
  'artifacts/_local/ah-1.5-mock-type-matrix.json',
  'artifacts/_local/ah-1.5-full-qa-before.json',
  'artifacts/_local/ah-1.5-full-qa.json',
  'artifacts/_local/ah-1.5-font-cls.json',
  'artifacts/_local/ah-1.5-typography-final.log',
  'artifacts/_local/ah-1.5-pr-check.log',
  'artifacts/_local/ah-1.5-pr-check-docs.log',
  'artifacts/_local/ah-1.5-pr-check-final.log',
  'artifacts/_local/ah-1.5-pr-check-retry.log',
  'artifacts/_local/ah-1.5-push-attempt3-failed.log',
  'artifacts/_local/ah-1.5-theme-recheck.log',
  'artifacts/_local/ah-1.5-push.log',
  'artifacts/_local/ah-1.5-seo-main-compare.log',
  'artifacts/_local/ah-1.5-production-freshness.json',
];
const evidence = [];
for (const file of files) {
  const bytes = await readFile(file);
  const entry = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (file.endsWith('.json')) {
    const data = JSON.parse(bytes);
    if (data.summary) entry.summary = data.summary;
    if (data.scenarios) entry.summary = { scenarios: data.scenarios, failures: data.failures };
    if (file.endsWith('font-cls.json')) entry.summary = { scenarios: data.rows.length, maxCls: Math.max(...data.rows.map((row) => row.cls)) };
  }
  evidence.push(entry);
}
await writeFile('artifacts/after-hours/qa/ah-1.5-evidence.json', JSON.stringify({ evidence }, null, 2) + '\n');
console.log(`Recorded ${evidence.length} local evidence hashes.`);
