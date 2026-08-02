import { expect, test } from '@playwright/test';

test('an unpublished Weekly Digest is a true noindex 404 without article SEO', async ({ page }) => {
  const response = await page.goto('/en/weekly/definitely-not-a-published-digest');
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(
    page.locator('script[type="application/ld+json"]', { hasText: 'Article' }),
  ).toHaveCount(0);
});
