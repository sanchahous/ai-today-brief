/**
 * AI Today Brief — Design System Tokens (After Hours v2.0.0)
 *
 * 3-tier architecture:
 * 1. Primitives: raw immutable palettes, spacing, type scale, motion, breakpoints, z-index.
 * 2. Semantic: intent-based roles for Night (default) and Day. Every role is defined in BOTH
 *    themes, so Day never inherits a Night value.
 * 3. Component: control sizes, touch floor, focus ring.
 *
 * This module is the programmatic source of truth. `src/app/globals.css` mirrors the semantic
 * values as CSS variables; `npm run tokens:check` fails on contrast, font-floor or drift.
 * Prototype reference: artifacts/after-hours/tokens.css (2.0.0-proposal).
 * Decision record: wiki/decisions/2026-09-29-design-tokens-2-0-migration.md
 */

export const TOKENS_VERSION = '2.0.0';

export const PRIMITIVES = {
  palette: {
    night: {
      ink: '#171918',
      inkDeep: '#131514',
      stage: '#0e100f',
      surface: '#1f2321',
      raised: '#282d29',
      overlay: '#323832',
      paper: '#f0e9dc',
      muted: '#b9b7ac',
      faint: '#a3a197',
      brass: '#d4b483',
      mint: '#b5d8cc',
      claret: '#e3919d',
      velvet: '#431a24',
      line: '#3b413c',
      lineStrong: '#737a73',
      error: '#ff9b8a',
      success: '#b5d8cc',
      warning: '#e8c07a',
    },
    day: {
      bg: '#efe8da',
      bgDeep: '#e6ddcc',
      stage: '#151716',
      surface: '#f7f2e8',
      raised: '#fdfaf4',
      overlay: '#e6ddcc',
      text: '#1d211d',
      muted: '#4d5148',
      faint: '#5a5e54',
      accent: '#72562e',
      mint: '#2d6559',
      claret: '#8e2a3f',
      velvet: '#f3e1dc',
      line: '#d6cebf',
      lineStrong: '#8c8577',
      error: '#b3261e',
      success: '#2d6559',
      warning: '#7a5a10',
    },
  },
  spacing: {
    '0': '0px',
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '20px',
    '6': '24px',
    '8': '32px',
    '10': '40px',
    '12': '48px',
    '16': '64px',
    '20': '80px',
    '24': '96px',
  },
  radii: {
    none: '0px',
    sm: '3px',
    md: '6px',
    lg: '8px',
    card: '14px',
    pill: '9999px',
  },
  shadows: {
    card: '0 8px 24px rgba(0, 0, 0, 0.25)',
    pop: '0 16px 40px rgba(0, 0, 0, 0.45)',
    focus: '0 0 0 2px var(--focus)',
  },
  typography: {
    fonts: {
      sans: "'Inter Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      serif: "'Fraunces Variable', Georgia, serif",
      ukDisplayFallback: 'Georgia, serif',
      mono: "'Consolas', 'Courier New', monospace",
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.06,
      heading: 1.14,
      snug: 1.3,
      normal: 1.5,
      body: 1.65,
      relaxed: 1.7,
      reading: 1.78,
      prose: 1.85,
    },
    /** rem-based: respects the reader's browser font size. 12px is the absolute floor. */
    scale: {
      '2xs': '0.75rem', // 12 · mono meta, eyebrows
      xs: '0.8125rem', // 13 · badges, captions
      sm: '0.875rem', // 14 · secondary copy, controls
      md: '1rem', // 16 · UI body, inputs
      lg: '1.125rem', // 18 · reading body
      xl: 'clamp(1.1875rem, 1.1rem + 0.35vw, 1.375rem)', // 19–22 · card titles
      '2xl': 'clamp(1.375rem, 1.2rem + 0.8vw, 1.75rem)', // 22–28 · h3
      '3xl': 'clamp(1.75rem, 1.4rem + 1.5vw, 2.5rem)', // 28–40 · h2
      '4xl': 'clamp(2.25rem, 1.65rem + 2.6vw, 3.625rem)', // 36–58 · page h1
      '5xl': 'clamp(2.625rem, 1.8rem + 3.8vw, 4.5rem)', // 42–72 · masthead
    },
    /** Absolute minimum rendered font size, px at the default 16px root. */
    minFontPx: 12,
  },
  motion: {
    duration: {
      fast: 160,
      standard: 320,
      entrance: 640,
    },
    easing: 'cubic-bezier(0.18, 0.82, 0.26, 1)',
  },
  zIndex: {
    base: 1,
    sticky: 30,
    dropdown: 60,
    overlay: 80,
    dialog: 90,
    toast: 100,
  },
  breakpoints: {
    phone: 390,
    mobile: 760,
    tablet: 1024,
    desktop: 1280,
  },
  controlSize: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  touchTargetMin: 44, // 44x44px WCAG AA
  focus: {
    width: 2,
    offset: 2,
  },
} as const;

const N = PRIMITIVES.palette.night;
const D = PRIMITIVES.palette.day;

export const SEMANTIC_TOKENS = {
  night: {
    bg: N.ink,
    bgSoft: N.inkDeep,
    stage: N.stage,
    surface: N.surface,
    surface2: N.raised,
    raised: N.raised,
    overlay: N.overlay,
    border: N.line,
    borderSoft: '#2d332f',
    lineStrong: N.lineStrong,
    text: N.paper,
    muted: N.muted,
    faint: N.faint,
    accent: N.brass,
    onAccent: N.ink,
    signal: N.mint,
    claret: N.claret,
    velvet: N.velvet,
    focus: N.mint,
    error: N.error,
    success: N.success,
    warning: N.warning,
  },
  day: {
    bg: D.bg,
    bgSoft: D.bgDeep,
    stage: D.stage,
    surface: D.surface,
    surface2: D.overlay,
    raised: D.raised,
    overlay: D.overlay,
    border: D.line,
    borderSoft: '#e2dacb',
    lineStrong: D.lineStrong,
    text: D.text,
    muted: D.muted,
    faint: D.faint,
    accent: D.accent,
    onAccent: D.raised,
    signal: D.mint,
    claret: D.claret,
    velvet: D.velvet,
    focus: D.mint,
    error: D.error,
    success: D.success,
    warning: D.warning,
  },
} as const;

/**
 * Semantic role → CSS custom property. `globals.css` must define every entry in both themes;
 * `tokens:check` enforces it. `surface2` is the recessed/secondary surface used by chips and
 * inset panels (Night: raised; Day: slightly darker than surface). `border` = decorative line.
 */
export const CSS_VAR_BY_ROLE: Record<keyof typeof SEMANTIC_TOKENS.night, string> = {
  bg: '--bg',
  bgSoft: '--bg-soft',
  stage: '--stage',
  surface: '--surface',
  surface2: '--surface-2',
  raised: '--raised',
  overlay: '--overlay',
  border: '--border',
  borderSoft: '--border-soft',
  lineStrong: '--line-strong',
  text: '--text',
  muted: '--muted',
  faint: '--faint',
  accent: '--accent',
  onAccent: '--on-accent',
  signal: '--signal',
  claret: '--claret',
  velvet: '--velvet',
  focus: '--focus',
  error: '--error',
  success: '--success',
  warning: '--warning',
};

export const LEGACY_MIGRATION_MAP: Record<string, string> = {
  '#0f0f0f': 'var(--bg)',
  '#141414': 'var(--bg-soft)',
  '#1a1a1a': 'var(--surface)',
  '#202020': 'var(--surface-2)',
  '#2a2a2a': 'var(--border)',
  '#232323': 'var(--border-soft)',
  '#e8e8e8': 'var(--text)',
  '#a3a3a3': 'var(--muted)',
  '#6a6a6a': 'var(--faint)',
  '#f0c040': 'var(--accent)',
};
