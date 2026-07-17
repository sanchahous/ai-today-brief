'use client';

import { useEffect } from 'react';

/**
 * Registers a network-only worker so the admin is installable without ever
 * caching private CMS responses or allowing stale, offline approvals.
 */
export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/' });
    }
  }, []);
  return null;
}
