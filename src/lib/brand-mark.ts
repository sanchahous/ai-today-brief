import { MARK_COLOR, MARK_COLOR_DEEP, MARK_COLOR_CORE } from './site';

/**
 * Full brand mark ("bloom") — single source for the favicon, apple-touch-icon
 * and schema.org publisher logo. 64×64 viewBox, transparent background.
 *
 * This is the canonical copy; `src/app/icon.svg`, `src/app/favicon.ico` and
 * `src/app/apple-icon.png` are generated from it. After editing, regenerate
 * with `npm run icons:generate`.
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="atbPetal" x1="6%" y1="6%" x2="94%" y2="94%">
<stop offset="0%" stop-color="#8DF3E6"/><stop offset="50%" stop-color="${MARK_COLOR}"/><stop offset="100%" stop-color="${MARK_COLOR_DEEP}"/>
</linearGradient></defs>
<rect x="4" y="16" width="8" height="8" rx="2.2" fill="${MARK_COLOR}" opacity="0.3"/>
<rect x="11" y="8" width="10" height="10" rx="2.6" fill="${MARK_COLOR}" opacity="0.55"/>
<rect x="20" y="1" width="27" height="27" rx="7.5" fill="url(#atbPetal)"/>
<rect x="37" y="18" width="27" height="27" rx="7.5" fill="url(#atbPetal)"/>
<rect x="20" y="35" width="27" height="27" rx="7.5" fill="url(#atbPetal)"/>
<rect x="24.5" y="24.5" width="15" height="15" rx="4.2" fill="${MARK_COLOR_CORE}"/>
</svg>`;
