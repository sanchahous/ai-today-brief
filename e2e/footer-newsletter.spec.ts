import { expect, test } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

// Home page carries both the newsletter band and the site footer.
const HOME = '/en';

const MOBILE_VIEWPORTS = [VIEWPORTS.phone320, VIEWPORTS.phone390] as const;

test.describe('Footer and newsletter band layout', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`newsletter email input and submit button fit within ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });

      // The NewsletterBand is wrapped in a <Reveal> that may defer rendering until
      // the element enters the viewport — scroll it into view before asserting.
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.scrollIntoViewIfNeeded();
      await expect(emailInput).toBeVisible({ timeout: 10_000 });

      const form = page
        .locator('form')
        .filter({ has: page.locator('input[type="email"]') })
        .first();
      const submitBtn = form.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();

      const btnBox = await submitBtn.boundingBox();
      expect(btnBox, 'submit button has no bounding box').not.toBeNull();
      // Button must be fully within the viewport — not clipped on the right.
      expect(btnBox!.x, 'button starts left of viewport').toBeGreaterThanOrEqual(0);
      expect(
        btnBox!.x + btnBox!.width,
        'submit button is clipped on the right edge',
      ).toBeLessThanOrEqual(vp.width + 1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1);
    });

    test(`footer nav link tap targets are >= 40px tall at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });

      const footerNav = page.locator('footer').getByRole('navigation', { name: /footer/i });
      await expect(footerNav).toBeVisible({ timeout: 30_000 });

      const links = footerNav.getByRole('link');
      const count = await links.count();
      expect(count, 'no links found in footer navigation').toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const box = await link.boundingBox();
        expect(box, `footer link #${i} has no bounding box`).not.toBeNull();
        const label = (await link.textContent())?.trim() ?? `link #${i}`;
        expect(
          box!.height,
          `"${label}" tap target height ${box!.height}px is below the 40px minimum`,
        ).toBeGreaterThanOrEqual(40);
      }
    });
  }

  test('footer renders columns side-by-side at 1280px without overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 30_000 });

    // Inspect the footer's flex row: footer > div (content wrapper) > div (flex row).
    // At 1280px the brand block and footer nav should sit side-by-side, so their
    // left edges must differ by a meaningful amount (> 40px).
    const colMetrics = await page.locator('footer').evaluate((footer) => {
      const contentDiv = footer.children[0] as Element | undefined;
      if (!contentDiv) return [];
      const flexRow = contentDiv.children[0] as Element | undefined;
      if (!flexRow) return [];
      return Array.from(flexRow.children).map((el) => ({
        left: Math.round(el.getBoundingClientRect().left),
      }));
    });

    expect(
      colMetrics.length,
      'footer flex row has fewer than 2 column blocks',
    ).toBeGreaterThanOrEqual(2);

    const lefts = colMetrics.map((c) => c.left);
    const spread = Math.max(...lefts) - Math.min(...lefts);
    expect(
      spread,
      `footer columns are stacked, not side-by-side (horizontal spread: ${spread}px)`,
    ).toBeGreaterThan(40);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow at 1280px').toBeLessThanOrEqual(1);
  });
});
