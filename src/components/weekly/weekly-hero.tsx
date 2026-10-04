import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/site';
import type { WeeklyDigestView } from '@/lib/digests';
import { WEEKLY_COPY } from './copy';
import { SleeveArt } from '@/components/editorial/sleeve-art';
import { pluralLabel, type WeeklyBandFacts } from '@/lib/home-stats';

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

export interface WeeklyHeroDescriptions {
  /** The short, editorially-crafted lead - always visible for SEO/AEO. */
  standfirst: string | null;
  /** The longer intro, shown only once the reader opens Show more. */
  more: string | null;
}

/**
 * The standfirst is the crafted SEO lead (see `WEEKLY_HERO_COPY_MAX_CHARS.standfirst`
 * in editorial-llm.ts) and stays visible on first paint - hiding it behind a
 * client-side toggle would bury the definition-block text engines and readers
 * both expect above the fold. The full intro, when it adds anything beyond
 * the standfirst, stays behind Show more so it doesn't compete with the
 * visual.
 */
export function weeklyHeroDescriptions({
  intro,
  standfirst,
}: Pick<WeeklyDigestView, 'intro' | 'standfirst'>): WeeklyHeroDescriptions {
  const shortText = standfirst?.trim() || null;
  const longText = intro?.trim() || null;
  if (shortText && longText && longText !== shortText) {
    return { standfirst: shortText, more: longText };
  }
  return { standfirst: shortText ?? longText, more: null };
}

export function WeeklyHero({
  digest,
  facts,
  lang,
}: {
  digest: WeeklyDigestView;
  facts: WeeklyBandFacts | null;
  lang: Lang;
}) {
  const copy = WEEKLY_COPY[lang];
  const { standfirst, more } = weeklyHeroDescriptions(digest);

  return (
    <header className="border-border-soft border-b pb-10">
      <Link
        href={`/${lang}/digests`}
        className="text-accent inline-flex text-sm font-semibold no-underline hover:underline"
      >
        ← {copy.allDigests}
      </Link>

      <section className="rounded-card border-border bg-surface grain relative isolate mt-6 overflow-hidden border shadow-[var(--shadow-pop)]">
        {digest.cover ? (
          <Image
            aria-hidden
            src={digest.cover.url}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 1199px) 100vw, 1160px"
            className="object-contain object-bottom opacity-55 sm:object-right-bottom sm:opacity-70"
          />
        ) : (
          <div className="absolute inset-0 z-0 opacity-40">
            <SleeveArt seed={digest.id} />
          </div>
        )}

        <div aria-hidden className="weekly-hero-scrim absolute inset-0 z-0" />

        <div
          className={`relative z-10 flex flex-col px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16 ${
            digest.cover ? 'min-h-[22rem] sm:min-h-[26rem]' : 'min-h-[20rem]'
          }`}
        >
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
            {copy.eyebrow}
            {facts?.issueNumber ? ` • № ${facts.issueNumber}` : ''}
          </p>
          <h1 className="text-text mt-3 w-full text-[clamp(1.85rem,3.1vw,3rem)] leading-[1.04]">
            {digest.displayTitle}
          </h1>
          <p className="text-muted mt-4 text-sm">
            <time dateTime={digest.weekStart}>{formatDate(digest.weekStart, lang)}</time> —{' '}
            <time dateTime={digest.weekEnd}>{formatDate(digest.weekEnd, lang)}</time>
            {digest.publishedAt ? ` • ${formatDate(digest.publishedAt.split('T')[0] ?? digest.publishedAt, lang)}` : ''}
          </p>
          
          {facts ? (
            <p className="text-faint mt-2 text-xs font-medium uppercase tracking-wide">
              {facts.stories} {pluralLabel(facts.stories, lang, 'stories')} •{' '}
              {facts.minutes} {pluralLabel(facts.minutes, lang, 'minutes')} •{' '}
              {facts.sources} {pluralLabel(facts.sources, lang, 'sources')}
            </p>
          ) : null}

          {digest.cover ? <span className="sr-only">{digest.cover.alt}</span> : null}

          {standfirst ? (
            <p className="text-muted mt-4 w-full text-base leading-7 sm:text-lg sm:leading-8">
              {standfirst}
            </p>
          ) : null}

          {more ? (
            <details className="border-border group mt-4 w-full border-t pt-4">
              <summary className="border-border bg-surface text-text hover:border-accent hover:text-accent rounded-pill inline-flex list-none items-center gap-2 border px-4 py-2.5 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{copy.showMore}</span>
                <span className="hidden group-open:inline">{copy.showLess}</span>
                <span
                  aria-hidden
                  className="text-lg leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-muted mt-4 w-full text-base leading-7 sm:text-lg sm:leading-8">
                {more}
              </p>
            </details>
          ) : null}

          <div className="mt-auto pt-7">
            <div className="flex flex-wrap gap-3">
              <a
                href="#stories"
                className="bg-accent text-on-accent rounded-pill px-5 py-3 text-sm font-semibold no-underline"
              >
                {lang === 'uk' ? 'Почати читати' : 'Start reading'}
              </a>
              {digest.hasPdf ? (
                <a
                  href={`/${lang}/weekly/${digest.slug}/download`}
                  data-digest-event="pdf_download"
                  className="border-border bg-surface text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
                >
                  {copy.downloadPdf}
                </a>
              ) : null}
              {digest.video ? (
                <a
                  href="#video"
                  data-digest-event="video_play"
                  className="border-border bg-surface text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
                >
                  {copy.watch}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </header>
  );
}
