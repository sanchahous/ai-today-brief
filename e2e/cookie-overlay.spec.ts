import { expect, test } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

/**
 * Unlike the rest of the suite, this spec does NOT pre-seed cookie consent, so the
 * bottom-fixed consent banner is present. It guards that focused overlays (search
 * modal, mobile menu) render ABOVE the banner instead of being covered by it
 * (the banner is z-[100], overlays are z-[120]).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PHONE_360 = { width: 360, height: 780 } as const;

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
    if (el.closest('[data-testid="cookie-consent"],[role="region"]')) return 'cookie-banner';
    return el.tagName;
  });

function consentRegion(page: import('@playwright/test').Page) {
  return page.getByTestId('cookie-consent');
}

test.describe('Cookie banner vs overlays (no consent seeded)', () => {
  test('the cookie banner is shown and intercepts the bottom before any overlay', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });
    expect(await bottomOwner(page)).toBe('cookie-banner');
  });

  test('search modal renders above the cookie banner', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /search by tool/i }).click();
    await expect(page.getByRole('dialog', { name: /^search$/i })).toBeVisible();
    expect(await bottomOwner(page)).toBe('search-modal');
  });

  test('mobile menu renders above the cookie banner', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /menu/i }).first().click();
    await expect(page.getByRole('dialog', { name: /^menu$/i })).toBeVisible();
    expect(await bottomOwner(page)).toBe('menu');
  });

  test('does not send GA collect requests before a consent choice', async ({ page }) => {
    const collects: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/g/collect') || url.includes('google-analytics.com')) {
        collects.push(url);
      }
    });

    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);

    const consentDefaults = await page.evaluate(() => {
      for (const script of document.querySelectorAll('script')) {
        const source = script.textContent ?? '';
        if (
          source.includes("gtag('consent','default'") &&
          source.includes("analytics_storage:'denied'")
        ) {
          return 'denied';
        }
      }
      const layer = window.dataLayer ?? [];
      for (const entry of layer) {
        const args = Array.isArray(entry)
          ? entry
          : typeof entry === 'object' && entry !== null
            ? Object.values(entry as Record<string, unknown>)
            : [];
        if (args[0] === 'consent' && args[1] === 'default') {
          const params = args[2] as { analytics_storage?: string } | undefined;
          return params?.analytics_storage ?? null;
        }
      }
      return typeof window.gtag === 'function' ? 'missing-script' : 'ga-off';
    });

    if (consentDefaults === 'ga-off') {
      test.info().annotations.push({ type: 'note', description: 'GA not configured in this build' });
    } else {
      expect(consentDefaults).toBe('denied');
    }
    expect(collects).toHaveLength(0);
  });

  test('does not cover the homepage primary CTA at 360px', async ({ page }) => {
    await page.setViewportSize(PHONE_360);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });

    const cta = page.locator('section[aria-labelledby="hero-title"]').getByRole('link', {
      name: /browse all news/i,
    });
    await expect(cta).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await cta.click({ trial: true });
  });

  test('moves focus into the card from the footer and returns after closing', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(consentRegion(page)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^accept all$/i }).click();
    await expect(consentRegion(page)).toBeHidden();

    const footerButton = page.getByRole('button', { name: /cookie settings/i });
    await footerButton.scrollIntoViewIfNeeded();
    await footerButton.focus();
    await footerButton.click();
    await expect(consentRegion(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /^accept all$/i })).toBeFocused();

    await page.getByRole('button', { name: /^essential only$/i }).click();
    await expect(consentRegion(page)).toBeHidden();
    await expect(footerButton).toBeFocused();
  });
});
