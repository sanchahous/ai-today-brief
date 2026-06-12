import type { MetadataRoute } from 'next';
import { SITE_URL, LANGS } from '@/lib/site';
import { GUIDES } from '@/content/guides';
import { TOOLS } from '@/content/tools';
import { getPublishedItemSitemapEntries } from '@/lib/items';
import { getConceptSitemapEntries } from '@/lib/concepts';
import { getCategoryPaths } from '@/lib/categories';
import { getBriefSitemapEntries } from '@/lib/briefs';

export const revalidate = 3600;

const TRUST_PATHS = [
  'about',
  'author',
  'editorial-policy',
  'subscribe',
  'advertise',
  'ai-disclosure',
  'privacy',
  'terms',
] as const;

/** hreflang alternates — lets Google treat /en and /uk as one bundle per page. */
function langAlternates(path: string) {
  return {
    languages: {
      en: `${SITE_URL}/en${path}`,
      uk: `${SITE_URL}/uk${path}`,
      'x-default': `${SITE_URL}/en${path}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [items, concepts, categories, briefs] = await Promise.all([
    getPublishedItemSitemapEntries(),
    getConceptSitemapEntries(),
    getCategoryPaths(),
    getBriefSitemapEntries(),
  ]);

  // Newest publish time — lastmod for pages whose content changes with every brief.
  const latestPublish = briefs.map((b) => b.lastModified).sort().at(-1);

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANGS) {
    entries.push({
      url: `${SITE_URL}/${lang}`,
      lastModified: latestPublish,
      changeFrequency: 'daily',
      priority: 1,
      alternates: langAlternates(''),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/news`,
      lastModified: latestPublish,
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: langAlternates('/news'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/concepts`,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: langAlternates('/concepts'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/guides`,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: langAlternates('/guides'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/tools`,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: langAlternates('/tools'),
    });
    for (const tool of TOOLS) {
      entries.push({
        url: `${SITE_URL}${tool.href(lang)}`,
        lastModified: tool.lastVerified,
        changeFrequency: 'weekly',
        priority: 0.75,
        alternates: langAlternates(`/tools/${tool.slug}`),
      });
    }
    for (const guide of GUIDES) {
      entries.push({
        url: `${SITE_URL}/${lang}/guides/${guide.slug}`,
        lastModified: guide.lastVerified,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: langAlternates(`/guides/${guide.slug}`),
      });
    }
    for (const brief of briefs) {
      entries.push({
        url: `${SITE_URL}/${lang}/${brief.slug}`,
        lastModified: brief.lastModified,
        changeFrequency: 'weekly',
        priority: 0.75,
        alternates: langAlternates(`/${brief.slug}`),
      });
    }
    for (const path of TRUST_PATHS) {
      entries.push({
        url: `${SITE_URL}/${lang}/${path}`,
        changeFrequency: path === 'privacy' || path === 'terms' ? 'monthly' : 'weekly',
        priority: path === 'subscribe' || path === 'advertise' ? 0.5 : 0.4,
        alternates: langAlternates(`/${path}`),
      });
    }
  }

  for (const c of categories) {
    entries.push({
      url: `${SITE_URL}/${c.lang}/category/${c.slug}`,
      lastModified: latestPublish,
      changeFrequency: 'daily',
      priority: 0.65,
      alternates: langAlternates(`/category/${c.slug}`),
    });
  }

  for (const p of items) {
    entries.push({
      url: `${SITE_URL}/${p.lang}/${p.brief}/${p.item}`,
      lastModified: p.lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: langAlternates(`/${p.brief}/${p.item}`),
    });
  }

  for (const c of concepts) {
    entries.push({
      url: `${SITE_URL}/${c.lang}/concepts/${c.slug}`,
      lastModified: c.lastModified,
      changeFrequency: 'weekly',
      priority: 0.5,
      alternates: langAlternates(`/concepts/${c.slug}`),
    });
  }

  return entries;
}
