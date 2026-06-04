import Link from 'next/link';
import { conceptIcon } from '@/lib/concept-meta';
import type { ConceptSummary } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { ArrowRight, CategoryGlyph } from '@/components/icons';

export function ConceptOtherChips({
  lang,
  concepts,
}: {
  lang: Lang;
  concepts: ConceptSummary[];
}) {
  if (concepts.length === 0) return null;
  const t = getStrings(lang);
  const accent = '#f0c040';

  return (
    <section className="mt-12" aria-labelledby="other-concepts-title">
      <h2 id="other-concepts-title" className="mb-4 text-xl">
        {t.conceptOther}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {concepts.map((c) => (
          <Link
            key={c.slug}
            href={`/${lang}/concepts/${c.slug}`}
            className="rounded-pill border-border bg-surface text-text hover:border-accent inline-flex items-center gap-2 border px-3.5 py-2 text-[0.9rem] font-semibold no-underline transition"
          >
            <span className="inline-flex" style={{ color: accent }}>
              <CategoryGlyph icon={conceptIcon(c.slug, c.type)} size={16} strokeWidth={1.7} />
            </span>
            {c.name}
            <ArrowRight size={14} className="text-accent" />
          </Link>
        ))}
      </div>
    </section>
  );
}
