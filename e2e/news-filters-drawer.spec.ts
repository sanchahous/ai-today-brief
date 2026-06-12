import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoNewsPage } from './helpers/news-page';
import { VIEWPORTS } from './helpers/viewports';

async function openFiltersDrawer(page: Page) {
  const trigger = page.getByRole('button', { name: /filters|фільтри/i });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: /filters|фільтри/i });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

async function expectAtLeastTwoFilterColumns(dialog: Locator) {
  const groups = dialog.getByTestId('filter-group');
  await expect(groups.first()).toBeVisible();
  expect(await groups.count()).toBeGreaterThanOrEqual(2);

  const metrics = await groups.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      };
    }),
  );

  const hasSharedRowAcrossColumns = metrics.some((a, index) =>
    metrics.slice(index + 1).some((b) => {
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const separatedX = Math.abs(a.left - b.left) > 40 || Math.abs(a.right - b.right) > 40;
      return overlapY > 20 && separatedX;
    }),
  );

  expect(hasSharedRowAcrossColumns).toBe(true);
}

test.describe('News filters drawer', () => {
  for (const viewport of [VIEWPORTS.phone390, VIEWPORTS.tablet768]) {
    test(`opens as a fullscreen compact multi-column drawer at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoNewsPage(page, 'en');

      const { dialog } = await openFiltersDrawer(page);
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(viewport.width * 0.95);

      await expectAtLeastTwoFilterColumns(dialog);
      await expect(dialog.getByRole('radio', { name: /newest|oldest|relevance|discussed/i })).toHaveCount(0);
    });
  }

  test('locks body scroll and closes via Escape, close button, and Apply', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await gotoNewsPage(page, 'en');

    const { trigger, dialog } = await openFiltersDrawer(page);
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const bodyScrollWhileOpen = await page.evaluate(() => {
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      window.scrollTo(0, 400);
      return { body: document.body.scrollTop, doc: document.documentElement.scrollTop, win: window.scrollY };
    });
    expect(bodyScrollWhileOpen.body + bodyScrollWhileOpen.doc + bodyScrollWhileOpen.win).toBe(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

    await openFiltersDrawer(page);
    await page.getByRole('button', { name: /^close$/i }).click();
    await expect(dialog).toBeHidden();

    await openFiltersDrawer(page);
    await dialog.getByRole('button', { name: /apply/i }).click();
    await expect(dialog).toBeHidden();
  });

  for (const viewport of [VIEWPORTS.layout960, VIEWPORTS.header1023, VIEWPORTS.header1024]) {
    test(`keeps filters trigger and desktop sidebar mutually exclusive at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await gotoNewsPage(page, 'en');

      const triggerVisible = await page
        .getByRole('button', { name: /filters/i })
        .isVisible()
        .catch(() => false);
      const sidebarVisible = await page.getByTestId('news-sidebar').isVisible().catch(() => false);

      expect(Number(triggerVisible) + Number(sidebarVisible)).toBe(1);
      if (viewport.width < 1024) {
        expect(triggerVisible).toBe(true);
        expect(sidebarVisible).toBe(false);
      } else {
        expect(triggerVisible).toBe(false);
        expect(sidebarVisible).toBe(true);
      }
    });
  }
});
