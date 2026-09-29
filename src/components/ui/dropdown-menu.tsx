'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactElement } from 'react';
import { nextRovingIndex, typeaheadIndex } from '@/lib/ui/roving';
import { Popover, type PopoverAlign, type PopoverRenderProps } from './popover';

export interface DropdownMenuItem {
  id: string;
  label: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface DropdownMenuProps {
  trigger: (props: PopoverRenderProps) => ReactElement;
  items: DropdownMenuItem[];
  ariaLabel: string;
  align?: PopoverAlign;
}

const ITEM_CLASS =
  'hover:bg-surface-2 focus-visible:bg-surface-2 flex min-h-[44px] w-full items-center rounded-md px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

function MenuList({
  items,
  ariaLabel,
  close,
}: {
  items: DropdownMenuItem[];
  ariaLabel: string;
  close: () => void;
}) {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const typed = useRef({ text: '', at: 0 });
  const disabled = new Set(items.flatMap((item, i) => (item.disabled ? [i] : [])));

  useEffect(() => {
    refs.current[items.findIndex((item) => !item.disabled)]?.focus();
    // Focus the first enabled item once, when the menu mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = refs.current.findIndex((el) => el === document.activeElement);
    if (event.key === 'Tab') {
      close();
      return;
    }
    let next = nextRovingIndex(current, event.key, items.length, { orientation: 'vertical', disabled });
    if (next === null && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const fresh = now - typed.current.at > 700;
      typed.current = { text: fresh ? event.key : typed.current.text + event.key, at: now };
      next = typeaheadIndex(
        items.map((item) => item.label),
        typed.current.text,
        fresh ? current : current - 1,
      );
    }
    if (next !== null) {
      event.preventDefault();
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="menu" aria-label={ariaLabel} aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col">
      {items.map((item, i) => {
        const className = `${ITEM_CLASS} ${item.destructive ? 'text-error' : 'text-text'}`;
        const setRef = (el: HTMLElement | null) => {
          refs.current[i] = el;
        };
        const select = () => {
          if (item.disabled) return;
          item.onSelect?.();
          close();
        };
        return item.href && !item.disabled ? (
          <a key={item.id} role="menuitem" tabIndex={-1} className={className} href={item.href} ref={setRef} onClick={select}>
            {item.label}
          </a>
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={item.disabled || undefined}
            className={className}
            ref={setRef}
            onClick={select}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Action menu (WAI-ARIA menu button): ↑/↓/Home/End move, typeahead, Enter/Space select, Esc closes to trigger. */
export function DropdownMenu({ trigger, items, ariaLabel, align }: DropdownMenuProps) {
  return (
    <Popover trigger={trigger} align={align} role="menu" ariaLabel={ariaLabel} panelClassName="p-1">
      {({ close }) => <MenuList items={items} ariaLabel={ariaLabel} close={close} />}
    </Popover>
  );
}
