import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  CSS_VAR_BY_ROLE,
  CATEGORY_TOKEN_KEYS,
  PRIMITIVES,
  SEMANTIC_TOKENS,
  TOKENS_VERSION,
} from '../src/lib/design-system/tokens';

type Rgb = { r: number; g: number; b: number };
type Theme = 'night' | 'day';
type Role = keyof typeof SEMANTIC_TOKENS.night;

const ROOT = join(__dirname, '..');
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

interface PairRule {
  fg: Role;
  bg: Role;
  min: number;
  kind: 'text' | 'ui';
}

/** Every text role must reach 4.5:1 on every surface it can sit on; UI strokes need 3:1. */
const SURFACES: Role[] = ['bg', 'bgSoft', 'surface', 'surface2', 'raised'];
const PAIR_RULES: PairRule[] = [
  ...CATEGORY_TOKEN_KEYS.flatMap((key) =>
    (['bg', 'surface', 'raised'] as const).map((bg): PairRule => ({
      // Category roles share the same closed key set as the slug mapping.
      fg: `cat${key[0].toUpperCase()}${key.slice(1)}` as Role,
      bg, min: 4.5, kind: 'text',
    })),
  ),
  ...(['text', 'muted', 'faint', 'accent', 'signal', 'claret', 'error', 'success', 'warning'] as Role[]).flatMap(
    (fg) => SURFACES.map((bg): PairRule => ({ fg, bg, min: 4.5, kind: 'text' })),
  ),
  { fg: 'onAccent', bg: 'accent', min: 4.5, kind: 'text' },
  ...(['lineStrong', 'focus', 'accent'] as Role[]).flatMap((fg) =>
    (['bg', 'surface'] as Role[]).map((bg): PairRule => ({ fg, bg, min: 3, kind: 'ui' })),
  ),
];

export function runContrastAudit(): { pass: boolean; reports: string[] } {
  const reports: string[] = [];
  let pass = true;

  for (const theme of THEMES) {
    const t = SEMANTIC_TOKENS[theme];
    for (const rule of PAIR_RULES) {
      const ratio = contrastRatio(t[rule.fg], t[rule.bg]);
      const ok = ratio >= rule.min;
      if (!ok) pass = false;
      reports.push(
        `[${theme}] ${rule.fg} on ${rule.bg}: ${ratio.toFixed(2)}:1 (${rule.kind}, min ${rule.min}:1)${ok ? '' : '  <-- FAIL'}`,
      );
    }
  }

  reports.push(`[WCAG AA] Touch target minimum: ${PRIMITIVES.touchTargetMin}px (Min 44px required)`);
  if (PRIMITIVES.touchTargetMin < 44) pass = false;

  return { pass, reports };
}

/** Extract `--name: value;` declarations from the first CSS block that follows `selector`. */
function readBlock(css: string, selectorRe: RegExp): Map<string, string> {
  const match = selectorRe.exec(css);
  const out = new Map<string, string>();
  if (!match) return out;
  const start = css.indexOf('{', match.index) + 1;
  const end = css.indexOf('}', start);
  for (const decl of css.slice(start, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(decl[1], decl[2].trim().toLowerCase());
  }
  return out;
}

/** globals.css must mirror SEMANTIC_TOKENS for both themes (no drift, no missing Day role). */
export function runDriftAudit(css: string): { pass: boolean; reports: string[] } {
  const reports: string[] = [];
  let pass = true;
  const blocks: Record<Theme, Map<string, string>> = {
    night: readBlock(css, /\/\* dark-first[^\n]*\*\/\s*:root\s*\{/),
    day: readBlock(css, /\.theme-light,\s*html\[data-theme='day'\]\s*\{/),
  };
  for (const theme of THEMES) {
    for (const [role, cssVar] of Object.entries(CSS_VAR_BY_ROLE)) {
      const expected = SEMANTIC_TOKENS[theme][role as Role].toLowerCase();
      const actual = blocks[theme].get(cssVar);
      if (actual !== expected) {
        pass = false;
        reports.push(`[drift:${theme}] ${cssVar}: css=${actual ?? 'MISSING'} tokens.ts=${expected}`);
      }
    }
  }
  return { pass, reports };
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
  const fonts = findSubFloorFonts(
    walk(join(ROOT, 'src')).map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') })),
  );

  console.log(`Design tokens v${TOKENS_VERSION}`);
  for (const line of contrast.reports) console.log(line);
  for (const line of drift.reports) console.error(line);
  for (const line of fonts) console.error(`[font-floor] ${line}`);

  const failed = !contrast.pass || !drift.pass || fonts.length > 0;
  if (failed) {
    console.error(
      `FAIL: contrast=${contrast.pass ? 'ok' : 'fail'} drift=${drift.pass ? 'ok' : 'fail'} fontFloorViolations=${fonts.length}`,
    );
    process.exit(1);
  }
  console.log('PASS: contrast (WCAG 2.2 AA), globals.css sync, 12px font floor.');
}
