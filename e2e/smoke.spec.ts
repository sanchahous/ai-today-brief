import { expect, test } from '@playwright/test';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';

test.describe('Smoke', () => {
  test('/uk/news renders header, sidebar, and feed', async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page);

    await expect(page.locator('h1')).toBeVisible();

    const postCards = page.getByTestId('post-card');
    const emptyState = page.getByText(/Нічого не знайдено|Nothing found/i);

    const hasPosts = (await postCards.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasPosts || hasEmpty).toBe(true);
  });

  test('header navigation links are reachable', async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page);

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Головна' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Новини' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Про нас' })).toBeVisible();
  });
});
