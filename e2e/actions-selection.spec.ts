import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openCatalog(page: Page, lang: 'en' | 'uk', theme: 'night' | 'day') {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
  await page.goto('/ds-catalog');
  await expect(page.getByRole('heading', { name: 'Design system catalog', level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Axe/computed-colour checks must sample settled states, not transition frames.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  const scope = page.getByTestId('action-catalog');
  if (lang === 'uk') await scope.getByRole('button', { name: 'UK', exact: true }).click();
  await expect(scope).toHaveAttribute('lang', lang);
  return scope;
}

for (const lang of ['en', 'uk'] as const) for (const theme of ['night', 'day'] as const) {
  test.describe(`actions ${lang} ${theme}`, () => {
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      test(`state matrix, axe and reflow ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const scope = await openCatalog(page, lang, theme);
        const axe = await new AxeBuilder({ page }).include('[data-testid="action-catalog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(axe.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const smallText = await scope.locator('*').evaluateAll((nodes) => nodes.filter((node) =>
          node.getBoundingClientRect().width > 0 && Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
          && Number.parseFloat(getComputedStyle(node).fontSize) < 12).length);
        expect(smallText).toBe(0);
        await expect(scope.locator('button[aria-busy="true"]')).toHaveCount(26);
        expect(await scope.locator('svg').evaluateAll((nodes) => nodes.every((node) => node.getAttribute('aria-hidden') === 'true'))).toBe(true);
      });
    }

    test('native keyboard, toggle announcement, independent removal and pending submission', async ({ page }) => {
      const scope = await openCatalog(page, lang, theme);
      const button = scope.locator('button[data-variant="primary"][data-size="sm"]:not(:disabled)').first();
      await button.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      await expect(page.getByTestId('action-activation-count')).toHaveText('2');
      const toggle = page.getByTestId('action-toggle');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      const label = lang === 'uk' ? 'Прибрати фільтр: Тема з видаленням' : 'Remove filter: Removable topic';
      await scope.getByRole('button', { name: label, exact: true }).focus();
      await page.keyboard.press('Space');
      await expect(scope.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      await expect(page.getByTestId('action-chip-select-count')).toHaveText('0');
      const pending = page.getByTestId('action-pending-button');
      await pending.focus();
      await page.keyboard.press('Enter');
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveAttribute('aria-busy', 'true');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('action-submit-count')).toHaveText('1');
      await expect(scope.getByRole('link')).toHaveAttribute('href', '#action-catalog');
    });

    test('computed focus and fine-pointer hover use theme tokens; reduced motion keeps colour only', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const scope = await openCatalog(page, lang, theme);
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
      const button = scope.locator('button[data-variant="primary"]:not(:disabled)').first();
      await button.hover();
      const hover = await button.evaluate((node) => {
        const expected = document.createElement('span');
        expected.style.backgroundColor = 'var(--accent-fill-hover)';
        document.body.append(expected);
        const value = { actual: getComputedStyle(node).backgroundColor, expected: getComputedStyle(expected).backgroundColor };
        expected.remove();
        return value;
      });
      expect(hover.actual).toBe(hover.expected);
      await page.keyboard.press('Tab');
      await button.focus();
      const focus = await button.evaluate((node) => {
        const expected = document.createElement('span');
        expected.style.color = 'var(--focus)';
        document.body.append(expected);
        const style = getComputedStyle(node);
        const value = { actual: style.outlineColor, expected: getComputedStyle(expected).color, width: style.outlineWidth, offset: style.outlineOffset, transform: style.transform };
        expected.remove();
        return value;
      });
      expect(focus).toMatchObject({ actual: focus.expected, width: '2px', offset: '3px', transform: 'none' });
      const animations = await scope.locator('.animate-spin').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
      expect(animations.every((name) => name === 'none')).toBe(true);
    });
  });
}

test.describe('coarse pointer', () => {
  test.use({ hasTouch: true });
  for (const theme of ['night', 'day'] as const) for (const width of [360, 390, 768, 1440]) {
    test(`all actions have 44px targets and no sticky hover ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const scope = await openCatalog(page, 'uk', theme);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      const small = await scope.locator('button, a').evaluateAll((nodes) => nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width < 43.9 || rect.height < 43.9;
      }).map((node) => node.outerHTML.slice(0, 180)));
      expect(small).toEqual([]);
      await page.addStyleTag({ content: '* { transition: none !important; }' });
      const button = scope.locator('button[data-variant="primary"]:not(:disabled)').first();
      const resting = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
      await button.hover();
      expect(await button.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(resting);
    });
  }
});

test('200% text reflow', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Native browser text scaling uses CDP.');
  await page.setViewportSize({ width: 1280, height: 900 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
  await openCatalog(page, 'uk', 'day');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
