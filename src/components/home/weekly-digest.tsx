import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { LiteYouTube } from '@/components/weekly/lite-youtube';
import { WEEKLY_COPY } from '@/components/weekly/copy';
import { weeklyHeroDescriptions } from '@/components/weekly/weekly-hero';
import type { WeeklyDigestHomeView } from '@/lib/digests';
import type { Lang } from '@/lib/site';
import { DigestCardClickTracker } from '@/components/analytics/home-click-trackers';

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
  const href = `/${lang}/weekly/${digest.slug}`;
  const { standfirst, more } = weeklyHeroDescriptions(digest);

  return (
    <section
      id="weekly-digest"
      aria-labelledby="weekly-digest-title"
      className="mx-auto w-full max-w-[1160px] scroll-mt-[var(--header-h)] px-6 py-12"
    >
      <div
        className="border-border rounded-card relative overflow-hidden border p-6 sm:p-8 lg:p-10"
        style={{
          background:
            'radial-gradient(100% 140% at 100% 0%, rgba(240,192,64,.17), transparent 55%), var(--surface)',
        }}
      >
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]">
          <div>
            <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
              {copy.eyebrow}
            </p>
            <h2
              id="weekly-digest-title"
              className="mt-3 text-[clamp(1.5rem,2.4vw,2.15rem)] leading-tight"
            >
              {digest.title}
            </h2>
            <p className="text-faint mt-3 text-sm">
              {formatDate(digest.weekStart, lang)} — {formatDate(digest.weekEnd, lang)}
            </p>

            <p className="text-muted mt-5 max-w-2xl text-base leading-7">
              {standfirst || copy.latestSubtitle}
            </p>

            {more || digest.highlights.length ? (
              <details className="border-border group mt-5 w-full border-t pt-4">
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
                {more ? (
                  <p className="text-muted mt-4 max-w-2xl text-base leading-7">{more}</p>
                ) : null}

                {digest.highlights.length ? (
                  <ul className="mt-6 grid gap-3">
                    {digest.highlights.slice(0, 5).map((highlight) => (
                      <li
                        key={highlight}
                        className="text-muted grid grid-cols-[1rem_minmax(0,1fr)] gap-3 text-sm leading-6"
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

            <div className="mt-7 flex flex-wrap gap-3">
              <DigestCardClickTracker method="read" digestSlug={digest.slug}>
                <Link
                  href={href}
                  className="bg-accent text-on-accent rounded-pill inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold no-underline"
                >
                  {copy.readFull}
                  <ArrowRight size={16} />
                </Link>
              </DigestCardClickTracker>
              {digest.hasPdf ? (
                <DigestCardClickTracker method="pdf" digestSlug={digest.slug}>
                  <a
                    href={`${href}/download`}
                    className="border-border text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
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
                className="border-border bg-surface rounded-card relative block h-56 overflow-hidden border sm:h-64 lg:h-72"
              >
                <Image
                  src={digest.cover.url}
                  alt={digest.cover.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 480px"
                  className="object-contain transition-transform duration-300 hover:scale-[1.015]"
                />
              </Link>
            </DigestCardClickTracker>
          ) : (
            <DigestCardClickTracker method="cover" digestSlug={digest.slug}>
              <Link
                href={href}
                aria-label={copy.readFull}
                className="border-border rounded-card block h-56 border sm:h-64 lg:h-72"
                style={{
                  background:
                    'radial-gradient(90% 100% at 85% 5%, rgba(71,228,211,.18), transparent 60%), var(--surface-2)',
                }}
              />
            </DigestCardClickTracker>
          )}
        </div>

        {digest.video ? (
          <div className="border-border-soft mt-9 border-t pt-8">
            <div className="mb-4">
              <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
                {copy.watch}
              </p>
              <h3 className="mt-2 text-xl sm:text-2xl">{copy.videoTitle}</h3>
            </div>
            <LiteYouTube
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
