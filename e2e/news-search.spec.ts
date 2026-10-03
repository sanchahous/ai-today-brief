import { expect, test } from '@playwright/test';

test.describe('News search page (/[lang]/news/search)', () => {
  test('empty q shows idle state without results feed', async ({ page }) => {
    await page.goto('/en/news/search?q=', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('news-search-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('news-search-idle')).toBeVisible();
    await expect(page.getByTestId('news-feed')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/thread/i);
  });

  test('bare search route shows idle state', async ({ page }) => {
    await page.goto('/en/news/search', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('news-search-idle')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('news-feed')).toHaveCount(0);
  });

  test('encodes quotes, Cyrillic and emoji in q', async ({ page }) => {
    const query = `"тест" 🎉`;
    const encoded = encodeURIComponent(query);
    await page.goto(`/en/news/search?q=${encoded}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`q=${encoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(query);
    await expect(page.getByTestId('news-feed')).toBeVisible({ timeout: 30_000 });
  });

  test('breadcrumb includes Search and robots stay noindex', async ({ page }) => {
    await page.goto('/en/news/search?q=mcp', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toContainText(/search/i);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/noindex/i);
    expect(robots).toMatch(/follow/i);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://aitodaybrief.com/en/news');
  });

  test('UK idle heading and form', async ({ page }) => {
    await page.goto('/uk/news/search', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/зв/i);
    await expect(page.getByTestId('news-search-form')).toBeVisible();
  });
});
