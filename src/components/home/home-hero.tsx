import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import { mastheadStats } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';
import { BrandStage } from '@/components/brand/brand-stage';
import { HeroSearch } from '@/components/home/hero-search';
import { HeroCtaClickTracker } from '@/components/analytics/home-click-trackers';

/**
 * Masthead: promise, archive search, real counts, brand scene in the hero column.
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
    <section aria-labelledby="hero-title" className="home-hero border-line border-b">
      <div className="home-hero-layout relative mx-auto w-full max-w-[1160px] gap-8 px-6 pt-[4.5rem] pb-10 lg:pb-12">
        <div className="home-hero-copy min-w-0">
          <div>
            <p className="text-accent eyebrow">{t.heroEyebrow}</p>
            <h1
              id="hero-title"
              data-gesture="curtain"
              className="mt-4 max-w-[14ch] text-4xl leading-[1.08] sm:text-5xl"
            >
              {t.heroTitleLead}
              <em>{t.heroTitleEm}</em>
            </h1>
            <p
              data-gesture="reveal"
              data-gesture-delay="90"
              className="home-hero-lede mt-5 max-w-[54ch] text-lg leading-relaxed"
            >
              {t.heroSubtitle}
            </p>
          </div>

          <div className="home-hero-actions">
            <div className="max-w-[38.75rem]">
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
                  className="rounded-pill border-line text-text hover:border-accent hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center border px-5 py-3 text-sm font-semibold transition-colors"
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
        </div>

        <div className="hero-stage min-w-0 lg:sticky lg:top-24">
          <BrandStage lang={lang} />
        </div>
      </div>
    </section>
  );
}
