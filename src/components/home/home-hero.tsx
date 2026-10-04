import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import { mastheadStats } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';
import { HeroSearch } from '@/components/home/hero-search';
import { HeroCtaClickTracker } from '@/components/analytics/home-click-trackers';

/**
 * Masthead: promise, archive search, real counts. No decorative motion and
 * no statistic that is not counted from published data.
 */
export function HomeHero({
  lang,
  categoryCount,
  storiesLast7Days,
  popularQueries,
}: {
  lang: Lang;
  categoryCount: number;
  storiesLast7Days: number | null;
  popularQueries: string[];
}) {
  const t = getStrings(lang).landing;
  const stats = mastheadStats({ storiesLast7Days, categoryCount });

  return (
    <section aria-labelledby="hero-title" className="border-border-soft border-b">
      <div className="relative mx-auto w-full max-w-[1160px] px-6 pt-[4.5rem] pb-14">
        <p className="text-accent eyebrow">{t.heroEyebrow}</p>
        <h1 id="hero-title" className="mt-4 max-w-3xl text-4xl leading-[1.08] sm:text-5xl">
          {t.heroTitleLead}
          <em>{t.heroTitleEm}</em>
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed">{t.heroSubtitle}</p>

        <div className="mt-8 max-w-2xl">
          <HeroSearch
            lang={lang}
            placeholder={t.searchPlaceholder}
            button={t.searchButton}
            popularLabel={t.searchPopular}
            popularQueries={popularQueries}
          />
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <HeroCtaClickTracker target="news">
            <Link
              href={`/${lang}/news`}
              className="rounded-pill bg-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent"
            >
              {t.ctaPrimary}
              <ArrowRight size={16} />
            </Link>
          </HeroCtaClickTracker>
          <HeroCtaClickTracker target="week">
            <a
              href="#week"
              className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center border px-5 py-3 text-sm font-semibold transition-colors"
            >
              {t.ctaSecondary}
            </a>
          </HeroCtaClickTracker>
        </div>

        {stats.length > 0 ? (
          <dl className="mt-10 flex flex-wrap gap-8">
            {stats.map((stat) => (
              <div key={stat.kind}>
                <dt className="font-serif text-3xl leading-tight font-semibold tabular-nums">
                  {stat.value}
                </dt>
                <dd className="text-muted mt-1 text-sm">
                  {stat.kind === 'stories7d' ? t.statStories7d : t.statCategories}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
