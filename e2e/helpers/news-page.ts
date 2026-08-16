import { expect, type Page } from '@playwright/test';
import { VIEWPORTS } from './viewports';

/** Fixed desktop viewport — same in local runs and GitHub Actions. */
export const NEWS_DESKTOP_VIEWPORT = VIEWPORTS.desktop1280;

export async function gotoNewsPage(page: Page, lang: 'uk' | 'en' = 'uk') {
  await page.goto(`/${lang}/news`, { waitUntil: 'domcontentloaded' });
  // Level 1 only: the loose name regex also matches story headlines, so any
  // published item with "news" in its title used to break strict mode.
  await expect(page.getByRole('heading', { level: 1, name: /news|новини/i })).toBeVisible({
    timeout: 30_000,
  });
}
