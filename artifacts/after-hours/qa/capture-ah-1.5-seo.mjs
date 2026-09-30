// Preserve the AH-0.4 URL set while comparing local main with the local typography branch.
// node --import tsx artifacts/after-hours/qa/capture-ah-1.5-seo.mjs --base=http://127.0.0.1:3106
import { readFile, writeFile } from 'node:fs/promises';
import { parseSeoHtml } from '../../../src/lib/seo-contract.ts';
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7);
if (!base) throw new Error('--base is required');
const baseline = JSON.parse(await readFile('e2e/fixtures/seo-contract.baseline.json', 'utf8'));
const routes = [];
for (const { path } of baseline.routes) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  const resolved = new URL(response.url);
  routes.push(parseSeoHtml(await response.text(), path, response.status, resolved.pathname + resolved.search));
}
await writeFile('artifacts/_local/ah-1.5-seo-local-main.json', JSON.stringify({ createdAt: new Date().toISOString(), base, routes }, null, 2));
console.log(`Local main SEO baseline: ${routes.length} routes`);
