import { expect, test, type Page } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

/**
 * Unified SearchDialog: hero/header triggers, fullscreen sheet below 960px,
 * in-flow results, scroll-lock, and focus return.
 */
const PHONE = VIEWPORTS.phone390;

async function gotoHome(page: Page) {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
}

const heroTrigger = (page: Page) => page.getByTestId('hero-search-trigger');
const headerIcon = (page: Page) => page.getByTestId('header-search-icon');
const dialog = (page: Page) => page.getByRole('dialog', { name: /^search$/i });

test.describe('Mobile search', () => {
  test('hero shows a full-width trigger at phone width', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await gotoHome(page);
    const trigger = heroTrigger(page);
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(PHONE.width * 0.8);
  });

  test('tap opens a fullscreen modal: scroll-lock, >=16px input, focus, Escape returns focus', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await gotoHome(page);
    const trigger = heroTrigger(page);
    await trigger.click();

    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(d).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByTestId('search-dialog-panel')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const input = d.getByRole('searchbox');
    await expect(input).toBeFocused();
    const fontSize = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('results render in-flow and are never clipped horizontally', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone320);
    await gotoHome(page);
    await heroTrigger(page).click();
    const d = dialog(page);
    await d.getByRole('searchbox').fill('MCP');

    const list = d.getByRole('listbox', { name: /search results/i });
    await expect(list).toBeVisible({ timeout: 15_000 });
    const position = await list.evaluate((el) => getComputedStyle(el).position);
    expect(position).not.toBe('absolute');
    const box = await list.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS.phone320.width + 1);
  });

  test('close button dismisses and releases the scroll lock', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await gotoHome(page);
    await heroTrigger(page).click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    await d.getByRole('button', { name: /close search/i }).click();
    await expect(d).toBeHidden();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('header icon: inert on home until scrolled past the hero, then back (two-way)', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await gotoHome(page);
    const icon = headerIcon(page);
    await expect.poll(async () => icon.getAttribute('aria-hidden')).toBe('true');

    await page.evaluate(() => window.scrollTo(0, 1400));
    await expect.poll(async () => icon.getAttribute('aria-hidden')).toBe('false');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => icon.getAttribute('aria-hidden')).toBe('true');
  });

  test('header icon opens the same modal; on /news it is available without scrolling', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/en/news', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });
    const icon = headerIcon(page);
    await expect(icon).not.toHaveAttribute('aria-hidden', 'true');
    await icon.click();
    await expect(dialog(page)).toBeVisible();
  });

  test('desktop opens SearchDialog from header trigger and Ctrl+K', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await gotoHome(page);
    await expect(heroTrigger(page)).toBeVisible();
    await expect(headerIcon(page)).toBeHidden();

    await page.getByTestId('search-trigger-compact').click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();

    await page.keyboard.press('Control+K');
    await expect(dialog(page)).toBeVisible();
  });
});
