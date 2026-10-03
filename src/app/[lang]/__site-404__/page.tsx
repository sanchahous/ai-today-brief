import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/not-found-content';
import { getStrings } from '@/lib/i18n';
import { isLang, type Lang } from '@/lib/site';

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : 'en';
  const t = getStrings(lang);
  return {
    title: t.notFoundMetaTitle,
    description: t.notFoundBody,
    robots: { index: false, follow: true },
  };
}

/** Rendered only via proxy rewrite — returns real HTTP 404 before the brief route streams. */
export default async function SiteNotFoundPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  const lang: Lang = isLang(raw) ? raw : 'en';
  return <NotFoundContent lang={lang} />;
}
