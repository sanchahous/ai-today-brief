import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDigestArchive } from '@/lib/digests';
import { isLang, SITE_URL, type Lang } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Lang = isLang(lang) ? lang : 'en';
  const title =
    locale === 'uk' ? 'Архів щоденних і тижневих дайджестів' : 'Daily and weekly AI digest archive';
  const description =
    locale === 'uk'
      ? 'Погоджені щоденні брифи та тижневі підсумки AI Today Brief.'
      : 'Approved daily briefs and persisted weekly AI engineering roundups.';
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/digests`,
      languages: {
        en: `${SITE_URL}/en/digests`,
        uk: `${SITE_URL}/uk/digests`,
        'x-default': `${SITE_URL}/en/digests`,
      },
    },
  };
}

export default async function DigestsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const entries = await getDigestArchive(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <p className="text-sm font-bold tracking-[.16em] text-cyan-600 uppercase dark:text-[#47e4d3]">
        {lang === 'uk' ? 'Дайджести' : 'Digests'}
      </p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
        {lang === 'uk'
          ? 'Щоденний контекст. Тижнева перспектива.'
          : 'Daily context. Weekly perspective.'}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-400">
        {lang === 'uk'
          ? 'Кожен випуск складається лише з опублікованих і вручну погоджених матеріалів.'
          : 'Every edition is built only from published, human-approved reporting.'}
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link
            key={`${entry.kind}-${entry.id}`}
            href={entry.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-400 dark:border-white/10 dark:bg-white/[.03]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold tracking-wide text-cyan-700 uppercase dark:text-[#47e4d3]">
                {entry.kind === 'weekly'
                  ? lang === 'uk'
                    ? 'Тижневий'
                    : 'Weekly'
                  : lang === 'uk'
                    ? 'Щоденний'
                    : 'Daily'}
              </span>
              <time className="text-xs text-slate-500">{entry.date}</time>
            </div>
            <h2 className="mt-3 text-lg leading-7 font-bold">{entry.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
