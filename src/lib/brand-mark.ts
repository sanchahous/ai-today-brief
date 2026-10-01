import { SEMANTIC_TOKENS } from '@/lib/design-system/tokens';

/**
 * After Hours brand mark — plate + nested A strokes + celadon signal dot.
 * Single source for favicon, apple-touch-icon and schema.org publisher logo.
 *
 * Static raster colors use the Night semantic palette so icons stay legible
 * without a theme context. Interactive surfaces use the `.brand-mark` CSS
 * classes in globals.css (token-driven, Day/Night aware).
 *
 * Generated artifacts: `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`.
 * Regenerate after edits: `npm run icons:generate`.
 */
export const BRAND_MARK_PLATE = SEMANTIC_TOKENS.night.bg;
export const BRAND_MARK_STROKE = SEMANTIC_TOKENS.night.accent;
export const BRAND_MARK_DOT = SEMANTIC_TOKENS.night.signal;

/** 64×64 viewBox; includes the plate (favicon has no separate wordmark). */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="6" fill="${BRAND_MARK_PLATE}"/>
<g fill="none" stroke="${BRAND_MARK_STROKE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<path d="M12 49 31 13l20 36"/>
<path d="M18 49l13-25 14 25"/>
<path d="M25 40h15"/>
</g>
<circle cx="49" cy="15" r="4" fill="${BRAND_MARK_DOT}"/>
</svg>`;
