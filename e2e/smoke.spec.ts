import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('/uk/news renders header, sidebar, and feed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/news');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('news-sidebar')).toBeVisible();

    const postCards = page.getByTestId('post-card');
    const emptyState = page.getByText(/Нічого не знайдено|Nothing found/i);

    const hasPosts = (await postCards.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasPosts || hasEmpty).toBe(true);
  });

  test('header navigation links are reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/news');
    await page.waitForLoadState('networkidle');

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Головна' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Новини' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Про нас' })).toBeVisible();
  });
});
