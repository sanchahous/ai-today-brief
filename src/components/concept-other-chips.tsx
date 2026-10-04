import { Tag } from '@/components/ui/tag';
import { conceptIcon } from '@/lib/concept-meta';
import type { ConceptSummary } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { ArrowRight, CategoryGlyph } from '@/components/icons';

export function ConceptOtherChips({
  lang,
  concepts,
  title,
  headingId = 'other-concepts-title',
  variant = 'section',
}: {
  lang: Lang;
  concepts: ConceptSummary[];
  /** Section heading — defaults to the "Other concepts" label. */
  title?: string;
  headingId?: string;
  /** `rail` is the compact daily-brief aside; `section` is the concept-page block. */
  variant?: 'section' | 'rail';
}) {
  if (concepts.length === 0) return null;
  const t = getStrings(lang);
  const heading = title ?? t.conceptOther;

  if (variant === 'rail') {
    return (
      <section className="rounded-card border-border bg-surface border p-4" aria-labelledby={headingId}>
        <h2 id={headingId} className="m-0 mb-3 text-sm font-semibold">
          {heading}
        </h2>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {concepts.map((c) => (
            <li key={c.slug}>
              <Tag href={`/${lang}/concepts/${c.slug}`} size="md">
                <span className="text-accent inline-flex">
                  <CategoryGlyph icon={conceptIcon(c.slug, c.type)} size={16} strokeWidth={1.7} />
                </span>
                {c.name}
              </Tag>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="mt-12" aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-4 text-xl">
        {heading}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {concepts.map((c) => (
          <Tag
            key={c.slug}
            href={`/${lang}/concepts/${c.slug}`}
            size="md"
          >
            <span className="text-accent inline-flex">
              <CategoryGlyph icon={conceptIcon(c.slug, c.type)} size={16} strokeWidth={1.7} />
            </span>
            {c.name}
            <ArrowRight size={14} className="text-accent" />
          </Tag>
        ))}
      </div>
    </section>
  );
}
