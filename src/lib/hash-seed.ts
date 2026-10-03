/**
 * Deterministic string/number hash function ported from After Hours prototype v3.
 * Produces a stable 32-bit unsigned integer seed for decorative visual variations.
 */
export function hashSeed(text: string | number | null | undefined): number {
  return [...String(text ?? '')].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
}
