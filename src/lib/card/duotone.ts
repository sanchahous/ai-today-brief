/**
 * Generative duotone illustration for share / OG cards.
 *
 * One engine, tinted per category and seeded per item, so every brief item
 * gets a unique-but-on-brand backdrop with zero external cost: a gold "sun"
 * glow over layered duotone ridges that ramp from the category's shadow tone
 * up to its accent. Output is a plain SVG string — embed it as an <img> inside
 * the Satori (next/og) card so the rich gradients render without leaving the
 * edge runtime. Pure string building, no Node/DOM APIs → safe in edge + tests.
 */

/** Master brand accent — the "signal" sun, constant across every category. */
export const BRAND_SUN = '#f0c040';

export interface DuotonePalette {
  /** Deep base tone (sky bottom + farthest ridge). */
  shadow: string;
  /** Bright accent tone (nearest ridge crest) — the category colour. */
  highlight: string;
  /** The sun glow — brand gold by default. */
  sun: string;
}

/** Derive a duotone palette from a category accent colour (e.g. `#5bc9f0`). */
export function paletteFromCategory(categoryColor: string): DuotonePalette {
  return {
    shadow: mix(categoryColor, '#000000', 0.86),
    highlight: categoryColor,
    sun: BRAND_SUN,
  };
}

export interface DuotoneOptions {
  /** Stable per-item string (use the item slug) → deterministic composition. */
  seed: string;
  palette: DuotonePalette;
  width?: number;
  height?: number;
}

/** Build the per-item duotone illustration as a standalone SVG string. */
export function duotoneSvg({ seed, palette, width = 1200, height = 630 }: DuotoneOptions): string {
  const rand = seededRng(seed);
  const { shadow, highlight, sun } = palette;
  const uid = (hashString(seed) % 100000).toString(36);

  // Sky: a vertical ramp from a lifted shadow at the top down to pure shadow.
  const skyTop = mix(shadow, highlight, 0.28);

  // Sun: position + size vary by seed; sometimes high (full disc) and sometimes
  // low so it reads as a horizon glow once the ridges overlap it.
  const sunX = Math.round(180 + rand() * 840);
  const sunY = Math.round(90 + rand() * 170);
  const sunR = Math.round(85 + rand() * 70);

  const ridges = buildRidges(rand, shadow, highlight, width, height);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`,
    ` viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">`,
    `<defs>`,
    `<linearGradient id="sky-${uid}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${shadow}"/>`,
    `</linearGradient>`,
    `<radialGradient id="sun-${uid}">`,
    `<stop offset="0" stop-color="${sun}" stop-opacity="0.95"/>`,
    `<stop offset="0.45" stop-color="${sun}" stop-opacity="0.32"/>`,
    `<stop offset="1" stop-color="${sun}" stop-opacity="0"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="url(#sky-${uid})"/>`,
    `<circle cx="${sunX}" cy="${sunY}" r="${Math.round(sunR * 2.4)}" fill="url(#sun-${uid})"/>`,
    `<circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${sun}" fill-opacity="0.9"/>`,
    ridges,
    `</svg>`,
  ].join('');
}

/** Same illustration as an `<img src>`-ready data URI (edge-safe, no Buffer). */
export function duotoneDataUri(opts: DuotoneOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(duotoneSvg(opts))}`;
}

// ── internals ────────────────────────────────────────────────────────────────

/** Stacked ridges, far→near, each lighter and more opaque than the last. */
function buildRidges(
  rand: () => number,
  shadow: string,
  highlight: string,
  width: number,
  height: number,
): string {
  const layers = 5;
  let out = '';
  for (let i = 0; i < layers; i++) {
    const depth = i / (layers - 1);
    const baseY = 270 + i * 72 + rand() * 24;
    const amp = 28 + rand() * 64;
    const phase = rand() * Math.PI * 2;
    const freq = 0.0028 + rand() * 0.0032;
    let d = `M0 ${baseY.toFixed(0)}`;
    for (let x = 0; x <= width; x += 18) {
      const y = baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 1.3) * amp * 0.34;
      d += ` L${x} ${y.toFixed(0)}`;
    }
    d += ` L${width} ${height} L0 ${height}Z`;
    const fill = mix(shadow, highlight, 0.12 + depth * 0.86);
    const opacity = (0.6 + depth * 0.36).toFixed(2);
    out += `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
  }
  return out;
}

/** mulberry32 PRNG seeded from a string — deterministic across runtimes. */
function seededRng(seed: string): () => number {
  let s = hashString(seed);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Linear blend between two hex colours; returns an `rgb(...)` string. */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `rgb(${clampByte(ar + (br - ar) * t)},${clampByte(ag + (bg - ag) * t)},${clampByte(ab + (bb - ab) * t)})`;
}
