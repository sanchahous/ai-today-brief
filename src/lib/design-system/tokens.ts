/**
 * AI Today Brief — Design System Tokens (After Hours v1.0.0)
 *
 * 3-tier architecture:
 * 1. Primitives: Raw immutable color palettes, spacing units, fonts, motion, breakpoints.
 * 2. Semantic: Intent-based tokens mapped to CSS variables for Night (default) and Day themes.
 * 3. Component: Sizing, touch targets, focus rings, badges, card elevation.
 */

export const PRIMITIVES = {
  palette: {
    night: {
      ink: '#171918',
      surface: '#202421',
      raised: '#2b302c',
      paper: '#f0e9dc',
      muted: '#b9b7ac',
      faint: '#78766c',
      brass: '#d4b483',
      mint: '#b5d8cc',
      line: '#414640',
      error: '#efaaa0',
      success: '#b5d8cc',
    },
    day: {
      bg: '#f0e9dc',
      surface: '#e7dfd0',
      raised: '#ddd4c4',
      text: '#232820',
      muted: '#606358',
      faint: '#84877b',
      accent: '#72562e',
      mint: '#2d6559',
      line: '#b4b0a3',
      error: '#a13328',
      success: '#2d6559',
    },
  },
  spacing: {
    '0': '0px',
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '6': '24px',
    '8': '32px',
    '12': '48px',
    '16': '64px',
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
    focus: '0 0 0 2px var(--accent)',
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
      tight: 1.12,
      snug: 1.3,
      normal: 1.5,
      relaxed: 1.7,
      prose: 1.85,
    },
  },
  motion: {
    duration: {
      fast: 160,
      standard: 320,
      entrance: 640,
    },
    easing: 'cubic-bezier(0.18, 0.82, 0.26, 1)',
  },
  breakpoints: {
    phone: 390,
    mobile: 760,
    tablet: 1024,
    desktop: 1280,
  },
  touchTargetMin: 44, // 44x44px WCAG AA
  focus: {
    width: 2,
    offset: 2,
  },
} as const;

export const SEMANTIC_TOKENS = {
  night: {
    bg: PRIMITIVES.palette.night.ink,
    bgSoft: '#1c1f1d',
    surface: PRIMITIVES.palette.night.surface,
    surface2: PRIMITIVES.palette.night.raised,
    border: PRIMITIVES.palette.night.line,
    borderSoft: '#2d332f',
    text: PRIMITIVES.palette.night.paper,
    muted: PRIMITIVES.palette.night.muted,
    faint: PRIMITIVES.palette.night.faint,
    accent: PRIMITIVES.palette.night.brass,
    onAccent: PRIMITIVES.palette.night.ink,
    signal: PRIMITIVES.palette.night.mint,
    error: PRIMITIVES.palette.night.error,
    success: PRIMITIVES.palette.night.success,
  },
  day: {
    bg: PRIMITIVES.palette.day.bg,
    bgSoft: '#e9e1d1',
    surface: PRIMITIVES.palette.day.surface,
    surface2: PRIMITIVES.palette.day.raised,
    border: PRIMITIVES.palette.day.line,
    borderSoft: '#cdc7ba',
    text: PRIMITIVES.palette.day.text,
    muted: PRIMITIVES.palette.day.muted,
    faint: PRIMITIVES.palette.day.faint,
    accent: PRIMITIVES.palette.day.accent,
    onAccent: '#ffffff',
    signal: PRIMITIVES.palette.day.mint,
    error: PRIMITIVES.palette.day.error,
    success: PRIMITIVES.palette.day.success,
  },
} as const;

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
