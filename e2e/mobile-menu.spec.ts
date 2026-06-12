import { expect, test, type Page } from '@playwright/test';

import { MOBILE_MENU_WIDTHS } from './helpers/viewports';

async function openMobileMenu(page: Page) {
  await page.goto('/uk', { waitUntil: 'domcontentloaded' });
  const menuButton = page.getByRole('button', { name: /меню|menu/i }).first();
  await expect(menuButton).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        await menuButton.click();
        return menuButton.getAttribute('aria-expanded');
      },
      { timeout: 10_000 },
    )
    .toBe('true');
  const dialog = page.getByRole('dialog', { name: /меню|menu/i });
  await expect(dialog).toBeVisible();
  return { menuButton, dialog };
}

test.describe('Mobile menu overlay', () => {
  for (const viewport of MOBILE_MENU_WIDTHS) {
    test(`uses accessible fullscreen drawer at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { menuButton, dialog } = await openMobileMenu(page);

      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      await expect(menuButton).toHaveAttribute('aria-controls', 'site-mobile-menu');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      const panel = page.getByTestId('mobile-menu-panel');
      const backdrop = page.getByTestId('mobile-menu-backdrop');
      await expect(panel).toBeVisible();
      await expect(backdrop).toBeVisible();

      const overlayMetrics = await backdrop.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const styles = getComputedStyle(el);
        return {
          position: styles.position,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          background: styles.backgroundColor,
        };
      });
      expect(overlayMetrics.position).toBe('fixed');
      expect(overlayMetrics.top).toBe(0);
      expect(overlayMetrics.left).toBe(0);
      expect(overlayMetrics.width).toBe(viewport.width);
      expect(overlayMetrics.height).toBe(viewport.height);
      expect(overlayMetrics.background).not.toContain('rgba(0, 0, 0, 0)');

      await expect(dialog.getByRole('link', { name: /^Підписатися$/ })).toHaveCount(1);
      await expect(page.locator('header').getByRole('link', { name: /^Підписатися$/ })).toHaveCount(0);

      const tapTargets = dialog.getByRole('link', { name: /^EN$/ }).or(dialog.locator('summary'));
      const targetCount = await tapTargets.count();
      for (let index = 0; index < targetCount; index += 1) {
        const box = await tapTargets.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

      await page.keyboard.press('Tab');
      for (let index = 0; index < 6; index += 1) {
        const activeInsideDialog = await dialog.evaluate((el) => el.contains(document.activeElement));
        expect(activeInsideDialog).toBe(true);
        await page.keyboard.press('Tab');
      }

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(menuButton).toBeFocused();
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    });
  }

  test('closes on route change and leaves a single Subscribe action visible while open', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const { dialog } = await openMobileMenu(page);

    await expect(dialog.getByRole('link', { name: /^Підписатися$/ })).toHaveCount(1);
    await expect(page.locator('header').getByRole('link', { name: /^Підписатися$/ })).toHaveCount(0);
    await dialog.getByRole('link', { name: /^Новини$/ }).click();

    await expect(page).toHaveURL(/\/uk\/news$/);
    await expect(dialog).toBeHidden();
  });
});
