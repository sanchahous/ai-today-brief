import { categoryColor } from '@/lib/category-meta';
import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { HomeCoverageSegment } from '@/lib/home';
import type { Lang } from '@/lib/site';

/**
 * Shares of the newest published items (capped at 100). Widths use those
 * counts only — not an all-time total labelled as “latest 100”.
 */
export function CategoryMixBar({
  lang,
  segments = [],
  sampleSize = 0,
}: {
  lang: Lang;
  segments?: HomeCoverageSegment[];
  sampleSize?: number;
}) {
  const t = getStrings(lang).landing;
  const withCount = (segments ?? []).filter((segment) => segment.count > 0);
  let total = 0;
  for (const segment of withCount) total += segment.count;
  if (sampleSize < 2 || total === 0 || withCount.length < 2) return null;
  const caption = `${t.mixTitle} · ${t.mixSample.replace('{n}', String(sampleSize))}`;

  return (
    <figure className="max-w-3xl">
      <figcaption className="text-faint mb-2.5 text-2xs font-bold tracking-[0.12em] uppercase">
        {caption}
      </figcaption>
      <div
        role="img"
        aria-label={`${caption}: ${withCount.map((segment) => `${segment.name} — ${segment.count}`).join(', ')}`}
        className="border-border-soft flex h-3 w-full overflow-hidden rounded-pill border"
      >
        {withCount.map((segment) => (
          <span
            key={segment.slug}
            className="min-w-[2px]"
            style={{
              width: `${(segment.count / sampleSize) * 100}%`,
              background: categoryColor(segment.slug, segment.color),
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {withCount.map((segment) => (
          <li key={segment.slug}>
            <Link
              href={`/${lang}/category/${segment.slug}`}
              className="text-muted hover:text-text inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 text-xs transition-colors"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: categoryColor(segment.slug, segment.color) }}
              />
              {segment.name}
              <span className="text-faint font-semibold">{segment.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </figure>
  );
}
