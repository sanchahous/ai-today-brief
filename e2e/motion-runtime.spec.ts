import { test, expect } from '@playwright/test';

/** G5 templates exercised for no-JS visibility (SSR HTML, not Reveal-gated). */
const NO_JS_TEMPLATES = [
  { path: '/en/about', needle: 'human perspective' },
  { path: '/en/subscribe', needle: 'in your inbox' },
  { path: '/en/advertise', needle: 'Start a conversation' },
  { path: '/en/terms', needle: 'Terms of Service' },
  { path: '/en/guides', needle: 'Guides' },
] as const;

test.describe('motion runtime — no JavaScript', () => {
  for (const { path, needle } of NO_JS_TEMPLATES) {
    test(`SSR HTML on ${path} is not reveal-gated`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      try {
        const page = await context.newPage();
        const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
        expect(response?.ok()).toBeTruthy();
        const html = await page.content();
        expect(html).toContain(needle);
        expect(html).not.toContain('class="reveal"');
        expect(html).not.toMatch(/\.reveal:not\(\.is-in\)/);
      } finally {
        await context.close();
      }
    });
  }
});

test.describe('motion runtime — reduced motion', () => {
  test('no WAAPI animations after load', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-tension-motion', 'off');
    const animationCount = await page.evaluate(() => document.getAnimations().length);
    expect(animationCount).toBe(0);
  });
});

test.describe('motion runtime — budget and finite motion', () => {
  test('peak UI animations stay within cap and finish within 5s', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('data-tension', 'v3');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('link', { name: /browse all news/i }).first().click();
    await page.waitForURL('**/news');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button').first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(5000);
    const stats = await page.evaluate(() => {
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      const peak = Number.parseInt(document.documentElement.dataset.tensionPeak ?? '0', 10);
      return { running: running.length, peak };
    });
    expect(stats.running).toBe(0);
    expect(stats.peak).toBeLessThanOrEqual(32);
  });
});
