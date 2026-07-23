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

export function WeeklyHero({ digest, lang }: { digest: WeeklyDigestView; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  return (
    <header className="border-border-soft border-b pb-10">
      <Link
        href={`/${lang}/digests`}
        className="text-accent inline-flex text-sm font-semibold no-underline hover:underline"
      >
        ← {copy.allDigests}
      </Link>

      <div className="mt-7 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.78fr)]">
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02]">{digest.title}</h1>
          {digest.intro ? (
            <p className="text-muted mt-5 max-w-3xl text-lg leading-8 sm:text-xl">{digest.intro}</p>
          ) : null}
          <p className="text-faint mt-5 text-sm">
            {copy.period}: {formatDate(digest.weekStart, lang)} — {formatDate(digest.weekEnd, lang)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {digest.hasPdf ? (
              <a
                href={`/${lang}/weekly/${digest.slug}/download`}
                className="bg-accent text-on-accent rounded-pill px-5 py-3 text-sm font-semibold no-underline"
              >
                {copy.downloadPdf}
              </a>
            ) : null}
            <a
              href="#stories"
              className="border-border text-text hover:border-accent hover:text-accent rounded-pill border px-5 py-3 text-sm font-semibold no-underline transition-colors"
            >
              {copy.contents}
            </a>
          </div>
        </div>

        {digest.cover ? (
          <figure className="border-border rounded-card relative m-0 aspect-[1200/630] overflow-hidden border shadow-[var(--shadow-card)]">
            <Image
              src={digest.cover.url}
              alt={digest.cover.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 520px"
              className="object-cover"
            />
          </figure>
        ) : (
          <div
            aria-hidden
            className="border-border rounded-card aspect-[1200/630] border"
            style={{
              background:
                'radial-gradient(100% 120% at 90% 0%, rgba(240,192,64,.24), transparent 55%), var(--surface)',
            }}
          />
        )}
      </div>
    </header>
  );
}
