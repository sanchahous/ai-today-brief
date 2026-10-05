import Image from 'next/image';
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

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
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
  const { standfirst, more } = weeklyHeroDescriptions(digest);
  const facts = digest.facts;

  return (
    <section
      id="weekly-digest"
      aria-labelledby="weekly-digest-title"
      className="mx-auto w-full max-w-[1160px] scroll-mt-[var(--header-h)] px-6 py-12"
    >
      <div className="bg-velvet text-on-velvet rounded-card relative overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.1fr)]">
          <div className="lg:order-2">
            <p className="text-on-velvet eyebrow">
              {landing.velvetEyebrow}
              {facts?.issueNumber ? ` · № ${facts.issueNumber}` : ''}
            </p>
            <h2
              id="weekly-digest-title"
              className="mt-3 text-[clamp(1.5rem,2.4vw,2.15rem)] leading-tight"
            >
              {digest.title}
            </h2>
            <p className="mt-3 text-sm opacity-80">
              <time dateTime={digest.weekStart}>{formatDate(digest.weekStart, lang)}</time>
              {' — '}
              <time dateTime={digest.weekEnd}>{formatDate(digest.weekEnd, lang)}</time>
            </p>

            {standfirst ? (
              <p className="mt-5 max-w-2xl text-base leading-7 opacity-90">{standfirst}</p>
            ) : null}

            {more || digest.highlights.length ? (
              <details className="border-line group mt-5 w-full border-t pt-4">
                <summary className="border-line bg-surface text-text hover:border-accent hover:text-accent rounded-pill inline-flex list-none items-center gap-2 border px-4 py-2.5 text-sm font-semibold transition-colors [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">{copy.showMore}</span>
                  <span className="hidden group-open:inline">{copy.showLess}</span>
                  <span
                    aria-hidden
                    className="text-lg leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                {more ? (
                  <p className="mt-4 max-w-2xl text-base leading-7 opacity-90">{more}</p>
                ) : null}

                {digest.highlights.length ? (
                  <ul className="mt-6 grid gap-3">
                    {digest.highlights.slice(0, 5).map((highlight) => (
                      <li
                        key={highlight}
                        className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-sm leading-6 opacity-90"
                      >
                        <span aria-hidden className="text-accent font-bold">
                          •
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ) : null}

            {facts && (facts.stories > 0 || facts.minutes > 0 || facts.sources > 0) ? (
              <ul className="mt-5 flex flex-wrap gap-6">
                {facts.stories > 0 ? (
                  <li>
                    <strong className="font-serif text-2xl">{facts.stories}</strong>
                    <span className="mt-1 block text-sm opacity-80">
                      {pluralLabel(facts.stories, lang, 'stories')}
                    </span>
                  </li>
                ) : null}
                {facts.minutes > 0 ? (
                  <li>
                    <strong className="font-serif text-2xl">{facts.minutes}</strong>
                    <span className="mt-1 block text-sm opacity-80">
                      {pluralLabel(facts.minutes, lang, 'minutes')}
                    </span>
                  </li>
                ) : null}
                {facts.sources > 0 ? (
                  <li>
                    <strong className="font-serif text-2xl">{facts.sources}</strong>
                    <span className="mt-1 block text-sm opacity-80">
                      {pluralLabel(facts.sources, lang, 'sources')}
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-7 flex flex-wrap gap-3">
              <DigestCardClickTracker method="read" digestSlug={digest.slug}>
                <Link
                  href={href}
                  className="bg-accent text-on-accent rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center gap-2 px-5 py-3 text-sm font-semibold no-underline"
                >
                  {landing.velvetOpen}
                  <ArrowRight size={16} />
                </Link>
              </DigestCardClickTracker>
              <Link
                href={`/${lang}/digests`}
                className="border-on-velvet text-on-velvet hover:bg-velvet-deep rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center border px-5 py-3 text-sm font-semibold no-underline"
              >
                {landing.velvetAll}
              </Link>
              {digest.hasPdf ? (
                <DigestCardClickTracker method="pdf" digestSlug={digest.slug}>
                  <a
                    href={`${href}/download`}
                    className="border-on-velvet text-on-velvet hover:bg-velvet-deep rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center border px-5 py-3 text-sm font-semibold no-underline"
                  >
                    {copy.downloadPdf}
                  </a>
                </DigestCardClickTracker>
              ) : null}
            </div>
          </div>

          {digest.cover ? (
            <DigestCardClickTracker method="cover" digestSlug={digest.slug}>
              <Link
                href={href}
                aria-label={copy.readFull}
                className="bg-velvet-deep rounded-card relative block h-56 overflow-hidden sm:h-64 lg:order-1 lg:h-72"
              >
                <Image
                  src={digest.cover.url}
                  alt={digest.cover.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 480px"
                  className="object-contain"
                />
              </Link>
            </DigestCardClickTracker>
          ) : null}
        </div>

        {digest.video ? (
          <div className="border-line-soft mt-9 border-t pt-8">
            <div className="mb-4">
              <p className="text-accent eyebrow">
                {copy.watch}
              </p>
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
      </div>
    </section>
  );
}
