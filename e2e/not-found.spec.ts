import { expect, test } from '@playwright/test';

const missingPaths = ['/en/zzz-missing', '/uk/zzz-missing', '/zzz-missing'];

for (const path of missingPaths) {
  test(`returns HTTP 404 for ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator('#nf-title')).toBeVisible();
    await expect(page.locator('head meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
}

test('404 page has no infinite CSS animations', async ({ page }) => {
  await page.goto('/en/zzz-missing');
  const infiniteCount = await page.evaluate(() => {
    const root = document.querySelector('.not-found-page');
    if (!root) return 0;
    const animations = root.getAnimations({ subtree: true });
    return animations.filter((a) => {
      if (a.playbackRate <= 0 || !a.effect) return false;
      const timing = a.effect.getTiming();
      return timing.iterations === Infinity;
    }).length;
  });
  expect(infiniteCount).toBe(0);
});

test('404 search form navigates to news search', async ({ page }) => {
  await page.goto('/en/zzz-missing');
  await page.locator('#nf-q').fill('agents');
  await page.getByRole('search').getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/en\/news\/search\?q=agents/);
});

test('404 suggested links include digests and subscribe', async ({ page }) => {
  await page.goto('/uk/zzz-missing');
  const nav = page.getByRole('navigation', { name: 'Рекомендовані сторінки' });
  await expect(nav.getByRole('link', { name: 'Головна' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Новини' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Дайджести' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Підписатися' })).toBeVisible();
});
