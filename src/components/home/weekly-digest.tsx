import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { VideoFacade } from '@/components/editorial/video-facade';
import { WEEKLY_COPY } from '@/components/weekly/copy';
import { weeklyHeroDescriptions } from '@/components/weekly/weekly-hero';
import { DigestCardClickTracker } from '@/components/analytics/home-click-trackers';
import type { WeeklyDigestHomeView } from '@/lib/digests';
import { getStrings } from '@/lib/i18n';
import { pluralLabel } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import styles from './weekly-digest.module.css';

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function weeklyIssueEyebrow(lang: Lang, issueNumber: number | null | undefined) {
  if (issueNumber == null) {
    return lang === 'uk' ? 'ТИЖНЕВИК' : 'WEEKLY';
  }
  return lang === 'uk'
    ? `ТИЖНЕВИК · № ${issueNumber}`
    : `WEEKLY · NO. ${issueNumber}`;
}

export function WeeklyDigestBlock({
  digest,
  lang,
}: {
  digest: WeeklyDigestHomeView | null;
  lang: Lang;
}) {
  if (!digest) return null;
  const copy = WEEKLY_COPY[lang];
  const landing = getStrings(lang).landing;
  const href = `/${lang}/weekly/${digest.slug}`;
  const { standfirst } = weeklyHeroDescriptions(digest);
  const facts = digest.facts;

  return (
    <section
      id="weekly-digest"
      aria-labelledby="weekly-digest-title"
      className="mx-auto w-full max-w-[1160px] scroll-mt-[var(--header-h)] px-6 py-12"
    >
      <div data-gesture="fold" className={styles.band}>
        <div className={styles.cover}>
          <p className={`eyebrow ${styles.coverEyebrow}`}>
            {weeklyIssueEyebrow(lang, facts?.issueNumber)}
          </p>
          <p className={styles.period}>
            <time dateTime={digest.weekStart}>{formatDate(digest.weekStart, lang)}</time>
            {' – '}
            <time dateTime={digest.weekEnd}>{formatDate(digest.weekEnd, lang)}</time>
          </p>
          <p className={styles.coverTitle}>{digest.title}</p>
          <span className={styles.rings} aria-hidden="true" />
        </div>

        <div className={styles.copy}>
          <p className={`eyebrow ${styles.copyEyebrow}`}>{landing.velvetEyebrow}</p>
          <h2
            id="weekly-digest-title"
            className="text-[clamp(1.5rem,2.4vw,2.15rem)] leading-tight text-[var(--on-weekly)]"
          >
            {landing.weeklyHomeHeadlineLine1}
            <br />
            {landing.weeklyHomeHeadlineLine2}
          </h2>

          {standfirst ? (
            <p className={`text-base leading-7 ${styles.copyLead}`}>{standfirst}</p>
          ) : null}

          {facts && (facts.stories > 0 || facts.minutes > 0 || facts.sources > 0) ? (
            <ul className={styles.facts}>
              {facts.stories > 0 ? (
                <li className={styles.factItem}>
                  <strong className={styles.factValue}>{facts.stories}</strong>
                  <span>{pluralLabel(facts.stories, lang, 'stories')}</span>
                </li>
              ) : null}
              {facts.minutes > 0 ? (
                <li className={styles.factItem}>
                  <strong className={styles.factValue}>{facts.minutes}</strong>
                  <span>{pluralLabel(facts.minutes, lang, 'minutes')}</span>
                </li>
              ) : null}
              {facts.sources > 0 ? (
                <li className={styles.factItem}>
                  <strong className={styles.factValue}>{facts.sources}</strong>
                  <span>{pluralLabel(facts.sources, lang, 'sources')}</span>
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-3">
            <DigestCardClickTracker method="read" digestSlug={digest.slug}>
              <Link
                href={href}
                className={`rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center gap-2 px-5 py-3 text-sm font-semibold no-underline ${styles.primaryBtn}`}
              >
                {landing.velvetOpen}
                <ArrowRight size={16} />
              </Link>
            </DigestCardClickTracker>
            <Link
              href={`/${lang}/digests`}
              className={`rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center border px-5 py-3 text-sm font-semibold no-underline ${styles.outlineBtn}`}
            >
              {landing.velvetAll}
            </Link>
          </div>
        </div>
      </div>

      {digest.video ? (
        <div className="border-line-soft mt-9 border-t pt-8">
          <div className="mb-4">
            <p className="text-accent eyebrow">{copy.watch}</p>
            <h3 className="mt-2 text-xl sm:text-2xl">{copy.videoTitle}</h3>
          </div>
          <VideoFacade
            videoId={digest.video.youtubeId}
            thumbnailUrl={digest.video.thumbnailUrl}
            title={copy.videoTitle}
            lang={lang}
          />
        </div>
      ) : null}
    </section>
  );
}
