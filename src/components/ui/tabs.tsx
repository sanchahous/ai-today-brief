'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { nextRovingIndex } from '@/lib/ui/roving';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  ariaLabel: string;
  defaultTabId?: string;
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

/**
 * WAI-ARIA tabs with automatic activation: ←/→ move and select, Home/End jump, only the active tab is
 * in the tab order (roving tabindex). Inactive panels stay mounted but `hidden` so state survives.
 */
export function Tabs({ tabs, ariaLabel, defaultTabId, activeTabId, onTabChange, className = '' }: TabsProps) {
  const base = useId();
  const [inner, setInner] = useState(defaultTabId ?? tabs.find((t) => !t.disabled)?.id ?? '');
  const active = activeTabId ?? inner;
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const disabled = new Set(tabs.flatMap((t, i) => (t.disabled ? [i] : [])));

  const select = (id: string) => {
    if (activeTabId === undefined) setInner(id);
    onTabChange?.(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((t) => t.id === active);
    const next = nextRovingIndex(current, event.key, tabs.length, { orientation: 'horizontal', disabled });
    if (next === null) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    select(tabs[next].id);
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => select(tab.id)}
              className={`-mb-px min-h-[44px] shrink-0 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 ${
                selected ? 'border-accent text-text' : 'text-muted hover:text-text border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
