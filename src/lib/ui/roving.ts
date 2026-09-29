/**
 * Keyboard navigation for composite widgets (Tabs, DropdownMenu, Combobox listbox).
 * Pure so the behaviour is unit-tested without a DOM.
 */
export type Orientation = 'horizontal' | 'vertical';

export interface RovingOptions {
  orientation?: Orientation;
  /** Wrap from last to first (and back). Default true. */
  loop?: boolean;
  /** Indices that cannot receive focus. */
  disabled?: ReadonlySet<number>;
}

const NEXT_KEYS: Record<Orientation, string> = { horizontal: 'ArrowRight', vertical: 'ArrowDown' };
const PREV_KEYS: Record<Orientation, string> = { horizontal: 'ArrowLeft', vertical: 'ArrowUp' };

/** Returns the index that should receive focus after `key`, or `null` if the key is not handled. */
export function nextRovingIndex(
  current: number,
  key: string,
  count: number,
  { orientation = 'horizontal', loop = true, disabled }: RovingOptions = {},
): number | null {
  if (count <= 0) return null;
  const enabled = (i: number) => !disabled?.has(i);

  let step: 1 | -1;
  let from = current;
  if (key === NEXT_KEYS[orientation]) step = 1;
  else if (key === PREV_KEYS[orientation]) step = -1;
  else if (key === 'Home') {
    step = 1;
    from = -1;
  } else if (key === 'End') {
    step = -1;
    from = count;
  } else return null;

  let candidate = from;
  for (let n = 0; n < count; n += 1) {
    candidate += step;
    if (candidate < 0 || candidate >= count) {
      if (!loop) return enabled(current) ? current : null;
      candidate = (candidate + count) % count;
    }
    if (enabled(candidate)) return candidate;
  }
  return null;
}

/** First index whose label starts with the typed characters (menu typeahead), starting after `current`. */
export function typeaheadIndex(labels: readonly string[], typed: string, current: number): number | null {
  const needle = typed.trim().toLocaleLowerCase();
  if (!needle) return null;
  const count = labels.length;
  for (let n = 1; n <= count; n += 1) {
    const i = (current + n) % count;
    if (labels[i].toLocaleLowerCase().startsWith(needle)) return i;
  }
  return null;
}
