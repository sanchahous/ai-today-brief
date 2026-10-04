import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { HomeFocusConcept } from '@/lib/home';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';

export function FocusStrip({ lang, concepts = [] }: { lang: Lang; concepts?: HomeFocusConcept[] }) {
  if (concepts.length === 0) return null;
  const t = getStrings(lang).landing;
  return (
    <nav aria-label={t.focusLabel} className="border-border-soft border-y">
      <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
        <span className="text-accent eyebrow">{t.focusLabel}</span>
        <ul className="flex flex-wrap gap-2">
          {concepts.map((concept) => (
            <li key={concept.slug}>
              <Link
                href={`/${lang}/concepts/${concept.slug}`}
                className="border-border text-text hover:border-accent hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-pill border px-3 text-sm font-semibold no-underline"
              >
                {concept.name}
                <ArrowRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
