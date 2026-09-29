'use client';

import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from 'react';

export interface TooltipProps {
  /** Short, non-interactive text. Never the only place important information lives. */
  content: string;
  /** A single focusable element; it receives `aria-describedby` and hover/focus handlers. */
  children: ReactElement<Record<string, unknown>>;
  delayMs?: number;
}

/**
 * Supplementary label shown on hover and keyboard focus, dismissed with Escape (WCAG 1.4.13:
 * dismissible, hoverable, persistent). Not shown on touch — do not hide required info here.
 */
export function Tooltip({ content, children, delayMs = 300 }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (immediate: boolean) => {
    clear();
    if (immediate) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    clear();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clear();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => clear, []);

  // Handlers sit on the wrapper (focus/blur bubble in React); only the ARIA link goes on the trigger.
  const child = cloneElement(children, { 'aria-describedby': open ? id : undefined });

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {child}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="bg-overlay text-text rounded-md absolute bottom-full left-1/2 z-[var(--z-dropdown)] mb-2 w-max max-w-64 -translate-x-1/2 px-3 py-1.5 text-xs shadow-[var(--shadow-pop)]"
        >
          {content}
        </span>
      )}
    </span>
  );
}
