import { getCategories } from '@/lib/categories';
import { categoryMeta } from '@/lib/category-meta';
import type { Lang } from '@/lib/site';
import { SiteHeaderChrome, type NavCategory } from '@/components/site-header-chrome';

async function getNavCategories(lang: Lang): Promise<NavCategory[]> {
  const rows = await getCategories(lang);
  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: c.color,
    icon: categoryMeta(c.slug).icon,
  }));
}

export async function SiteHeader({ lang }: { lang: Lang }) {
  const categories = await getNavCategories(lang);
  return <SiteHeaderChrome lang={lang} categories={categories} />;
}
