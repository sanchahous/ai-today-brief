import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const paths = [
  'artifacts/_local/ah-2-2-before/manifest.json', 'artifacts/_local/ah-2-2-after/manifest.json',
  'artifacts/_local/ah-2.2-components-final.log', 'artifacts/_local/ah-2.2-public-qa.json',
  'artifacts/_local/ah-2.2-public-qa-main.json', 'artifacts/_local/ah-2.2-seo-main-warm.json',
  'artifacts/_local/ah-2.2-seo-verified.log', 'artifacts/_local/ah-2.2-unit.log',
  'artifacts/_local/ah-2.2-tokens.log', 'artifacts/_local/ah-2.2-pr-check.log',
  'artifacts/_local/ah-2.2-pr-check-docs.log', 'artifacts/_local/ah-2.2-push.log',
  'artifacts/_local/ah-2.2-push-docs.log', 'artifacts/_local/ah-2-2-catalog/manifest.json',
  'artifacts/_local/ah-2.2-main-pr386.json', 'coverage/lcov.info',
  'artifacts/_local/ah-2.2-seo-before.json', 'artifacts/_local/ah-2.2-seo-after.log',
  'artifacts/_local/ah-2.2-push-attempt1-failed.log', 'artifacts/_local/ah-2.2-components-recheck.log',
  'artifacts/_local/ah-2.2-components-recheck-before-readiness.log',
  'artifacts/_local/ah-2.2-components-recheck-url-readiness.log', 'artifacts/_local/ah-2.2-seo-recheck-cold.log',
  'artifacts/_local/ah-2.2-pr387-status.json',
];
const evidence = [];
for (const file of paths) {
  let bytes;
  try { bytes = await readFile(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const item = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (file.endsWith('.json')) {
    const value = JSON.parse(bytes.toString());
    if (value.summary) item.summary = value.summary;
    if (value.files) item.screenshots = value.files.length;
  }
  evidence.push(item);
}
await writeFile('artifacts/after-hours/qa/ah-2.2-evidence.json', JSON.stringify({ baselineMain: 'c477b09', evidence }, null, 2) + '\n');
