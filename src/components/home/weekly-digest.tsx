import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { LiteYouTube } from '@/components/weekly/lite-youtube';
import { WEEKLY_COPY } from '@/components/weekly/copy';
import type { WeeklyDigestHomeView } from '@/lib/digests';
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
  const href = `/${lang}/weekly/${digest.slug}`;

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
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)]">
          <div>
            <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
              {copy.eyebrow}
            </p>
            <h2
              id="weekly-digest-title"
              className="mt-3 text-[clamp(2rem,4vw,3.3rem)] leading-tight"
            >
              {digest.title}
            </h2>
            <p className="text-faint mt-3 text-sm">
              {formatDate(digest.weekStart, lang)} — {formatDate(digest.weekEnd, lang)}
            </p>
            {digest.intro ? (
              <p className="text-muted mt-5 max-w-2xl text-base leading-7">{digest.intro}</p>
            ) : (
              <p className="text-muted mt-5 max-w-2xl text-base leading-7">{copy.latestSubtitle}</p>
            )}

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

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={href}
                className="bg-accent text-on-accent rounded-pill inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold no-underline"
              >
                {copy.readFull}
                <ArrowRight size={16} />
              </Link>
              {digest.hasPdf ? (
                <a
                  href={`${href}/download`}
                  className="border-border text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
                >
                  {copy.downloadPdf}
                </a>
              ) : null}
            </div>
          </div>

          {digest.cover ? (
            <Link
              href={href}
              aria-label={copy.readFull}
              className="border-border rounded-card relative block aspect-[1200/630] overflow-hidden border"
            >
              <Image
                src={digest.cover.url}
                alt={digest.cover.alt}
                fill
                sizes="(max-width: 1023px) 100vw, 480px"
                className="object-cover transition-transform duration-300 hover:scale-[1.015]"
              />
            </Link>
          ) : (
            <Link
              href={href}
              aria-label={copy.readFull}
              className="border-border rounded-card block aspect-[1200/630] border"
              style={{
                background:
                  'radial-gradient(90% 100% at 85% 5%, rgba(71,228,211,.18), transparent 60%), var(--surface-2)',
              }}
            />
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
