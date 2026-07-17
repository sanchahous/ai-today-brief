import 'server-only';

/** Isolates wall-clock access from React render functions. */
export function serverEpochMs() {
  return Date.now();
}
