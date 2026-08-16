import { expect, test } from '@playwright/test';

const HEADER_COLLISION_WIDTHS = [1024, 1100, 1160] as const;
const BASE_URL = process.env.HEADER_LAYOUT_BASE_URL ?? 'http://127.0.0.1:3000';

async function gotoHeaderLayoutPage(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/uk/news`, { waitUntil: 'domcontentloaded' });
  // Level 1 only — story headlines containing "news" also match the name regex.
  await expect(page.getByRole('heading', { level: 1, name: /news|новини/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Header layout', () => {
  for (const width of HEADER_COLLISION_WIDTHS) {
    test(`desktop header keeps search and nav usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await gotoHeaderLayoutPage(page);

      const header = page.locator('header').first();
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();

      const headerMetrics = await header.evaluate((el) => {
        const root = document.documentElement;
        const headerHeight = Number.parseFloat(getComputedStyle(root).getPropertyValue('--header-h'));
        const rect = el.getBoundingClientRect();
        return {
          cssHeaderHeight: headerHeight,
          renderedHeight: rect.height,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(headerMetrics.renderedHeight).toBeCloseTo(headerMetrics.cssHeaderHeight, 0);
      expect(headerMetrics.documentOverflow).toBeLessThanOrEqual(1);

      const nav = page.getByRole('navigation', { name: 'Primary' });
      await expect(nav).toBeVisible();

      const navMetrics = await nav.evaluate((el) => {
        const container = el.closest('.site-header-shell')?.querySelector('.mx-auto') ?? el.parentElement;
        const navRect = el.getBoundingClientRect();
        const containerRect = container?.getBoundingClientRect();
        return {
          navLeft: navRect.left,
          navRight: navRect.right,
          containerLeft: containerRect?.left ?? 0,
          containerRight: containerRect?.right ?? window.innerWidth,
          navHeight: navRect.height,
          navOverflow: el.scrollWidth - el.clientWidth,
        };
      });

      expect(navMetrics.navLeft).toBeGreaterThanOrEqual(navMetrics.containerLeft - 1);
      expect(navMetrics.navRight).toBeLessThanOrEqual(navMetrics.containerRight + 1);
      expect(navMetrics.navHeight).toBeLessThanOrEqual(44);
      expect(navMetrics.navOverflow).toBeLessThanOrEqual(1);

      const search = header.getByRole('search').first();
      await expect(search).toBeVisible();
      const searchBox = await search.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(searchBox!.width).toBeGreaterThanOrEqual(160);

      const input = search.getByRole('searchbox');
      await input.fill('agent');
      await expect(input).toHaveValue('agent');
      await input.press('Enter');
      await expect(page).toHaveURL(/\/uk\/news\?q=agent$/);
    });
  }
});
