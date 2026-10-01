import type { CSSProperties } from 'react';
import { CategoryGlyph } from '@/components/icons';
import { categoryColor, categoryMeta } from '@/lib/category-meta';
import styles from './actions.module.css';

export interface CategoryBadgeProps {
  name: string | null;
  slug: string | null;
  color: string | null;
  size?: 'sm' | 'md';
  variant?: 'default' | 'plain' | 'dot';
  className?: string;
}

export function CategoryBadge({ name, slug, color, size = 'sm', variant = 'default', className = '' }: CategoryBadgeProps) {
  if (!name) return null;
  // CSS custom properties are not enumerated by React's CSSProperties type.
  const style = { '--cat-color': categoryColor(slug, color) } as CSSProperties;
  return <span style={style}
    className={`cat-badge ${styles.category} ${variant === 'plain' ? styles.plain : ''} inline-flex items-center rounded-pill font-semibold ${size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-2xs'} ${className}`}>
    {variant === 'dot' ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      : <CategoryGlyph icon={categoryMeta(slug).icon} size={16} className="shrink-0" />}
    <span className="min-w-0 truncate">{name}</span>
  </span>;
}
