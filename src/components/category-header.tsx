import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CategoryGlyph, ArrowRight } from '@/components/icons';
import type { CategoryHubView } from '@/lib/categories';
import { categoryColor } from '@/lib/category-meta';
import { getStrings } from '@/lib/i18n';
import { pluralLabel } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import { Tag } from '@/components/ui/tag';

export function CategoryHeader({ lang, hub }: { lang: Lang; hub: CategoryHubView }) {
  const t = getStrings(lang);
  const color = categoryColor(hub.slug, hub.color);
  const catStyle = { '--cat-color': color } as CSSProperties;
  const countLabel = pluralLabel(hub.items.length, lang, 'stories');
  const primerConcepts = hub.primerConcepts ?? [];
  const subtopics = hub.subtopics ?? [];

  return (
    <div className="mb-8">
      <header
        className="cat-header rounded-card mb-6 flex flex-col sm:flex-row items-start gap-5 p-6 sm:p-7"
        style={catStyle}
      >
        <span
          aria-hidden="true"
          className="cat-icon-box grid h-16 w-16 shrink-0 place-items-center rounded-[18px]"
          style={catStyle}
        >
          <CategoryGlyph icon={hub.icon} size={34} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-accent eyebrow mb-1">{t.categoryEyebrow}</p>
          <h1 className="mb-2 text-[clamp(1.75rem,4vw,2.5rem)] font-display font-medium leading-[1.15]">
            {hub.name}
          </h1>
          {hub.description ? (
            <p className="text-muted m-0 mb-3 max-w-[680px] text-[0.98rem] leading-relaxed">
              {hub.description}
            </p>
          ) : hub.tagline ? (
            <p className="text-muted m-0 mb-3 max-w-[680px] text-[0.98rem] leading-relaxed">
              {hub.tagline}
            </p>
          ) : null}
          <p className="cat-fg hub-meta m-0 text-xs font-mono uppercase tracking-[0.06em]" style={catStyle}>
            {hub.items.length} {countLabel}
            {hub.updatedDaily ? ` · ${t.updatedDaily}` : ''}
          </p>
          {subtopics.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-faint text-[0.78rem] font-mono uppercase tracking-[var(--tracking-eyebrow)]">
                {t.subtopicsLabel}:
              </span>
              <ul className="flex flex-wrap items-center gap-2 list-none p-0 m-0" aria-label={t.subtopicsLabel}>
                {subtopics.map((st) => (
                  <li key={st}>
                    <Link
                      href={`/${lang}/news/search?q=${encodeURIComponent(st)}`}
                      className="cat-chip rounded-pill inline-flex items-center px-3 py-1 text-[0.82rem] font-medium no-underline transition hover:border-[var(--cat-color)] [@media(pointer:coarse)]:min-h-[44px]"
                      style={catStyle}
                    >
                      {st}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      {(primerConcepts.length > 0 || hub.relatedGuide) && (
        <CategoryPrimer lang={lang} hub={hub} primerConcepts={primerConcepts} />
      )}
    </div>
  );
}

export function CategoryPrimer({
  lang,
  hub,
  primerConcepts = hub.primerConcepts ?? [],
}: {
  lang: Lang;
  hub: CategoryHubView;
  primerConcepts?: CategoryHubView['primerConcepts'];
}) {
  const t = getStrings(lang);
  return (
    <section
      className="primer rounded-card border-border/80 bg-surface/60 mb-6 flex flex-wrap items-center justify-between gap-4 border p-4 sm:p-5"
      aria-labelledby="primer-title"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="primer-title" className="eyebrow text-accent m-0 text-xs font-bold uppercase tracking-[var(--tracking-eyebrow)]">
          {t.primerTitle}
        </h2>
        {primerConcepts.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            {primerConcepts.map((concept) => (
              <li key={concept.slug}>
                <Tag href={`/${lang}/concepts/${concept.slug}`} size="sm">
                  {concept.name}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hub.relatedGuide && (
        <Link
          href={`/${lang}/guides/${hub.relatedGuide.slug}`}
          className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline [@media(pointer:coarse)]:min-h-[44px]"
        >
          <span>
            {t.relatedGuide}: {hub.relatedGuide.title}
          </span>
          <ArrowRight size={15} />
        </Link>
      )}
    </section>
  );
}

