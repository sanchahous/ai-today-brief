import Link from 'next/link';
import { conceptIcon } from '@/lib/concept-meta';
import type { ConceptSummary } from '@/lib/concepts';
import type { Lang } from '@/lib/site';
import { ArrowRight, CategoryGlyph } from '@/components/icons';
import { Reveal } from '@/components/reveal';

function prettyType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ConceptsGrid({ lang, concepts }: { lang: Lang; concepts: ConceptSummary[] }) {
  const accent = '#f0c040';

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {concepts.map((c, i) => (
        <Reveal key={c.slug} delayMs={i * 40}>
          <Link
            href={`/${lang}/concepts/${c.slug}`}
            className="card-hover rounded-card border-border bg-surface flex h-full flex-col border p-5 no-underline transition"
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"
                style={{
                  color: accent,
                  background: 'rgba(240,192,64,0.1)',
                  borderColor: 'rgba(240,192,64,0.3)',
                }}
              >
                <CategoryGlyph icon={conceptIcon(c.slug, c.type)} size={20} strokeWidth={1.6} />
              </span>
              <span className="text-accent text-[0.68rem] font-bold tracking-wider uppercase">
                {prettyType(c.type)}
              </span>
            </div>
            <h2 className="text-text mb-2 text-lg leading-snug">{c.name}</h2>
            {c.description && (
              <p className="text-muted mb-4 line-clamp-3 flex-1 text-sm leading-relaxed">{c.description}</p>
            )}
            <span className="text-accent mt-auto inline-flex items-center gap-1 text-sm font-semibold">
              <ArrowRight size={14} />
            </span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
