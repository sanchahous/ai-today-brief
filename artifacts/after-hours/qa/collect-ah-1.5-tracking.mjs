import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const files = [
  'artifacts/_local/ah-1-5-tracking-before/manifest.json',
  'artifacts/_local/ah-1-5-tracking-after/manifest.json',
  'artifacts/_local/ah-1.5-tracking-audit-before.json',
  'artifacts/_local/ah-1.5-tracking-audit-after.json',
  'artifacts/_local/ah-1.5-tracking-typography-cold.log',
  'artifacts/_local/ah-1.5-tracking-typography.log',
  'artifacts/_local/ah-1.5-tracking-pr-check.log',
];
const evidence = [];
for (const file of files) {
  const bytes = await readFile(file);
  const entry = { file, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (file.includes('audit-')) {
    const report = JSON.parse(bytes);
    entry.summary = report.summary;
    entry.seoDiff = report.seoDiff;
    entry.trackingFailures = report.trackingFailures.length;
    const desktop = report.rows.find((row) => row.route === '/uk/digests' && row.width === 1440 && row.theme === 'night');
    entry.ukDesktopH1 = desktop.headings.find((heading) => heading.tag === 'H1');
  }
  evidence.push(entry);
}
await writeFile('artifacts/after-hours/qa/ah-1.5-tracking-evidence.json', JSON.stringify({ baselineMain: '2dea14c', evidence }, null, 2) + '\n');
console.log(`Recorded ${evidence.length} follow-up evidence hashes.`);
