'use client';

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  lockBodyScroll,
  unlockBodyScroll,
  type BodyScrollLockSnapshot,
} from '@/lib/body-scroll-lock';
import { useFocusTrap } from '@/hooks/use-focus-trap';

export type OverlayDrawerPlacement = 'center' | 'top' | 'right' | 'fullscreen';

export interface OverlayDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelledBy?: string;
  ariaLabel?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  placement?: OverlayDrawerPlacement;
  panelClassName?: string;
  overlayClassName?: string;
  panelTestId?: string;
  backdropTestId?: string;
  children: ReactNode;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function placementClasses(placement: OverlayDrawerPlacement): { overlay: string; panel: string } {
  switch (placement) {
    case 'right':
      return {
        overlay: 'items-stretch justify-end',
        panel:
          'overlay-panel-viewport h-full w-[min(380px,92vw)] overflow-y-auto overscroll-y-contain',
      };
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
    default:
      return {
        overlay: 'items-stretch justify-stretch',
        panel: 'overlay-panel-viewport w-full overflow-y-auto overscroll-y-contain',
      };
  }
}

export function OverlayDrawer({
  open,
  onOpenChange,
  labelledBy,
  ariaLabel,
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
      className={cx('fixed inset-0 z-[120] flex bg-black/60', classes.overlay, overlayClassName)}
      data-testid={backdropTestId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-testid={panelTestId}
        className={cx('bg-bg shadow-pop outline-none', classes.panel, panelClassName)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
