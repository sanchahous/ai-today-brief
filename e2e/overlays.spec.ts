import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function openCatalog(page: Page) {
  await page.goto('/ds-catalog');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  const scope = page.getByTestId('overlay-catalog');
  await expect(scope).toHaveAttribute('data-ready', 'true');
  return scope;
}

async function clickBackdrop(page: Page, backdrop: Locator, panel: Locator) {
  const shell = await backdrop.boundingBox();
  const dialog = await panel.boundingBox();
  if (!shell || !dialog) throw new Error('overlay boxes missing');
  const points = [
    { x: shell.x + 6, y: shell.y + 6 },
    { x: shell.x + shell.width - 6, y: shell.y + 48 },
    { x: shell.x + shell.width / 2, y: shell.y + shell.height - 6 },
  ];
  const point = points.find(
    (candidate) =>
      candidate.x < dialog.x ||
      candidate.x > dialog.x + dialog.width ||
      candidate.y < dialog.y ||
      candidate.y > dialog.y + dialog.height,
  );
  if (!point) throw new Error('backdrop is not reachable');
  await page.mouse.click(point.x, point.y);
}

test.describe('overlay catalog', () => {
  test('Escape, backdrop and close return focus; Tab stays inside; the page does not scroll', async ({ page }) => {
    await openCatalog(page);
    const cases = [
      { name: 'Open centred dialog', backdrop: 'sheet-center-backdrop', panel: 'sheet-center-panel' },
      { name: 'Open left sheet', backdrop: 'sheet-left-backdrop', panel: 'sheet-left-panel' },
      { name: 'Open right sheet', backdrop: 'sheet-right-backdrop', panel: 'sheet-right-panel' },
    ] as const;

    for (const item of cases) {
      const trigger = page.getByRole('button', { name: item.name });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Edition note' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      for (let step = 0; step < 4; step += 1) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await clickBackdrop(page, page.getByTestId(item.backdrop), page.getByTestId(item.panel));
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });

  test('full sheet closes from Escape and the close button and covers the viewport', async ({ page }) => {
    await openCatalog(page);
    const trigger = page.getByRole('button', { name: 'Open full sheet' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Edition note' });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.width).toBeGreaterThan((viewport?.width ?? 0) - 2);
    expect(box && viewport && box.height).toBeGreaterThan((viewport?.height ?? 0) - 2);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('an open modal locks body scroll and restores it on close', async ({ page }) => {
    await openCatalog(page);
    const trigger = page.getByRole('button', { name: 'Open dialog' });
    await trigger.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Subscribe to the brief' });
    await expect(dialog).toBeVisible();
    const locked = await page.evaluate(() => ({
      position: document.body.style.position,
      overflow: document.body.style.overflow,
      top: document.body.style.top,
    }));
    expect(locked.position).toBe('fixed');
    expect(locked.overflow).toBe('hidden');
    await page.mouse.wheel(0, 800);
    await page.evaluate(() => window.scrollBy(0, 800));
    expect(await page.evaluate(() => document.body.style.top)).toBe(locked.top);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    await expect(trigger).toBeFocused();
  });

  test('disclosure is a link list, not a menu, and dismiss returns focus', async ({ page }) => {
    const scope = await openCatalog(page);
    const trigger = scope.getByRole('button', { name: 'Sections' });
    await trigger.click();
    const nav = scope.getByRole('navigation', { name: 'Sections' });
    await expect(nav).toBeVisible();
    await expect(scope.getByRole('menu')).toHaveCount(0);
    await expect(scope.getByRole('menuitem')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'News' })).toHaveAttribute('href', '#overlay-nav-news');
    for (let step = 0; step < 4; step += 1) {
      if (await nav.evaluate((el) => el.contains(document.activeElement))) break;
      await page.keyboard.press('Tab');
    }
    expect(await nav.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    const viewport = page.viewportSize();
    await page.mouse.click((viewport?.width ?? 800) / 2, (viewport?.height ?? 600) - 24);
    await expect(nav).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await scope.getByRole('button', { name: 'Close' }).click();
    await expect(nav).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Ukrainian labels and a scoped axe pass', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const scope = await openCatalog(page);
    await scope.getByRole('button', { name: 'UK', exact: true }).click();
    await expect(scope).toHaveAttribute('lang', 'uk');
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="overlay-catalog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    const trigger = scope.getByRole('button', { name: 'Відкрити ліву панель' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Нотатка випуску' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Закрити' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('modal shell uses the modal layer token', async ({ page }) => {
    await openCatalog(page);
    await page.getByRole('button', { name: 'Open left sheet' }).click();
    const backdrop = page.getByTestId('sheet-left-backdrop');
    const layer = await backdrop.evaluate((el) => ({
      z: getComputedStyle(el).zIndex,
      raw: [...el.classList].some((name) => /^z-\[\d+\]$/.test(name)),
    }));
    expect(layer.raw).toBe(false);
    expect(layer.z).toBe('120');
  });
});
