import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openFields(page: Page, lang: 'en' | 'uk', theme: 'night' | 'day') {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
  // Optional override for a local `next dev` host. Production `next start` uses the config baseURL.
  await page.goto(process.env.FIELDS_E2E_BASE ? `${process.env.FIELDS_E2E_BASE}/ds-catalog` : '/ds-catalog');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  const scope = page.getByTestId('field-catalog');
  await expect(scope).toHaveAttribute('data-ready', 'true');
  if (lang === 'uk') await scope.getByRole('button', { name: 'UK', exact: true }).click();
  await expect(scope).toHaveAttribute('lang', lang);
  return scope;
}

const copy = {
  en: { emailInvalid: 'Email · Invalid', edition: 'Edition language', period: 'Period', today: 'Today', week: '7 days', clear: 'Clear input', submit: 'Check fields' },
  uk: { emailInvalid: 'Електронна адреса · Помилка', edition: 'Мова випуску', period: 'Період', today: 'Сьогодні', week: '7 днів', clear: 'Очистити поле', submit: 'Перевірити поля' },
} as const;

for (const lang of ['en', 'uk'] as const) for (const theme of ['night', 'day'] as const) {
  test.describe(`fields ${lang} ${theme}`, () => {
    for (const width of [320, 390, 768, 1440]) {
      test(`labels, axe and reflow ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const scope = await openFields(page, lang, theme);
        const axe = await new AxeBuilder({ page }).include('[data-testid="field-catalog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(axe.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const smallText = await scope.locator('*').evaluateAll((nodes) => nodes.filter((node) =>
          node.getBoundingClientRect().width > 0 && Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
          && Number.parseFloat(getComputedStyle(node).fontSize) < 12).length);
        expect(smallText).toBe(0);
      });
    }

    test('hint stays with the error, and submit focuses the first invalid field', async ({ page }) => {
      const scope = await openFields(page, lang, theme);
      const text = copy[lang];
      const invalid = scope.getByRole('textbox', { name: text.emailInvalid, exact: true });
      await expect(invalid).toHaveAttribute('aria-invalid', 'true');
      const described = (await invalid.getAttribute('aria-describedby'))?.split(' ') ?? [];
      expect(described).toHaveLength(2);
      await expect(scope.locator(`[id="${described[0]}"]`)).toBeVisible();
      await expect(scope.locator(`[id="${described[1]}"]`)).toBeVisible();
      const form = page.getByTestId('field-invalid-form');
      await form.getByRole('button', { name: text.submit }).click();
      await expect(page.getByTestId('field-focused-id')).toHaveText('field-demo-email');
      await expect(form.locator('#field-demo-email')).toBeFocused();
      await form.locator('#field-demo-email').fill('reader@example.com');
      await form.getByRole('button', { name: text.submit }).click();
      await expect(page.getByTestId('field-focused-id')).toHaveText('field-demo-note');
      await expect(form.locator('#field-demo-note')).toBeFocused();
    });

    test('arrows move radios and segments; space toggles checkbox and switch', async ({ page }) => {
      const scope = await openFields(page, lang, theme);
      const text = copy[lang];
      const edition = scope.getByRole('radiogroup', { name: text.edition, exact: true });
      await edition.getByRole('radio', { name: 'English', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(edition.getByRole('radio', { name: 'Українська', exact: true })).toBeChecked();
      const period = scope.getByRole('radiogroup', { name: text.period, exact: true });
      await period.getByRole('radio', { name: text.today, exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(period.getByRole('radio', { name: text.week, exact: true })).toBeChecked();
      const checkbox = scope.getByTestId('field-checkbox');
      await checkbox.focus();
      await expect(checkbox).toBeChecked();
      await page.keyboard.press('Space');
      await expect(checkbox).not.toBeChecked();
      const toggle = scope.getByTestId('field-switch');
      await toggle.focus();
      await page.keyboard.press('Space');
      await expect(toggle).toBeChecked();
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await expect(toggle).toHaveAttribute('role', 'switch');
      const search = scope.getByTestId('field-search');
      await search.fill('archive');
      await scope.getByRole('button', { name: text.clear, exact: true }).click();
      await expect(search).toHaveValue('');
    });

    test('computed focus uses the focus token', async ({ page }) => {
      const scope = await openFields(page, lang, theme);
      const input = scope.getByTestId('field-focus-sample');
      await input.focus();
      const focus = await input.evaluate((node) => {
        const expected = document.createElement('span');
        expected.style.color = 'var(--focus)';
        document.body.append(expected);
        const style = getComputedStyle(node);
        const value = { actual: style.outlineColor, expected: getComputedStyle(expected).color, width: style.outlineWidth, offset: style.outlineOffset };
        expected.remove();
        return value;
      });
      expect(focus.actual).toBe(focus.expected);
      expect(focus.width).toBe('2px');
      expect(focus.offset).toBe('3px');
    });
  });
}

test.describe('field coarse pointer', () => {
  test.use({ hasTouch: true });
  for (const width of [390, 1440]) {
    test(`touch targets are at least 44px at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const scope = await openFields(page, 'uk', 'night');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      const small = await scope.locator('input, select, textarea, button, label:has(input)').evaluateAll((nodes) => nodes.flatMap((node) => {
        if (node.matches('input[type="checkbox"], input[type="radio"]')) return [];
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return [];
        if (rect.width < 43.9 || rect.height < 43.9) return [`${Math.round(rect.width)}x${Math.round(rect.height)} ${node.tagName} ${(node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 40)}`];
        return [];
      }));
      expect(small).toEqual([]);
    });
  }
});
