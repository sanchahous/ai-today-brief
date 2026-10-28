import Image from 'next/image';
import Link from 'next/link';
import { DailyVisualEngagement } from '@/components/daily/daily-visual-engagement';
import { ReadProgressRing } from '@/components/daily/daily-read-state';
import styles from '@/components/daily/daily.module.css';
import { CategoryBanner } from '@/components/editorial/category-banner';
import { BannerHeroFrame } from '@/components/editorial/editorial-hero';
import { ClockIcon, ListIcon, SparkleIcon } from '@/components/icons';
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

function DailyMeta({ lang, minutes, count }: { lang: Lang; minutes: number; count: number }) {
  const t = getStrings(lang);
  return (
    <div className={styles.metaRow}>
      {minutes > 0 ? (
        <span>
          <ClockIcon size={16} />
          {minutes} {pluralLabel(minutes, lang, 'minutes')}
        </span>
      ) : null}
      {count > 0 ? (
        <span>
          <ListIcon size={16} />
          {count} {pluralLabel(count, lang, 'stories')}
        </span>
      ) : null}
      <span>
        <SparkleIcon size={14} />
        <Link className={styles.aiNoteLink} href={`/${lang}/ai-disclosure`}>
          {t.aiNoteLabel}
        </Link>
      </span>
    </div>
  );
}

function IntroBlock({
  lang,
  excerpt,
  more,
}: {
  lang: Lang;
  excerpt: string | null;
  more: string | null;
}) {
  const t = getStrings(lang);
  if (!excerpt) return null;

  if (!more) {
    return <p className={styles.introLead}>{excerpt}</p>;
  }

  return (
    <details className={styles.introDetails}>
      <summary className={styles.introSummary}>
        <span className={styles.introLead}>{excerpt}</span>
        <span className={styles.introToggleMore}>{t.briefShowMore}</span>
        <span className={styles.introToggleLess}>{t.briefShowLess}</span>
      </summary>
      <p className={styles.introBody}>{more}</p>
    </details>
  );
}

export function DailyHero({ brief, lang }: { brief: DailyBriefView; lang: Lang }) {
  const t = getStrings(lang);
  const parts = briefDateParts(brief.date, lang);
  const { excerpt, more } = dailyHeroDescriptions(brief.intro);
  const displayTitle = brief.visual?.displayTitle || brief.title || t.todaysBrief;
  const minutes = readMinutesForParts(brief.allItems);
  const count = brief.allItems.length;
  const lead = brief.allItems[0];

  return (
    <header data-testid="daily-hero">
      <div className={styles.masthead}>
        {parts ? (
          <p className={styles.dateBlock} aria-hidden="true">
            <span className={styles.dayNum}>{parts.day}</span>
            <span className={styles.monthBlock}>
              {parts.month}
              <br />
              {parts.weekday}
            </span>
          </p>
        ) : null}

        <div className={styles.headCopy}>
          <p className={styles.eyebrow}>
            {t.dailyBriefEyebrow}
            {parts ? (
              <>
                {' · '}
                <time dateTime={parts.iso}>{parts.full}</time>
              </>
            ) : null}
          </p>
          <h1 className={styles.headTitle}>{displayTitle}</h1>
          <IntroBlock lang={lang} excerpt={excerpt} more={more} />
          <DailyMeta lang={lang} minutes={minutes} count={count} />
        </div>

        <ReadProgressRing variant="masthead" />
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

  const art = visual ? (
    <Image
      src={visual.publicUrl}
      alt=""
      width={visual.width}
      height={visual.height}
      priority
      unoptimized
      className="banner-hero-art-fill"
    />
  ) : (
    <CategoryBanner
      id={lead?.id}
      slug={lead?.categorySlug}
      name={lead?.categoryName}
      color={lead?.categoryColor}
      variant="hero"
      className="h-full w-full"
    />
  );

  return (
    <>
      <figure className={styles.visual}>
        <BannerHeroFrame id="daily-visual-hero" testId="daily-visual" art={art} overlay={false} />
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
      </figure>
      {visual ? (
        <DailyVisualEngagement
          targetId="daily-visual-hero"
          visualSetId={visual.visualSetId}
          candidateId={visual.candidateId}
          lang={lang}
        />
      ) : null}
    </>
  );
}
