'use client';

import { useId, type ReactNode, type RefObject } from 'react';
import { OverlayDrawer } from './overlay-drawer';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Action row, usually a primary and a secondary `Button`. */
  footer?: ReactNode;
  /** Element to refocus on close (the button that opened the dialog). */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Element focused on open; defaults to the first focusable inside. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Localised accessible name for the × button. */
  closeLabel?: string;
  children?: ReactNode;
}

/**
 * Modal dialog: focus trap, Esc and backdrop close, body scroll lock, focus return — all from
 * `OverlayDrawer`. Adds the title/description/footer structure so every modal reads the same.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  triggerRef,
  initialFocusRef,
  closeLabel = 'Close',
  children,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <OverlayDrawer
      open={open}
      onOpenChange={onOpenChange}
      labelledBy={titleId}
      placement="center"
      triggerRef={triggerRef}
      initialFocusRef={initialFocusRef}
      panelClassName="border-border border"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="m-0 font-serif text-xl leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
            className="text-muted hover:text-text -mt-2 -mr-2 inline-flex size-[44px] shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {description && (
          <p id={descId} className="text-muted m-0 text-sm">
            {description}
          </p>
        )}
        {children}
        {footer && <div className="mt-2 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </OverlayDrawer>
  );
}
