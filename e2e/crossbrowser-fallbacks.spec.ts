import { expect, test } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

/**
 * Cross-browser degradation guards (runs on chromium / firefox / webkit projects):
 * the sticky header must stay legible (opaque-enough) even where color-mix /
 * backdrop-filter degrade, and the desktop sidebar must have a finite, bounded height.
 */
function alphaOf(color: string): number {
  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (!m) return 1;
  const parts = m[1].split(',').map((s) => s.trim());
  return parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
}

test.describe('Cross-browser fallbacks', () => {
  test('sticky header background stays effectively opaque', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });

    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 30_000 });

    const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    // .site-header-shell falls back to var(--bg) (alpha 1) and only layers a 96%
    // color-mix where supported — so content never bleeds through while scrolled.
    expect(alphaOf(bg)).toBeGreaterThanOrEqual(0.95);
  });

  test('desktop filter sidebar has a finite, bounded max-height', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto('/en/news', { waitUntil: 'domcontentloaded' });

    const sidebar = page.getByTestId('news-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    // .sidebar-viewport-height uses a 100vh fallback before the 100dvh enhancement,
    // so every engine resolves a concrete pixel height (never 'none').
    const maxH = await sidebar.evaluate((el) => getComputedStyle(el).maxHeight);
    expect(maxH).not.toBe('none');
    expect(Number.parseFloat(maxH)).toBeGreaterThan(0);
  });
});
