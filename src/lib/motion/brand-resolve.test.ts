import { describe, expect, it } from 'vitest';
import { BRAND_DURATION_MS, ribPaths, scatterRib } from '@/lib/motion/brand-resolve';

describe('brand-resolve', () => {
  it('renders 16 rib pairs with deterministic scatter', () => {
    expect(ribPaths()).toHaveLength(16);
    const first = scatterRib(0);
    const again = scatterRib(0);
    expect(first).toEqual(again);
    expect(scatterRib(3)).not.toEqual(first);
  });

  it('keeps the prototype scene duration at 3.4s', () => {
    expect(BRAND_DURATION_MS).toBe(3400);
  });
});
