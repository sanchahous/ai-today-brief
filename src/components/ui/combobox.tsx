'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDismissable } from '@/hooks/use-dismissable';
import { filterOptions, type ComboboxOption } from '@/lib/ui/combobox-filter';

export interface ComboboxProps {
  label: string;
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  /** Localised "N results" announcement, e.g. `(n) => \`${n} результатів\``. */
  resultsText?: (count: number) => string;
  className?: string;
}

/**
 * WAI-ARIA 1.2 combobox with list autocomplete. Focus stays in the input; the highlighted option is
 * exposed through `aria-activedescendant`. ↓/↑ move, Home/End jump, Enter selects, Esc closes then clears.
 */
export function Combobox({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  emptyText = 'No matches',
  resultsText = (n) => `${n} results`,
  className = '',
}: ComboboxProps) {
  const base = useId();
  const listId = `${base}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const selectable = shown.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const inputValue = open ? query : (selected?.label ?? '');

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  useDismissable(open, [rootRef], close);

  const move = (delta: 1 | -1) => {
    if (!open) setOpen(true);
    if (selectable.length === 0) return;
    const at = selectable.indexOf(active);
    setActive(selectable[(at + delta + selectable.length) % selectable.length]);
  };

  const choose = (option: ComboboxOption | undefined) => {
    if (!option || option.disabled) return;
    onValueChange(option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
      case 'End':
        if (open && selectable.length) {
          event.preventDefault();
          setActive(selectable[event.key === 'Home' ? 0 : selectable.length - 1]);
        }
        break;
      case 'Enter':
        if (open) {
          event.preventDefault();
          choose(shown[active]);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (value !== null) {
          onValueChange(null);
        }
        break;
      case 'Tab':
        close();
        break;
      default:
    }
  };

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={`${base}-input`} className="text-muted text-xs font-medium">
        {label}
      </label>
      <input
        id={`${base}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${base}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="bg-surface border-border text-text min-h-[44px] w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="bg-raised border-border rounded-card absolute top-full right-0 left-0 z-[var(--z-dropdown)] mt-2 max-h-64 overflow-y-auto border p-1 shadow-[var(--shadow-pop)]"
      >
        {shown.map((option, i) => (
          <li
            key={option.value}
            id={`${base}-opt-${i}`}
            role="option"
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            // Keep focus in the input: selecting on mousedown avoids a blur race.
            onMouseDown={(e) => {
              e.preventDefault();
              choose(option);
            }}
            onMouseMove={() => !option.disabled && setActive(i)}
            className={`flex min-h-[44px] cursor-pointer items-center justify-between rounded-md px-3 text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ${
              i === active ? 'bg-surface-2' : ''
            } ${option.value === value ? 'text-accent font-semibold' : 'text-text'}`}
          >
            {option.label}
            {option.value === value && <span aria-hidden="true">✓</span>}
          </li>
        ))}
        {shown.length === 0 && <li className="text-muted px-3 py-3 text-sm">{emptyText}</li>}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {open ? (shown.length ? resultsText(shown.length) : emptyText) : ''}
      </p>
    </div>
  );
}
