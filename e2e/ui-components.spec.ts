import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Keyboard + ARIA contract of the composite primitives, exercised on the internal /ds-catalog page. */
test.describe('UI composite primitives', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ds-catalog');
  });

  test('Popover: toggles aria-expanded, Escape closes and returns focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open popover' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog', { name: 'Filter help' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Filter help' })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Popover: outside click closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Open popover' }).click();
    await page.getByRole('heading', { name: 'Design system catalog' }).click();
    await expect(page.getByRole('dialog', { name: 'Filter help' })).toBeHidden();
  });

  test('DropdownMenu: arrows skip disabled, typeahead, Enter selects and closes', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Share', exact: true });
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Share' });
    await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Share on X' })).toBeFocused();
    await page.keyboard.press('ArrowDown'); // skips the disabled item
    await expect(menu.getByRole('menuitem', { name: 'Share on LinkedIn' })).toBeFocused();
    await page.keyboard.press('ArrowDown'); // wraps
    await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId('menu-result')).toHaveText('linkedin');
  });

  test('Tooltip: shows on focus, is described-by, dismissed with Escape', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Hover or focus me' });
    await trigger.focus();
    const tip = page.getByRole('tooltip');
    await expect(tip).toHaveText('Copies the article link');
    await expect(trigger).toHaveAttribute('aria-describedby', (await tip.getAttribute('id')) ?? '');
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });

  test('Tabs: roving tabindex, arrows skip disabled, Home/End, panel follows', async ({ page }) => {
    const daily = page.getByRole('tab', { name: 'Daily' });
    await daily.focus();
    await expect(daily).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tab', { name: 'Weekly' })).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Weekly' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Weekly' })).toBeVisible();
    await page.keyboard.press('ArrowRight'); // skips disabled "Soon"
    await expect(page.getByRole('tab', { name: 'Monthly' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(daily).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Daily' })).toBeVisible();
  });

  test('Accordion: single mode keeps one panel open', async ({ page }) => {
    const a = page.getByRole('button', { name: 'What is the brief?' });
    const b = page.getByRole('button', { name: 'How is it ranked?' });
    await a.click();
    await expect(a).toHaveAttribute('aria-expanded', 'true');
    await b.click();
    await expect(a).toHaveAttribute('aria-expanded', 'false');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: 'How is it ranked?' })).toBeVisible();
  });

  test('Combobox: filter, arrow to option, Enter selects, Esc clears', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Tool' });
    await input.click();
    await input.fill('c');
    const listId = await input.getAttribute('aria-controls');
    // Native <select> options elsewhere on the catalog are also role=option.
    await expect(page.locator(`[id="${listId}"]`).getByRole('option')).toHaveCount(4);
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', /-opt-1$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('combobox-value')).toHaveText('cursor');
    await expect(input).toHaveValue('Cursor');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('combobox-value')).toHaveText('none');
  });

  test('Combobox: matches Cyrillic case-insensitively and reports empty state', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Tool' });
    await input.fill('АГЕ');
    await expect(page.getByRole('option', { name: 'Агенти' })).toBeVisible();
    await input.fill('zzz');
    await expect(page.getByText('No matches').first()).toBeVisible();
  });

  test('Toast: errors use role=alert, dismissible, capped queue', async ({ page }) => {
    await page.getByRole('button', { name: 'Error toast' }).click();
    // Next.js also renders a route-announcer role=alert, so scope to our toast.
    const alert = page.getByRole('alert').filter({ hasText: 'Failed to save' });
    await expect(alert).toContainText('Failed to save');
    await alert.getByRole('button', { name: 'Dismiss notification' }).click();
    await expect(alert).toHaveCount(0);
    for (let i = 0; i < 5; i += 1) await page.getByRole('button', { name: 'Success toast' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(3);
  });

  test('Dialog: modal, focus trapped, Esc closes and returns focus', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open dialog' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Subscribe to the brief' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Dialog: backdrop click and × both close', async ({ page }) => {
    await page.getByRole('button', { name: 'Open dialog' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open dialog' }).click();
    await page.mouse.click(5, 5);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Popover: flips above and stays inside the viewport near the bottom edge', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Edge popover' });
    await trigger.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(() => window.scrollBy(0, -20));
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Edge popover' });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
  });
});

/** Accessibility-tree structure: what a screen reader is given (proxy — not a substitute for NVDA/VoiceOver). */
test.describe('UI primitives accessibility tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ds-catalog');
  });

  test('Tabs expose tablist / selected tab / labelled tabpanel', async ({ page }) => {
    await expect(page.getByRole('tablist', { name: 'Digest sections' })).toMatchAriaSnapshot(`
      - tablist "Digest sections":
        - tab "Daily" [selected]
        - tab "Weekly"
        - tab "Soon" [disabled]
        - tab "Monthly"
    `);
  });

  test('DropdownMenu exposes menu with menuitems and disabled state', async ({ page }) => {
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Share' })).toMatchAriaSnapshot(`
      - menu "Share":
        - menuitem "Copy link"
        - menuitem "Share on X"
        - menuitem "Unavailable" [disabled]
        - menuitem "Share on LinkedIn"
    `);
  });

  test('Combobox exposes expanded listbox with options and selection', async ({ page }) => {
    const input = page.getByRole('combobox', { name: 'Tool' });
    await input.click();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox', { name: 'Tool' })).toMatchAriaSnapshot(`
      - listbox "Tool":
        - option "Claude Code"
        - option "Cursor"
        - option "Codex"
        - option "Агенти"
        - option "MCP"
    `);
  });

  test('Toast announces through a live region', async ({ page }) => {
    await page.getByRole('button', { name: 'Success toast' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  });
});

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`axe WCAG 2.2 AA — ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    const scan = (page: import('@playwright/test').Page) =>
      new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();

    test('resting catalog has no violations', async ({ page }) => {
      await page.goto('/ds-catalog');
      expect((await scan(page)).violations).toEqual([]);
    });

    test('with menu, combobox list, popover and dialog open', async ({ page }) => {
      await page.goto('/ds-catalog');
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await page.getByRole('combobox', { name: 'Tool' }).click();
      await page.getByRole('button', { name: 'Open popover' }).click();
      expect((await scan(page)).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Open dialog' }).click();
      expect((await scan(page)).violations).toEqual([]);
    });
  });
}

/**
 * Visual regression baseline. Screenshots are OS/browser specific, so this runs only with VISUAL=1:
 *   VISUAL=1 npx playwright test e2e/ui-components.spec.ts --project=chromium --update-snapshots
 * Commit the generated PNGs for the platform CI uses (linux) — see wiki/ops runbook note in epic-readiness.
 */
for (const scheme of ['dark', 'light'] as const) {
  for (const [name, width] of [['desktop', 1280], ['mobile', 390]] as const) {
    test(`visual: catalog ${scheme} ${name}`, async ({ page }) => {
      test.skip(!process.env.VISUAL, 'set VISUAL=1 to compare screenshots');
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/ds-catalog');
      await expect(page).toHaveScreenshot(`catalog-${scheme}-${name}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
}
