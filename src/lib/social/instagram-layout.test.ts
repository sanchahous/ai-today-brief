import { describe, expect, it } from 'vitest';
import {
  approximateInstagramMeasurer,
  INSTAGRAM_LAYOUT,
  INSTAGRAM_SLIDE_HEIGHT,
  INSTAGRAM_SLIDE_WIDTH,
  layoutInstagramSlideText,
} from './instagram-layout';

describe('Instagram measured layout', () => {
  it('keeps every line inside the safe area', () => {
    const result = layoutInstagramSlideText({
      kind: 'comparison',
      headline: 'Before vs after',
      body: 'Old reviews were narrative; the new eval is checkable.',
      measurer: approximateInstagramMeasurer(0.52),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const line of result.layout.lines) {
      expect(line.x).toBeGreaterThanOrEqual(INSTAGRAM_LAYOUT.safeLeft);
      expect(line.x + line.width).toBeLessThanOrEqual(INSTAGRAM_SLIDE_WIDTH - INSTAGRAM_LAYOUT.safeRight);
      expect(line.y).toBeGreaterThanOrEqual(INSTAGRAM_LAYOUT.safeTop);
      expect(line.y + line.height).toBeLessThanOrEqual(INSTAGRAM_LAYOUT.footerTop);
      expect(line.y + line.height).toBeLessThan(INSTAGRAM_SLIDE_HEIGHT);
    }
  });

  it('returns an overflow blocker instead of truncating', () => {
    const result = layoutInstagramSlideText({
      kind: 'cover',
      headline: 'SupercalifragilisticexpialidociousUnbreakableGlyphRunThatCannotWrapAtAnySize',
      measurer: approximateInstagramMeasurer(1.8),
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'overflow',
      }),
    );
  });
});
