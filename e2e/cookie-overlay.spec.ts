import { expect, test } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

/**
 * Unlike the rest of the suite, this spec does NOT pre-seed cookie consent, so the
 * bottom-fixed consent banner is present. It guards that focused overlays (search
 * modal, mobile menu) render ABOVE the banner instead of being covered by it
 * (the banner is z-[100], overlays are z-[120]).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const bottomOwner = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const el = document.elementFromPoint(
      Math.round(window.innerWidth / 2),
      window.innerHeight - 24,
    );
    if (!el) return 'none';
    if (el.closest('[data-testid="mobile-search-panel"],[data-testid="mobile-search-backdrop"]'))
      return 'search-modal';
    if (el.closest('[data-testid="mobile-menu-panel"],[data-testid="mobile-menu-backdrop"]'))
      return 'menu';
    if (el.closest('[role="region"]')) return 'cookie-banner';
    return el.tagName;
  });

test.describe('Cookie banner vs overlays (no consent seeded)', () => {
  test('the cookie banner is shown and intercepts the bottom before any overlay', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: /privacy/i })).toBeVisible({ timeout: 30_000 });
    // Sanity: with no overlay open, the banner does own the bottom area.
    expect(await bottomOwner(page)).toBe('cookie-banner');
  });

  test('search modal renders above the cookie banner', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: /privacy/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /search by tool/i }).click();
    await expect(page.getByRole('dialog', { name: /^search$/i })).toBeVisible();
    // The modal (z-120) must cover the banner (z-100) at the bottom of the screen.
    expect(await bottomOwner(page)).toBe('search-modal');
  });

  test('mobile menu renders above the cookie banner', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: /privacy/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /menu/i }).first().click();
    await expect(page.getByRole('dialog', { name: /^menu$/i })).toBeVisible();
    expect(await bottomOwner(page)).toBe('menu');
  });
});
