import { getCategories, getPublishedCategoryCounts } from '@/lib/categories';
import { categoryColor, categoryMeta } from '@/lib/category-meta';
import { getHomeData } from '@/lib/home';
import type { Lang } from '@/lib/site';
import { SiteHeaderChrome, type NavCategory } from '@/components/site-header-chrome';

async function getNavCategories(lang: Lang): Promise<NavCategory[]> {
  const [rows, counts] = await Promise.all([getCategories(lang), getPublishedCategoryCounts()]);
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: categoryColor(c.slug, c.color),
    icon: categoryMeta(c.slug).icon,
    count: counts.get(c.slug) ?? 0,
  }));
}

export async function SiteHeader({ lang }: { lang: Lang }) {
  const [categories, homeData] = await Promise.all([getNavCategories(lang), getHomeData(lang)]);
  return (
    <SiteHeaderChrome 
      lang={lang} 
      categories={categories} 
      trending={homeData.trending} 
      briefDate={homeData.briefDate} 
    />
  );
}
