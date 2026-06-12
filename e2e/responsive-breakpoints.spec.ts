import { expect, test, type Page } from '@playwright/test';

import { BREAKPOINT_CONTRACT_WIDTHS, HORIZONTAL_OVERFLOW_WIDTHS } from './helpers/viewports';

/**
 * Cross-cutting breakpoint contract: header chrome, the news filter sidebar/trigger,
 * --header-h correctness, and the absence of horizontal overflow — across the
 * unified 1024px (Tailwind lg) breakpoint. Guards the 900-1023px "dead band" regression.
 */
async function goto(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
  // Wait for the page main content to render before asserting breakpoint visibility,
  // so the news sidebar/feed are settled (avoids a boundary render race on WebKit).
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
}

test.describe('Responsive breakpoint contract', () => {
  for (const size of BREAKPOINT_CONTRACT_WIDTHS) {
    const isDesktop = size.width >= 1024;

    test(`header chrome lockstep + --header-h at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await goto(page, '/en/news');

      const nav = page.getByRole('navigation', { name: 'Primary' });
      const hamburger = page.getByRole('button', { name: /menu|меню/i });

      // Exactly one of {desktop nav, hamburger} is shown, matching the breakpoint.
      expect(await nav.isVisible()).toBe(isDesktop);
      expect(await hamburger.isVisible()).toBe(!isDesktop);

      // Rendered header height equals the --header-h token (within 1px).
      const m = await page.locator('header').first().evaluate((el) => ({
        css: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
        ),
        rendered: el.getBoundingClientRect().height,
      }));
      expect(m.css).toBeGreaterThan(0);
      expect(m.rendered).toBeCloseTo(m.css, 0);
    });

    test(`filter sidebar/trigger mutual exclusivity at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await goto(page, '/en/news');

      const sidebarVisible = await page.getByTestId('news-sidebar').isVisible().catch(() => false);
      const triggerVisible = await page
        .getByRole('button', { name: /filters|фільтри/i })
        .isVisible()
        .catch(() => false);

      // Exactly one is present (never the dead-band combo of desktop sidebar + hamburger),
      // and it matches the unified breakpoint.
      expect(Number(sidebarVisible) + Number(triggerVisible)).toBe(1);
      expect(sidebarVisible).toBe(isDesktop);
      expect(triggerVisible).toBe(!isDesktop);
    });
  }

  for (const size of HORIZONTAL_OVERFLOW_WIDTHS) {
    for (const path of ['/en', '/en/news']) {
      test(`no horizontal overflow at ${size.width}px on ${path}`, async ({ page }) => {
        await page.setViewportSize(size);
        await goto(page, path);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
