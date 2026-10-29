import { test, expect } from '@playwright/test';

test.describe('The Resolve — brand stage', () => {
  test('SSR HTML shows the finished mark without JavaScript', async ({ request }) => {
    const response = await request.get('/en');
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('class="brand-stage');
    expect(html).toContain('class="rs-dot"');
    expect(html.match(/class="rs-rib"/g)?.length).toBe(16);
    expect(html).toContain('AI Today Brief mark: many brass signals');
    expect(html).not.toContain('brand-phases');
    expect(html).not.toContain('THE RESOLVE');
    expect(html).not.toContain('AFTER HOURS');
    expect(html).not.toContain('data-brand-replay');
    expect(html).toContain('no-js');
    expect(html).toContain('class="hero-stage');
  });

  test('reduced motion keeps the static mark with no replay control', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-tension-motion', 'off');
    const stage = page.locator('.brand-stage').first();
    await expect(stage.locator('.rs-dot')).toBeVisible();
    await expect(page.locator('[data-brand-replay]')).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test('scene plays once when it enters the viewport', async ({ page }) => {
    await page.goto('/en');
    const stage = page.locator('.hero-stage .brand-stage').first();
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute('data-brand-played', 'true', { timeout: 5000 });
    await expect(stage).toHaveAttribute('data-brand-state', 'rest', { timeout: 5000 });
  });

  test('home hero hosts a single brand stage above the lead grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en');
    await expect(page.locator('.brand-stage')).toHaveCount(1);
    const heroStage = page.locator('.home-hero .hero-stage .brand-stage');
    await expect(heroStage).toBeVisible();
    const leadBox = page.locator('section[aria-label="The big idea"], section[aria-label="Головна тема"]').first();
    const heroBottom = await heroStage.boundingBox();
    const leadTop = await leadBox.boundingBox();
    expect(heroBottom).toBeTruthy();
    expect(leadTop).toBeTruthy();
    if (heroBottom && leadTop) {
      expect(heroBottom.y + heroBottom.height).toBeLessThanOrEqual(leadTop.y + 2);
    }
  });
});
