import { expect, type Page } from '@playwright/test';

/** Fixed desktop viewport — same in local runs and GitHub Actions. */
export const NEWS_DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

export async function gotoNewsPage(page: Page, lang: 'uk' | 'en' = 'uk') {
  await page.goto(`/${lang}/news`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('news-sidebar')).toBeVisible({ timeout: 30_000 });
}
