import { describe, expect, it } from 'vitest';
import {
  BRAND_MARK_DOT,
  BRAND_MARK_PALETTES,
  BRAND_MARK_PLATE,
  BRAND_MARK_RENDER_ACCENT,
  BRAND_MARK_STROKE,
  BRAND_MARK_SVG,
  BRAND_RENDER_SUN,
  brandMarkDataUri,
  brandMarkSvg,
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

  it('exposes a yellow-render palette for OG/PDF/social surfaces', () => {
    const yellow = brandMarkSvg({ palette: 'yellow', size: 48 });
    expect(yellow).toContain('width="48"');
    expect(yellow).toContain(BRAND_MARK_PALETTES.yellow.plate);
    expect(BRAND_RENDER_SUN).toBe('#f0c040');
    expect(BRAND_MARK_RENDER_ACCENT).toBe(BRAND_MARK_PALETTES.yellow.stroke);
  });

  it('builds edge-safe data URIs', () => {
    expect(brandMarkDataUri({ palette: 'yellow' })).toMatch(/^data:image\/svg\+xml,/);
  });
});
