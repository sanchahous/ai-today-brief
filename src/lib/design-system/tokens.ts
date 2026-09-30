/**
 * AI Today Brief — Design System Tokens (After Hours v2.1.0)
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

export const TOKENS_VERSION = '2.1.0';

export const CATEGORY_TOKEN_KEYS = ['tools', 'tutorials', 'cost', 'agents', 'vibe', 'creative', 'local', 'career', 'models'] as const;
export type CategoryTokenKey = (typeof CATEGORY_TOKEN_KEYS)[number];

export const PRIMITIVES = {
  categoryPalette: {
    night: {
      tools: '#7fcfae',
      tutorials: '#e6c071',
      cost: '#6fcad6',
      agents: '#b2a6f0',
      vibe: '#e59bc9',
      creative: '#f09b86',
      local: '#8fb4ee',
      career: '#c4cc7e',
      models: '#cfa0e6',
    },
    day: {
      tools: '#1f6b4f',
      tutorials: '#7a5a10',
      cost: '#16636e',
      agents: '#5645a8',
      vibe: '#8b2f69',
      creative: '#9c3b25',
      local: '#2c5a9e',
      career: '#5c6418',
      models: '#733d93',
    },
  },
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
      brassHover: '#e8cd9e',
      mint: '#b5d8cc',
      claret: '#e3919d',
      velvet: '#431a24',
      velvetDeep: '#2e1118',
      onVelvet: '#f6e6df',
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
      accentHover: '#5a4424',
      selectionBg: '#e8cd9e',
      mint: '#2d6559',
      claret: '#8e2a3f',
      velvet: '#f3e1dc',
      velvetDeep: '#ead0ca',
      onVelvet: '#4a1522',
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
  /**
   * Prototype scale 3 / 4 / 8 / 14 / pill. Code names differ where Tailwind already owns a name:
   * prototype `radius` = `xs`, prototype `radius-lg` (14px) = `card`. `lg` stays Tailwind's own
   * 0.5rem (8px) so the existing `rounded-lg` uses do not move.
   */
  radii: {
    none: '0px',
    xs: '3px',
    sm: '4px',
    md: '8px',
    lg: '8px',
    card: '14px',
    pill: '9999px',
  },
  /** Elevation per theme: Day uses warm, low-opacity shadows and a white inset highlight. */
  shadows: {
    night: {
      shadow1: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 10px 28px -18px rgb(0 0 0 / 0.7)',
      shadow2: '0 1px 0 rgb(255 255 255 / 0.04) inset, 0 22px 48px -24px rgb(0 0 0 / 0.85)',
      pop: '0 28px 70px -28px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(255 255 255 / 0.04)',
    },
    day: {
      shadow1: '0 1px 0 rgb(255 255 255 / 0.7) inset, 0 12px 30px -20px rgb(74 56 28 / 0.4)',
      shadow2: '0 1px 0 rgb(255 255 255 / 0.8) inset, 0 24px 50px -26px rgb(74 56 28 / 0.5)',
      pop: '0 28px 70px -30px rgb(58 44 22 / 0.45), 0 0 0 1px rgb(58 44 22 / 0.06)',
    },
  },
  /** Surface effects (consumers arrive with the hero and editorial patterns, AH-5.x). */
  effects: {
    night: {
      stageLight: 'radial-gradient(90% 60% at 78% -8%, rgb(212 180 131 / 0.11), transparent 62%)',
      sheen: 'linear-gradient(105deg, transparent 20%, rgb(255 240 208 / 0.28) 45%, transparent 70%)',
      grainOpacity: '0.07',
    },
    day: {
      stageLight: 'radial-gradient(90% 60% at 78% -8%, rgb(212 180 131 / 0.28), transparent 62%)',
      sheen: 'linear-gradient(105deg, transparent 20%, rgb(255 255 255 / 0.55) 45%, transparent 70%)',
      grainOpacity: '0.05',
    },
  },
  /** Fluid page rhythm and fixed measures. */
  sizes: {
    gutter: 'clamp(16px, 4vw, 40px)',
    sectionY: 'clamp(48px, 7vw, 88px)',
    iconSm: '16px',
    iconMd: '20px',
    max: '1280px',
    maxWide: '1440px',
    reading: '42.5rem',
    /**
     * The prototype header is 72px, but `--header-h` must equal the rendered header (sticky
     * offsets and e2e assert it) and the header only changes in AH-3.3 — so it stays 60px until then.
     */
    headerH: '60px',
    headerHPrototype: '72px',
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
    /**
     * Prototype names `ease`, `ease-in-out`, `ease-release`. `ease-in-out` is renamed `soft` so the
     * Tailwind utility of the same name keeps its own curve.
     */
    easing: {
      standard: 'cubic-bezier(0.18, 0.82, 0.26, 1)',
      soft: 'cubic-bezier(0.65, 0, 0.35, 1)',
      release: 'cubic-bezier(0.2, 0.85, 0.25, 1.08)',
    },
  },
  zIndex: {
    base: 1,
    sticky: 30,
    dropdown: 60,
    overlay: 80,
    dialog: 90,
    toast: 100,
  },
  /**
   * D5, variant A: prototype values as named `--breakpoint-*` in rem, so layouts reflow when the
   * reader enlarges the browser font size. Tailwind builds `min-width` variants from them
   * (`tablet:` >= 60rem; the prototype's `max-width` queries are `max-tablet:`). The default
   * `sm/md/lg/xl` are NOT redefined until AH-7.3. Header and discovery move to `tablet` (60rem =
   * 960px) with AH-3.3 / AH-4.3; today they still switch at Tailwind `lg` (1024px).
   */
  breakpoints: {
    compact: '23.75rem',
    narrow: '25rem',
    phone: '47.5rem',
    tablet: '60rem',
    laptop: '68.75rem',
    navCompact: '73.75rem',
    desktop: '80rem',
  },
  controlSize: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  touchTargetMin: 44, // 44x44px WCAG AA
  focus: {
    width: 2,
    offset: 3,
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
    accentHover: N.brassHover,
    accentFill: N.brass,
    accentFillHover: N.brassHover,
    onAccent: N.ink,
    signal: N.mint,
    claret: N.claret,
    velvet: N.velvet,
    velvetDeep: N.velvetDeep,
    onVelvet: N.onVelvet,
    selectionBg: N.brass,
    selectionText: N.ink,
    focus: N.mint,
    error: N.error,
    success: N.success,
    warning: N.warning,
    catTools: PRIMITIVES.categoryPalette.night.tools,
    catTutorials: PRIMITIVES.categoryPalette.night.tutorials,
    catCost: PRIMITIVES.categoryPalette.night.cost,
    catAgents: PRIMITIVES.categoryPalette.night.agents,
    catVibe: PRIMITIVES.categoryPalette.night.vibe,
    catCreative: PRIMITIVES.categoryPalette.night.creative,
    catLocal: PRIMITIVES.categoryPalette.night.local,
    catCareer: PRIMITIVES.categoryPalette.night.career,
    catModels: PRIMITIVES.categoryPalette.night.models,
    artTools: PRIMITIVES.categoryPalette.night.tools,
    artTutorials: PRIMITIVES.categoryPalette.night.tutorials,
    artCost: PRIMITIVES.categoryPalette.night.cost,
    artAgents: PRIMITIVES.categoryPalette.night.agents,
    artVibe: PRIMITIVES.categoryPalette.night.vibe,
    artCreative: PRIMITIVES.categoryPalette.night.creative,
    artLocal: PRIMITIVES.categoryPalette.night.local,
    artCareer: PRIMITIVES.categoryPalette.night.career,
    artModels: PRIMITIVES.categoryPalette.night.models,
    artNeutral: N.muted,
    artText: N.paper,
    artStage: N.stage,
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
    accentHover: D.accentHover,
    accentFill: D.accent,
    accentFillHover: D.accentHover,
    onAccent: D.raised,
    signal: D.mint,
    claret: D.claret,
    velvet: D.velvet,
    velvetDeep: D.velvetDeep,
    onVelvet: D.onVelvet,
    selectionBg: D.selectionBg,
    selectionText: D.text,
    focus: D.mint,
    error: D.error,
    success: D.success,
    warning: D.warning,
    catTools: PRIMITIVES.categoryPalette.day.tools,
    catTutorials: PRIMITIVES.categoryPalette.day.tutorials,
    catCost: PRIMITIVES.categoryPalette.day.cost,
    catAgents: PRIMITIVES.categoryPalette.day.agents,
    catVibe: PRIMITIVES.categoryPalette.day.vibe,
    catCreative: PRIMITIVES.categoryPalette.day.creative,
    catLocal: PRIMITIVES.categoryPalette.day.local,
    catCareer: PRIMITIVES.categoryPalette.day.career,
    catModels: PRIMITIVES.categoryPalette.day.models,
    artTools: PRIMITIVES.categoryPalette.night.tools,
    artTutorials: PRIMITIVES.categoryPalette.night.tutorials,
    artCost: PRIMITIVES.categoryPalette.night.cost,
    artAgents: PRIMITIVES.categoryPalette.night.agents,
    artVibe: PRIMITIVES.categoryPalette.night.vibe,
    artCreative: PRIMITIVES.categoryPalette.night.creative,
    artLocal: PRIMITIVES.categoryPalette.night.local,
    artCareer: PRIMITIVES.categoryPalette.night.career,
    artModels: PRIMITIVES.categoryPalette.night.models,
    artNeutral: N.muted,
    artText: N.paper,
    artStage: N.stage,
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
  accentHover: '--accent-hover',
  accentFill: '--accent-fill',
  accentFillHover: '--accent-fill-hover',
  onAccent: '--on-accent',
  signal: '--signal',
  claret: '--claret',
  velvet: '--velvet',
  velvetDeep: '--velvet-deep',
  onVelvet: '--on-velvet',
  selectionBg: '--selection-bg',
  selectionText: '--selection-text',
  focus: '--focus',
  error: '--error',
  success: '--success',
  warning: '--warning',
  catTools: '--cat-tools',
  catTutorials: '--cat-tutorials',
  catCost: '--cat-cost',
  catAgents: '--cat-agents',
  catVibe: '--cat-vibe',
  catCreative: '--cat-creative',
  catLocal: '--cat-local',
  catCareer: '--cat-career',
  catModels: '--cat-models',
  artTools: '--art-tools',
  artTutorials: '--art-tutorials',
  artCost: '--art-cost',
  artAgents: '--art-agents',
  artVibe: '--art-vibe',
  artCreative: '--art-creative',
  artLocal: '--art-local',
  artCareer: '--art-career',
  artModels: '--art-models',
  artNeutral: '--art-neutral',
  artText: '--art-text',
  artStage: '--art-stage',
};

/** Rendered px at the default 16px root — the unit e2e viewport contracts are written in. */
export function remToPx(rem: string): number {
  return Number.parseFloat(rem) * 16;
}

/**
 * Theme-independent custom properties declared in the `:root` block of `globals.css`.
 * `tokens:check` fails when the CSS drifts from these values.
 */
export const CSS_VARS_STATIC: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(PRIMITIVES.spacing)
      .filter(([step]) => step !== '0')
      .map(([step, value]) => [`--space-${step}`, value]),
  ),
  '--gutter': PRIMITIVES.sizes.gutter,
  '--section-y': PRIMITIVES.sizes.sectionY,
  '--icon-sm': PRIMITIVES.sizes.iconSm,
  '--icon-md': PRIMITIVES.sizes.iconMd,
  '--max': PRIMITIVES.sizes.max,
  '--max-wide': PRIMITIVES.sizes.maxWide,
  '--reading': PRIMITIVES.sizes.reading,
  '--header-h': PRIMITIVES.sizes.headerH,
  '--touch-target-min': `${PRIMITIVES.touchTargetMin}px`,
  '--control-sm': `${PRIMITIVES.controlSize.sm}px`,
  '--control-md': `${PRIMITIVES.controlSize.md}px`,
  '--control-lg': `${PRIMITIVES.controlSize.lg}px`,
  '--z-base': String(PRIMITIVES.zIndex.base),
  '--z-sticky': String(PRIMITIVES.zIndex.sticky),
  '--z-dropdown': String(PRIMITIVES.zIndex.dropdown),
  '--z-overlay': String(PRIMITIVES.zIndex.overlay),
  '--z-dialog': String(PRIMITIVES.zIndex.dialog),
  '--z-toast': String(PRIMITIVES.zIndex.toast),
  '--duration-fast': `${PRIMITIVES.motion.duration.fast}ms`,
  '--duration-standard': `${PRIMITIVES.motion.duration.standard}ms`,
  '--duration-entrance': `${PRIMITIVES.motion.duration.entrance}ms`,
  '--ease-standard': PRIMITIVES.motion.easing.standard,
  '--ease-soft': PRIMITIVES.motion.easing.soft,
  '--ease-release': PRIMITIVES.motion.easing.release,
  '--focus-width': `${PRIMITIVES.focus.width}px`,
  '--focus-offset': `${PRIMITIVES.focus.offset}px`,
};

function themedVars(theme: 'night' | 'day'): Record<string, string> {
  const shadows = PRIMITIVES.shadows[theme];
  const effects = PRIMITIVES.effects[theme];
  return {
    '--shadow-1': shadows.shadow1,
    '--shadow-2': shadows.shadow2,
    '--shadow-pop': shadows.pop,
    '--stage-light': effects.stageLight,
    '--sheen': effects.sheen,
    '--grain-opacity': effects.grainOpacity,
  };
}

/** Themed non-colour custom properties (`:root` = Night, the Day block overrides them). */
export const CSS_VARS_BY_THEME: Readonly<Record<'night' | 'day', Readonly<Record<string, string>>>> = {
  night: themedVars('night'),
  day: themedVars('day'),
};

/** Radii registered in the `@theme inline` block (Tailwind `rounded-*`). `lg` is Tailwind's own. */
export const CSS_THEME_RADII: Readonly<Record<string, string>> = {
  '--radius-xs': PRIMITIVES.radii.xs,
  '--radius-sm': PRIMITIVES.radii.sm,
  '--radius-md': PRIMITIVES.radii.md,
  '--radius-card': PRIMITIVES.radii.card,
  '--radius-pill': PRIMITIVES.radii.pill,
};

/** D5 breakpoints registered in the `@theme` block (Tailwind `min-width` and `max-*` variants). */
export const CSS_THEME_BREAKPOINTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PRIMITIVES.breakpoints).map(([name, value]) => [
    `--breakpoint-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`,
    value,
  ]),
);

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
