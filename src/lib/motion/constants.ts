/** Active UI WAAPI cap; decorative motion is skipped above this (content stays visible). */
export const MAX_ACTIVE_UI_ANIMATIONS = 32;

export const SPRING_FRAME_COUNT = 33;

/** Tension v3 spring: m = 1, k = 240, c = 24 → damp = c/(2m) = 12. */
export const SPRING_DAMPING_RATIO = 12;
export const SPRING_FREQUENCY = Math.sqrt(240 - SPRING_DAMPING_RATIO * SPRING_DAMPING_RATIO);

export const GESTURE_DURATION_MS: Readonly<Record<string, number>> = {
  settle: 640,
  curtain: 720,
  fold: 760,
  index: 440,
  rule: 620,
  draw: 900,
  count: 900,
  press: 480,
  focus: 300,
  reveal: 520,
  confirm: 420,
  grow: 820,
  disclose: 360,
  record: 1400,
};

export const TENSION_EASE = 'cubic-bezier(0.18, 0.82, 0.26, 1)';
