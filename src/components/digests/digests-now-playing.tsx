import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { SleeveArt } from '@/components/editorial/sleeve-art';
import type { DigestDailySpotlight } from '@/lib/digests-archive-shared';
import type { WeeklyDigestHomeView } from '@/lib/digests';
import { issueLabel } from '@/lib/digests-archive-shared';
import { pluralLabel } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';

const COPY = {
  en: {
    label: 'Latest editions',
    dailyKicker: 'Latest daily',
    weeklyKicker: 'Latest weekly',
    readBrief: 'Read the brief',
    openWeekly: 'Open weekly edition',
    stories: 'stories',
    minRead: 'min read',
  },
  uk: {
    label: 'Останні випуски',
    dailyKicker: 'Останній daily',
    weeklyKicker: 'Останній тижневик',
    readBrief: 'Читати бриф',
    openWeekly: 'Відкрити тижневик',
    stories: 'історій',
    minRead: 'хв читання',
  },
} as const;

function formatShortDate(value: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function DigestsNowPlaying({
  lang,
  daily,
  weekly,
}: {
  lang: Lang;
  daily: DigestDailySpotlight | null;
  weekly: WeeklyDigestHomeView | null;
}) {
  if (!daily && !weekly) return null;
  const t = COPY[lang];

  return (
    <div
      className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
      aria-label={t.label}
    >
      {daily ? (
        <Link
          href={daily.href}
          className="border-border bg-surface hover:border-accent rounded-card group flex flex-col border p-5 no-underline transition-colors"
        >
          <span className="text-accent text-xs font-bold tracking-wide uppercase">{t.dailyKicker}</span>
          <span className="mt-4 flex items-start gap-4">
            <span className="font-serif text-5xl leading-none">{daily.dayNumber}</span>
            <span className="text-muted text-sm leading-6">
              {daily.weekday}
              <br />
              {daily.monthYear}
            </span>
          </span>
          <span className="text-text mt-4 text-xl font-bold leading-8">{daily.title}</span>
          <span className="text-muted mt-2 text-sm">
            {daily.storyCount} {pluralLabel(daily.storyCount, lang, 'stories')} · {daily.readMinutes}{' '}
            {t.minRead}
          </span>
          {daily.topStories.length ? (
            <span className="mt-4 grid gap-2">
              {daily.topStories.map((title, index) => (
                <span key={`${daily.id}-top-${index}`} className="text-muted flex gap-2 text-sm">
                  <b className="text-accent font-mono text-xs">{String(index + 1).padStart(2, '0')}</b>
                  <span>{title}</span>
                </span>
              ))}
            </span>
          ) : null}
          <span className="text-accent mt-5 inline-flex items-center gap-2 text-sm font-semibold">
            {t.readBrief}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ) : null}

      {weekly ? (
        <Link
          href={`/${lang}/weekly/${weekly.slug}`}
          className="border-border bg-surface hover:border-accent rounded-card group grid gap-4 overflow-hidden border p-5 no-underline transition-colors sm:grid-cols-[7rem_minmax(0,1fr)]"
        >
          <div className="border-border relative aspect-square overflow-hidden rounded-lg border">
            {weekly.cover ? (
              <Image
                src={weekly.cover.url}
                alt={weekly.cover.alt}
                width={weekly.cover.width}
                height={weekly.cover.height}
                className="h-full w-full object-cover"
              />
            ) : (
              <SleeveArt seed={weekly.slug} />
            )}
          </div>
          <span className="flex flex-col">
            <span className="text-accent text-xs font-bold tracking-wide uppercase">
              {t.weeklyKicker}
              {weekly.facts?.issueNumber
                ? ` · ${issueLabel(lang, weekly.facts.issueNumber)}`
                : ''}
            </span>
            <span className="text-text mt-3 text-lg font-bold leading-7">{weekly.title}</span>
            <span className="text-muted mt-2 text-sm">
              {formatShortDate(weekly.weekStart, lang)} – {formatShortDate(weekly.weekEnd, lang)}
              {weekly.facts
                ? ` · ${weekly.facts.stories} ${t.stories} · ${weekly.facts.minutes} ${lang === 'uk' ? 'хв' : 'min'}`
                : ''}
            </span>
            <span className="text-accent mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              {t.openWeekly}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}
