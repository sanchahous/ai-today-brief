import { readFileSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AboutPage, { generateMetadata as aboutMetadata } from './about/page';
import AuthorPage, { generateMetadata as authorMetadata } from './author/page';
import { getNewsPageData } from '@/lib/news';
import {
  CONTACT_EMAIL,
  EDITOR_NAME,
  EDITOR_ALT_NAME,
  EDITOR_PROFILE,
  SITE_URL,
  type Lang,
} from '@/lib/site';
import { authorNode, publisherNode } from '@/lib/schema';
import type { NewsPageData } from '@/lib/news';

vi.mock('@/lib/news', () => ({ getNewsPageData: vi.fn() }));

const emptyNews: NewsPageData = { items: [], categories: [], trending: [], updatedAt: null };

function graph(html: string): Record<string, unknown>[] {
  const script = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
  expect(script).toBeDefined();
  // The page produces this controlled JSON-LD graph; assertions below verify its entity nodes.
  return (JSON.parse(script!) as { '@graph': Record<string, unknown>[] })['@graph'];
}

beforeEach(() => vi.mocked(getNewsPageData).mockResolvedValue(emptyNews));

describe.each<Lang>(['en', 'uk'])('About and Author (%s)', (lang) => {
  const params = Promise.resolve({ lang });

  it('preserves canonical metadata and the editor identity on both routes', async () => {
    for (const [route, page, metadata] of [
      ['about', AboutPage, aboutMetadata],
      ['author', AuthorPage, authorMetadata],
    ] as const) {
      const html = renderToStaticMarkup(await page({ params }));
      const nodes = graph(html);
      const person = nodes.find((node) => node['@type'] === 'Person');
      expect(person).toEqual(authorNode(lang));
      expect(person).toMatchObject({
        name: EDITOR_NAME,
        alternateName: EDITOR_ALT_NAME,
        sameAs: EDITOR_PROFILE.links.map((link) => link.url),
      });
      const org = nodes.find((node) => node['@type'] === 'Organization');
      expect(org).toMatchObject(publisherNode());
      expect(nodes[0]).toMatchObject({ '@type': route === 'about' ? 'AboutPage' : 'ProfilePage' });
      const meta = await metadata({ params });
      expect(meta.alternates?.canonical).toBe(`${SITE_URL}/${lang}/${route}`);
      expect(meta.alternates?.languages).toEqual({
        en: `${SITE_URL}/en/${route}`,
        uk: `${SITE_URL}/uk/${route}`,
        'x-default': `${SITE_URL}/en/${route}`,
      });
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain(`mailto:${CONTACT_EMAIL}`);
      for (const link of EDITOR_PROFILE.links) expect(html).toContain(`href="${link.url}"`);
      expect(html).not.toContain('editor@aitodaybrief.com');
    }
  });

  it('renders the four-step process, captioned responsive art and newsletter', async () => {
    const html = renderToStaticMarkup(await AboutPage({ params }));
    expect(html.match(/<h3\b/g)).toHaveLength(5); // Four steps and the named editor.
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('after-hours-800.avif 800w');
    expect(html).toContain('width="1600" height="900"');
    expect(html).toContain(
      lang === 'uk' ? 'Концепт-арт · After Hours' : 'Concept art · After Hours',
    );
    expect(html).toContain(lang === 'uk' ? 'латунна скульптура' : 'brass sculpture');
    expect(html).toContain('type="email"');
  });

  it('uses published stories and only available focus categories', async () => {
    vi.mocked(getNewsPageData).mockResolvedValue({
      ...emptyNews,
      categories: [
        { slug: 'agents-and-mcp', name: 'Agents', color: null, icon: 'agents' },
        { slug: 'industry', name: 'Industry', color: null, icon: 'agents' },
      ],
      items: [
        {
          id: 'published-story',
          rank: 1,
          categorySlug: 'agents-and-mcp',
          categoryName: 'Agents',
          categoryColor: null,
          href: `/${lang}/news/agents-and-mcp/published-story`,
          title: 'Published story',
          summary: 'A source-backed story.',
          why: '',
          date: '2026-10-04',
          hasVideo: false,
          tools: [],
          topics: [],
          sourceName: 'Primary source',
          readMinutes: 1,
          imageUrl: null,
        },
      ],
    });
    const html = renderToStaticMarkup(await AuthorPage({ params }));
    expect(getNewsPageData).toHaveBeenCalledWith(lang);
    expect(html).toContain(`href="/${lang}/category/agents-and-mcp"`);
    expect(html).not.toContain(`href="/${lang}/category/industry"`);
    expect(html).toContain(`href="/${lang}/news/agents-and-mcp/published-story"`);
    expect(html).toContain('id="recent-title"');
    for (const topic of EDITOR_PROFILE.expertise[lang])
      expect(html).toContain(topic.replaceAll('&', '&amp;'));
  });

  it('omits unavailable stories and categories instead of fabricating content', async () => {
    const html = renderToStaticMarkup(await AuthorPage({ params }));
    expect(html).not.toContain('id="recent-title"');
    expect(html).not.toContain(`/category/`);
    expect(html).toContain('aria-current="page"');
  });
});

it('keeps the original AVIF bytes within the two image budgets', () => {
  for (const [width, budget] of [
    [1600, 35000],
    [800, 15000],
  ]) {
    const asset = `after-hours-${width}.avif`;
    expect(statSync(`public/images/after-hours/${asset}`).size).toBeLessThanOrEqual(budget);
    expect(readFileSync(`public/images/after-hours/${asset}`)).toEqual(
      readFileSync(`artifacts/after-hours/assets/${asset}`),
    );
  }
});
