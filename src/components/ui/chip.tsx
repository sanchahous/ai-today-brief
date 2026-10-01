'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CloseIcon } from '@/components/icons';
import { categoryColor as resolveCategoryColor } from '@/lib/category-meta';
import type { Lang } from '@/lib/site';
import { Button } from './button';
import { IconButton } from './icon-button';
import styles from './actions.module.css';

export interface FilterChipProps {
  label: string;
  lang?: Lang;
  active?: boolean;
  disabled?: boolean;
  pending?: boolean;
  categoryColor?: string | null;
  categorySlug?: string | null;
  count?: number;
  icon?: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  removeAriaLabel?: string;
  className?: string;
}

export function Chip({
  label, lang = 'en', active = false, disabled = false, pending = false,
  categoryColor, categorySlug, count, icon, onRemove, onClick, removeAriaLabel, className = '',
}: FilterChipProps) {
  const color = categorySlug || categoryColor ? resolveCategoryColor(categorySlug, categoryColor) : null;
  // CSS custom properties are not enumerated by React's CSSProperties type.
  const style = color ? { '--cat-color': color } as CSSProperties : undefined;
  const content = <>
    {color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
    {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
    <span className="min-w-0 truncate">{label}</span>
    {typeof count === 'number' && <span className="text-muted shrink-0 tabular-nums">{new Intl.NumberFormat(lang).format(count)}</span>}
  </>;

  if (!onRemove && onClick) return (
    <Button onClick={onClick} disabled={disabled} pending={pending} aria-pressed={active}
      size="sm" variant="outline" style={style} className={`!rounded-pill ${className}`}>
      <span className="inline-flex min-w-0 items-center gap-1.5">{content}</span>
    </Button>
  );

  return (
    <span style={style} className={`${styles.chip} ${active ? styles.chipActive : ''} border text-xs font-medium ${className}`}>
      {onClick ? <Button onClick={onClick} disabled={disabled} pending={pending} aria-pressed={active}
        size="sm" variant="ghost" className={`${styles.chipLabel} !px-1`}>
        <span className="inline-flex min-w-0 items-center gap-1.5">{content}</span>
      </Button> : <span className="inline-flex min-w-0 items-center gap-1.5">{content}</span>}
      {onRemove && <IconButton size="sm" disabled={disabled} pending={pending}
        aria-label={removeAriaLabel ?? (lang === 'uk' ? `Прибрати фільтр: ${label}` : `Remove filter: ${label}`)}
        onClick={(event) => { event.stopPropagation(); onRemove(); }}>
        <CloseIcon size={16} />
      </IconButton>}
    </span>
  );
}

export const FilterChip = Chip;
