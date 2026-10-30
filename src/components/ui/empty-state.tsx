'use client';

import { type ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /**
   * Level of the title. Match the headings the empty state stands in for, so the outline
   * never jumps (e.g. h1 → h3 when a feed of h2 cards comes back empty). Size is set by
   * class, not by the tag.
   */
  headingLevel?: 'h2' | 'h3';
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
  headingLevel: Heading = 'h3',
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={`rounded-card border-line/80 bg-surface/50 flex flex-col items-center justify-center border border-dashed px-6 py-14 text-center ${className}`}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="text-muted bg-raised mb-4 flex size-12 items-center justify-center rounded-full"
        >
          {icon}
        </div>
      )}
      <Heading className="font-serif text-text m-0 mb-2 text-xl font-medium tracking-tight">
        {title}
      </Heading>
      <p className="text-muted m-0 mb-6 max-w-[420px] text-sm leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
