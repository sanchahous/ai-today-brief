import { expect, test } from '@playwright/test';

test.describe('News sidebar (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/news');
    await page.waitForLoadState('networkidle');
  });

  test('sidebar scrolls when content exceeds viewport', async ({ page }) => {
    const sidebar = page.getByTestId('news-sidebar');
    await expect(sidebar).toBeVisible();

    const metrics = await sidebar.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });

  test('trending section is reachable via sidebar scroll', async ({ page }) => {
    const trending = page.getByTestId('news-trending-section');

    const hasTrending = (await trending.count()) > 0;
    test.skip(!hasTrending, 'No trending topics in current data');

    await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="news-sidebar"]') as HTMLElement | null;
      const trending = document.querySelector('[data-testid="news-trending-section"]') as HTMLElement | null;
      if (!sidebar || !trending) return;
      sidebar.scrollTop = trending.offsetTop - sidebar.clientHeight + trending.offsetHeight + 8;
    });

    const visibleInSidebar = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="news-sidebar"]');
      const trending = document.querySelector('[data-testid="news-trending-section"]');
      if (!sidebar || !trending) return false;
      const sRect = sidebar.getBoundingClientRect();
      const tRect = trending.getBoundingClientRect();
      return tRect.top >= sRect.top - 1 && tRect.bottom <= sRect.bottom + 1;
    });

    expect(visibleInSidebar).toBe(true);
  });

  test('filter rows are compact on desktop', async ({ page }) => {
    const firstRow = page.getByTestId('news-sidebar').locator('.filter-row').first();
    await expect(firstRow).toBeVisible();

    const box = await firstRow.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(36);
  });
});
