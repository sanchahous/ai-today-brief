import { expect, test } from '@playwright/test';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';
import { VIEWPORTS } from './helpers/viewports';

test.describe('News feed interaction, URL state and pagination (G14)', () => {
  test('synchronizes filter selection with URL query params and preserves back/forward history', async ({
    page,
  }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page, 'en');

    // 1. Initial state: clean URL
    expect(page.url()).toContain('/en/news');
    expect(page.url()).not.toContain('categories=');

    // 2. Select first category checkbox in desktop sidebar if available
    const sidebar = page.getByTestId('news-sidebar');
    const firstCategoryCheckbox = sidebar.locator('input[type="checkbox"]').first();
    const hasCategoryCheckbox = await firstCategoryCheckbox.isVisible().catch(() => false);

    if (hasCategoryCheckbox) {
      await firstCategoryCheckbox.check();
      // Verify URL updated without full page reload
      await expect(page).toHaveURL(/categories=/);
      // Verify active filter chip appeared
      const resetButton = sidebar.getByRole('button', { name: /reset|скинути/i });
      await expect(resetButton).toBeVisible();
    }

    // 3. Select a topic if available
    const topicCheckboxes = sidebar.locator('section').filter({ hasText: /topics|теми/i }).locator('input[type="checkbox"]');
    const hasTopic = await topicCheckboxes.count().then(c => c > 0);
    if (hasTopic) {
      await topicCheckboxes.first().check();
      await expect(page).toHaveURL(/topics=/);
    }

    // 4. Select a date preset
    const dateWeekButton = sidebar.getByRole('button', { name: /week/i });
    if (await dateWeekButton.isVisible()) {
      await dateWeekButton.click();
      await expect(page).toHaveURL(/date=week/);
    }
    
    // 5. Test reload preserves state
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('news-feed')).toHaveAttribute('data-hydrated', 'true', { timeout: 30_000 });
    if (hasCategoryCheckbox) await expect(page).toHaveURL(/categories=/);
    if (hasTopic) await expect(page).toHaveURL(/topics=/);
    
    // 6. Test browser back button restores previous state
    if (await dateWeekButton.isVisible()) {
      await page.goBack();
      // After back, date=week should be gone
      expect(page.url()).not.toContain('date=week');
    }
    if (hasTopic) {
      await page.goBack();
      expect(page.url()).not.toContain('topics=');
    }
  });

  test('hydrates state directly from URL query parameters', async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);

    // Direct visit with query parameters
    await page.goto('/en/news?date=month&sort=oldest', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /news/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('news-feed')).toHaveAttribute('data-hydrated', 'true', {
      timeout: 30_000,
    });

    // Check that date "Month" button has pressed state
    const sidebar = page.getByTestId('news-sidebar');
    const monthButton = sidebar.getByRole('button', { name: /month/i });
    await expect(monthButton).toHaveAttribute('aria-pressed', 'true');

    // Check that sort select has 'oldest' value
    const sortSelect = page.getByLabel(/sort/i);
    await expect(sortSelect).toHaveValue('oldest');
  });

  test('search query shows relevance sort option and updates URL', async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);

    // Direct visit with search query parameter
    await page.goto('/en/news?q=intelligence', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /news/i })).toBeVisible({
      timeout: 30_000,
    });

    // Sort select should offer Relevance when query is active
    const sortSelect = page.getByLabel(/sort/i);
    const updatedOptions = await sortSelect.locator('option').allTextContents();
    expect(updatedOptions.some((o) => /relevance/i.test(o))).toBe(true);

    // Search input should have the query value
    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toHaveValue('intelligence');

    // Active query chip should be visible
    const activeChips = page.getByTestId('active-filter-chips');
    await expect(activeChips).toBeVisible();

    // Clear search using chip remove button
    const clearBtn = activeChips.getByRole('button', { name: /remove|✕|x/i }).first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(page).not.toHaveURL(/q=intelligence/);
      await expect(searchInput).toHaveValue('');
    }
  });

  test('pagination renders semantic links and supports client navigation', async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page, 'en');

    const pagination = page.getByTestId('pagination');
    const hasPagination = await pagination.isVisible().catch(() => false);

    if (!hasPagination) {
      test.skip(true, 'Feed items fit on single page in this environment');
      return;
    }

    // Pagination links must be semantic <a> elements with href for SEO
    const page2Link = pagination.getByRole('link', { name: '2' });
    await expect(page2Link).toBeVisible();
    await expect(page2Link).toHaveAttribute('href', /\?page=2/);

    // Click page 2
    await page2Link.click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page2Link).toHaveAttribute('aria-current', 'page');

    // Next / Previous buttons have accessible touch size
    const nextBtn = pagination.getByRole('link', { name: /next/i });
    if (await nextBtn.isVisible()) {
      const box = await nextBtn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('mobile drawer controls satisfy touch target floor (min 44px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone390);
    await gotoNewsPage(page, 'en');

    // Open mobile drawer
    const filterBtn = page.getByRole('button', { name: /filters/i });
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();

    const drawer = page.getByRole('dialog', { name: /filters/i });
    await expect(drawer).toBeVisible();

    // Check Done button height is at least 44px
    const doneBtn = drawer.getByRole('button', { name: /done|apply/i });
    await expect(doneBtn).toBeVisible();
    const doneBox = await doneBtn.boundingBox();
    expect(doneBox).not.toBeNull();
    expect(doneBox!.height).toBeGreaterThanOrEqual(44);

    // Check Reset button height
    const resetBtn = drawer.getByRole('button', { name: /reset all/i });
    if (await resetBtn.isVisible()) {
      const resetBox = await resetBtn.boundingBox();
      expect(resetBox).not.toBeNull();
      expect(resetBox!.height).toBeGreaterThanOrEqual(44);
    }

    // Close via Done
    await doneBtn.click();
    await expect(drawer).toBeHidden();
  });
});
