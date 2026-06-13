/**
 * Module-level external store for the mobile search UX, shared across two disjoint
 * client islands (the home HeroSearch and the SiteHeaderChrome header) that have no
 * common React ancestor — so React Context would force a provider around the RSC
 * layout. useSyncExternalStore needs no shared ancestor and is SSR-safe.
 *
 * IMPORTANT (React 19): getSnapshot must return a STABLE reference between changes,
 * otherwise useSyncExternalStore loops / warns. `state` is only reassigned inside
 * set() when something actually changed.
 */
export type MobileSearchSource = 'hero' | 'icon';

export interface MobileSearchState {
  open: boolean;
  source: MobileSearchSource | null;
  heroVisible: boolean;
  triggerEl: HTMLElement | null;
}

const SERVER_SNAPSHOT: MobileSearchState = Object.freeze({
  open: false,
  source: null,
  heroVisible: false,
  triggerEl: null,
});

let state: MobileSearchState = {
  open: false,
  source: null,
  heroVisible: false,
  triggerEl: null,
};

const listeners = new Set<() => void>();

function set(next: Partial<MobileSearchState>): void {
  const merged: MobileSearchState = { ...state, ...next };
  if (
    merged.open === state.open &&
    merged.source === state.source &&
    merged.heroVisible === state.heroVisible &&
    merged.triggerEl === state.triggerEl
  ) {
    return; // no-op: keep the stable snapshot reference
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

export function getSnapshot(): MobileSearchState {
  return state;
}

export function getServerSnapshot(): MobileSearchState {
  return SERVER_SNAPSHOT;
}

export function openSearch(source: MobileSearchSource, triggerEl: HTMLElement | null): void {
  set({ open: true, source, triggerEl });
}

export function closeSearch(): void {
  set({ open: false, source: null, triggerEl: null });
}

export function setHeroVisible(visible: boolean): void {
  set({ heroVisible: visible });
}
