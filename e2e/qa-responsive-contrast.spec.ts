import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { EDITOR_NAME } from '../src/lib/site';
import { VIEWPORTS } from './helpers/viewports';

/**
 * ATB-88 · A12 — re-verify responsive layout and AA contrast on every page touched by A2–A11:
 * home, News, Article, Daily, the concepts shelf and a concept page. Runs the exact viewport
 * set the task calls out (320/375/768/1024/1440, i.e. phone320/phone375/tablet768/header1024/
 * desktop1440 from helpers/viewports.ts) rather than the neighbouring 360/390 set used by
 * a11y-layout-matrix.spec.ts.
 */

const QA_VIEWPORTS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone375,
  VIEWPORTS.tablet768,
  VIEWPORTS.header1024,
  VIEWPORTS.desktop1440,
] as const;

// Sponsor slots and the advertise link are out of scope for this pass (pre-existing, not
// touched by A2–A11) — same exclusions as category-colours.spec.ts and a11y-layout-matrix.spec.ts.
const AXE_EXCLUDE = ['[data-testid="sponsor-card"]', '[href$="advertise"]'];

async function gotoAndSettle(page: Page, path: string) {
  // Reduced motion skips the home hero's gesture-reveal fade-in — without it axe can sample
  // `.home-hero-lede` mid-transition and read a transient low-contrast frame (flaky, not a
  // real defect).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertAaContrast(page: Page, scope?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2aa']).withRules(['color-contrast']);
  for (const selector of AXE_EXCLUDE) builder = builder.exclude(selector);
  if (scope) builder = builder.include(scope);
  const result = await builder.analyze();
  expect(result.violations).toEqual([]);
}

type PageSpec = {
  id: string;
  resolveUrl: (page: Page) => Promise<string | null>;
  assertKeyBlocks: (page: Page) => Promise<void>;
  /** Axe scope restricted to the blocks A2–A11 actually touched, per page. */
  axeScope: string;
};

async function firstMatchingHref(
  page: Page,
  listUrl: string,
  hrefFragment: string,
  excludeFragment?: string,
): Promise<string | null> {
  await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('main').waitFor({ timeout: 30_000 });
  const locator = excludeFragment
    ? page.locator(`main a[href*="${hrefFragment}"]:not([href*="${excludeFragment}"])`)
    : page.locator(`main a[href*="${hrefFragment}"]`);
  return locator.first().getAttribute('href', { timeout: 10_000 }).catch(() => null);
}

const PAGES: PageSpec[] = [
  {
    id: 'home',
    resolveUrl: async () => '/en',
    assertKeyBlocks: async (page) => {
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('#weekly-digest')).toBeVisible();
      await expect(page.locator('section[aria-labelledby="cats-title"]')).toBeVisible();
      await expect(page.locator('section[aria-labelledby="trending-title"]')).toBeVisible();
      await expect(page.locator('section[aria-labelledby="newsletter-title"]')).toBeVisible();
    },
    // Home: hero (A5), weekly block + newsletter band (A3), category coverage + trending (A4).
    axeScope:
      '.home-hero, #weekly-digest, section[aria-labelledby="cats-title"], section[aria-labelledby="trending-title"], section[aria-labelledby="newsletter-title"]',
  },
  {
    id: 'news',
    resolveUrl: async () => '/en/news',
    assertKeyBlocks: async (page) => {
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByTestId('this-week-three-lines')).toBeVisible();
      await expect(page.getByTestId('news-feed')).toBeVisible();
      await expect(page.getByPlaceholder(/Search stories, tools, topics/i)).toBeVisible();
    },
    axeScope: 'main header, [data-testid="this-week-three-lines"], [data-testid="news-feed"]',
  },
  {
    id: 'article',
    resolveUrl: (page) => firstMatchingHref(page, '/en/news', '/en/news/', 'search'),
    assertKeyBlocks: async (page) => {
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('.banner-hero-frame').first()).toBeVisible();
      await expect(page.getByRole('link', { name: EDITOR_NAME }).first()).toBeVisible();
    },
    // Article: banner-over-art, byline, and whichever editorial patterns (key facts, callout,
    // table, chart) the story happens to carry (A7–A9) — scoped to <main>, sponsor excluded above.
    axeScope: 'main',
  },
  {
    id: 'daily',
    resolveUrl: async (page) => {
      await page.goto('/en', { waitUntil: 'domcontentloaded' });
      await page.getByRole('main').waitFor({ timeout: 30_000 });
      return page
        .getByRole('link', { name: /Read today.s brief|Read this edition/i })
        .first()
        .getAttribute('href', { timeout: 10_000 })
        .catch(() => null);
    },
    assertKeyBlocks: async (page) => {
      await expect(page.getByTestId('daily-hero')).toBeVisible();
      await expect(page.locator('.banner-hero-frame').first()).toBeVisible();
      await expect(page.locator('section[aria-labelledby="thirty-title"]')).toBeVisible();
    },
    axeScope:
      '[data-testid="daily-hero"], .banner-hero-frame, section[aria-labelledby="thirty-title"]',
  },
  {
    id: 'concepts',
    resolveUrl: async () => '/en/concepts',
    assertKeyBlocks: async (page) => {
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main ul[aria-label]').first()).toBeVisible();
      await expect(page.locator('main nav[aria-label]').first()).toBeVisible();
    },
    axeScope: 'main',
  },
  {
    id: 'concept-page',
    resolveUrl: (page) => firstMatchingHref(page, '/en/concepts', '/en/concepts/'),
    assertKeyBlocks: async (page) => {
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('#overview')).toBeVisible();
    },
    axeScope: 'main',
  },
];

test.describe('A12 responsive + AA contrast re-check', () => {
  for (const spec of PAGES) {
    for (const viewport of QA_VIEWPORTS) {
      test(`${spec.id} at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const url = await spec.resolveUrl(page);
        test.skip(!url, `${spec.id}: no route discovered — listing may be empty`);
        if (!url) return;

        await gotoAndSettle(page, url);
        await assertNoHorizontalOverflow(page);
        await spec.assertKeyBlocks(page);
        await assertAaContrast(page, spec.axeScope);
      });
    }
  }
});
