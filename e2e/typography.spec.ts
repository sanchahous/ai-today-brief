import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The same real URLs used by the AH-0.4 baseline and visual gallery.
const baseline: { routes: { path: string }[] } = JSON.parse(readFileSync('e2e/fixtures/seo-contract.baseline.json', 'utf8'));
const home = '/en';
const article = baseline.routes.find((route) => route.path.startsWith('/en/news/agents-and-mcp/'))!.path;
const weekly = baseline.routes.find((route) => route.path.startsWith('/en/weekly/'))!.path;

test.describe('AH-1.5 typography', () => {
  for (const route of [home, article, weekly]) for (const lang of ['en', 'uk']) {
    for (const theme of ['night', 'day']) for (const width of [390, 1440]) {
      const url = route.replace('/en', `/${lang}`);
      test(`${url} ${theme} ${width}: local fonts and one heading family`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
        const fonts: string[] = [];
        page.on('request', (request) => {
          if (request.resourceType() === 'font') fonts.push(request.url());
        });
        await page.goto(url);
        await expect(page.locator('main h1')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        expect(fonts.length).toBeGreaterThan(0);
        expect(fonts.every((font) => new URL(font).origin === new URL(page.url()).origin)).toBe(true);
        const families = await page.locator('main h1, main h2, main h3, main .font-serif').evaluateAll((nodes) =>
          nodes.map((node) => getComputedStyle(node).fontFamily));
        expect(families.length).toBeGreaterThan(0);
        expect(families.every((family) => lang === 'uk' ? family.startsWith('Georgia') : /displayFont/i.test(family))).toBe(true);
        await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(3);
      });
    }
  }

  test('server language scopes Georgia without the pre-paint script', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
    try {
      const page = await context.newPage();
      // Static content avoids the existing no-JS Suspense debt on data-backed routes.
      await page.goto('/uk/about');
      await expect(page.locator('main')).toHaveAttribute('lang', 'uk');
      // The no-JS Suspense content debt is tracked separately; inspect the server-rendered scope.
      const family = await page.locator('main').evaluate((node) => getComputedStyle(node).getPropertyValue('--font-display').trim());
      expect(family).toMatch(/^Georgia/);
    } finally {
      await context.close();
    }
  });

  test('eyebrow, registry, reading and italic use the agreed tokens', async ({ page }) => {
    await page.goto('/ds-catalog');
    await page.evaluate(() => document.fonts.ready);
    const section = page.getByRole('region', { name: 'Typography / Типографіка' });
    await expect(section.locator('.eyebrow').first()).toHaveCSS('text-transform', 'uppercase');
    await expect(section.locator('.eyebrow-registry')).toHaveCSS('text-transform', 'none');
    await expect(section.locator('.reading-copy')).toHaveCSS('font-size', '18px');
    const lineHeight = await section.locator('.reading-copy').evaluate((node) => Number.parseFloat(getComputedStyle(node).lineHeight));
    expect(lineHeight).toBeCloseTo(32.04, 1);
    const englishItalic = await section.locator('em').first().evaluate((node) => getComputedStyle(node).fontFamily);
    expect(englishItalic).toMatch(/displayItalicFont/i);
    const ukrainianItalic = await section.locator('[lang="uk"] em').evaluate((node) => getComputedStyle(node).fontFamily);
    expect(ukrainianItalic).toMatch(/^Georgia/);
  });
});
