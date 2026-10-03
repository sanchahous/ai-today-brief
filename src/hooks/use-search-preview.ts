'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@/lib/site';

export type SearchPreviewItem = {
  id: string;
  href: string;
  title: string;
  date: string;
  categorySlug: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  sourceName: string | null;
};

export type SearchPreviewState = {
  rows: SearchPreviewItem[];
  total: number;
  loading: boolean;
  error: boolean;
};

const EMPTY: SearchPreviewState = { rows: [], total: 0, loading: false, error: false };

/** Debounced live search for SearchDialog previews. Skips fetch when query is empty. */
export function useSearchPreview(
  lang: Lang,
  query: string,
  limit = 5,
  enabled = true,
): SearchPreviewState & { retry: () => void } {
  const [state, setState] = useState<SearchPreviewState>(EMPTY);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((k) => k + 1), []);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || !q) {
      setState(EMPTY);
      return;
    }

    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: false }));

    const id = window.setTimeout(() => {
      const params = new URLSearchParams({ q, lang, limit: String(limit) });
      fetch(`/api/search?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('search failed'))))
        .then((body: { items?: SearchPreviewItem[]; total?: number }) => {
          setState({
            rows: body.items ?? [],
            total: body.total ?? 0,
            loading: false,
            error: false,
          });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({ rows: [], total: 0, loading: false, error: true });
        });
    }, 200);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [lang, query, limit, retryKey, enabled]);

  return { ...state, retry };
}
