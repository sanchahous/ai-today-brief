import { expect, test } from '@playwright/test';
import type { SearchPreviewItem } from '../src/hooks/use-search-preview';

import { VIEWPORTS } from './helpers/viewports';

const dialog = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: /^search$/i });

test.describe('SearchDialog keyboard and network', () => {
  test('Ctrl+K opens, Escape closes with focus return, arrows move focus, Enter opens result', async ({
    page,
  }) => {
    // Keyboard behavior must remain testable when the search index has no matching stories.
    const result: SearchPreviewItem = {
      id: 'keyboard-search-fixture',
      href: '/en/news/agents-and-mcp/keyboard-search-fixture',
      title: 'Agent keyboard search fixture',
      date: '2026-10-04',
      categorySlug: 'agents-and-mcp',
      categoryName: 'Agents & MCP',
      categoryColor: null,
      sourceName: 'Test fixture',
    };
    await page.route('**/api/search?**', async (route) => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get('q')).toBe('agent');
      expect(params.get('lang')).toBe('en');
      expect(params.get('limit')).toBe('5');
      await route.fulfill({ json: { items: [result], total: 1 } });
    });
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    const headerTrigger = page.getByTestId('search-trigger-compact');
    await expect(headerTrigger).toBeVisible({ timeout: 30_000 });

    // Hydrate client listeners before relying on the global shortcut.
    await headerTrigger.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();

    await page.keyboard.press('Control+K');
    const d = dialog(page);
    await expect(d).toBeVisible();
    const input = d.getByRole('searchbox');
    await expect(input).toBeFocused();

    await input.fill('agent');
    const list = d.getByRole('listbox', { name: /search results/i });
    await expect(list).toBeVisible({ timeout: 15_000 });
    const first = list.getByRole('option').first();
    await expect(first).toBeVisible();
    await expect(first).toContainText(result.title);
    await expect(first).toHaveAttribute('href', result.href);

    await page.keyboard.press('ArrowDown');
    await expect(first).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(input).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(first).toBeFocused();

    await Promise.all([
      page.waitForURL((url) => url.pathname === result.href),
      page.keyboard.press('Enter'),
    ]);
    await expect(d).toBeHidden();
  });

  test('Escape returns focus to the header trigger', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    const headerTrigger = page.getByTestId('search-trigger-compact');
    await expect(headerTrigger).toBeVisible({ timeout: 30_000 });
    await headerTrigger.click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(headerTrigger).toBeFocused();
  });

  test('empty query sends zero requests to /api/search', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    const headerTrigger = page.getByTestId('search-trigger-compact');
    await expect(headerTrigger).toBeVisible({ timeout: 30_000 });

    let searchRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/search')) searchRequests += 1;
    });

    await headerTrigger.click();
    await expect(dialog(page)).toBeVisible();
    await page.waitForTimeout(400);
    expect(searchRequests).toBe(0);
  });
});
