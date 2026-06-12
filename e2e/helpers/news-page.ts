import { expect, type Page } from '@playwright/test';
import { VIEWPORTS } from './viewports';

/** Fixed desktop viewport — same in local runs and GitHub Actions. */
export const NEWS_DESKTOP_VIEWPORT = VIEWPORTS.desktop1280;

export async function gotoNewsPage(page: Page, lang: 'uk' | 'en' = 'uk') {
  await page.goto(`/${lang}/news`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /news|новини/i })).toBeVisible({ timeout: 30_000 });
}
