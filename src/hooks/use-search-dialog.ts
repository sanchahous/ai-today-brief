'use client';

import { useSyncExternalStore } from 'react';
import {
  closeSearchDialog,
  getServerSnapshot,
  getSnapshot,
  openSearchDialog,
  setHeroVisible,
  subscribe,
  type SearchDialogState,
} from '@/lib/search-dialog-store';

export function useSearchDialog(): SearchDialogState & {
  openSearchDialog: typeof openSearchDialog;
  closeSearchDialog: typeof closeSearchDialog;
  setHeroVisible: typeof setHeroVisible;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snapshot,
    openSearchDialog,
    closeSearchDialog,
    setHeroVisible,
  };
}
