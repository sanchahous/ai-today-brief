import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { HomeCategory } from '@/lib/home';
import { ArrowRight, CategoryGlyph } from '@/components/icons';
import { Reveal } from '@/components/reveal';
import { SectionHead } from '@/components/home/section-head';

export function CategoryGrid({ lang, categories }: { lang: Lang; categories: HomeCategory[] }) {
  if (categories.length === 0) return null;
  const t = getStrings(lang).landing;
  return (
    <section aria-labelledby="cats-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <Reveal>
        <SectionHead
          id="cats-title"
          eyebrow={t.categoriesEyebrow}
          title={t.categoriesTitle}
          subtitle={t.categoriesSubtitle}
        />
      </Reveal>
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
          <Reveal key={c.slug} delayMs={i * 60}>
            <CategoryCard
              lang={lang}
              category={c}
              latestLabel={t.categoryLatest}
              ctaLabel={t.categoryCta}
              articlesLabel={t.categoryArticles}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CategoryCard({
  lang,
  category,
  latestLabel,
  ctaLabel,
  articlesLabel,
}: {
  lang: Lang;
  category: HomeCategory;
  latestLabel: string;
  ctaLabel: string;
  articlesLabel: string;
}) {
  const color = category.color ?? '#888888';
  return (
    <article className="rounded-card border-border bg-surface flex h-full flex-col overflow-hidden border transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
      <div
        className="flex items-center gap-3 p-4"
        style={{
          background: `linear-gradient(135deg, ${color}26, ${color}0a)`,
          borderBottom: `1px solid ${color}33`,
        }}
      >
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{ color, background: `${color}1f`, border: `1px solid ${color}55` }}
        >
          <CategoryGlyph icon={category.icon} size={24} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight">{category.name}</h3>
          <p className="mt-1 text-sm font-medium" style={{ color }}>
            {category.tagline}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-faint mb-2 text-[0.68rem] font-bold tracking-[0.08em] uppercase">
          {latestLabel}
        </p>
        {category.latest.length > 0 ? (
          <ul className="mb-4 grid gap-2">
            {category.latest.map((it) => (
              <li key={it.id} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <Link
                  href={it.href}
                  className="text-text hover:text-accent line-clamp-2 text-sm leading-snug transition-colors"
                >
                  {it.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mb-4 line-clamp-3 text-sm leading-relaxed">
            {category.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <Link
            href={`/${lang}/category/${category.slug}`}
            className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-semibold transition-colors"
          >
            {ctaLabel}
            <ArrowRight size={16} />
          </Link>
          {category.count > 0 && (
            <span className="text-faint text-xs whitespace-nowrap">
              {category.count} {articlesLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
