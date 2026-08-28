import Image from 'next/image';
import { DailyVisualEngagement } from '@/components/daily/daily-visual-engagement';
import type { DailyBriefView } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

function clean(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

/**
 * The display title gives the immediate orientation. The published intro can
 * be long and must not compete with the visual on first view, so it remains
 * wholly behind the native Show more control.
 */
export function dailyHeroDescriptions(intro: string | null | undefined): {
  fullDescription: string | null;
} {
  return { fullDescription: clean(intro) };
}

export function DailyHero({
  brief,
  lang,
  dateLabel,
}: {
  brief: DailyBriefView;
  lang: Lang;
  dateLabel: string;
}) {
  const t = getStrings(lang);
  const visual = brief.visual;
  const { fullDescription } = dailyHeroDescriptions(brief.intro);
  const displayTitle = visual?.displayTitle || brief.title || t.todaysBrief;

  return (
    <header className="border-border-soft mb-8 border-b pb-10">
      <section
        id="daily-visual-hero"
        data-testid="daily-hero"
        className="rounded-card border-border bg-surface relative isolate overflow-hidden border shadow-[var(--shadow-pop)]"
      >
        {visual ? (
          <Image
            aria-hidden
            src={visual.publicUrl}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 1199px) 100vw, 1160px"
            className="object-contain object-center opacity-50 sm:opacity-70"
          />
        ) : null}
        {visual ? (
          <DailyVisualEngagement
            targetId="daily-visual-hero"
            visualSetId={visual.visualSetId}
            candidateId={visual.candidateId}
            lang={lang}
          />
        ) : null}
        {visual ? <div aria-hidden className="daily-hero-scrim absolute inset-0" /> : null}

        <div
          className={`relative z-10 flex flex-col px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16 ${
            visual ? 'min-h-[24rem] sm:min-h-[27rem]' : ''
          }`}
        >
          <p className="text-accent m-0 text-xs font-bold tracking-[0.14em] uppercase">
            {dateLabel}
          </p>
          <h1 className="text-text mt-3 mb-0 w-full text-[clamp(1.9rem,4.2vw,3.35rem)] leading-[1.05]">
            {displayTitle}
          </h1>
          {visual ? <span className="sr-only">{visual.alt}</span> : null}

          {fullDescription ? (
            <details className="group border-border mt-6 w-full border-t pt-4">
              <summary className="rounded-pill border-border bg-surface text-text hover:border-accent hover:text-accent inline-flex list-none items-center gap-2 border px-4 py-2.5 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{t.briefShowMore}</span>
                <span className="hidden group-open:inline">{t.briefShowLess}</span>
                <span
                  aria-hidden
                  className="text-lg leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-muted m-0 mt-4 w-full text-base leading-7 sm:text-lg sm:leading-8">
                {fullDescription}
              </p>
            </details>
          ) : null}
        </div>
      </section>
    </header>
  );
}
