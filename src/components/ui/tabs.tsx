'use client';

import { useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
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

export interface LinkTabItem {
  id: string;
  label: string;
  href: string;
  count?: number | string;
  isActive?: boolean;
}

export interface LinkTabsProps {
  tabs: LinkTabItem[];
  ariaLabel: string;
  activeTabId?: string;
  wrap?: boolean;
  onTabClick?: (e: MouseEvent<HTMLAnchorElement>, tab: LinkTabItem) => void;
  className?: string;
}

/**
 * Link-based navigation tabs with `aria-current="page"` for URL-state subnavigation.
 * Renders semantic <nav> and <a> links.
 */
export function LinkTabs({
  tabs,
  ariaLabel,
  activeTabId,
  wrap = false,
  onTabClick,
  className = '',
}: LinkTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={`tabs ${className}`.trim()}>
      <ul
        className={`flex gap-1 ${
          wrap ? 'flex-wrap overflow-visible' : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }`}
      >
        {tabs.map((tab) => {
          const selected = activeTabId !== undefined ? tab.id === activeTabId : Boolean(tab.isActive);
          return (
            <li key={tab.id} className="shrink-0">
              <a
                href={tab.href}
                aria-current={selected ? 'page' : undefined}
                onClick={(e) => onTabClick?.(e, tab)}
                className={`focus-visible:ring-2 focus-visible:ring-[var(--focus)] inline-flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors select-none outline-none ${
                  selected
                    ? 'bg-text text-bg font-medium'
                    : 'text-muted hover:text-text hover:bg-[var(--tint-hover)]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-xs ${
                      selected
                        ? 'bg-[color-mix(in_srgb,var(--bg)_20%,transparent)] text-bg font-semibold'
                        : 'bg-[var(--surface-raised)] text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
