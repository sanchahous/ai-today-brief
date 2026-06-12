'use client';

import { useEffect, type RefObject } from 'react';

export interface UseFocusTrapOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'details[open] summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
  if (element.offsetParent === null && getComputedStyle(element).position !== 'fixed') return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && isVisible(element),
  );
}

export function useFocusTrap({
  active,
  containerRef,
  returnFocusRef,
  initialFocusRef,
  onEscape,
}: UseFocusTrapOptions): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const explicitReturnFocus = returnFocusRef?.current ?? null;

    const focusTarget = initialFocusRef?.current ?? getFocusable(container)[0] ?? container;
    window.requestAnimationFrame(() => {
      if (container.isConnected && focusTarget.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      const focusable = getFocusable(currentContainer);
      if (focusable.length === 0) {
        event.preventDefault();
        currentContainer.focus({ preventScroll: true });
        return;
      }

      // Fully control Tab order so focus can never leave the dialog. Boundary-only
      // handling is not enough on some engines (notably WebKit/Safari), which do not
      // move focus to links/buttons on native Tab — letting focus escape the modal.
      event.preventDefault();
      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;
      let nextIndex: number;
      if (event.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        nextIndex =
          currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
      }
      focusable[nextIndex].focus({ preventScroll: true });
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const returnFocusTarget = explicitReturnFocus ?? previousFocus;
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef, onEscape, returnFocusRef]);
}
