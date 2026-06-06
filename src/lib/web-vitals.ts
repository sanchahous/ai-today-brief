'use client';

import { trackEvent } from '@/lib/analytics-client';

type VitalName = 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB';

const THRESHOLDS: Record<VitalName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function rating(name: VitalName, v: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = THRESHOLDS[name];
  return v <= good ? 'good' : v <= poor ? 'needs-improvement' : 'poor';
}

const reported = new Set<VitalName>();

function report(name: VitalName, value: number): void {
  if (reported.has(name)) return;
  reported.add(name);
  const rounded = name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value);
  trackEvent('web_vitals', {
    metric_name: name,
    metric_value: rounded,
    metric_rating: rating(name, value),
  });
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

type ObserverInit = PerformanceObserverInit & { durationThreshold?: number };

function observe(
  type: string,
  cb: (entries: PerformanceEntryList) => void,
  opts?: ObserverInit,
): void {
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered: true, ...opts } as ObserverInit);
  } catch {
    /* entry type unsupported in this browser */
  }
}

/** Collect LCP, CLS, INP, FCP, TTFB and send as `web_vitals` GA4 events. */
export function collectWebVitals(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav) report('TTFB', nav.responseStart);
  } catch {
    /* navigation timing unavailable */
  }

  observe('paint', (entries) => {
    for (const e of entries) if (e.name === 'first-contentful-paint') report('FCP', e.startTime);
  });

  let lcp = 0;
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = last.startTime;
  });

  let cls = 0;
  observe('layout-shift', (entries) => {
    for (const e of entries as LayoutShift[]) if (!e.hadRecentInput) cls += e.value;
  });

  let inp = 0;
  observe(
    'event',
    (entries) => {
      for (const e of entries) inp = Math.max(inp, e.duration);
    },
    { durationThreshold: 40 },
  );

  const finalize = () => {
    if (lcp) report('LCP', lcp);
    report('CLS', cls);
    if (inp) report('INP', inp);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalize();
  });
  window.addEventListener('pagehide', finalize, { once: true });
}
