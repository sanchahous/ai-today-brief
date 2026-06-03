import type { MetadataRoute } from 'next';
import { SITE_URL, LANGS } from '@/lib/site';
import { getPublishedItemPaths } from '@/lib/items';
import { getConceptPaths } from '@/lib/concepts';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANGS) {
    entries.push({ url: `${SITE_URL}/${lang}`, changeFrequency: 'daily', priority: 1 });
    entries.push({ url: `${SITE_URL}/${lang}/news`, changeFrequency: 'daily', priority: 0.8 });
    entries.push({ url: `${SITE_URL}/${lang}/concepts`, changeFrequency: 'weekly', priority: 0.6 });
  }

  const [items, concepts] = await Promise.all([getPublishedItemPaths(), getConceptPaths()]);

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
