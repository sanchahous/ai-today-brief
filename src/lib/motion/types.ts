/** Tension v3 UI gesture kinds wired through `data-gesture` on server markup. */
export const GESTURE_KINDS = [
  'settle',
  'curtain',
  'fold',
  'index',
  'rule',
  'draw',
  'count',
  'press',
  'focus',
  'reveal',
  'confirm',
  'grow',
  'disclose',
  'record',
] as const;

export type GestureKind = (typeof GESTURE_KINDS)[number];

export function isGestureKind(value: string): value is GestureKind {
  return (GESTURE_KINDS as readonly string[]).includes(value);
}
