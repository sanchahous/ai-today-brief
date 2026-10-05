import { test, expect } from '@playwright/test';

test.describe('The Resolve — brand stage', () => {
  test('SSR HTML shows the finished mark without JavaScript', async ({ request }) => {
    const response = await request.get('/en');
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('class="brand-stage');
    expect(html).toContain('class="rs-dot"');
    expect(html.match(/class="rs-rib"/g)?.length).toBe(16);
    expect(html).toContain('The Resolve: many brass signals');
    expect(html).toContain('data-brand-replay');
    expect(html).toContain('no-js');
  });

  test('reduced motion keeps the static mark and hides replay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-tension-motion', 'off');
    const stage = page.locator('.brand-stage').first();
    await expect(stage.locator('.rs-dot')).toBeVisible();
    await expect(stage.getByRole('button', { name: /Replay The Resolve/i })).toBeHidden();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('replay control has accessible EN/UK labels and sits outside the scene image', async ({ page }) => {
    await page.goto('/en');
    const stage = page.locator('.brand-stage').first();
    const replay = stage.getByRole('button', { name: 'Replay The Resolve' });
    await expect(replay).toBeVisible();
    await expect(stage.getByRole('img')).not.toContainText('Replay');

    await page.goto('/uk');
    await expect(page.locator('.brand-stage').first().getByRole('button', { name: 'Повторити The Resolve' })).toBeVisible();
  });

  test('scene plays once when it enters the viewport', async ({ page }) => {
    await page.goto('/en');
    const stage = page.locator('.brand-stage').first();
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute('data-brand-played', 'true', { timeout: 5000 });
    await expect(stage).toHaveAttribute('data-brand-state', 'rest', { timeout: 5000 });
  });

  test('replay restarts the scene after completion', async ({ page }) => {
    await page.goto('/en');
    const stage = page.locator('.brand-stage').first();
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute('data-brand-state', 'rest', { timeout: 5000 });
    const replay = stage.getByRole('button', { name: 'Replay The Resolve' });
    await replay.click();
    await expect(stage).toHaveAttribute('data-brand-state', 'playing');
    await expect(replay).toHaveAttribute('aria-disabled', 'true');
    await expect(stage).toHaveAttribute('data-brand-state', 'rest', { timeout: 5000 });
  });
});
