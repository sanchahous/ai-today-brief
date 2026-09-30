// Reuse the other session's read-only mock server; never export or rebuild its data.
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { inspectPage } from '../../../e2e/helpers/inspect-page.ts';
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7);
if (!base) throw new Error('--base is required');
const suffixes = [
  '/news/tools-and-releases/mock-long-title',
  '/news/local-llms/mock-long-words',
  '/news/models-and-research/mock-long-article',
  '/weekly/mock-weekly-long',
];
const browser = await chromium.launch();
const rows = [];
try {
  for (const lang of ['en', 'uk']) for (const theme of ['night', 'day']) {
    for (const width of [320, 390, 1440, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: 'e2e/consent-state.json' });
      const page = await context.newPage();
      await page.addInitScript(() => { window.__name = (fn) => fn; });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
      if (width === 1280) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
      }
      for (const suffix of suffixes) {
        const route = `/${lang}${suffix}`;
        const response = await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 60000 });
        await page.locator('main h1').waitFor({ state: 'visible', timeout: 15000 });
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        const { smallText, h1, overflow } = await inspectPage(page, false);
        const family = await page.locator('main h1').evaluate((node) => getComputedStyle(node).fontFamily);
        rows.push({ route, theme, width, mode: width === 1280 ? 'text-200' : 'normal', status: response.status(), smallText, h1, overflow, family });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const failures = rows.filter((row) => row.status !== 200 || row.smallText.length || row.h1 !== 1 || row.overflow.length || (row.route.startsWith('/uk') && !row.family.startsWith('Georgia')));
await writeFile('artifacts/_local/ah-1.5-mock-type-matrix.json', JSON.stringify({ base, scenarios: rows.length, failures: failures.length, rows }, null, 2));
console.log(JSON.stringify({ scenarios: rows.length, failures: failures.length }));
if (failures.length) process.exitCode = 1;
