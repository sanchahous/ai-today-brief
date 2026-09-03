import Image from 'next/image';
import { DailyVisualEngagement } from '@/components/daily/daily-visual-engagement';
import type { DailyBriefView } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

function clean(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

// No daily brief has a separately-authored short lead (unlike the weekly
// digest's `standfirst`), so the excerpt is cut from the intro itself. This
// budget roughly matches one opening sentence without competing with the
// hero visual.
const EXCERPT_MAX_CHARS = 220;

function splitExcerpt(text: string, maxChars: number): { excerpt: string; more: string | null } {
  if (text.length <= maxChars) return { excerpt: text, more: null };

  const sentenceEnd = /[.!?](?:\s|$)/g;
  let cut = -1;
  let match: RegExpExecArray | null;
  while ((match = sentenceEnd.exec(text))) {
    const end = match.index + 1;
    if (end > maxChars) break;
    cut = end;
  }

  if (cut === -1) {
    const slice = text.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(' ');
    const wordCut = lastSpace > 0 ? lastSpace : maxChars;
    const more = text.slice(wordCut).trim();
    return { excerpt: `${text.slice(0, wordCut).trim()}…`, more: more || null };
  }

  const more = text.slice(cut).trim();
  return { excerpt: text.slice(0, cut).trim(), more: more || null };
}

/**
 * The display title gives the immediate orientation, and a short excerpt of
 * the intro stays visible for on-page SEO/AEO — burying all descriptive text
 * behind a client-side toggle leaves nothing for the definition-block engines
 * and readers expect above the fold. The rest of the intro, when there is
 * more, stays behind Show more so it doesn't compete with the visual.
 */
export function dailyHeroDescriptions(intro: string | null | undefined): {
  excerpt: string | null;
  more: string | null;
} {
  const cleaned = clean(intro);
  if (!cleaned) return { excerpt: null, more: null };
  return splitExcerpt(cleaned, EXCERPT_MAX_CHARS);
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
  const { excerpt, more } = dailyHeroDescriptions(brief.intro);
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

          {excerpt ? (
            <p className="text-muted m-0 mt-4 w-full text-base leading-7 sm:text-lg sm:leading-8">
              {excerpt}
            </p>
          ) : null}

          {more ? (
            <details className="group border-border mt-4 w-full border-t pt-4">
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
                {more}
              </p>
            </details>
          ) : null}
        </div>
      </section>
    </header>
  );
}
