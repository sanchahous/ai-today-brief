'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { CloseIcon } from '@/components/icons';

export interface FilterChipProps {
  label: string;
  active?: boolean;
  categoryColor?: string | null;
  count?: number;
  icon?: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  removeAriaLabel?: string;
  className?: string;
}

export function FilterChip({
  label,
  active = false,
  categoryColor,
  count,
  icon,
  onRemove,
  onClick,
  removeAriaLabel,
  className = '',
}: FilterChipProps) {
  const content = (
    <>
      {categoryColor && (
        <span
          aria-hidden="true"
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: categoryColor }}
        />
      )}
      {icon && <span aria-hidden="true" className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
      {typeof count === 'number' && (
        <span className="text-muted ml-1 text-xs tabular-nums opacity-80">
          {count}
        </span>
      )}
    </>
  );

  const styleObj: CSSProperties = categoryColor
    ? ({ '--cat-color': categoryColor } as CSSProperties)
    : {};

  if (onRemove) {
    return (
      <span
        style={styleObj}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition min-h-[32px] ${
          active
            ? 'border-accent/50 bg-accent/15 text-accent'
            : 'border-border bg-surface text-text'
        } ${className}`}
      >
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-1.5 cursor-pointer text-left bg-transparent border-0 p-0 text-inherit font-inherit"
          >
            {content}
          </button>
        ) : (
          content
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeAriaLabel ?? `Remove filter ${label}`}
          className="text-muted hover:text-text hover:bg-surface-2 ml-0.5 inline-flex size-5 items-center justify-center rounded-full transition cursor-pointer"
        >
          <CloseIcon size={12} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={styleObj}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer min-h-[36px] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-(--focus-offset) ${
        active
          ? 'border-accent bg-accent text-on-accent font-semibold shadow-sm'
          : 'border-border bg-surface text-text hover:border-accent hover:text-accent'
      } ${className}`}
    >
      {content}
    </button>
  );
}
