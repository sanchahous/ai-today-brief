'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ACTIVE_STATUSES = new Set(['queued', 'running']);

/**
 * Renders nothing. Soft-refreshes the current route on an interval while
 * `status` is non-terminal, so a long-running generation job (editorial_master
 * can take minutes) shows up-to-date status without a manual reload.
 */
export function AutoRefreshWhileActive({
  status,
  intervalMs = 5000,
}: {
  status: string | null | undefined;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!status || !ACTIVE_STATUSES.has(status)) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [status, intervalMs, router]);

  return null;
}
