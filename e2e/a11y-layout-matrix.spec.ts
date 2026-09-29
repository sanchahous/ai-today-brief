import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectPage, type PageInspection } from './helpers/inspect-page';

type Theme = 'night' | 'day';
type Scenario = {
  route: string;
  lang: string;
  theme: Theme;
  mode: string;
  inspection: PageInspection;
  consoleErrors: string[];
  axe: { id: string; impact: string | null; count: number }[];
};

// This checked-in fixture is controlled by the test suite, not an external input.
const GATING = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/a11y-gating.json'), 'utf8'),
) as {
  routes: { id: string; path: string; locales: string[] }[];
};
const VIEWPORTS = [
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
] as const;
const ZOOM = [
  { name: 'text-200', width: 1280, height: 800, fontSize: 32 },
  { name: 'reflow-320', width: 320, height: 640, fontSize: null },
] as const;
const THEMES: Theme[] = ['night', 'day'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const REPORT_MODE = process.env.A11Y_MATRIX_REPORT === '1';

async function seedTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    (value) => localStorage.setItem('theme', value),
    theme === 'day' ? 'light' : 'dark',
  );
}

async function measure(
  page: Page,
  route: string,
  lang: string,
  theme: Theme,
  mode: string,
  coarse: boolean,
): Promise<Scenario> {
  const consoleErrors: string[] = [];
  const onPageError = (error: Error) => consoleErrors.push(error.message.slice(0, 200));
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    const response = await page.goto(route, { waitUntil: 'load', timeout: 30_000 });
    if (!response || ![200, 404].includes(response.status()))
      consoleErrors.push(`HTTP ${response?.status() ?? 'no response'}`);
    await page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);
    if (process.env.A11Y_MATRIX_INJECT_SMALL_TEXT === '1') {
      await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.className = 'text-[10px]';
        probe.style.fontSize = '10px';
        probe.textContent = 'Small text gate probe';
        document.querySelector('main')?.append(probe);
      });
    }
    const inspection = await inspectPage(page, coarse);
    const axeResult = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    return {
      route,
      lang,
      theme,
      mode,
      inspection,
      consoleErrors,
      axe: axeResult.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        count: violation.nodes.length,
      })),
    };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

function failures(result: Scenario): string[] {
  const { inspection: data } = result;
  return [
    ...result.consoleErrors.map((error) => `console: ${error}`),
    ...result.axe.map((violation) => `axe ${violation.id}: ${violation.count}`),
    ...data.overflow.map((item) => `overflow: ${item}`),
    ...data.smallText.map((item) => `small text: ${item}`),
    ...data.smallTargets.map((item) => `small target: ${item}`),
    ...data.images.map((item) => `image without alt: ${item}`),
    ...(result.mode === 'text-200' || result.mode === 'reflow-320'
      ? data.clipped.map((item) => `clipped text: ${item}`)
      : []),
    ...(data.h1 === 1 ? [] : [`H1 count: ${data.h1}`]),
    ...(data.skips === 0 ? [] : [`heading skips: ${data.skips}`]),
  ];
}

function sitemapPaths(xml: string): string[] {
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)].map(
    (match, position) => ({
      path: new URL(match[1]).pathname,
      modified: match[2].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '',
      position,
    }),
  );
  const newest = (pattern: RegExp) =>
    entries
      .filter((entry) => pattern.test(entry.path))
      .sort((a, b) => b.modified.localeCompare(a.modified) || a.position - b.position);
  const dynamic = (pattern: RegExp, preferred?: string) => {
    const matches = newest(pattern);
    return matches.find((entry) => entry.path === preferred)?.path ?? matches[0]?.path;
  };
  const articles = newest(/^\/en\/news\/[^/]+\/[^/]+$/);
  const categories = new Set<string>();
  const selectedArticles = articles
    .filter((entry) => {
      const category = entry.path.split('/')[3];
      if (categories.has(category)) return false;
      categories.add(category);
      return true;
    })
    .slice(0, 3)
    .map((entry) => entry.path.slice(3));
  const fixed = new Set([
    'news',
    'digests',
    'concepts',
    'guides',
    'tools',
    'about',
    'author',
    'subscribe',
    'advertise',
    'editorial-policy',
    'ai-disclosure',
    'privacy',
    'terms',
  ]);
  const daily = newest(/^\/en\/[^/]+$/)
    .find((entry) => !fixed.has(entry.path.slice(4)))
    ?.path.slice(3);
  const suffixes = [
    '',
    '/news',
    '/news?categories=agents-and-mcp&page=2',
    '/news/search?q=mcp',
    '/news/search?q=',
    ...selectedArticles,
    '/digests',
    daily,
    dynamic(/^\/en\/weekly\/[^/]+$/)?.slice(3),
    '/concepts',
    dynamic(/^\/en\/concepts\/[^/]+$/, '/en/concepts/mcp')?.slice(3),
    '/guides',
    dynamic(/^\/en\/guides\/[^/]+$/, '/en/guides/claude-code-vs-cursor-vs-codex')?.slice(3),
    '/tools',
    '/tools/prompt-optimizer',
    '/tools/settings-builder',
    '/tools/claude-md-generator',
    dynamic(/^\/en\/category\/[^/]+$/, '/en/category/agents-and-mcp')?.slice(3),
    '/about',
    '/author',
    '/subscribe',
    '/advertise',
    '/editorial-policy',
    '/ai-disclosure',
    '/privacy',
    '/terms',
    '/zzz-missing',
  ];
  if (suffixes.some((suffix) => suffix === undefined) || selectedArticles.length < 3) {
    throw new Error('Sitemap does not contain the route matrix');
  }
  return suffixes.flatMap((suffix) => [`/en${suffix}`, `/uk${suffix}`]);
}

async function contextFor(
  browser: Browser,
  width: number,
  height: number,
  coarse: boolean,
): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width, height },
    isMobile: coarse,
    hasTouch: coarse,
    reducedMotion: 'reduce',
    storageState: './e2e/consent-state.json',
  });
}

test.describe('A11y and layout matrix gating', () => {
  for (const route of GATING.routes)
    for (const lang of route.locales)
      for (const theme of THEMES) {
        for (const viewport of VIEWPORTS) {
          test(`${route.id} ${lang} ${theme} ${viewport.name}`, async ({ page }) => {
            test.skip(REPORT_MODE, 'The full legacy report runs separately');
            await page.setViewportSize(viewport);
            await seedTheme(page, theme);
            const result = await measure(
              page,
              route.path,
              lang,
              theme,
              viewport.name,
              viewport.width < 800,
            );
            expect(failures(result), `${route.path} ${lang} ${theme} ${viewport.name}`).toEqual([]);
          });
        }
        for (const zoom of ZOOM) {
          test(`${route.id} ${lang} ${theme} ${zoom.name}`, async ({ browser, browserName }) => {
            test.skip(REPORT_MODE, 'The full legacy report runs separately');
            test.skip(
              zoom.fontSize !== null && browserName !== 'chromium',
              'CDP font emulation is Chromium-only',
            );
            const context = await contextFor(browser, zoom.width, zoom.height, zoom.width < 800);
            const page = await context.newPage();
            try {
              await seedTheme(page, theme);
              if (zoom.fontSize) {
                const cdp = await context.newCDPSession(page);
                await cdp.send('Page.setFontSizes', {
                  fontSizes: { standard: zoom.fontSize, fixed: 26 },
                });
              }
              const result = await measure(
                page,
                route.path,
                lang,
                theme,
                zoom.name,
                zoom.width < 800,
              );
              if (zoom.fontSize) {
                const rootSize = await page.evaluate(
                  () => getComputedStyle(document.documentElement).fontSize,
                );
                expect(rootSize).toBe(`${zoom.fontSize}px`);
              }
              expect(failures(result), `${route.path} ${lang} ${theme} ${zoom.name}`).toEqual([]);
            } finally {
              await context.close();
            }
          });
        }
      }
});

test('legacy route matrix report', async ({ browser, request }) => {
  test.skip(!REPORT_MODE, 'Set A11Y_MATRIX_REPORT=1 for the full legacy report');
  test.setTimeout(30 * 60_000);
  // Minimal local prerender deliberately limits sitemap data; route selection comes from production.
  const response = await request.get('https://aitodaybrief.com/sitemap.xml');
  expect(response.ok()).toBe(true);
  const paths = sitemapPaths(await response.text());
  const results: Scenario[] = [];
  for (const theme of THEMES) {
    for (const viewport of [...VIEWPORTS, ...ZOOM]) {
      const context = await contextFor(
        browser,
        viewport.width,
        viewport.height,
        viewport.width < 800,
      );
      const page = await context.newPage();
      await seedTheme(page, theme);
      if ('fontSize' in viewport && viewport.fontSize) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.setFontSizes', {
          fontSizes: { standard: viewport.fontSize, fixed: 26 },
        });
      }
      try {
        for (const route of paths) {
          const lang = route.startsWith('/uk') ? 'uk' : 'en';
          try {
            results.push(
              await measure(page, route, lang, theme, viewport.name, viewport.width < 800),
            );
          } catch (error) {
            results.push({
              route,
              lang,
              theme,
              mode: viewport.name,
              inspection: {
                overflow: [],
                smallText: [],
                smallTargets: [],
                headings: [],
                h1: 0,
                skips: 0,
                images: [],
                clipped: [],
                scrollWidth: 0,
                clientWidth: 0,
              },
              consoleErrors: [String(error)],
              axe: [],
            });
          }
        }
      } finally {
        await context.close();
      }
      process.stdout.write(
        `Legacy report: ${results.length}/${paths.length * THEMES.length * (VIEWPORTS.length + ZOOM.length)} scenarios\n`,
      );
    }
  }
  const summary = {
    scenarios: results.length,
    overflow: results.filter((result) => result.inspection.overflow.length > 0).length,
    smallText: results.reduce((count, result) => count + result.inspection.smallText.length, 0),
    smallTargets: results.reduce(
      (count, result) => count + result.inspection.smallTargets.length,
      0,
    ),
    axe: results.reduce(
      (count, result) => count + result.axe.reduce((sum, violation) => sum + violation.count, 0),
      0,
    ),
    consoleErrors: results.reduce((count, result) => count + result.consoleErrors.length, 0),
    h1Problems: results.filter((result) => result.inspection.h1 !== 1).length,
    headingSkips: results.reduce((count, result) => count + result.inspection.skips, 0),
    imagesMissingAlt: results.reduce((count, result) => count + result.inspection.images.length, 0),
    clipped: results.reduce((count, result) => count + result.inspection.clipped.length, 0),
    clippedAtZoom: results
      .filter((result) => result.mode === 'text-200' || result.mode === 'reflow-320')
      .reduce((count, result) => count + result.inspection.clipped.length, 0),
  };
  const out = path.join(process.cwd(), 'artifacts/_local/ah-0.5-legacy-report.json');
  await writeFile(
    out,
    `${JSON.stringify({ date: new Date().toISOString(), summary, results }, null, 2)}\n`,
  );
  process.stdout.write(`Legacy matrix: ${JSON.stringify(summary)}\n`);
});
