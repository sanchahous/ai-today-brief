import Image from 'next/image';
import { DailyVisualEngagement } from '@/components/daily/daily-visual-engagement';
import { ReadProgressRing } from '@/components/daily/daily-read-state';
import { CategoryBanner } from '@/components/editorial/category-banner';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';
import { ClockIcon } from '@/components/icons';
import type { DailyBriefView } from '@/lib/briefs';
import { briefDateParts } from '@/lib/daily-edition';
import { pluralLabel, readMinutesForParts } from '@/lib/home-stats';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

function cleanIntro(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || null;
}

// No daily brief has a separately-authored short lead (unlike the weekly
// digest's `standfirst`), so a long single paragraph is cut at a sentence.
// This budget roughly matches one opening sentence without competing with
// the hero visual. A real paragraph break (decision #360) wins first.
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

function splitParagraphs(text: string): { excerpt: string; more: string | null } | null {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const first = paragraphs[0];
  if (!first || paragraphs.length < 2) return null;
  return { excerpt: first, more: paragraphs.slice(1).join('\n\n') };
}

/**
 * The display title gives the immediate orientation, and the first paragraph
 * of the intro stays visible for on-page SEO/AEO. The rest, when there is
 * more, stays behind Show more so it doesn't compete with the visual.
 */
export function dailyHeroDescriptions(intro: string | null | undefined): {
  excerpt: string | null;
  more: string | null;
} {
  const cleaned = cleanIntro(intro);
  if (!cleaned) return { excerpt: null, more: null };
  const paragraphs = splitParagraphs(cleaned);
  if (paragraphs) return paragraphs;
  return splitExcerpt(cleaned, EXCERPT_MAX_CHARS);
}

export function DailyHero({ brief, lang }: { brief: DailyBriefView; lang: Lang }) {
  const t = getStrings(lang);
  const visual = brief.visual;
  const parts = briefDateParts(brief.date, lang);
  const { excerpt, more } = dailyHeroDescriptions(brief.intro);
  const displayTitle = visual?.displayTitle || brief.title || t.todaysBrief;
  const minutes = readMinutesForParts(brief.allItems);
  const count = brief.allItems.length;
  const lead = brief.allItems[0];

  return (
    <header className="mb-8" data-testid="daily-hero">
      <div className="flex flex-col gap-6 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="min-w-0 flex-1">
          {parts ? (
            <p className="m-0 mb-4 flex items-end gap-3" aria-hidden="true">
              <span className="font-serif text-text text-6xl leading-none">{parts.day}</span>
              <span className="text-muted text-sm leading-snug">
                {parts.month}
                <br />
                {parts.weekday}
              </span>
            </p>
          ) : null}
          <p className="text-accent m-0 text-xs font-bold tracking-[0.14em] uppercase">
            {t.dailyBriefEyebrow}
            {parts ? (
              <>
                {' · '}
                <time dateTime={parts.iso}>{parts.full}</time>
              </>
            ) : null}
          </p>
          <h1 className="text-text mt-3 mb-0 font-serif text-4xl leading-tight sm:text-5xl">{displayTitle}</h1>
          {excerpt ? (
            <p className="text-muted m-0 mt-4 max-w-[70ch] text-base leading-7">{excerpt}</p>
          ) : null}
          {more ? (
            <details className="group mt-4 max-w-[70ch]">
              <summary className="rounded-pill border-border bg-surface text-text hover:border-accent inline-flex min-h-[var(--touch-target-min)] list-none items-center gap-2 border px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">{t.briefShowMore}</span>
                <span className="hidden group-open:inline">{t.briefShowLess}</span>
              </summary>
              <p className="text-muted m-0 mt-4 text-base leading-7 whitespace-pre-line">{more}</p>
            </details>
          ) : null}
          <ul className="m-0 mt-4 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0 text-sm text-muted">
            {minutes > 0 ? (
              <li className="inline-flex items-center gap-1.5">
                <ClockIcon size={16} />
                <span>
                  {minutes} {pluralLabel(minutes, lang, 'minutes')}
                </span>
              </li>
            ) : null}
            {count > 0 ? (
              <li>
                {count} {pluralLabel(count, lang, 'stories')}
              </li>
            ) : null}
            <li>
              <AiDisclosureNote lang={lang} variant="inline" />
            </li>
          </ul>
        </div>
        <ReadProgressRing />
      </div>

      <DailyVisual brief={brief} lang={lang} lead={lead} />
    </header>
  );
}

function DailyVisual({
  brief,
  lang,
  lead,
}: {
  brief: DailyBriefView;
  lang: Lang;
  lead: DailyBriefView['allItems'][number] | undefined;
}) {
  const t = getStrings(lang);
  const visual = brief.visual;
  if (!visual && !lead) return null;

  return (
    <figure id="daily-visual-hero" data-testid="daily-visual" className="mt-8 mb-0">
      {visual ? (
        <Image
          src={visual.publicUrl}
          alt=""
          width={visual.width}
          height={visual.height}
          priority
          // The shared loader sends Supabase objects to render/image, whose
          // default resize=cover keeps the origin height and crops the width.
          // A 1600×900 daily visual then arrives as 640×900 or 1200×900.
          // The stored file is already WebP at the publication size, so this
          // hero serves that file and lets object-contain scale it.
          unoptimized
          className="h-auto w-full object-contain"
          style={{ width: '100%', height: 'auto' }}
        />
      ) : (
        <CategoryBanner
          id={lead?.id}
          slug={lead?.categorySlug}
          name={lead?.categoryName}
          color={lead?.categoryColor}
          variant="hero"
        />
      )}
      <figcaption className="text-faint mt-2 text-sm">
        {visual ? (
          <>
            <span className="text-text font-semibold">{t.dailyVisualLabel}.</span> {visual.alt}
          </>
        ) : (
          <>
            {t.dailyVisualFallback}
            {lead?.categoryName ? ` · ${lead.categoryName}` : ''}
          </>
        )}
      </figcaption>
      {visual ? (
        <DailyVisualEngagement
          targetId="daily-visual-hero"
          visualSetId={visual.visualSetId}
          candidateId={visual.candidateId}
          lang={lang}
        />
      ) : null}
    </figure>
  );
}
