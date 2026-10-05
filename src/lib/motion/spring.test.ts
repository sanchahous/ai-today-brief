import { describe, expect, it } from 'vitest';
import { sampledSpringKeyframes, springAt } from '@/lib/motion/spring';

describe('springAt', () => {
  it('starts at 1 and settles to 0 at the end of the sample', () => {
    expect(springAt(0, 0.64)).toBeCloseTo(1, 5);
    expect(springAt(1, 0.64)).toBeCloseTo(0, 2);
  });
});

describe('sampledSpringKeyframes', () => {
  it('emits 33 keyframes with monotonic offsets', () => {
    const frames = sampledSpringKeyframes((r) => `translateY(${r}px)`);
    expect(frames).toHaveLength(33);
    expect(frames[0]?.offset).toBe(0);
    expect(frames.at(-1)?.offset).toBe(1);
    expect(frames.at(-1)?.transform).toBe('translateY(0px)');
  });
});
