'use client';

import { Button } from './button';
import { Notice } from './notice';

export interface ErrorStateProps {
  title: string;
  description: string;
  /** Omit both retry fields for a terminal error. */
  retryLabel?: string;
  onRetry?: () => void;
  pending?: boolean;
  /** Announced in a polite live region while and after a retry. */
  status?: string;
  retryTestId?: string;
  statusTestId?: string;
}

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  pending = false,
  status = '',
  retryTestId,
  statusTestId,
}: ErrorStateProps) {
  const recoverable = Boolean(retryLabel && onRetry);
  return (
    <div className="grid justify-items-start gap-3">
      <Notice tone="error" title={title}>
        {description}
      </Notice>
      {recoverable ? (
        <Button variant="outline" pending={pending} onClick={onRetry} data-testid={retryTestId}>
          {retryLabel}
        </Button>
      ) : null}
      {recoverable ? (
        <p role="status" data-testid={statusTestId} className="text-muted m-0 min-h-6 text-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}
