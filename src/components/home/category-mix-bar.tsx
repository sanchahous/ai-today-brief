import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import type { HomeCategory } from '@/lib/home';

/**
 * Real-data visual layer for the hero: one stacked bar showing how published
 * stories distribute across the top categories, with a clickable legend.
 * Pure server render — counts come from `getHomeData` (already fetched).
 */
export function CategoryMixBar({ lang, categories }: { lang: Lang; categories: HomeCategory[] }) {
  const t = getStrings(lang).landing;
  const withCount = categories.filter((c) => c.count > 0);
  const total = withCount.reduce((sum, c) => sum + c.count, 0);
  if (total === 0 || withCount.length < 2) return null;

  return (
    <figure className="mt-10 max-w-2xl">
      <figcaption className="text-faint mb-2.5 text-[0.72rem] font-bold tracking-[0.12em] uppercase">
        {t.mixTitle}
      </figcaption>
      <div
        role="img"
        aria-label={`${t.mixTitle}: ${withCount.map((c) => `${c.name} — ${c.count}`).join(', ')}`}
        className="border-border-soft flex h-3 w-full overflow-hidden rounded-pill border"
      >
        {withCount.map((c) => (
          <span
            key={c.slug}
            className="min-w-[2px]"
            style={{
              width: `${(c.count / total) * 100}%`,
              background: c.color ?? 'var(--color-accent)',
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {withCount.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${lang}/category/${c.slug}`}
              className="text-muted hover:text-text inline-flex items-center gap-1.5 text-xs transition-colors"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: c.color ?? 'var(--color-accent)' }}
              />
              {c.name}
              <span className="text-faint font-semibold">{c.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
