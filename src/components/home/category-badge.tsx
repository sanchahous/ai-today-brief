import type { CSSProperties } from 'react';
import { categoryColor } from '@/lib/category-meta';

/**
 * Category name as a coloured pill; known slugs follow the current theme palette.
 */
export function CategoryBadge({
  name,
  slug,
  color,
  size = 'sm',
}: {
  name: string | null;
  slug: string | null;
  color: string | null;
  size?: 'sm' | 'md';
}) {
  if (!name) return null;
  const c = categoryColor(slug, color);
  const sizeClasses = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-2xs';
  return (
    <span
      className={`cat-badge rounded-pill inline-flex items-center font-semibold tracking-wide whitespace-nowrap uppercase ${sizeClasses}`}
      style={{ '--cat-color': c } as CSSProperties}
    >
      {name}
    </span>
  );
}
