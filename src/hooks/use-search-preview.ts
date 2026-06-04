'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/site';

export type SearchPreviewItem = {
  id: string;
  href: string;
  title: string;
  date: string;
  categoryName: string | null;
  categoryColor: string | null;
  sourceName: string | null;
};

type PreviewState = {
  rows: SearchPreviewItem[];
  total: number;
  loading: boolean;
};

const EMPTY: PreviewState = { rows: [], total: 0, loading: false };

/** Debounced live search for header/hero dropdown previews. */
export function useSearchPreview(lang: Lang, query: string, limit = 5): PreviewState {
  const [state, setState] = useState<PreviewState>(EMPTY);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState(EMPTY);
      return;
    }

    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));

    const id = window.setTimeout(() => {
      const params = new URLSearchParams({ q, lang, limit: String(limit) });
      fetch(`/api/search?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('search failed'))))
        .then((body: { items?: SearchPreviewItem[]; total?: number }) => {
          setState({
            rows: body.items ?? [],
            total: body.total ?? 0,
            loading: false,
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({ rows: [], total: 0, loading: false });
        });
    }, 200);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [lang, query, limit]);

  return state;
}
