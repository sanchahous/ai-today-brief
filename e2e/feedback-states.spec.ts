import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const CHAIN = ['loading', 'stale', 'ready', 'empty', 'recoverable', 'terminal'] as const;

async function openCatalog(page: Page) {
  await page.goto('/ds-catalog');
  await expect(page.getByRole('heading', { name: 'Design system catalog', level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  const scope = page.getByTestId('feedback-catalog');
  await expect(scope).toHaveAttribute('data-ready', 'true');
  return scope;
}

test.describe('feedback catalog', () => {
  test('shows the data-state chain and announces a success toast', async ({ page }) => {
    const scope = await openCatalog(page);
    const steps = await scope.locator('[data-feedback-step]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-feedback-step')),
    );
    expect(steps).toEqual([...CHAIN]);
    await expect(scope.getByText('Loading the example feed')).toBeVisible();
    await expect(scope.getByText('Updated 3 hours ago. New stories may be missing.')).toBeVisible();
    await expect(scope.getByText('Showing the latest 100 stories. Older coverage: use search.')).toBeVisible();
    await expect(scope.getByText('No stories match these filters.')).toBeVisible();
    await expect(scope.getByText('The feed could not be refreshed.')).toBeVisible();
    await expect(scope.getByText('This example is unavailable.')).toBeVisible();

    await page.getByRole('button', { name: 'Success toast' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  });

  test('retry sets aria-busy and then a polite status', async ({ page }) => {
    const scope = await openCatalog(page);
    const retry = scope.getByTestId('feedback-retry');
    await retry.click();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    await expect(scope.getByTestId('feedback-retry-status')).toHaveText('Retrying…');
    await expect(scope.getByTestId('feedback-retry-status')).toHaveText('Example recovered.');
    await expect(retry).not.toHaveAttribute('aria-busy');
  });

  test('replacing the skeleton keeps the reserved box', async ({ page }) => {
    const scope = await openCatalog(page);
    const box = scope.getByTestId('reserved-swap');
    const before = await box.boundingBox();
    await scope.getByRole('button', { name: 'Show the story' }).click();
    await expect(scope.getByText('A reserved story shape').first()).toBeVisible();
    const after = await box.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs((before?.height ?? 0) - (after?.height ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((before?.width ?? 0) - (after?.width ?? 0))).toBeLessThanOrEqual(1);
  });

  test('focused retry uses the focus token with transitions disabled', async ({ page }) => {
    const scope = await openCatalog(page);
    const ring = await scope.getByTestId('feedback-retry').evaluate((el) => {
      if (!(el instanceof HTMLElement)) return null;
      el.focus({ focusVisible: true } as FocusOptions);
      const probe = document.createElement('span');
      probe.style.color = 'var(--focus)';
      document.body.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        expected,
        transition: style.transitionDuration,
      };
    });
    expect(ring?.transition === '0s' || ring?.transition.startsWith('0')).toBe(true);
    expect(ring?.outlineStyle).toBe('solid');
    expect(ring?.outlineColor).toBe(ring?.expected);
  });

  test('Ukrainian copy and a scoped axe pass', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const scope = await openCatalog(page);
    await scope.getByRole('button', { name: 'UK', exact: true }).click();
    await expect(scope).toHaveAttribute('lang', 'uk');
    await expect(scope.getByText('Спробувати ще')).toBeVisible();
    await expect(scope.getByText(/Оновлено .+ Нових матеріалів може бракувати\./)).toBeVisible();
    await expect(scope.getByText('Показано останні 100 матеріалів. Давніші — через пошук.')).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="feedback-catalog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });

  test('day theme axe on the feedback section', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCatalog(page);
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="feedback-catalog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });
});

test.describe('feedback spinner reduced motion', () => {
  test('the loading ring does not keep spinning', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/ds-catalog');
    await expect(page.getByTestId('feedback-catalog')).toHaveAttribute('data-ready', 'true');
    const motion = await page.getByText('Loading the example feed').locator('span').evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        duration: style.animationDuration,
        name: style.animationName,
        reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    expect(motion.reduce).toBe(true);
    expect(motion.name === 'none' || motion.duration === '0s' || motion.duration === '0.001ms').toBe(true);
  });
});
