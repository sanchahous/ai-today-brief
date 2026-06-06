import { expect, test, type Page } from '@playwright/test';

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/news');
    await page.waitForLoadState('networkidle');
  });

  function themeToggle(page: Page) {
    return page.getByRole('navigation', { name: 'Primary' }).getByTestId('theme-toggle');
  }

  test('toggles light theme class on html', async ({ page }) => {
    const toggle = themeToggle(page);
    await expect(toggle).toBeEnabled();

    const html = page.locator('html');
    const wasLight = await html.evaluate((el) => el.classList.contains('theme-light'));

    await toggle.click();
    if (wasLight) {
      await expect(html).not.toHaveClass(/theme-light/);
    } else {
      await expect(html).toHaveClass(/theme-light/);
    }

    await toggle.click();
    if (wasLight) {
      await expect(html).toHaveClass(/theme-light/);
    } else {
      await expect(html).not.toHaveClass(/theme-light/);
    }
  });

  test('persists theme preference after reload', async ({ page }) => {
    const toggle = themeToggle(page);
    await expect(toggle).toBeEnabled();

    const html = page.locator('html');
    const isLight = await html.evaluate((el) => el.classList.contains('theme-light'));

    if (isLight) {
      await toggle.click();
      await expect(html).not.toHaveClass(/theme-light/);
    }
    await toggle.click();
    await expect(html).toHaveClass(/theme-light/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(themeToggle(page)).toBeEnabled();
    await expect(html).toHaveClass(/theme-light/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
  });
});
