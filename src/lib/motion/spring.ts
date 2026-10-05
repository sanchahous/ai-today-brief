import { SPRING_DAMPING_RATIO, SPRING_FREQUENCY, SPRING_FRAME_COUNT } from '@/lib/motion/constants';

/** Damped spring at rest (r → 0) for gesture sampling. */
export function springAt(progress: number, seconds = 0.64): number {
  const time = progress * seconds;
  const damp = SPRING_DAMPING_RATIO;
  const frequency = SPRING_FREQUENCY;
  return (
    Math.exp(-damp * time) *
    (Math.cos(frequency * time) + (damp / frequency) * Math.sin(frequency * time))
  );
}

/** Sample spring displacement into WAAPI keyframes (33 frames). */
export function sampledSpringKeyframes(
  toTransform: (remainder: number) => string,
  durationSeconds = 0.64,
): Keyframe[] {
  const last = SPRING_FRAME_COUNT - 1;
  return Array.from({ length: SPRING_FRAME_COUNT }, (_, index) => {
    const progress = index / last;
    const remainder = index === last ? 0 : springAt(progress, durationSeconds);
    return { offset: progress, transform: toTransform(remainder) };
  });
}
