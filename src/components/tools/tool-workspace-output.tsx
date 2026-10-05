'use client';

import { type ReactNode } from 'react';
import { Button, Notice } from '@/components/ui';

export type ToolOutputState = 'draft' | 'ready' | 'copied' | 'export-error';

export interface ToolWorkspaceOutputProps {
  state: ToolOutputState;
  draftMessage: string;
  exportErrorMessage?: string;
  children?: ReactNode;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: () => void;
  showCopy?: boolean;
  footnote?: ReactNode;
}

export function ToolWorkspaceOutput({
  state,
  draftMessage,
  exportErrorMessage,
  children,
  copyLabel,
  copiedLabel,
  onCopy,
  showCopy = false,
  footnote,
}: ToolWorkspaceOutputProps) {
  const copyEnabled = showCopy && (state === 'ready' || state === 'export-error') && Boolean(onCopy);

  return (
    <div className="grid gap-4">
      <div aria-live="polite" className="min-h-[12rem]">
        {state === 'draft' ? (
          <p className="panel-empty m-0 text-muted text-sm leading-relaxed">{draftMessage}</p>
        ) : (
          children
        )}
      </div>

      {state === 'export-error' && exportErrorMessage ? (
        <Notice tone="error">{exportErrorMessage}</Notice>
      ) : null}

      {showCopy ? (
        <Button
          type="button"
          variant="primary"
          disabled={!copyEnabled}
          onClick={onCopy}
          className="w-fit min-h-[44px]"
        >
          {state === 'copied' ? copiedLabel : copyLabel}
        </Button>
      ) : null}

      {footnote ? (
        <p className="field-note m-0 text-muted text-sm leading-relaxed">{footnote}</p>
      ) : null}
    </div>
  );
}
