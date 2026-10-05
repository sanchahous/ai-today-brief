'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useDismissable } from '@/hooks/use-dismissable';

export interface DisclosureNavLink {
  id: string;
  href: string;
  label: string;
}

export interface DisclosureNavProps {
  /** Accessible name of the trigger and the navigation landmark. */
  label: string;
  links: readonly DisclosureNavLink[];
  closeLabel: string;
}

/**
 * Navigation disclosure: real links, not a `role="menu"`.
 * Escape, the backdrop and the close button dismiss it and return focus to the trigger.
 * It does not trap Tab or lock scroll — those belong only to `OverlayDrawer`.
 * `aria-haspopup` is omitted because `true` is announced as a menu.
 */
export function DisclosureNav({ label, links, closeLabel }: DisclosureNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeToTrigger = useCallback(() => {
    setOpen(false);
    const trigger = triggerRef.current;
    // After mouseup, so the backdrop click cannot leave focus on the page underneath.
    window.setTimeout(() => {
      trigger?.focus();
    }, 0);
  }, []);

  const onDismiss = useCallback(() => {
    closeToTrigger();
  }, [closeToTrigger]);

  useDismissable(open, [rootRef], onDismiss);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className="bg-surface border-line text-text min-h-[var(--touch-target-min)] rounded-lg border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div
          data-testid="disclosure-backdrop"
          className="fixed inset-0 z-[var(--z-dropdown)] bg-black/45"
          onMouseDown={(event) => {
            event.preventDefault();
            closeToTrigger();
          }}
        />
      ) : null}
      <nav
        id={panelId}
        aria-label={label}
        hidden={!open}
        className="bg-raised border-line rounded-card absolute top-full left-0 z-[var(--z-dropdown)] mt-2 min-w-56 border p-2 shadow-[var(--shadow-pop)]"
      >
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                className="text-text hover:bg-raised focus-visible:bg-raised flex min-h-[var(--touch-target-min)] items-center rounded-md px-3 text-sm no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-muted hover:text-text mt-1 flex min-h-[var(--touch-target-min)] w-full items-center rounded-md px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          onClick={closeToTrigger}
        >
          {closeLabel}
        </button>
      </nav>
    </div>
  );
}
