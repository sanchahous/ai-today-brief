import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectedSiteUrl } from '../scripts/e2e-server-url';
import { CONTACT_EMAIL, EDITOR_ALT_NAME, EDITOR_NAME, EDITOR_PROFILE } from '../src/lib/site';
import { compareSeoSnapshots, parseSeoHtml, type SeoSnapshot } from '../src/lib/seo-contract';

// The checked-in baseline is controlled by this repository.
const baseline = JSON.parse(readFileSync('e2e/fixtures/seo-contract.baseline.json', 'utf8')) as {
  base: string;
  routes: SeoSnapshot[];
};

for (const lang of ['en', 'uk']) {
  for (const route of ['about', 'author']) {
    test(`${lang}/${route} preserves SEO and real editor contacts`, async ({ page }) => {
      const path = `/${lang}/${route}`;
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const html = await response!.text();
      const before = baseline.routes.find((snapshot) => snapshot.path === path);
      expect(before).toBeDefined();
      // CI builds metadata with the local origin; preserve paths under that configured origin.
      const expectedBefore = {
        ...before!,
        canonical: before!.canonical?.replace(baseline.base, expectedSiteUrl()) ?? null,
        hreflang: Object.fromEntries(
          Object.entries(before!.hreflang).map(([locale, href]) => [
            locale,
            href.replace(baseline.base, expectedSiteUrl()),
          ]),
        ),
      };
      expect(
        compareSeoSnapshots(expectedBefore, parseSeoHtml(html, path, response!.status())).errors,
      ).toEqual([]);
      const content =
        route === 'about' ? page.getByTestId('about-page') : page.getByTestId('author-page');
      await expect(content.getByRole('heading', { level: 1 })).toHaveCount(1);
      for (const profile of EDITOR_PROFILE.links) {
        await expect(content.locator(`a[href="${profile.url}"]`)).toBeVisible();
      }
      await expect(content.locator(`a[href="mailto:${CONTACT_EMAIL}"]`)).toBeVisible();
      const graphs = await content.locator('script[type="application/ld+json"]').allTextContents();
      const graph = JSON.parse(graphs[0]) as { '@graph': Record<string, unknown>[] };
      expect(graph['@graph'].find((node) => node['@type'] === 'Person')).toMatchObject({
        name: EDITOR_NAME,
        alternateName: EDITOR_ALT_NAME,
        sameAs: EDITOR_PROFILE.links.map((profile) => profile.url),
      });
      if (route === 'about') {
        await expect(content.getByRole('img')).toHaveAttribute(
          'alt',
          lang === 'uk' ? /Концепт-арт After Hours/ : /After Hours concept art/,
        );
        expect(
          await content.getByRole('img').evaluate((img: HTMLImageElement) => img.currentSrc),
        ).toMatch(/after-hours-(800|1600)\.avif$/);
        await expect(content.locator('input[type="email"]')).toBeVisible();
      } else {
        await expect(content.locator('[aria-current="page"]')).toHaveText(EDITOR_NAME);
      }
    });
  }
}
