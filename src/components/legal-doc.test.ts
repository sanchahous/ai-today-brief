import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import baseline from '../../e2e/fixtures/policy-text.baseline.json';
import * as editorial from '@/app/[lang]/editorial-policy/page';
import * as disclosure from '@/app/[lang]/ai-disclosure/page';
import * as privacy from '@/app/[lang]/privacy/page';
import * as terms from '@/app/[lang]/terms/page';
import { SITE_URL } from '@/lib/site';

const pages = { 'editorial-policy': editorial, 'ai-disclosure': disclosure, privacy, terms };

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Policy document baseline (navigation excluded by owner decision)', () => {
  for (const [key, page] of Object.entries(pages)) {
    for (const lang of ['en', 'uk']) {
      const path = `/${lang}/${key}`;
      const saved = baseline.routes.find((route) => route.path === path);

      it(`${path} preserves every heading, date and paragraph in server HTML`, async () => {
        const html = renderToStaticMarkup(
          await page.default({ params: Promise.resolve({ lang }) }),
        );
        const article = html.match(
          /<article\b[^>]*data-policy-document[^>]*>([\s\S]*?)<\/article>/,
        )?.[1];
        expect(article).toBeDefined();
        const blocks = [...(article ?? '').matchAll(/<(h1|h2|p)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(
          (match) => plainText(match[2]),
        );
        expect(blocks).toEqual(saved?.blocks);
      });

      it(`${path} preserves all route metadata`, async () => {
        const metadata = await page.generateMetadata({ params: Promise.resolve({ lang }) });
        const normalized = JSON.parse(
          JSON.stringify(metadata).replaceAll(SITE_URL, 'https://aitodaybrief.com'),
        );
        expect(normalized).toEqual(saved?.metadata);
      });
    }
  }
});
