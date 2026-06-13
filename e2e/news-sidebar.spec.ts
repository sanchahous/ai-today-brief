import { expect, test } from '@playwright/test';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';

test.describe('News sidebar (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page);
  });

  test('sidebar is configured as an internal scroll container', async ({ page }) => {
    const sidebar = page.getByTestId('news-sidebar');
    await expect(sidebar).toBeVisible();

    const layout = await sidebar.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        maxHeight: style.maxHeight,
      };
    });

    expect(['auto', 'scroll']).toContain(layout.overflowY);
    expect(layout.maxHeight).not.toBe('none');
    expect(parseFloat(layout.maxHeight)).toBeGreaterThan(0);
  });

  test('sidebar scrollTop moves when content exceeds capped height', async ({ page }) => {
    const sidebar = page.getByTestId('news-sidebar');
    await expect(sidebar).toBeVisible();

    const scrollWorked = await sidebar.evaluate((el) => {
      const before = el.scrollTop;
      // Force overflow so the test does not depend on font metrics or live row counts.
      el.style.maxHeight = '220px';
      if (el.scrollHeight <= el.clientHeight) return false;
      el.scrollTop = el.scrollHeight;
      return el.scrollTop > before;
    });

    expect(scrollWorked).toBe(true);
  });

  test('trending section is reachable via sidebar scroll', async ({ page }) => {
    const sidebar = page.getByTestId('news-sidebar');
    const trending = page.getByTestId('news-trending-section');

    test.skip((await trending.count()) === 0, 'No trending topics in current data');

    const alreadyVisible = await trending.evaluate((el) => {
      // The testid sits on a display:contents wrapper (0x0 rect); measure its real parent box.
      const box = (el.parentElement ?? el) as HTMLElement;
      const host = el.closest('[data-testid="news-sidebar"]');
      if (!host) return false;
      const sRect = host.getBoundingClientRect();
      const tRect = box.getBoundingClientRect();
      return tRect.top >= sRect.top - 1 && tRect.bottom <= sRect.bottom + 1;
    });

    if (!alreadyVisible) {
      await sidebar.evaluate((sidebarEl) => {
        const found = sidebarEl.querySelector('[data-testid="news-trending-section"]');
        const trendingEl = (found?.parentElement ?? found) as HTMLElement | null;
        if (!trendingEl) return;
        sidebarEl.scrollTop =
          trendingEl.offsetTop - sidebarEl.clientHeight + trendingEl.offsetHeight + 8;
      });
    }

    const visibleInSidebar = await trending.evaluate((el) => {
      // The testid sits on a display:contents wrapper (0x0 rect); measure its real parent box.
      const box = (el.parentElement ?? el) as HTMLElement;
      const host = el.closest('[data-testid="news-sidebar"]');
      if (!host) return false;
      const sRect = host.getBoundingClientRect();
      const tRect = box.getBoundingClientRect();
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
