'use client';

import { useEffect } from 'react';
import { socialClickTokenFromSearch } from '@/lib/social/tracked-url';

/**
 * Records a social click when the reader lands on the canonical page with `?s=`.
 * Bots that do not run JS are skipped here; `/r/s/{token}` legacy hops also skip bots.
 */
export function SocialClickCapture() {
  useEffect(() => {
    const token = socialClickTokenFromSearch(window.location.search);
    if (!token) return;
    const key = `atb_s_${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Private mode can block sessionStorage; still send one beacon this load.
    }
    void fetch('/api/social/click', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  }, []);
  return null;
}
