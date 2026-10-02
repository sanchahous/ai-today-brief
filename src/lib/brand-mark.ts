import { SEMANTIC_TOKENS } from '@/lib/design-system/tokens';

/**
 * After Hours brand mark — plate + nested A strokes + celadon signal dot.
 * Single source for favicon, apple-touch-icon, schema.org publisher logo and
 * raster/OG/PDF/social renderers (AH-3.7).
 *
 * Static raster colors use the Night semantic palette so icons stay legible
 * without a theme context. Interactive surfaces use the `.brand-mark` CSS
 * classes in globals.css (token-driven, Day/Night aware).
 *
 * Generated artifacts: `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`.
 * Regenerate after edits: `npm run icons:generate`.
 */
export const BRAND_MARK_VIEWBOX = 64;

export const BRAND_MARK_PATHS = {
  outerA: 'M12 49 31 13l20 36',
  innerA: 'M18 49l13-25 14 25',
  crossbar: 'M25 40h15',
  dot: { cx: 49, cy: 15, r: 4 },
} as const;

export type BrandMarkPaletteId = 'night' | 'yellow';

export interface BrandMarkPalette {
  plate: string;
  stroke: string;
  dot: string;
  plateRadius: number;
}

/**
 * Night palette for site icons. Yellow palette is the dark-plate variant for OG/PDF/social
 * scrims (readable on #f0c040 duotone suns per I-12) — same ink as `artifacts/after-hours/assets/mark.svg`.
 */
export const BRAND_MARK_PALETTES: Record<BrandMarkPaletteId, BrandMarkPalette> = {
  night: {
    plate: SEMANTIC_TOKENS.night.bg,
    stroke: SEMANTIC_TOKENS.night.accent,
    dot: SEMANTIC_TOKENS.night.signal,
    plateRadius: 6,
  },
  yellow: {
    plate: SEMANTIC_TOKENS.night.bg,
    stroke: SEMANTIC_TOKENS.night.accent,
    dot: SEMANTIC_TOKENS.night.signal,
    plateRadius: 3,
  },
};

export interface BrandMarkSvgOptions {
  size?: number;
  palette?: BrandMarkPaletteId;
  includePlate?: boolean;
}

/** Standalone SVG string for any raster or `<img src>` consumer. */
export function brandMarkSvg({
  size = BRAND_MARK_VIEWBOX,
  palette: paletteId = 'night',
  includePlate = true,
}: BrandMarkSvgOptions = {}): string {
  const palette = BRAND_MARK_PALETTES[paletteId];
  const plate = includePlate
    ? `<rect width="64" height="64" rx="${palette.plateRadius}" fill="${palette.plate}"/>`
    : '';
  const { outerA, innerA, crossbar, dot } = BRAND_MARK_PATHS;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">`,
    plate,
    `<g fill="none" stroke="${palette.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="${outerA}"/>`,
    `<path d="${innerA}"/>`,
    `<path d="${crossbar}"/>`,
    `</g>`,
    `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${palette.dot}"/>`,
    `</svg>`,
  ].join('');
}

/** Edge-safe data URI for Satori / next/og ImageResponse. */
export function brandMarkDataUri(options?: BrandMarkSvgOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(options))}`;
}

/** Brass accent for labels on dark scrims in PDF and social renders. */
export const BRAND_MARK_RENDER_ACCENT = SEMANTIC_TOKENS.night.accent;

/** OG/PDF/duotone sun — invariant I-12; stays #f0c040, not brass. */
export const BRAND_RENDER_SUN = '#f0c040';

export const BRAND_MARK_PLATE = BRAND_MARK_PALETTES.night.plate;
export const BRAND_MARK_STROKE = BRAND_MARK_PALETTES.night.stroke;
export const BRAND_MARK_DOT = BRAND_MARK_PALETTES.night.dot;

/** 64×64 viewBox; includes the plate (favicon has no separate wordmark). */
export const BRAND_MARK_SVG = brandMarkSvg({ palette: 'night' });
