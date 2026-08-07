'use client';

import { useEffect } from 'react';

/**
 * Shared error boundary for every /admin/* CMS page. Without this, an
 * uncaught Server Action or render error anywhere under (cms) fell through
 * to Next's default error overlay -- unstyled, no way back into the admin
 * shell (AdminNav lives in the layout above this boundary, so it survives).
 */
export default function CmsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-bold tracking-[.16em] text-red-300 uppercase">Something broke</p>
      <p className="max-w-md text-sm leading-6 text-slate-400">
        {error.message || 'An unexpected error occurred.'}
        {error.digest ? (
          <span className="mt-1 block text-xs text-slate-600">Ref: {error.digest}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04]"
      >
        Try again
      </button>
    </div>
  );
}
