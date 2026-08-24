import type { MetadataRoute } from 'next';
import { SITE_URL, LANGS } from '@/lib/site';
import { GUIDES } from '@/content/guides';
import { TOOLS } from '@/content/tools';
import { getPublishedItemSitemapEntries } from '@/lib/items';
import { getConceptSitemapEntries } from '@/lib/concepts';
import { getCategoryPaths } from '@/lib/categories';
import { getBriefSitemapEntries } from '@/lib/briefs';
import { getWeeklySitemapEntries } from '@/lib/digests';

// 1316 URLs / 943 KB as of 2026-08-24. Regenerating that hourly cost ~22 MB a
// day of origin transfer for a file that only changes when content publishes,
// and the publish flow already revalidates it on demand. Six hours is the
// timed fallback, not the freshness guarantee. `news-sitemap.xml` keeps its
// one-hour cadence because Google News needs it.
export const revalidate = 21600;

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
  const [items, concepts, categories, briefs, weeklyDigests] = await Promise.all([
    getPublishedItemSitemapEntries(),
    getConceptSitemapEntries(),
    getCategoryPaths(),
    getBriefSitemapEntries(),
    getWeeklySitemapEntries(),
  ]);

  // Newest publish time — lastmod for pages whose content changes with every brief.
  const latestPublish = briefs
    .map((b) => b.lastModified)
    .sort()
    .at(-1);
  // Hub pages change when their newest child does.
  const latestConcept = concepts
    .map((c) => c.lastModified ?? '')
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestGuide = GUIDES.map((g) => g.lastVerified)
    .sort()
    .at(-1);
  const latestTool = TOOLS.map((t) => t.lastVerified)
    .sort()
    .at(-1);

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
      url: `${SITE_URL}/${lang}/digests`,
      lastModified:
        weeklyDigests
          .map((digest) => digest.published_at ?? digest.week_start)
          .sort()
          .at(-1) ?? latestPublish,
      changeFrequency: 'daily',
      priority: 0.75,
      alternates: langAlternates('/digests'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/concepts`,
      lastModified: latestConcept,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: langAlternates('/concepts'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/guides`,
      lastModified: latestGuide,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: langAlternates('/guides'),
    });
    entries.push({
      url: `${SITE_URL}/${lang}/tools`,
      lastModified: latestTool,
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
        // A brief is fixed at publish (only editor-take edits afterwards), so
        // it does not change daily the way the home/news index does.
        changeFrequency: 'weekly',
        priority: 0.75,
        alternates: langAlternates(`/${brief.slug}`),
      });
    }
    for (const digest of weeklyDigests) {
      entries.push({
        url: `${SITE_URL}/${lang}/weekly/${digest.slug}`,
        // updated_at moves when an edition is corrected after release — the
        // honest lastmod; published_at alone would hide post-release edits.
        lastModified:
          digest.updated_at && digest.updated_at > (digest.published_at ?? '')
            ? digest.updated_at
            : (digest.published_at ?? digest.week_start),
        // Weekly editions are frozen after release; 'monthly' reflects how
        // rarely their content actually changes (vs the archive's daily churn).
        changeFrequency: 'monthly',
        priority: 0.72,
        alternates: langAlternates(`/weekly/${digest.slug}`),
      });
    }
    for (const path of TRUST_PATHS) {
      entries.push({
        url: `${SITE_URL}/${lang}/${path}`,
        // Trust pages have no per-row timestamp; the newest guide/tool
        // verification date is the closest honest proxy for their last edit.
        lastModified: latestGuide ?? latestTool,
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
      url: `${SITE_URL}/${p.lang}/news/${p.category}/${p.item}`,
      lastModified: p.lastModified,
      // Item pages are fixed at publish — 'yearly' is the honest signal; the
      // lastmod timestamp carries the actual freshness.
      changeFrequency: 'yearly',
      priority: 0.7,
      alternates: langAlternates(`/news/${p.category}/${p.item}`),
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
