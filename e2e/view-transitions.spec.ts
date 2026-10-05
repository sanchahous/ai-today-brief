import { test, expect } from '@playwright/test';

async function installViewTransitionSpy(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const root = window as Window & { __viewTransitionCalls?: number };
    root.__viewTransitionCalls = 0;
    const native = document.startViewTransition?.bind(document);
    if (!native) return;
    document.startViewTransition = (update) => {
      root.__viewTransitionCalls = (root.__viewTransitionCalls ?? 0) + 1;
      return native(update);
    };
  });
}

async function readViewTransitionCalls(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as Window & { __viewTransitionCalls?: number }).__viewTransitionCalls ?? 0);
}

function isMainOrH1Focused(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const main = document.getElementById('main-content');
    const h1 = main?.querySelector('h1');
    const active = document.activeElement;
    return active === main || active === h1;
  });
}

test.describe('view transitions — route cross-fade', () => {
  test('Chromium starts a view transition on client navigation', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'View Transitions API is Chromium-first in CI matrix');
    await installViewTransitionSpy(page);
    await page.goto('/en');
    await page.getByRole('link', { name: /browse all news/i }).first().click();
    await page.waitForURL('**/news');
    await expect.poll(() => readViewTransitionCalls(page)).toBeGreaterThan(0);
  });

  test('navigation completes without console errors on all browsers', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/en');
    await page.getByRole('link', { name: /browse all news/i }).first().click();
    await page.waitForURL('**/news');
    expect(errors).toEqual([]);
  });
});

test.describe('view transitions — reduced motion and focus', () => {
  test('reduced motion keeps navigation instant and moves focus to main or H1', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-tension-motion', 'off');
    await page.getByRole('link', { name: /browse all news/i }).first().click();
    await page.waitForURL('**/news');
    await expect.poll(() => isMainOrH1Focused(page)).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() =>
          document
            .getAnimations()
            .filter((animation) => {
              const timing = animation.effect?.getTiming();
              const duration = typeof timing?.duration === 'number' ? timing.duration : 0;
              return animation.playState === 'running' && duration > 20;
            }).length,
        ),
      )
      .toBe(0);
  });
});
