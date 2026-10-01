import { describe, expect, it } from 'vitest';
import {
  BRAND_MARK_DOT,
  BRAND_MARK_PLATE,
  BRAND_MARK_STROKE,
  BRAND_MARK_SVG,
} from './brand-mark';

describe('brand-mark', () => {
  it('renders the After Hours plate, A strokes and celadon dot', () => {
    expect(BRAND_MARK_SVG).toContain('M12 49 31 13l20 36');
    expect(BRAND_MARK_SVG).toContain(`fill="${BRAND_MARK_DOT}"`);
    expect(BRAND_MARK_SVG).toContain(`stroke="${BRAND_MARK_STROKE}"`);
    expect(BRAND_MARK_SVG).toContain(`fill="${BRAND_MARK_PLATE}"`);
  });

  it('does not retain the legacy bloom geometry', () => {
    expect(BRAND_MARK_SVG).not.toContain('atbPetal');
    expect(BRAND_MARK_SVG).not.toContain('rx="7.5"');
  });
});
