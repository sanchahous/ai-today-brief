import { expect, test } from '@playwright/test';

const HEADER_COLLISION_WIDTHS = [960, 1100, 1160] as const;

async function gotoHeaderLayoutPage(page: import('@playwright/test').Page) {
  await page.goto('/uk/news', { waitUntil: 'domcontentloaded' });
  // Level 1 only - story headlines containing "news" also match the name regex.
  await expect(page.getByRole('heading', { level: 1, name: /news|новини/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Header layout', () => {
  for (const width of HEADER_COLLISION_WIDTHS) {
    test(`desktop header keeps search and nav usable at ${width}px`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.route('**/api/search?**', async (route) => {
        await route.fulfill({ json: { items: [], total: 0 } });
      });
      await page.setViewportSize({ width, height: 800 });
      await gotoHeaderLayoutPage(page);

      const header = page.locator('header').first();
      const headerBox = await header.boundingBox();
      expect(headerBox).not.toBeNull();

      const headerMetrics = await header.evaluate((el) => {
        const root = document.documentElement;
        const headerHeight = Number.parseFloat(getComputedStyle(root).getPropertyValue('--header-h'));
        const rect = el.getBoundingClientRect();
        return {
          cssHeaderHeight: headerHeight,
          renderedHeight: rect.height,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      // Header is --header-h (132px on desktop, 76px on mobile)
      const expectedHeight = headerMetrics.cssHeaderHeight;
      expect(headerMetrics.renderedHeight).toBeCloseTo(expectedHeight, 0);
      expect(headerMetrics.documentOverflow).toBeLessThanOrEqual(1);

      const nav = page.getByRole('navigation', { name: 'Primary' });
      await expect(nav).toBeVisible();

      const navMetrics = await nav.evaluate((el) => {
        const container = el.closest('.site-header-shell')?.querySelector('.mx-auto') ?? el.parentElement;
        const navRect = el.getBoundingClientRect();
        const containerRect = container?.getBoundingClientRect();
        return {
          navLeft: navRect.left,
          navRight: navRect.right,
          containerLeft: containerRect?.left ?? 0,
          containerRight: containerRect?.right ?? window.innerWidth,
          navHeight: navRect.height,
          navOverflow: el.scrollWidth - el.clientWidth,
        };
      });

      expect(navMetrics.navLeft).toBeGreaterThanOrEqual(navMetrics.containerLeft - 1);
      expect(navMetrics.navRight).toBeLessThanOrEqual(navMetrics.containerRight + 1);
      expect(navMetrics.navHeight).toBeLessThanOrEqual(44);
      expect(navMetrics.navOverflow).toBeLessThanOrEqual(1);

      const searchTrigger = header.getByTestId('search-trigger-compact');
      await expect(searchTrigger).toBeVisible();
      const searchBox = await searchTrigger.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(searchBox!.width).toBeGreaterThanOrEqual(160);

      await searchTrigger.click();
      const dialog = page.getByRole('dialog', { name: /search|пошук/i });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      const input = dialog.getByRole('searchbox');
      await input.fill('agent');
      await expect(input).toHaveValue('agent');
      const searchForm = dialog.locator('form[role="search"]');
      await Promise.all([
        page.waitForURL(/\/uk\/news\/search\?q=agent$/, { timeout: 45_000 }),
        searchForm.evaluate((form) => {
          if (!(form instanceof HTMLFormElement)) return;
          const input = form.querySelector('input[type="search"]');
          if (input instanceof HTMLInputElement && input.value) {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          form.requestSubmit();
        }),
      ]);
    });
  }

  test('desktop category dropdown opens, closes on Escape and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoHeaderLayoutPage(page);

    // Find the Categories button
    const categoriesBtn = page.getByRole('button', { name: /Categories|Категорії/i });
    await expect(categoriesBtn).toBeVisible();
    await categoriesBtn.click();

    // Verify dropdown opens
    const listbox = page.getByRole('listbox', { name: /Categories|Категорії/i });
    await expect(listbox).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();

    // Focus returns to the trigger
    await expect(categoriesBtn).toBeFocused();
  });

  test('digests section is active for weekly and daily briefs', async ({ page }) => {
    // Check weekly brief
    await page.goto('/en/weekly/ai-weekly-2026-06-29', { waitUntil: 'domcontentloaded' });
    const digestsLink1 = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Digests|Дайджести/i });
    await expect(digestsLink1).toHaveAttribute('aria-current', 'page');
    
    // Check daily brief
    await page.goto('/en/reasoning-token-compression-and-efficient-agent-execution', { waitUntil: 'domcontentloaded' });
    const digestsLink2 = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Digests|Дайджести/i });
    await expect(digestsLink2).toHaveAttribute('aria-current', 'page');
  });
});
