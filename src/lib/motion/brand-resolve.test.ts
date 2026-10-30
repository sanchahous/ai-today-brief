import { describe, expect, it } from 'vitest';
import { BRAND_DURATION_MS, brandTracks, ribPaths, scatterRib } from '@/lib/motion/brand-resolve';

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

  it('animates only the mark and caption, with no phase labels or progress line', () => {
    const queried: string[] = [];
    const el = {} as Element;
    const counts: Record<string, number> = { '.rs-rib': 16, '.brand-line > span': 2 };
    const stage = {
      querySelector: (selector: string) => {
        queried.push(selector);
        return el;
      },
      querySelectorAll: (selector: string) => {
        queried.push(selector);
        return Array.from({ length: counts[selector] ?? 0 }, () => el);
      },
    } as unknown as Element;

    expect(brandTracks(stage)).toHaveLength(27);
    expect(queried.some((selector) => /phase|progress/.test(selector))).toBe(false);
  });
});
