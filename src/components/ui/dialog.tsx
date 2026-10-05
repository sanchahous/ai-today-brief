'use client';

import { useId, type ReactNode, type RefObject } from 'react';
import { OverlayDrawer, type OverlayDrawerPlacement } from './overlay-drawer';

export type DialogVariant = 'center' | 'left' | 'right' | 'full';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Centre dialog, or a sheet anchored to the left, right, or full viewport. */
  variant?: DialogVariant;
  /** Action row, usually a primary and a secondary `Button`. */
  footer?: ReactNode;
  /** Element to refocus on close (the button that opened the dialog). */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Element focused on open; defaults to the first focusable inside. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Localised accessible name for the × button. */
  closeLabel?: string;
  id?: string;
  panelTestId?: string;
  backdropTestId?: string;
  children?: ReactNode;
}

function placementFor(variant: DialogVariant): OverlayDrawerPlacement {
  switch (variant) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'full':
      return 'fullscreen';
    case 'center':
      return 'center';
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

/**
 * Modal dialog and sheets. Focus trap, Escape, backdrop close, scroll lock and focus return
 * all come from `OverlayDrawer` — this component only adds the title, description and footer.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'center',
  footer,
  triggerRef,
  initialFocusRef,
  closeLabel = 'Close',
  id,
  panelTestId,
  backdropTestId,
  children,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <OverlayDrawer
      id={id}
      open={open}
      onOpenChange={onOpenChange}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      placement={placementFor(variant)}
      triggerRef={triggerRef}
      initialFocusRef={initialFocusRef}
      panelClassName="border-line border"
      panelTestId={panelTestId}
      backdropTestId={backdropTestId}
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
            className="text-muted hover:text-text -mt-2 -mr-2 inline-flex size-[var(--touch-target-min)] shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {description ? (
          <p id={descId} className="text-muted m-0 text-sm">
            {description}
          </p>
        ) : null}
        {children}
        {footer ? <div className="mt-2 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </OverlayDrawer>
  );
}
