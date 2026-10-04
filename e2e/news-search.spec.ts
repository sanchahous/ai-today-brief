import { expect, test } from '@playwright/test';
import { expectedSiteUrl } from '../scripts/e2e-server-url';

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
    expect(canonical).toBe(`${expectedSiteUrl()}/en/news`);
  });

  test('UK idle heading and form', async ({ page }) => {
    await page.goto('/uk/news/search', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/зв/i);
    await expect(page.getByTestId('news-search-form')).toBeVisible();
  });

  test('second query from results form resets chip, sort and URL', async ({ page }) => {
    await page.goto('/en/news/search?q=mcp', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('news-feed')).toHaveAttribute('data-hydrated', 'true', {
      timeout: 30_000,
    });

    const activeChips = page.getByTestId('active-filter-chips');
    await expect(activeChips).toContainText('mcp');

    const sortSelect = page.getByLabel(/sort/i);
    await sortSelect.selectOption('oldest');
    await expect(page).toHaveURL(/sort=oldest/);

    const input = page.locator('#news-search-q');
    await input.fill('agents');
    await page.getByTestId('news-search-form').getByRole('button', { name: /search/i }).click();

    await expect(page).toHaveURL(/q=agents/);
    await expect(page).not.toHaveURL(/sort=oldest/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('agents');
    await expect(activeChips).toContainText('agents');
    await expect(activeChips).not.toContainText('mcp');
    await expect(sortSelect).toHaveValue('relevance');
  });

  test('popular query syncs the search field and back restores idle input', async ({ page }) => {
    await page.goto('/en/news/search', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#news-search-q');
    await expect(input).toHaveValue('');

    const chip = page.getByTestId('news-search-idle').getByRole('button').first();
    const label = (await chip.textContent())?.trim() ?? '';
    expect(label.length).toBeGreaterThan(0);

    await chip.click();
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    await expect(input).toHaveValue(label);
    await expect(page.getByTestId('news-feed')).toBeVisible({ timeout: 30_000 });

    await page.goBack();
    await expect(page.getByTestId('news-search-idle')).toBeVisible({ timeout: 30_000 });
    await expect(input).toHaveValue('');
  });
});
