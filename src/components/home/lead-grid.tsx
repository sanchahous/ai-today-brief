import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { HomeEdition, HomeItem } from '@/lib/home';
import type { Lang } from '@/lib/site';
import { ArrowRight, BrandMark } from '@/components/icons';
import { CategoryBadge } from '@/components/ui/category-badge';
import { WeeklyTopClickTracker } from '@/components/analytics/home-click-trackers';

function itemSlugFromHref(href: string): string | undefined {
  const parts = href.split('/').filter(Boolean);
  return parts.length >= 4 ? (parts[parts.length - 1] ?? undefined) : undefined;
}

export function LeadGrid({
  lang,
  featured,
  rail = [],
  edition,
  todayIso,
}: {
  lang: Lang;
  featured: HomeItem | null;
  rail?: HomeItem[];
  edition: HomeEdition | null;
  todayIso: string;
}) {
  if (!featured && rail.length === 0) return null;
  const t = getStrings(lang).landing;
  const dailyHref = edition?.slug ? `/${lang}/${edition.slug}` : `/${lang}/digests`;
  const dailyLabel = edition?.date === todayIso ? t.railCtaToday : t.railCtaLatest;

  return (
    <section
      aria-label={t.leadEyebrow}
      className="mx-auto grid w-full max-w-[1160px] gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.72fr)]"
    >
      {featured ? (
        <article className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-accent eyebrow">
              {t.leadEyebrow}
              {featured.categoryName ? ` / ${featured.categoryName}` : ''}
            </p>
            <WeeklyTopClickTracker
              slot="featured"
              target={{ id: featured.id, slug: itemSlugFromHref(featured.href), lang }}
            >
              <h2 className="mt-3 text-3xl leading-tight sm:text-4xl">
                <Link href={featured.href} className="text-text hover:text-accent no-underline">
                  {featured.title}
                </Link>
              </h2>
              {featured.summary ? (
                <p className="text-muted mt-4 max-w-xl text-base leading-7">{featured.summary}</p>
              ) : null}
              <p className="text-faint mt-4 flex flex-wrap items-center gap-2 text-sm">
                <time dateTime={featured.date}>
                  {new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${featured.date}T00:00:00Z`))}
                </time>
                <span aria-hidden>·</span>
                <span>
                  {featured.readMinutes} {t.readMin}
                </span>
              </p>
              <Link
                href={featured.href}
                className="rounded-pill border-border text-text hover:border-accent hover:text-accent mt-5 inline-flex min-h-[var(--touch-target-min)] items-center gap-2 border px-5 py-3 text-sm font-semibold no-underline"
              >
                {t.leadCta}
                <ArrowRight size={16} />
              </Link>
            </WeeklyTopClickTracker>
          </div>
          <div className="text-accent hidden place-items-center md:grid" aria-hidden>
            <BrandMark size={160} className="size-40" />
          </div>
        </article>
      ) : null}

      {rail.length > 0 ? (
        <aside aria-labelledby="rail-title" className="border-border bg-surface rounded-card border p-5">
          <p className="text-accent eyebrow">{t.railEyebrow}</p>
          <h2 id="rail-title" className="mt-2 text-2xl">
            {t.railTitle}
          </h2>
          <ol className="mt-4 grid gap-4">
            {rail.map((item, index) => (
              <li key={item.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
                <span className="text-faint font-serif text-xl leading-none" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base leading-snug">
                    <Link href={item.href} className="text-text hover:text-accent no-underline">
                      {item.title}
                    </Link>
                  </h3>
                  <div className="mt-1">
                    <CategoryBadge
                      slug={item.categorySlug}
                      name={item.categoryName}
                      color={item.categoryColor}
                      variant="plain"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href={dailyHref}
            className="rounded-pill bg-accent mt-5 inline-flex min-h-[var(--touch-target-min)] items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent no-underline"
          >
            {dailyLabel}
            <ArrowRight size={16} />
          </Link>
        </aside>
      ) : null}
    </section>
  );
}
