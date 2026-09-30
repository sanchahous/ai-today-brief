import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';

/**
 * AH-1.6 focus contract: a 2px solid ring in the `--focus` colour, 3px away from the element,
 * visible on a link, a button and a field in Night, Day and forced-colors mode
 * (tokens: `--focus`, `--focus-width`, `--focus-offset`; docs: design-system-tokens §7.9).
 */
type Kind = 'link' | 'button' | 'field';
const KINDS: Kind[] = ['link', 'button', 'field'];

/** `--focus` per theme (globals.css), as the browser reports a resolved outline colour. */
const FOCUS_RGB = { dark: 'rgb(181, 216, 204)', light: 'rgb(45, 101, 89)' } as const;

function locate(page: Page, kind: Kind): Locator {
  switch (kind) {
    case 'link':
      return page
        .getByRole('navigation', { name: 'Primary' })
        .getByRole('link', { name: 'News', exact: true });
    case 'button':
      return page.getByTestId('theme-toggle').filter({ visible: true }).first();
    case 'field':
      return page.locator('input[type="email"]').first();
    default: {
      const unreachable: never = kind;
      throw new Error(`Unknown focus target: ${String(unreachable)}`);
    }
  }
}

async function focusRing(page: Page, target: Locator) {
  // Links and buttons animate outline-color (`transition-colors`). Reduced-motion emulation is not
  // honoured identically by every engine, so switch transitions off to read the final ring.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
  await target.scrollIntoViewIfNeeded();
  // A modifier keydown puts the page in keyboard modality, so focus() matches :focus-visible.
  await page.keyboard.press('Shift');
  await target.focus();
  await expect(target).toBeFocused();
  return target.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      visible: el.matches(':focus-visible'),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset),
      color: style.outlineColor,
    };
  });
}

test.describe('Focus ring contract (AH-1.6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    // Links and buttons animate outline-color (`transition-colors`); reduced motion makes the
    // computed ring final at once instead of mid-transition.
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const theme of ['dark', 'light'] as const) {
    for (const kind of KINDS) {
      test(`${kind} shows a 2px --focus ring 3px away in ${theme}`, async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        await gotoNewsPage(page, 'en');
        const ring = await focusRing(page, locate(page, kind));
        expect(ring).toEqual({
          visible: true,
          style: 'solid',
          width: 2,
          offset: 3,
          color: FOCUS_RGB[theme],
        });
      });
    }
  }

  for (const kind of KINDS) {
    test(`${kind} keeps a visible ring in forced-colors mode`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'forced-colors emulation is only asserted on Chromium');
      await page.emulateMedia({ forcedColors: 'active' });
      await gotoNewsPage(page, 'en');
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      const ring = await focusRing(page, locate(page, kind));
      expect(ring).toMatchObject({ visible: true, style: 'solid', offset: 3 });
      expect(ring.width).toBeGreaterThanOrEqual(2);
      expect(ring.color).not.toBe('rgba(0, 0, 0, 0)');
    });
  }
});
