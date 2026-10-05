'use client';

import { type ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
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
      <h3 className="font-serif text-text m-0 mb-2 text-xl font-medium tracking-tight">
        {title}
      </h3>
      <p className="text-muted m-0 mb-6 max-w-[420px] text-sm leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
