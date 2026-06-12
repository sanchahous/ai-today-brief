import type { MetadataRoute } from 'next';
import { SITE_URL, LANGS } from '@/lib/site';
import { GUIDES } from '@/content/guides';
import { TOOLS } from '@/content/tools';
import { getPublishedItemPaths } from '@/lib/items';
import { getConceptPaths } from '@/lib/concepts';
import { getCategoryPaths } from '@/lib/categories';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANGS) {
    entries.push({ url: `${SITE_URL}/${lang}`, changeFrequency: 'daily', priority: 1 });
    entries.push({ url: `${SITE_URL}/${lang}/news`, changeFrequency: 'daily', priority: 0.8 });
    entries.push({ url: `${SITE_URL}/${lang}/concepts`, changeFrequency: 'weekly', priority: 0.6 });
    entries.push({ url: `${SITE_URL}/${lang}/guides`, changeFrequency: 'weekly', priority: 0.7 });
    entries.push({ url: `${SITE_URL}/${lang}/tools`, changeFrequency: 'weekly', priority: 0.7 });
    for (const tool of TOOLS) {
      entries.push({
        url: `${SITE_URL}${tool.href(lang)}`,
        lastModified: tool.lastVerified,
        changeFrequency: 'weekly',
        priority: 0.75,
      });
    }
    for (const guide of GUIDES) {
      entries.push({
        url: `${SITE_URL}/${lang}/guides/${guide.slug}`,
        lastModified: guide.lastVerified,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
    for (const path of TRUST_PATHS) {
      entries.push({
        url: `${SITE_URL}/${lang}/${path}`,
        changeFrequency: path === 'privacy' || path === 'terms' ? 'monthly' : 'weekly',
        priority: path === 'subscribe' || path === 'advertise' ? 0.5 : 0.4,
      });
    }
  }

  const [items, concepts, categories] = await Promise.all([
    getPublishedItemPaths(),
    getConceptPaths(),
    getCategoryPaths(),
  ]);

  for (const c of categories) {
    entries.push({
      url: `${SITE_URL}/${c.lang}/category/${c.slug}`,
      changeFrequency: 'daily',
      priority: 0.65,
    });
  }

  for (const p of items) {
    entries.push({
      url: `${SITE_URL}/${p.lang}/${p.brief}/${p.item}`,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  for (const c of concepts) {
    entries.push({
      url: `${SITE_URL}/${c.lang}/concepts/${c.slug}`,
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  }

  return entries;
}
