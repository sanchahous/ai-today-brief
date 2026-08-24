import Image from 'next/image';
import Link from 'next/link';
import type { Lang } from '@/lib/site';
import type { WeeklyDigestView } from '@/lib/digests';
import { WEEKLY_COPY } from './copy';

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function weeklyHeroDescriptions({
  intro,
  standfirst,
}: Pick<WeeklyDigestView, 'intro' | 'standfirst'>): { fullDescription: string | null } {
  const fullDescription = intro?.trim() || standfirst?.trim() || null;
  return { fullDescription };
}

export function WeeklyHero({ digest, lang }: { digest: WeeklyDigestView; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  // The display title supplies the first-view orientation. Both standfirst and
  // full intro are description copy, so readers explicitly open them rather
  // than starting every digest with a dense text wall.
  const { fullDescription } = weeklyHeroDescriptions(digest);

  return (
    <header className="border-border-soft border-b pb-10">
      <Link
        href={`/${lang}/digests`}
        className="text-accent inline-flex text-sm font-semibold no-underline hover:underline"
      >
        ← {copy.allDigests}
      </Link>

      <section className="rounded-card border-border bg-surface relative isolate mt-6 overflow-hidden border shadow-[var(--shadow-pop)]">
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
        ) : null}

        <div aria-hidden className="weekly-hero-scrim absolute inset-0" />

        <div
          className={`relative z-10 flex flex-col px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16 ${
            digest.cover ? 'min-h-[22rem] sm:min-h-[26rem]' : ''
          }`}
        >
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="text-text mt-3 w-full text-[clamp(1.85rem,3.1vw,3rem)] leading-[1.04]">
            {digest.displayTitle}
          </h1>
          <p className="text-muted mt-4 text-sm">
            {copy.period}: {formatDate(digest.weekStart, lang)} — {formatDate(digest.weekEnd, lang)}
          </p>
          {digest.cover ? <span className="sr-only">{digest.cover.alt}</span> : null}

          {fullDescription ? (
            <details className="border-border group mt-6 w-full border-t pt-4">
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
                {fullDescription}
              </p>
            </details>
          ) : null}

          <div className="mt-auto pt-7">
            <div className="flex flex-wrap gap-3">
              {digest.hasPdf ? (
                <a
                  href={`/${lang}/weekly/${digest.slug}/download`}
                  data-digest-event="pdf_download"
                  className="bg-accent text-on-accent rounded-pill px-5 py-3 text-sm font-semibold no-underline"
                >
                  {copy.downloadPdf}
                </a>
              ) : null}
              <a
                href="#stories"
                className="border-border bg-surface text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
              >
                {copy.contents}
              </a>
            </div>
          </div>
        </div>
      </section>
    </header>
  );
}
