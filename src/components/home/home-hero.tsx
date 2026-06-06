import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';
import { HeroSearch } from '@/components/home/hero-search';

/**
 * First screen: product positioning + integrated archive search + headline
 * stats. The drifting orbs are decorative (CSS only, desktop-only, disabled
 * under reduced-motion).
 */
export function HomeHero({ lang, categoryCount }: { lang: Lang; categoryCount: number }) {
  const t = getStrings(lang).landing;
  const stats = [
    { n: '70+', label: t.statStories },
    { n: '120+', label: t.statSources },
    { n: String(categoryCount || 9), label: t.statCategories },
  ];

  return (
    <section
      aria-labelledby="hero-title"
      className="border-border-soft relative overflow-hidden border-b"
      style={{
        background: 'radial-gradient(80% 120% at 85% -10%, rgba(240,192,64,0.10), transparent 60%)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block">
        <span
          className="orb orb-a"
          style={{ left: '62%', top: '-10%', width: 320, height: 320, background: 'rgba(240,192,64,0.22)' }}
        />
        <span
          className="orb orb-b"
          style={{ left: '78%', top: '38%', width: 280, height: 280, background: 'rgba(91,201,240,0.16)' }}
        />
        <span
          className="orb orb-c"
          style={{ left: '45%', top: '12%', width: 240, height: 240, background: 'rgba(181,140,247,0.14)' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1160px] px-6 pt-[4.5rem] pb-14">
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{t.heroEyebrow}</p>
        <h1 id="hero-title" className="mt-4 max-w-3xl text-4xl leading-[1.08] sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed">{t.heroSubtitle}</p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/news`}
            className="rounded-pill bg-accent inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-on-accent"
          >
            {t.ctaPrimary}
            <ArrowRight size={16} />
          </Link>
          <a
            href="#week"
            className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex items-center border px-5 py-3 text-sm font-semibold transition-colors"
          >
            {t.ctaSecondary}
          </a>
        </div>

        <div className="mt-8 max-w-2xl">
          <HeroSearch
            lang={lang}
            placeholder={t.searchPlaceholder}
            button={t.searchButton}
            popularLabel={t.searchPopular}
          />
        </div>

        <dl className="mt-10 flex flex-wrap gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-accent font-serif text-3xl leading-tight font-semibold">{s.n}</dt>
              <dd className="text-muted mt-1 text-sm">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
