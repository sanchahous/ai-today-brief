import { expect, test } from '@playwright/test';

test.describe('Sponsor card spacing', () => {
  test('sponsor card has gap from preceding post card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/uk/news');
    await page.waitForLoadState('networkidle');

    const sponsor = page.getByTestId('sponsor-card');
    const sponsorCount = await sponsor.count();
    test.skip(sponsorCount === 0, 'Fewer than 3 posts — sponsor not woven in');

    const postCards = page.getByTestId('post-card');
    expect(await postCards.count()).toBeGreaterThanOrEqual(3);

    const gap = await page.evaluate(() => {
      const sponsorEl = document.querySelector('[data-testid="sponsor-card"]');
      const posts = document.querySelectorAll('[data-testid="post-card"]');
      if (!sponsorEl || posts.length < 3) return -1;

      const sponsorRect = sponsorEl.getBoundingClientRect();
      const prevPost = posts[2] as HTMLElement;
      const prevRect = prevPost.getBoundingClientRect();

      return sponsorRect.top - prevRect.bottom;
    });

    expect(gap).toBeGreaterThanOrEqual(12);
  });
});
