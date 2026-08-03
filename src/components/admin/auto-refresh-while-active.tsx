'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const ACTIVE_STATUSES = new Set(['queued', 'running']);

function hasActiveStatus(statuses: Array<string | null | undefined>) {
  return statuses.some((status) => typeof status === 'string' && ACTIVE_STATUSES.has(status));
}

/**
 * Renders nothing. Soft-refreshes the current route on an interval while any
 * watched job status is non-terminal, and once more when the last active job
 * finishes — so Visuals/PDF previews pick up the new artifact without a manual reload.
 */
export function AutoRefreshWhileActive({
  status,
  statuses,
  intervalMs = 5000,
}: {
  status?: string | null;
  statuses?: Array<string | null | undefined>;
  intervalMs?: number;
}) {
  const router = useRouter();
  const watched = statuses ?? [status];
  const active = hasActiveStatus(watched);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (wasActiveRef.current && !active) {
      router.refresh();
    }
    wasActiveRef.current = active;
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
