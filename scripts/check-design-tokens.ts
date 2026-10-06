import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  CSS_THEME_BREAKPOINTS,
  CSS_THEME_RADII,
  CSS_THEME_TYPOGRAPHY,
  CSS_VAR_BY_ROLE,
  CATEGORY_TOKEN_KEYS,
  CSS_VARS_BY_THEME,
  CSS_VARS_STATIC,
  CSS_VARS_UK_TYPOGRAPHY,
  PRIMITIVES,
  SEMANTIC_TOKENS,
  TOKENS_VERSION,
} from '../src/lib/design-system/tokens';

type Rgb = { r: number; g: number; b: number };
type Theme = 'night' | 'day';
type Role = keyof typeof SEMANTIC_TOKENS.night;

const ROOT = join(__dirname, '..');
export const TOKEN_DOC = 'wiki/architecture/design-system-tokens.md';
const THEMES: Theme[] = ['night', 'day'];

function hexToRgb(hex: string): Rgb {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

type ContrastKind = 'text' | 'ui';
type SemanticSet = Readonly<Record<Theme, Readonly<Record<Role, string>>>>;

interface PairRule {
  fg: Role;
  bg: Role;
  min: number;
  kind: ContrastKind;
  /** Take the foreground from another theme: brand colours on the always-dark `stage`. */
  fgTheme?: Theme;
}

const TEXT_MIN = 4.5;
const UI_MIN = 3;

/** Every text role must reach 4.5:1 on every surface it can sit on; UI strokes need 3:1. */
const SURFACES: Role[] = ['bg', 'bgDeep', 'surface', 'raised', 'overlay'];
const TEXT_ROLES: Role[] = ['text', 'muted', 'faint', 'accent', 'signal', 'claret', 'error', 'success', 'warning'];
const CATEGORY_ROLES = CATEGORY_TOKEN_KEYS.map((key) => `cat${key[0].toUpperCase()}${key.slice(1)}` as Role);
const ART_ROLES = [
  ...CATEGORY_TOKEN_KEYS.map((key) => `art${key[0].toUpperCase()}${key.slice(1)}` as Role),
  'artNeutral',
  'artText',
] as Role[];

const pairs = (fgs: Role[], bgs: Role[], min: number, kind: ContrastKind): PairRule[] =>
  fgs.flatMap((fg) => bgs.map((bg): PairRule => ({ fg, bg, min, kind })));

/**
 * The After Hours v3 matrix (ported from artifacts/after-hours/qa/check-tokens.mjs, extended to the
 * roles that exist in code): one gate for text, category, art, velvet, selection and UI pairs in
 * both themes. `npm run tokens:check` and `tokens.test.ts` (therefore `pr:check`) fail on any pair
 * below its minimum.
 */
const PAIR_RULES: PairRule[] = [
  // Text roles on every surface they can sit on.
  ...pairs(TEXT_ROLES, SURFACES, TEXT_MIN, 'text'),
  // Hover states and skeletons live on the overlay layer.
  ...pairs(['text', 'muted', 'faint', 'accent'], ['overlay'], TEXT_MIN, 'text'),
  // Category colours (AH-1.4) are used as text, so they need full text contrast.
  ...pairs(CATEGORY_ROLES, ['bg', 'surface', 'raised'], TEXT_MIN, 'text'),
  // Banner art always sits on the dark stage, in both themes.
  ...pairs(ART_ROLES, ['artStage'], TEXT_MIN, 'text'),
  // Accent fill, its hover, and the hover text colour.
  ...pairs(['onAccent'], ['accent', 'accentFill', 'accentFillHover'], TEXT_MIN, 'text'),
  ...pairs(['accentHover'], ['bg', 'surface', 'raised'], TEXT_MIN, 'text'),
  // Velvet blocks and text selection.
  ...pairs(['onVelvet'], ['velvet', 'velvetDeep'], TEXT_MIN, 'text'),
  ...pairs(['selectionText'], ['selectionBg'], TEXT_MIN, 'text'),
  ...pairs(['claret'], ['velvet'], UI_MIN, 'ui'),
  // Control edges, focus ring and fills against the surfaces they are drawn on.
  ...pairs(['lineStrong', 'focus', 'accentFill'], ['bg', 'surface', 'raised'], UI_MIN, 'ui'),
  ...pairs(['accent'], ['bg', 'surface'], UI_MIN, 'ui'),
  // The brand stays dark: Night paper / brass / celadon on `stage` in both themes.
  ...(['text', 'accent', 'signal'] as Role[]).map(
    (fg): PairRule => ({ fg, bg: 'stage', min: TEXT_MIN, kind: 'text', fgTheme: 'night' }),
  ),
];

/** Lowest text ratio among the category roles, per theme — the headline number of the gate. */
export interface CategoryFloor {
  night: number;
  day: number;
}

export function runContrastAudit(semantic: SemanticSet = SEMANTIC_TOKENS): {
  pass: boolean;
  reports: string[];
  pairCount: number;
  categoryFloor: CategoryFloor;
} {
  const reports: string[] = [];
  const categoryFloor: CategoryFloor = { night: Infinity, day: Infinity };
  let pass = true;
  let pairCount = 0;

  for (const theme of THEMES) {
    for (const rule of PAIR_RULES) {
      const fgTheme = rule.fgTheme ?? theme;
      const ratio = contrastRatio(semantic[fgTheme][rule.fg], semantic[theme][rule.bg]);
      const ok = ratio >= rule.min;
      if (!ok) pass = false;
      pairCount += 1;
      if (CATEGORY_ROLES.includes(rule.fg)) categoryFloor[theme] = Math.min(categoryFloor[theme], ratio);
      const fgLabel = rule.fgTheme ? `${rule.fg}(${rule.fgTheme})` : rule.fg;
      reports.push(
        `[${theme}] ${fgLabel} on ${rule.bg}: ${ratio.toFixed(2)}:1 (${rule.kind}, min ${rule.min}:1)${ok ? '' : '  <-- FAIL'}`,
      );
    }
  }

  reports.push(
    `[summary] ${pairCount} pairs; lowest category text ratio: night ${categoryFloor.night.toFixed(2)}:1, day ${categoryFloor.day.toFixed(2)}:1`,
  );
  reports.push(`[WCAG AA] Touch target minimum: ${PRIMITIVES.touchTargetMin}px (Min 44px required)`);
  if (PRIMITIVES.touchTargetMin < 44) pass = false;

  return { pass, reports, pairCount, categoryFloor };
}

/** Lowercase and collapse whitespace so multi-line values compare equal to their tokens.ts form. */
const normalizeValue = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

/** Extract `--name: value;` declarations from the first CSS block that follows `selector`. */
function readBlock(css: string, selectorRe: RegExp): Map<string, string> {
  const match = selectorRe.exec(css);
  const out = new Map<string, string>();
  if (!match) return out;
  const start = css.indexOf('{', match.index) + 1;
  const end = css.indexOf('}', start);
  for (const decl of css.slice(start, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(decl[1], normalizeValue(decl[2]));
  }
  return out;
}

/** The four custom-property blocks of `globals.css` that make up the token contract. */
function readTokenBlocks(css: string) {
  return {
    night: readBlock(css, /\/\* dark-first[^\n]*\*\/\s*:root\s*\{/),
    day: readBlock(css, /\.theme-light,\s*html\[data-theme='day'\]\s*\{/),
    themeInline: readBlock(css, /@theme inline\s*\{/),
    theme: readBlock(css, /@theme\s*\{/),
    uk: readBlock(css, /html\[lang='uk'\],\s*\[lang='uk'\]\s*\{/),
  };
}

/**
 * globals.css must mirror tokens.ts: semantic colours for both themes (no drift, no missing Day
 * role), and every non-colour token (space, radii, shadows, effects, sizes, layers, motion, focus,
 * D5 breakpoints).
 */
export function runDriftAudit(css: string): { pass: boolean; reports: string[] } {
  const reports: string[] = [];
  let pass = true;
  const blocks = readTokenBlocks(css);
  const compare = (label: string, block: Map<string, string>, cssVar: string, expected: string) => {
    const wanted = normalizeValue(expected);
    const actual = block.get(cssVar);
    if (actual !== wanted) {
      pass = false;
      reports.push(`[drift:${label}] ${cssVar}: css=${actual ?? 'MISSING'} tokens.ts=${wanted}`);
    }
  };

  for (const theme of THEMES) {
    for (const [role, cssVar] of Object.entries(CSS_VAR_BY_ROLE)) {
      compare(theme, blocks[theme], cssVar, SEMANTIC_TOKENS[theme][role as Role]);
    }
    for (const [cssVar, value] of Object.entries(CSS_VARS_BY_THEME[theme])) {
      compare(theme, blocks[theme], cssVar, value);
    }
  }
  for (const [cssVar, value] of Object.entries(CSS_VARS_STATIC)) compare('root', blocks.night, cssVar, value);
  for (const [cssVar, value] of Object.entries(CSS_THEME_RADII)) compare('radii', blocks.themeInline, cssVar, value);
  for (const [cssVar, value] of Object.entries(CSS_THEME_TYPOGRAPHY)) compare('type', blocks.themeInline, cssVar, value);
  for (const [cssVar, value] of Object.entries(CSS_VARS_UK_TYPOGRAPHY)) compare('type:uk', blocks.uk, cssVar, value);
  for (const [cssVar, value] of Object.entries(CSS_THEME_BREAKPOINTS)) {
    compare('breakpoint', blocks.theme, cssVar, value);
  }
  return { pass, reports };
}

/** A registration such as `--color-bg: var(--bg)` is documented through its target. */
function documentedName(name: string, value: string): string {
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? alias[1] : name;
}

/** Every custom property the token contract declares, alias registrations resolved to their target. */
export function collectDeclaredTokens(css: string): string[] {
  const names = new Set<string>();
  for (const block of Object.values(readTokenBlocks(css))) {
    for (const [name, value] of block) names.add(documentedName(name, value));
  }
  return [...names].sort();
}

/** M1 gate: every declared token must appear, in backticks, in the token registry page. */
export function runDocsAudit(css: string, markdown: string): { pass: boolean; reports: string[] } {
  const documented = new Set([...markdown.matchAll(/`(--[\w-]+)`/g)].map((m) => m[1]));
  const missing = collectDeclaredTokens(css).filter((name) => !documented.has(name));
  return {
    pass: missing.length === 0,
    reports: missing.map(
      (name) => `[docs] ${name} is declared in globals.css but not documented in wiki/architecture/design-system-tokens.md`,
    ),
  };
}

const FONT_EXTS = new Set(['.tsx', '.ts', '.css']);
const REM_PX = 16;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (FONT_EXTS.has(full.slice(full.lastIndexOf('.'))) && !/\.test\.tsx?$/.test(name)) files.push(full);
  }
  return files;
}

/** No arbitrary Tailwind size or CSS font-size below the 12px floor. */
export function findSubFloorFonts(files: Array<{ path: string; text: string }>): string[] {
  const hits: string[] = [];
  const re = /(?:text-\[|font-size:\s*)(\d*\.?\d+)(px|rem)\]?/g;
  for (const { path, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const px = m[2] === 'rem' ? Number(m[1]) * REM_PX : Number(m[1]);
        if (px < PRIMITIVES.typography.minFontPx) hits.push(`${path}:${i + 1}  ${m[0]} = ${px.toFixed(1)}px`);
      }
    });
  }
  return hits;
}

if (process.argv[1]?.endsWith('check-design-tokens.ts')) {
  const contrast = runContrastAudit();
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
  const drift = runDriftAudit(css);
  const docs = runDocsAudit(css, readFileSync(join(ROOT, TOKEN_DOC), 'utf8'));
  const fonts = findSubFloorFonts(
    walk(join(ROOT, 'src')).map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') })),
  );

  console.log(`Design tokens v${TOKENS_VERSION}`);
  for (const line of contrast.reports) console.log(line);
  for (const line of drift.reports) console.error(line);
  for (const line of docs.reports) console.error(line);
  for (const line of fonts) console.error(`[font-floor] ${line}`);

  const failed = !contrast.pass || !drift.pass || !docs.pass || fonts.length > 0;
  if (failed) {
    console.error(
      `FAIL: contrast=${contrast.pass ? 'ok' : 'fail'} drift=${drift.pass ? 'ok' : 'fail'} docs=${docs.pass ? 'ok' : 'fail'} fontFloorViolations=${fonts.length}`,
    );
    process.exit(1);
  }
  console.log('PASS: contrast (WCAG 2.2 AA), globals.css sync, token docs, 12px font floor.');
}
