import { expect, test, type Page } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

const REGRESSION_VIEWPORTS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone390,
  VIEWPORTS.tablet768,
  VIEWPORTS.header1024,
  VIEWPORTS.desktop1440,
] as const;

const STATIC_ROUTES = [
  '/en',
  '/en/news',
  '/en/about',
  '/en/subscribe',
  '/en/concepts',
  '/en/guides',
] as const;

const DYNAMIC_SOURCES = [
  { name: 'first-news-article', parent: '/en/news', pathFragment: '/en/news/' },
  { name: 'first-concept', parent: '/en/concepts', pathFragment: '/en/concepts/' },
  { name: 'first-guide', parent: '/en/guides', pathFragment: '/en/guides/' },
] as const;

async function gotoAndWait(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
}

async function assertLayout(page: Page, viewport: { width: number; height: number }) {
  // a. No horizontal overflow at the document level.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);

  // b. Structural landmarks must be present and visible.
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('footer').first()).toBeVisible();

  // c. No direct child of <main> wider than viewport + 1px.
  // This catches a single overflowing section even when root overflow:hidden clips it.
  const overflowing = await page.getByRole('main').evaluate(
    (main, vw) =>
      Array.from(main.children)
        .filter((el) => el.getBoundingClientRect().width > vw + 1)
        .map((el) => `${el.tagName}${el.id ? '#' + el.id : ''}`),
    viewport.width,
  );
  expect(
    overflowing,
    `main children wider than ${viewport.width}px: ${overflowing.join(', ')}`,
  ).toHaveLength(0);
}

test.describe('Layout regression – static routes', () => {
  for (const route of STATIC_ROUTES) {
    for (const vp of REGRESSION_VIEWPORTS) {
      test(`${route} at ${vp.width}px`, async ({ page }) => {
        await page.setViewportSize(vp);
        await gotoAndWait(page, route);
        await assertLayout(page, vp);
      });
    }
  }
});

test.describe('Layout regression – dynamic routes', () => {
  for (const source of DYNAMIC_SOURCES) {
    for (const vp of REGRESSION_VIEWPORTS) {
      test(`${source.name} at ${vp.width}px`, async ({ page }) => {
        await page.setViewportSize(vp);

        // Discover the slug by visiting the listing page and reading the first matching link.
        await page.goto(source.parent, { waitUntil: 'domcontentloaded' });
        await page.locator('main').waitFor({ timeout: 30_000 });

        const href = await page
          .locator(`main a[href*="${source.pathFragment}"]`)
          .first()
          .getAttribute('href', { timeout: 10_000 })
          .catch(() => null);

        test.skip(!href, `no ${source.name} link found on ${source.parent} – listing may be empty`);
        if (!href) return;

        await page.goto(href, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
        await assertLayout(page, vp);
      });
    }
  }
});
