// Local main / follow-up comparison. Full-page accessibility remains a legacy report.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { inspectPage } from '../../../e2e/helpers/inspect-page.ts';
import { parseSeoHtml, compareSeoSnapshots } from '../../../src/lib/seo-contract.ts';
const option = (key) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const base = option('base');
const label = option('label');
if (!base || !['before', 'after'].includes(label)) throw new Error('--base and --label=before|after required');
const paths = ['/en/digests', '/uk/digests'];
const seo = [];
for (const path of paths) {
  const response = await fetch(`${base}${path}`);
  seo.push(parseSeoHtml(await response.text(), path, response.status, new URL(response.url).pathname));
}
const browser = await chromium.launch();
const rows = [];
try {
  for (const route of paths) for (const theme of ['night', 'day']) for (const width of [320, 360, 390, 768, 1024, 1440, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, storageState: 'e2e/consent-state.json' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => { window.__name = (fn) => fn; });
    await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
    if (width === 1280) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
    }
    await page.goto(`${base}${route}`, { waitUntil: 'load' });
    await page.locator('main h1').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const inspection = await inspectPage(page, true);
    const headings = await page.locator('main h1, main h2, main h3').evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { tag: node.tagName, family: style.fontFamily, size: Number.parseFloat(style.fontSize), tracking: Number.parseFloat(style.letterSpacing) };
    }));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    rows.push({ route, theme, width, mode: width === 1280 ? 'text-200' : 'normal', inspection, headings, axe: axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })), errors });
    await context.close();
  }
} finally { await browser.close(); }
const summary = {
  scenarios: rows.length,
  overflow: rows.filter((row) => row.inspection.overflow.length).length,
  smallText: rows.reduce((sum, row) => sum + row.inspection.smallText.length, 0),
  h1Problems: rows.filter((row) => row.inspection.h1 !== 1).length,
  smallTargets: rows.reduce((sum, row) => sum + row.inspection.smallTargets.length, 0),
  axe: rows.reduce((sum, row) => sum + row.axe.length, 0),
  consoleErrors: rows.reduce((sum, row) => sum + row.errors.length, 0),
};
const trackingFailures = label === 'after' ? rows.flatMap((row) => row.route.startsWith('/uk') ? row.headings.filter((heading) => Math.abs(heading.tracking - heading.size * (heading.tag === 'H1' ? -0.012 : -0.008)) > 0.001) : []) : [];
let seoDiff = { errors: [], warnings: [] };
if (label === 'after') {
  const before = JSON.parse(await readFile('artifacts/_local/ah-1.5-tracking-audit-before.json', 'utf8'));
  for (const snapshot of seo) {
    const diff = compareSeoSnapshots(before.seo.find((row) => row.path === snapshot.path), snapshot);
    seoDiff.errors.push(...diff.errors);
    seoDiff.warnings.push(...diff.warnings);
  }
}
await writeFile(`artifacts/_local/ah-1.5-tracking-audit-${label}.json`, JSON.stringify({ base, label, summary, trackingFailures, seoDiff, seo, rows }, null, 2));
console.log(JSON.stringify({ summary, trackingFailures: trackingFailures.length, seoDiff }));
if (summary.overflow || summary.smallText || summary.h1Problems || summary.consoleErrors || trackingFailures.length || seoDiff.errors.length) process.exitCode = 1;
