'use client';

import { useEffect, type RefObject } from 'react';

/** Close on Escape and on pointer-down outside every ref in `insideRefs`. */
export function useDismissable(
  open: boolean,
  insideRefs: ReadonlyArray<RefObject<HTMLElement | null>>,
  onDismiss: (reason: 'escape' | 'outside') => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss('escape');
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && insideRefs.some((ref) => ref.current?.contains(target))) return;
      onDismiss('outside');
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
    // insideRefs is a fresh array each render; the refs themselves are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss]);
}
