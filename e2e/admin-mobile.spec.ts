import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './helpers/viewports';

test.describe('Mobile social CMS entry', () => {
  for (const [name, viewport] of [
    ['iPhone-sized', VIEWPORTS.phone390],
    ['Android-small', VIEWPORTS.phone320],
  ] as const) {
    test(`${name} login and PWA shell stay usable`, async ({ page, context }) => {
      await page.setViewportSize(viewport);
      await page.goto('/admin/login');

      await expect(page.getByRole('heading', { name: /social cms/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /secure login code/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /owner email/i })).toBeEditable();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
      expect(manifestHref).toBeTruthy();
      const manifest = await (await context.request.get(manifestHref!)).json();
      expect(manifest.start_url).toBe('/admin');
      expect(manifest.display).toBe('standalone');
    });
  }
});
