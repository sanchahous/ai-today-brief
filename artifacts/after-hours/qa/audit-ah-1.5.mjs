// Run: node --import tsx artifacts/after-hours/qa/audit-ah-1.5.mjs --base=<local-origin> --mode=matrix|cls
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { inspectPage } from '../../../e2e/helpers/inspect-page.ts';
const option = (key) => process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const base = option('base');
const mode = option('mode') ?? 'matrix';
const label = option('label') ?? 'after';
if (!base) throw new Error('--base is required');
const baseline = JSON.parse(await readFile('e2e/fixtures/seo-contract.baseline.json', 'utf8'));
const browser = await chromium.launch();
const rows = [];
try {
  if (mode === 'matrix') {
    // Two workers keep local dev and Supabase read load bounded.
    const routes = baseline.routes.map((row) => row.path);
    await Promise.all([0, 1].map(async (worker) => {
      for (const theme of ['night', 'day']) for (const width of [360, 390, 768, 1024, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: 'e2e/consent-state.json' });
        const page = await context.newPage();
        // tsx preserves names inside the shared TS inspector; supply its helper in the page sandbox.
        await page.addInitScript(() => { window.__name = (fn) => fn; });
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
        for (const route of routes.filter((_, index) => index % 2 === worker)) {
          const response = await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 60000 });
          let headingWaitError = null;
          try { await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 }); }
          catch (error) { headingWaitError = error.message.split('\n')[0]; }
          await page.evaluate(() => document.fonts.ready);
          await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
          const { smallText, h1, overflow } = await inspectPage(page, false);
          rows.push({ route, theme, width, status: response.status(), smallText, h1, overflow, headingWaitError });
        }
        await context.close();
      }
    }));
    const summary = { scenarios: rows.length, smallText: rows.reduce((sum, row) => sum + row.smallText.length, 0), h1Violations: rows.filter((row) => row.h1 !== 1).length, overflowScenarios: rows.filter((row) => row.overflow.length).length };
    await writeFile(`artifacts/_local/ah-1.5-type-matrix-${label}.json`, JSON.stringify({ base, summary, rows }, null, 2));
    console.log(JSON.stringify(summary));
    if (summary.smallText || summary.h1Violations) process.exitCode = 1;
  } else if (mode === 'cls') {
    const article = baseline.routes.find((row) => row.path.startsWith('/en/news/agents-and-mcp/')).path;
    for (const route of ['/en', '/uk', article, article.replace('/en', '/uk')]) for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: 'e2e/consent-state.json' });
      const page = await context.newPage();
      const trace = await context.newCDPSession(page);
      const traceEvents = [];
      trace.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value));
      await trace.send('Tracing.start', { categories: 'devtools.timeline,loading,blink.user_timing', transferMode: 'ReportEvents' });
      await page.addInitScript(() => {
        window.__fontShifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
            window.__fontShifts.push({ time: entry.startTime, value: entry.value, sources: entry.sources.map((source) => source.node?.nodeName ?? null) });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      // Cold context and a delayed font response expose swap shifts while images keep their layout boxes.
      await page.route('**/*.woff2', async (request) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await request.continue();
      });
      await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const shifts = await page.evaluate(() => window.__fontShifts);
      const cls = shifts.reduce((sum, shift) => sum + shift.value, 0);
      rows.push({ route, width, delayedFontMs: 300, cls, shifts });
      const traceComplete = new Promise((resolve) => trace.once('Tracing.tracingComplete', resolve));
      await trace.send('Tracing.end');
      await traceComplete;
      const kind = route.split('/').length > 2 ? 'article' : 'home';
      const lang = route.startsWith('/uk') ? 'uk' : 'en';
      await writeFile(`artifacts/_local/ah-1.5-trace-${kind}-${lang}-${width}.json`, JSON.stringify({ traceEvents }));
      await context.close();
    }
    await writeFile('artifacts/_local/ah-1.5-font-cls.json', JSON.stringify({ base, rows }, null, 2));
    console.log(JSON.stringify(rows.map(({ route, width, cls }) => ({ route, width, cls }))));
    if (rows.some((row) => row.cls > 0.01)) process.exitCode = 1;
  } else throw new Error(`Unknown mode: ${mode}`);
} finally {
  await browser.close();
}
