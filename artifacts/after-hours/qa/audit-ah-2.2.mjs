// Run with node --import tsx; public pages retain legacy report mode.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { inspectPage } from '../../../e2e/helpers/inspect-page.ts';

const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3106';
const output = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/_local/ah-2.2-public-qa.json';
const routes = ['', '/news', '/news?categories=agents-and-mcp', '/category/agents-and-mcp',
  '/news/tools-and-releases/deep-dive-into-chatgpt-work-persistent-filesystem-web-browser-and-cloud-deployme'];
const scenarios = [];
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'uk']) for (const theme of ['night', 'day']) {
    for (const width of [320, 360, 390, 768, 1024, 1440, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true,
        reducedMotion: 'reduce', storageState: 'e2e/consent-state.json' });
      await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
      const page = await context.newPage();
      // tsx preserves function names with this helper inside serialized inspectPage callbacks.
      await page.addInitScript(() => { globalThis.__name = (fn) => fn; });
      if (width === 1280) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
      }
      for (const suffix of routes) {
        const errors = [];
        const onError = (error) => errors.push(error.message);
        const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
        page.on('pageerror', onError);
        page.on('console', onConsole);
        await page.goto(`${base}/${lang}${suffix}`);
        await page.locator('main h1').waitFor({ timeout: 30_000 });
        if (suffix.startsWith('/news') && !suffix.includes('/tools-and-releases/')) await page.getByTestId('post-card').first().waitFor();
        if (suffix.startsWith('/category/')) await page.getByTestId('post-card').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: 'nextjs-portal { display:none!important } *,*::before,*::after { transition:none!important }' });
        const inspection = await inspectPage(page, true);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        const migratedTargets = await page.locator('button[data-size], a[data-size]').evaluateAll((nodes) => nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          const visible = rect.width && rect.height && !node.closest('[aria-hidden="true"]');
          return visible && (rect.width < 43.9 || rect.height < 43.9);
        }).map((node) => node.outerHTML.slice(0, 180)));
        scenarios.push({ route: `/${lang}${suffix}`, theme, width, textScale: width === 1280 ? 2 : 1,
          inspection, migratedTargets, errors, axe: axe.violations.map((violation) => ({ id: violation.id, count: violation.nodes.length })) });
        page.off('pageerror', onError);
        page.off('console', onConsole);
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
const sum = (fn) => scenarios.reduce((count, scenario) => count + fn(scenario), 0);
const summary = { scenarios: scenarios.length,
  overflow: sum((s) => s.inspection.overflow.length), smallText: sum((s) => s.inspection.smallText.length),
  h1Problems: sum((s) => Number(s.inspection.h1 !== 1)), smallTargets: sum((s) => s.inspection.smallTargets.length),
  migratedSmallTargets: sum((s) => s.migratedTargets.length), axe: sum((s) => s.axe.reduce((n, v) => n + v.count, 0)),
  consoleErrors: sum((s) => s.errors.length), clipped: sum((s) => s.inspection.clipped.length) };
await mkdir('artifacts/_local', { recursive: true });
await writeFile(output, JSON.stringify({ base, createdAt: new Date().toISOString(), summary, scenarios }, null, 2));
console.log(JSON.stringify(summary));
if (summary.overflow || summary.smallText || summary.h1Problems || summary.migratedSmallTargets || summary.consoleErrors) process.exitCode = 1;
