import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDigestArchive } from '@/lib/digests';
import { isLang, SITE_URL, type Lang } from '@/lib/site';
import { HubViewTracker } from '@/components/analytics/hub-view-tracker';
import { socialMeta } from '@/lib/seo';

export const revalidate = 3600;

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
    ...socialMeta({ title, description, path: `/${locale}/digests`, lang: locale }),
  };
}

export default async function DigestsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const entries = await getDigestArchive(lang);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
      <HubViewTracker hubType="digests" slug="digests" />
      <p className="text-accent text-sm font-bold tracking-[.16em] uppercase">
        {lang === 'uk' ? 'Дайджести' : 'Digests'}
      </p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
        {lang === 'uk'
          ? 'Щоденний контекст. Тижнева перспектива.'
          : 'Daily context. Weekly perspective.'}
      </h1>
      <p className="text-muted mt-5 max-w-2xl text-base leading-7">
        {lang === 'uk'
          ? 'Кожен випуск складається лише з опублікованих і вручну погоджених матеріалів.'
          : 'Every edition is built only from published, human-approved reporting.'}
      </p>
      {entries.length ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <Link
              key={`${entry.kind}-${entry.id}`}
              href={entry.href}
              className="border-border bg-surface hover:border-accent rounded-card border p-5 no-underline transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-accent text-xs font-bold tracking-wide uppercase">
                  {entry.kind === 'weekly'
                    ? lang === 'uk'
                      ? 'Тижневий'
                      : 'Weekly'
                    : lang === 'uk'
                      ? 'Щоденний'
                      : 'Daily'}
                </span>
                <time className="text-faint text-xs">{entry.date}</time>
              </div>
              <h2 className="text-text mt-3 text-lg leading-7 font-bold">{entry.title}</h2>
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-border bg-surface text-muted rounded-card mt-10 border p-6">
          {lang === 'uk'
            ? 'Опубліковані випуски з’являться тут.'
            : 'Published editions will appear here.'}
        </p>
      )}
    </div>
  );
}
