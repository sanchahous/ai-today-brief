'use client';

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDismissable } from '@/hooks/use-dismissable';
import { computePlacement, type Placement } from '@/lib/ui/placement';

export type PopoverAlign = 'start' | 'end';

export interface PopoverRenderProps {
  open: boolean;
  toggle: () => void;
  triggerProps: {
    ref: RefObject<HTMLButtonElement | null>;
    'aria-haspopup': 'dialog' | 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick: () => void;
  };
}

export interface PopoverProps {
  /** Render the trigger; spread `triggerProps` onto a `<button>` (or `Button`). */
  trigger: (props: PopoverRenderProps) => ReactElement;
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  align?: PopoverAlign;
  /** ARIA role of the panel: non-modal `dialog` for content, `menu` when used by DropdownMenu. */
  role?: 'dialog' | 'menu';
  ariaLabel?: string;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function PanelContent({ render, close }: { render: PopoverProps['children']; close: () => void }) {
  return <>{typeof render === 'function' ? render({ close }) : render}</>;
}

/**
 * Non-modal disclosure panel anchored to its trigger.
 * Escape and outside pointer-down close it; Escape returns focus to the trigger.
 * Opens below the trigger and flips above / to the other alignment when it would leave the viewport.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  role = 'dialog',
  ariaLabel,
  panelClassName = '',
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>({ vertical: 'bottom', horizontal: align });

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  const onDismiss = useCallback(
    (reason: 'escape' | 'outside') => {
      setOpen(false);
      if (reason === 'escape') triggerRef.current?.focus();
    },
    [setOpen],
  );
  useDismissable(open, [rootRef], onDismiss);

  // Measure after paint of the open panel; re-measure on resize. Falls back to the CSS default.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      const trig = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!trig || !panel) return;
      setPlacement(
        computePlacement(trig, panel, { width: window.innerWidth, height: window.innerHeight }, align),
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, align]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger({
        open,
        toggle: () => setOpen(!open),
        triggerProps: {
          ref: triggerRef,
          'aria-haspopup': role,
          'aria-expanded': open,
          'aria-controls': panelId,
          onClick: () => setOpen(!open),
        },
      })}
      <div
        id={panelId}
        ref={panelRef}
        data-placement={`${placement.vertical}-${placement.horizontal}`}
        // A menu panel is a plain wrapper: DropdownMenu renders the role="menu" element itself.
        role={role === 'dialog' ? 'dialog' : undefined}
        aria-label={role === 'dialog' ? ariaLabel : undefined}
        hidden={!open}
        className={`bg-raised border-border text-text rounded-card absolute z-[var(--z-dropdown)] min-w-48 max-w-[min(22rem,calc(100vw-2rem))] border p-2 shadow-[var(--shadow-pop)] ${
          placement.vertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        } ${placement.horizontal === 'end' ? 'right-0' : 'left-0'} ${panelClassName}`}
      >
        {open ? <PanelContent render={children} close={close} /> : null}
      </div>
    </div>
  );
}
