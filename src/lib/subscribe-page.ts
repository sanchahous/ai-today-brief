import type { Lang } from '@/lib/site';
import type { HomeItem } from '@/lib/home';
import { getHomeData } from '@/lib/home';
import { getLatestBrief } from '@/lib/briefs';

export interface SubscribeSampleItem {
  id: string;
  title: string;
  categorySlug?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

export interface SubscribeSampleEdition {
  title: string;
  href: string;
  items: SubscribeSampleItem[];
}

/** Lead + up to three secondary stories for the subscribe landing sample block. */
export async function getSubscribeSampleItems(lang: Lang): Promise<HomeItem[]> {
  const { featured, secondary } = await getHomeData(lang);
  const sample: HomeItem[] = [];
  if (featured) sample.push(featured);
  for (const item of secondary) {
    if (sample.length >= 4) break;
    sample.push(item);
  }
  return sample;
}

/** Real latest daily brief edition for the sample issue block on the subscribe landing. */
export async function getSubscribeSampleEdition(lang: Lang): Promise<SubscribeSampleEdition> {
  try {
    const latest = await getLatestBrief(lang, 4);
    if (latest && latest.items.length > 0) {
      return {
        title: latest.title || (lang === 'uk' ? 'Щоденний випуск' : 'Daily edition'),
        href: `/${lang}/${latest.slug}`,
        items: latest.items.map((it) => ({
          id: it.id,
          title: it.title,
          categorySlug: it.categorySlug,
          categoryName: it.categoryName,
          categoryColor: it.categoryColor,
        })),
      };
    }
  } catch {
    // fallback if briefs query fails
  }

  const fallbackItems = await getSubscribeSampleItems(lang);
  return {
    title: lang === 'uk' ? 'Щоденний випуск' : 'Daily edition',
    href: `/${lang}/digests`,
    items: fallbackItems.map((it) => ({
      id: it.id,
      title: it.title,
      categorySlug: it.categorySlug,
      categoryName: it.categoryName,
      categoryColor: it.categoryColor,
    })),
  };
}
