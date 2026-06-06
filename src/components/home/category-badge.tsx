import type { CSSProperties } from 'react';

/**
 * Category name as a coloured pill. The colour comes from the DB row (dynamic),
 * exposed via `--cat-color` so `.theme-light` can darken neon tints for readability.
 */
export function CategoryBadge({
  name,
  color,
  size = 'sm',
}: {
  name: string | null;
  color: string | null;
  size?: 'sm' | 'md';
}) {
  if (!name) return null;
  const c = color ?? '#888888';
  const sizeClasses = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[0.68rem]';
  return (
    <span
      className={`cat-badge rounded-pill inline-flex items-center font-semibold tracking-wide whitespace-nowrap uppercase ${sizeClasses}`}
      style={{ '--cat-color': c } as CSSProperties}
    >
      {name}
    </span>
  );
}
