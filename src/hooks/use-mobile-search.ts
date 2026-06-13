'use client';

import { useSyncExternalStore } from 'react';
import {
  closeSearch,
  getServerSnapshot,
  getSnapshot,
  openSearch,
  setHeroVisible,
  subscribe,
  type MobileSearchState,
} from '@/lib/mobile-search-store';

export function useMobileSearch(): MobileSearchState & {
  openSearch: typeof openSearch;
  closeSearch: typeof closeSearch;
  setHeroVisible: typeof setHeroVisible;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...state, openSearch, closeSearch, setHeroVisible };
}
