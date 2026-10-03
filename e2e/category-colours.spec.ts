import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { categoryColor } from '../src/lib/category-meta';

// Fixed article path from the production AH-1.4 before manifest; fixtures work in CI too.
const suffixes = ["", "/news", "/news/tools-and-releases/deep-dive-into-chatgpt-work-persistent-filesystem-web-browser-and-cloud-deployme", "/category/agents-and-mcp"];
const routes = suffixes.flatMap((suffix) => [
  { key: suffix || "home", path: `/en${suffix}` },
  { key: suffix || "home", path: `/uk${suffix}` },
]);
const CATEGORY_SCOPE = '.cat-badge, .cat-fg, .cat-chip, .cat-header, .cat-thumb, .cat-icon-box';

test.describe('category colour gate', () => {
  for (const route of routes) for (const theme of ['night', 'day'] as const) {
    for (const width of [360, 390, 768, 1024, 1440, 320, 1280]) {
      test(`${route.key} ${route.path.startsWith('/uk') ? 'uk' : 'en'} ${theme} ${width}`, async ({ page, context, browserName }) => {
        test.skip(width === 1280 && browserName !== 'chromium', '200% browser text uses CDP');
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
        if (width === 1280) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
        }
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(route.path);
        await expect(page.locator('main h1')).toBeVisible();
        if (route.key === '/news' || route.key.startsWith('/category/'))
          await expect(page.getByTestId('post-card').or(page.getByTestId('story-card')).first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('main h1')).toHaveCount(1);
        const scopes = page.locator(CATEGORY_SCOPE);
        expect(await scopes.count()).toBeGreaterThan(0);
        const badColours = await scopes.evaluateAll((elements) => elements.filter((element) => {
          const token = (element as HTMLElement).style.getPropertyValue('--cat-color');
          return token && !token.startsWith('var(--cat-') && token !== 'var(--accent)';
        }).map((element) => element.outerHTML.slice(0, 180)));
        expect(badColours).toEqual([]);
        const contrast = await new AxeBuilder({ page }).include(CATEGORY_SCOPE).exclude('[data-testid="sponsor-card"]').exclude('[href$="advertise"]').withRules(['color-contrast']).analyze();
        expect(contrast.violations).toEqual([]);
        const glyphs = scopes.locator('svg');
        for (const glyph of await glyphs.all()) {
          await expect(glyph).toHaveAttribute('aria-hidden', 'true');
          await expect(glyph).toHaveAttribute('focusable', 'false');
        }
        expect(errors).toEqual([]);
      });
    }
  }

  test('search API carries the category slug and preview badges use tokens', async ({ page, request }) => {
    const response = await request.get('/api/search?q=mcp&lang=en&limit=5');
    expect(response.ok()).toBe(true);
    const result = await response.json() as { items: { categorySlug: string | null; categoryColor: string | null }[] };
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) expect(categoryColor(item.categorySlug, item.categoryColor)).toMatch(/^var\(--cat-/);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/news');
    await expect(page.getByTestId('post-card').or(page.getByTestId('story-card')).first()).toBeVisible();
    await page.getByTestId('search-trigger-compact').click();
    const dialog = page.getByRole('dialog', { name: /^search$/i });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('searchbox');
    await input.click();
    const previewResponse = page.waitForResponse((response) => response.url().includes('/api/search?') && response.ok());
    await input.pressSequentially('mcp', { delay: 50 });
    await previewResponse;
    const badges = dialog.locator('[role="option"] .cat-badge');
    await expect(badges.first()).toBeVisible();
    expect(await badges.evaluateAll((nodes) => nodes.every((node) =>
      (node as HTMLElement).style.getPropertyValue('--cat-color').startsWith('var(--cat-')))).toBe(true);
  });
});
