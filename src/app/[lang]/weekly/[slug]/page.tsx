import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWeeklyDigest } from '@/lib/digests';
import { isLang, SITE_URL, type Lang } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale: Lang = isLang(lang) ? lang : 'en';
  const digest = await getWeeklyDigest(slug, locale);
  if (!digest) return {};
  return {
    title: digest.title,
    description: digest.intro ?? digest.items[0]?.summary,
    alternates: {
      canonical: `${SITE_URL}/${locale}/weekly/${slug}`,
      languages: {
        en: `${SITE_URL}/en/weekly/${slug}`,
        uk: `${SITE_URL}/uk/weekly/${slug}`,
        'x-default': `${SITE_URL}/en/weekly/${slug}`,
      },
    },
  };
}

export default async function WeeklyDigestPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();
  const digest = await getWeeklyDigest(slug, lang);
  if (!digest) notFound();
  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
      <Link
        href={`/${lang}/digests`}
        className="text-sm font-bold text-cyan-700 hover:underline dark:text-[#47e4d3]"
      >
        ← {lang === 'uk' ? 'Усі дайджести' : 'All digests'}
      </Link>
      <header className="mt-7 border-b border-slate-200 pb-8 dark:border-white/10">
        <p className="text-sm font-bold tracking-[.16em] text-cyan-700 uppercase dark:text-[#47e4d3]">
          {lang === 'uk' ? 'Тижневий дайджест' : 'Weekly digest'} · {digest.weekStart}
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {digest.title}
        </h1>
        {digest.intro ? (
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
            {digest.intro}
          </p>
        ) : null}
      </header>
      <ol className="mt-8 grid gap-6">
        {digest.items.map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 p-5 dark:border-white/10"
          >
            <span className="font-serif text-3xl font-semibold text-cyan-600 dark:text-[#47e4d3]">
              {item.rank}
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{item.date}</p>
              <h2 className="mt-1 text-xl leading-8 font-bold">
                <Link href={item.href} className="hover:text-cyan-700 dark:hover:text-[#47e4d3]">
                  {item.title}
                </Link>
              </h2>
              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-400">{item.summary}</p>
              {item.why ? (
                <p className="mt-3 text-sm leading-6">
                  <strong>{lang === 'uk' ? 'Чому це важливо:' : 'Why it matters:'}</strong>{' '}
                  {item.why}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
