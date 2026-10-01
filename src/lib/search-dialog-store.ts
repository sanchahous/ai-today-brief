/**
 * Module-level external store for SearchDialog, shared across disjoint client
 * islands (header, hero, 404) with no common React ancestor.
 */
export type SearchDialogSource = 'hero' | 'icon' | 'header' | 'keyboard' | 'menu';

export interface SearchDialogState {
  open: boolean;
  source: SearchDialogSource | null;
  heroVisible: boolean;
  triggerEl: HTMLElement | null;
}

const SERVER_SNAPSHOT: SearchDialogState = Object.freeze({
  open: false,
  source: null,
  heroVisible: false,
  triggerEl: null,
});

let state: SearchDialogState = {
  open: false,
  source: null,
  heroVisible: false,
  triggerEl: null,
};

const listeners = new Set<() => void>();

function set(next: Partial<SearchDialogState>): void {
  const merged: SearchDialogState = { ...state, ...next };
  if (
    merged.open === state.open &&
    merged.source === state.source &&
    merged.heroVisible === state.heroVisible &&
    merged.triggerEl === state.triggerEl
  ) {
    return;
  }
  state = merged;
  for (const l of listeners) l();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSnapshot(): SearchDialogState {
  return state;
}

export function getServerSnapshot(): SearchDialogState {
  return SERVER_SNAPSHOT;
}

export function openSearchDialog(
  source: SearchDialogSource,
  triggerEl: HTMLElement | null,
): void {
  set({ open: true, source, triggerEl });
}

export function closeSearchDialog(): void {
  set({ open: false, source: null, triggerEl: null });
}

export function setHeroVisible(visible: boolean): void {
  set({ heroVisible: visible });
}
