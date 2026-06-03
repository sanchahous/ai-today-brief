/**
 * Lightweight A/B experiment assignment.
 *
 * Each visitor is bucketed once (persisted in localStorage) and the bucket is
 * attached to every analytics event as a user property (`exp_<key>`), so any
 * metric can be sliced by variant in GA4 — i.e. the prototype is A/B-test ready
 * the moment you wire a real variant into the UI.
 *
 * To run a test: add an experiment here, then branch on
 * `getVariant('hero_cta')` in the component. Nothing else to set up.
 */
import { setUserProperties } from './analytics';

export interface Experiment {
  key: string;
  /** Equal-weighted variants; index 0 is the control. */
  variants: string[];
}

export const EXPERIMENTS: Experiment[] = [
  // Sample experiments — branch on these in the UI when you're ready.
  { key: 'hero_cta', variants: ['control', 'value_led'] },
  { key: 'newsletter_placement', variants: ['control', 'mid_feed'] },
];

const STORAGE_KEY = 'proto_experiments';

function loadStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable (private mode) — assignments stay in-memory */
  }
}

let assignments: Record<string, string> | null = null;

/** Assign every experiment once and publish buckets as GA4 user properties. */
export function initExperiments(): Record<string, string> {
  const store = loadStore();
  let changed = false;
  for (const exp of EXPERIMENTS) {
    if (!store[exp.key] || !exp.variants.includes(store[exp.key])) {
      store[exp.key] = exp.variants[Math.floor(Math.random() * exp.variants.length)];
      changed = true;
    }
  }
  if (changed) saveStore(store);
  assignments = store;

  const props: Record<string, string> = {};
  for (const exp of EXPERIMENTS) props[`exp_${exp.key}`] = store[exp.key];
  setUserProperties(props);
  return store;
}

/** Read a visitor's bucket for an experiment (control if not initialised). */
export function getVariant(key: string): string {
  if (!assignments) assignments = loadStore();
  return assignments[key] ?? EXPERIMENTS.find((e) => e.key === key)?.variants[0] ?? 'control';
}
