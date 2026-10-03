'use client';

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  lockBodyScroll,
  unlockBodyScroll,
  type BodyScrollLockSnapshot,
} from '@/lib/body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import styles from './overlay.module.css';

export type OverlayDrawerPlacement = 'center' | 'top' | 'left' | 'right' | 'fullscreen';

export interface OverlayDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  id?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  placement?: OverlayDrawerPlacement;
  panelClassName?: string;
  overlayClassName?: string;
  panelTestId?: string;
  backdropTestId?: string;
  children: ReactNode;
}

/**
 * The only modal focus trap and body-scroll lock in the product.
 * `Dialog` (centre, left, right, full) is a shell on top of this component.
 * Header, news filters still call it directly until AH-3.3 and AH-4.3.
 * Non-modal disclosures use `useDismissable` and do not trap focus.
 */

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const SIDE_PANEL =
  'overlay-panel-viewport h-full w-[min(380px,92vw)] overflow-y-auto overscroll-y-contain';

function placementClasses(placement: OverlayDrawerPlacement): { overlay: string; panel: string } {
  switch (placement) {
    case 'left':
      return { overlay: 'items-stretch justify-start', panel: SIDE_PANEL };
    case 'right':
      return { overlay: 'items-stretch justify-end', panel: SIDE_PANEL };
    case 'top':
      return {
        overlay: 'items-start justify-center',
        panel: 'max-h-[90vh] w-full overflow-y-auto overscroll-y-contain',
      };
    case 'center':
      return {
        overlay: 'items-center justify-center p-4',
        panel:
          'max-h-[90vh] w-[min(560px,calc(100vw-2rem))] overflow-y-auto overscroll-y-contain rounded-card',
      };
    case 'fullscreen':
      return {
        overlay: 'items-stretch justify-stretch',
        panel: 'overlay-panel-viewport w-full overflow-y-auto overscroll-y-contain',
      };
    default: {
      const exhaustive: never = placement;
      return exhaustive;
    }
  }
}

export function OverlayDrawer({
  open,
  onOpenChange,
  labelledBy,
  describedBy,
  ariaLabel,
  id,
  triggerRef,
  initialFocusRef,
  placement = 'fullscreen',
  panelClassName,
  overlayClassName,
  panelTestId,
  backdropTestId,
  children,
}: OverlayDrawerProps): React.ReactPortal | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const lockSnapshotRef = useRef<BodyScrollLockSnapshot | null>(null);
  const classes = placementClasses(placement);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    lockSnapshotRef.current = lockBodyScroll();
    return () => {
      unlockBodyScroll(lockSnapshotRef.current);
      lockSnapshotRef.current = null;
    };
  }, [open]);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    returnFocusRef: triggerRef,
    initialFocusRef,
    onEscape: close,
  });

  if (!open || typeof document === 'undefined') return null;

  if (!ariaLabel && !labelledBy) {
    throw new Error('OverlayDrawer requires either ariaLabel or labelledBy.');
  }

  return createPortal(
    <div
      className={cx('fixed inset-0 z-[var(--z-modal)] flex bg-black/60', classes.overlay, overlayClassName)}
      data-testid={backdropTestId}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Keep focus from moving to the document before the trap restores the trigger.
        event.preventDefault();
        close();
      }}
    >
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-testid={panelTestId}
        data-placement={placement}
        className={cx('bg-bg shadow-pop outline-none', styles.panel, classes.panel, panelClassName)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
