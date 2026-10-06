import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectDeclaredTokens,
  contrastRatio,
  findSubFloorFonts,
  runContrastAudit,
  runDocsAudit,
  runDriftAudit,
  TOKEN_DOC,
} from '../../../scripts/check-design-tokens';
import {
  NAV_BREAKPOINT_REM,
  NAV_COMPACT_LAST,
  NAV_WIDE_FIRST,
} from '../../../e2e/helpers/viewports';
import {
  CSS_THEME_BREAKPOINTS,
  CSS_VAR_BY_ROLE,
  CATEGORY_TOKEN_KEYS,
  CSS_VARS_BY_THEME,
  CSS_VARS_STATIC,
  DEPRECATED_TOKEN_PATTERNS,
  LEGACY_MIGRATION_MAP,
  PRIMITIVES,
  remToPx,
  SEMANTIC_TOKENS,
  TOKENS_VERSION,
} from './tokens';

const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const tokenDoc = readFileSync(join(process.cwd(), TOKEN_DOC), 'utf8');

describe('Design Tokens & Accessibility Contrast', () => {
  it('is version 3.0.0', () => {
    expect(TOKENS_VERSION).toBe('3.0.0');
  });

  it('passes all WCAG AA contrast checks in runContrastAudit', () => {
    const result = runContrastAudit();
    expect(result.reports.filter((r) => r.includes('FAIL'))).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it('checks at least 160 pairs and reports each one', () => {
    const result = runContrastAudit();
    expect(result.pairCount).toBeGreaterThanOrEqual(160);
    const lines = result.reports.filter((r) => /^\[(night|day)\] /.test(r));
    expect(lines).toHaveLength(result.pairCount);
  });

  it('prints the lowest category text ratio per theme (prototype 2.0: 6.41 and 5.22)', () => {
    const { categoryFloor, reports } = runContrastAudit();
    expect(categoryFloor.night).toBeGreaterThanOrEqual(6.41);
    expect(categoryFloor.day).toBeGreaterThanOrEqual(5.22);
    expect(reports.find((r) => r.startsWith('[summary]'))).toContain('lowest category text ratio');
  });

  it('covers every pair family of the v3 matrix in both themes', () => {
    const { reports } = runContrastAudit();
    const has = (theme: string, pair: string) => reports.some((r) => r.startsWith(`[${theme}] ${pair}:`));
    for (const theme of ['night', 'day']) {
      for (const pair of [
        'text on overlay',
        'catModels on raised',
        'artTools on artStage',
        'artText on artStage',
        'onAccent on accentFillHover',
        'accentHover on surface',
        'onVelvet on velvetDeep',
        'selectionText on selectionBg',
        'claret on velvet',
        'accentFill on raised',
        'focus on raised',
        'text(night) on stage',
        'accent(night) on stage',
        'signal(night) on stage',
      ]) {
        expect(has(theme, pair), `${theme}: ${pair}`).toBe(true);
      }
    }
  });

  it('fails the gate when a pair drops below its minimum', () => {
    const broken = (patch: Partial<Record<keyof typeof SEMANTIC_TOKENS.night, string>>, theme: 'night' | 'day') => ({
      ...SEMANTIC_TOKENS,
      [theme]: { ...SEMANTIC_TOKENS[theme], ...patch },
    });
    const cases: Array<[ReturnType<typeof broken>, string]> = [
      // A neon category colour on the light Day surfaces (the v1 problem this gate exists for).
      [broken({ catTools: '#7fcfae' }, 'day'), '[day] catTools on bg'],
      [broken({ faint: '#6a6a6a' }, 'night'), '[night] faint on bg'],
      [broken({ artText: '#1d211d' }, 'night'), '[night] artText on artStage'],
      [broken({ onVelvet: '#f3e1dc' }, 'day'), '[day] onVelvet on velvet'],
      [broken({ selectionText: '#d4b483' }, 'night'), '[night] selectionText on selectionBg'],
      [broken({ focus: '#282d29' }, 'night'), '[night] focus on bg'],
    ];
    for (const [semantic, expected] of cases) {
      const result = runContrastAudit(semantic);
      expect(result.pass).toBe(false);
      expect(result.reports.filter((r) => r.includes('<-- FAIL')).join('\n')).toContain(expected);
    }
  });

  it('takes brand colours on the stage from Night even in the Day theme', () => {
    const { reports } = runContrastAudit();
    const day = reports.find((r) => r.startsWith('[day] text(night) on stage:'));
    const night = reports.find((r) => r.startsWith('[night] text(night) on stage:'));
    expect(day).toBeDefined();
    expect(night).toBeDefined();
    // Day `text` is near-black: using it on the dark stage would fail, the brand colour passes.
    expect(contrastRatio(SEMANTIC_TOKENS.day.text, SEMANTIC_TOKENS.day.stage)).toBeLessThan(4.5);
    expect(day).not.toContain('FAIL');
  });

  it('keeps --faint above 4.5:1 on every surface in both themes (regression: 3.5:1 in v1)', () => {
    for (const theme of ['night', 'day'] as const) {
      const t = SEMANTIC_TOKENS[theme];
      for (const surface of [t.bg, t.bgDeep, t.surface, t.raised, t.overlay]) {
        expect(contrastRatio(t.faint, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    // The legacy production value the migration replaced.
    expect(contrastRatio('#6a6a6a', '#0f0f0f')).toBeLessThan(4.5);
  });

  it('defines valid semantic tokens for both night and day themes', () => {
    expect(SEMANTIC_TOKENS.night.bg).toBe('#171918');
    expect(SEMANTIC_TOKENS.night.accent).toBe('#d4b483');
    expect(SEMANTIC_TOKENS.day.bg).toBe('#efe8da');
    expect(SEMANTIC_TOKENS.day.accent).toBe('#72562e');
  });

  it('defines every role in both themes', () => {
    expect(Object.keys(SEMANTIC_TOKENS.day).sort()).toEqual(Object.keys(SEMANTIC_TOKENS.night).sort());
    expect(Object.keys(CSS_VAR_BY_ROLE).sort()).toEqual(Object.keys(SEMANTIC_TOKENS.night).sort());
  });

  it('guarantees touch target minimum is at least 44px and md control meets it', () => {
    expect(PRIMITIVES.touchTargetMin).toBeGreaterThanOrEqual(44);
    expect(PRIMITIVES.controlSize.md).toBeGreaterThanOrEqual(PRIMITIVES.touchTargetMin);
  });

  it('provides complete legacy migration map', () => {
    expect(LEGACY_MIGRATION_MAP['#0f0f0f']).toBe('var(--bg)');
    expect(LEGACY_MIGRATION_MAP['#f0c040']).toBe('var(--accent)');
  });
});

describe('globals.css sync', () => {
  it('covers all 54 category/surface pairs and keeps dark art immutable in Day', () => {
    const reports = runContrastAudit().reports.filter((line) => /\] cat\w+ on/.test(line));
    expect(reports).toHaveLength(54);
    expect(reports.every((line) => !line.includes('FAIL'))).toBe(true);
    for (const key of CATEGORY_TOKEN_KEYS) {
      const cssVar = `--art-${key}`;
      const role = Object.entries(CSS_VAR_BY_ROLE).find(([, name]) => name === cssVar)?.[0];
      expect(role).toBeDefined();
      // The lookup is constrained by the canonical role map above.
      const artRole = role as keyof typeof SEMANTIC_TOKENS.night;
      expect(SEMANTIC_TOKENS.day[artRole]).toBe(SEMANTIC_TOKENS.night[artRole]);
    }
  });

  it('rejects category drift and a Day art override', () => {
    expect(runDriftAudit(globalsCss.replace('--cat-tools: #1f6b4f;', '')).pass).toBe(false);
    expect(runDriftAudit(globalsCss.replaceAll('--art-tools: #7fcfae;', '--art-tools: #1f6b4f;')).pass).toBe(false);
  });
  it('mirrors SEMANTIC_TOKENS for both themes', () => {
    expect(runDriftAudit(globalsCss).reports).toEqual([]);
  });

  it('detects drift and a missing Day role', () => {
    const drifted = globalsCss.replace('--faint: #a3a197;', '--faint: #6a6a6a;');
    expect(runDriftAudit(drifted).pass).toBe(false);
    const noDayFaint = globalsCss.replace('--faint: #5a5e54;', '');
    expect(runDriftAudit(noDayFaint).reports.join('\n')).toContain('[drift:day] --faint');
  });
});

describe('non-colour token sync (AH-1.6)', () => {
  it('rejects a missing fluid size, reading rhythm, or display tracking (AH-1.5)', () => {
    for (const [from, expected] of [
      ['--text-xs: 0.8125rem;', '[drift:type] --text-xs'],
      ['--leading-reading: 1.78;', '[drift:root] --leading-reading'],
      ['--tracking-display: -0.032em;', '[drift:root] --tracking-display'],
      ['--measure: 68ch;', '[drift:root] --measure'],
      ['--tracking-display: -0.012em;', '[drift:type:uk] --tracking-display'],
    ]) {
      const result = runDriftAudit(globalsCss.replace(from, ''));
      expect(result.pass).toBe(false);
      expect(result.reports.join('\n')).toContain(expected);
    }
  });

  it('reports drift in a static, a themed, a radius and a breakpoint token', () => {
    const cases: Array<[string, string, string]> = [
      ['--space-4: 16px;', '--space-4: 18px;', '[drift:root] --space-4'],
      ['--focus-offset: 3px;', '--focus-offset: 2px;', '[drift:root] --focus-offset'],
      ['--radius-md: 8px;', '--radius-md: 6px;', '[drift:radii] --radius-md'],
      ['--breakpoint-tablet: 60rem;', '--breakpoint-tablet: 64rem;', '[drift:breakpoint] --breakpoint-tablet'],
      ['--z-dialog: 90;', '--z-dialog: 95;', '[drift:root] --z-dialog'],
    ];
    for (const [from, to, expected] of cases) {
      expect(globalsCss).toContain(from);
      const report = runDriftAudit(globalsCss.replace(from, to));
      expect(report.pass).toBe(false);
      expect(report.reports.join('\n')).toContain(expected);
    }
  });

  it('requires a Day value for every themed shadow and effect', () => {
    const dayShadow = CSS_VARS_BY_THEME.day['--shadow-1'];
    expect(dayShadow).not.toBe(CSS_VARS_BY_THEME.night['--shadow-1']);
    // Remove the Day declaration only (the Night one is a different string).
    const noDay = globalsCss.replace(/--shadow-1: 0 1px 0 rgb\(255 255 255 \/ 0\.7\) inset[^;]*;/, '');
    const report = runDriftAudit(noDay);
    expect(report.reports.join('\n')).toContain('[drift:day] --shadow-1: css=MISSING');
  });

  it('compares multi-line values after collapsing whitespace', () => {
    const reflowed = globalsCss.replace(
      '--shadow-2: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 22px 48px -24px rgb(0 0 0 / 0.85);',
      '--shadow-2:\n    0 1px 0 rgb(255 255 255 / 0.04) inset,\n    0 22px 48px -24px rgb(0 0 0 / 0.85);',
    );
    expect(reflowed).not.toBe(globalsCss);
    expect(runDriftAudit(reflowed).reports).toEqual([]);
  });

  it('keeps the scales ordered and on the agreed values', () => {
    const { radii, zIndex, motion, focus } = PRIMITIVES;
    expect([radii.xs, radii.sm, radii.md, radii.card, radii.pill]).toEqual(['3px', '4px', '8px', '14px', '9999px']);
    const layers = [zIndex.base, zIndex.sticky, zIndex.dropdown, zIndex.overlay, zIndex.dialog, zIndex.toast, zIndex.modal];
    expect([...layers].sort((a, b) => a - b)).toEqual(layers);
    expect(new Set(layers).size).toBe(layers.length);
    expect(motion.duration).toEqual({ fast: 160, standard: 320, entrance: 640 });
    for (const curve of Object.values(motion.easing)) {
      expect(curve).toMatch(/^cubic-bezier\(-?[\d.]+, -?[\d.]+, -?[\d.]+, -?[\d.]+\)$/);
    }
    expect(focus).toEqual({ width: 2, offset: 3 });
  });

  it('updates the header to its rendered 76px for AH-3.3 and records the prototype value', () => {
    expect(CSS_VARS_STATIC['--header-h']).toBe('76px');
    expect(PRIMITIVES.sizes.headerHPrototype).toBe('72px');
  });

  it('aligns default Tailwind breakpoints with D5 (sm / md / lg / xl)', () => {
    expect(CSS_THEME_BREAKPOINTS['--breakpoint-sm']).toBe(PRIMITIVES.breakpoints.narrow);
    expect(CSS_THEME_BREAKPOINTS['--breakpoint-md']).toBe(PRIMITIVES.breakpoints.phone);
    expect(CSS_THEME_BREAKPOINTS['--breakpoint-lg']).toBe(PRIMITIVES.breakpoints.tablet);
    expect(CSS_THEME_BREAKPOINTS['--breakpoint-xl']).toBe(PRIMITIVES.breakpoints.desktop);
    expect(globalsCss).toContain('--breakpoint-sm: 25rem;');
    expect(globalsCss).toContain('--breakpoint-lg: 60rem;');
  });
});

describe('D5 breakpoint contract', () => {
  it('turns the nav breakpoint into 959 / 960 px viewports', () => {
    const tablet = remToPx(PRIMITIVES.breakpoints.tablet);
    expect(tablet).toBe(960);
    expect(NAV_BREAKPOINT_REM * 16).toBe(tablet);
    expect(NAV_COMPACT_LAST.width).toBe(tablet - 1);
    expect(NAV_WIDE_FIRST.width).toBe(tablet);
  });

  it('matches the prototype values in px at the default root size', () => {
    const px = Object.fromEntries(Object.entries(PRIMITIVES.breakpoints).map(([k, v]) => [k, remToPx(v)]));
    expect(px).toEqual({
      compact: 380,
      narrow: 400,
      phone: 760,
      tablet: 960,
      laptop: 1100,
      navCompact: 1180,
      desktop: 1280,
    });
  });
});

describe('token documentation gate (M1)', () => {
  it('documents every declared token in the registry page', () => {
    expect(runDocsAudit(globalsCss, tokenDoc).reports).toEqual([]);
  });

  it('resolves Tailwind alias registrations to their target and lists real tokens', () => {
    const declared = collectDeclaredTokens(globalsCss);
    expect(declared).not.toContain('--color-bg');
    expect(declared).not.toContain('--spacing-gutter');
    expect(declared).toEqual(expect.arrayContaining(['--bg', '--gutter', '--shadow-1', '--focus-offset', '--breakpoint-tablet']));
  });

  it('names an undocumented token instead of passing silently', () => {
    const withNew = globalsCss.replace('--focus-offset: 3px;', '--focus-offset: 3px;\n  --brand-new-token: 1px;');
    const report = runDocsAudit(withNew, tokenDoc);
    expect(report.pass).toBe(false);
    expect(report.reports.join('\n')).toContain('--brand-new-token');
  });

  it('flags a token removed from the docs', () => {
    const report = runDocsAudit(globalsCss, tokenDoc.replace('`--ease-release`', '`--renamed`'));
    expect(report.pass).toBe(false);
    expect(report.reports.join('\n')).toContain('--ease-release');
  });
});

describe('deprecated token aliases (AH-7.3)', () => {
  it('has zero deprecated token names under src/', () => {
    const root = join(process.cwd(), 'src');
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx|css)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
          const rel = relative(process.cwd(), path).replace(/\\/g, '/');
          if (rel === 'src/lib/design-system/tokens.ts') continue;
          const text = readFileSync(path, 'utf8');
          for (const pattern of DEPRECATED_TOKEN_PATTERNS) {
            if (text.includes(pattern)) hits.push(`${rel}: ${pattern}`);
          }
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

describe('12px font floor', () => {
  it('flags Tailwind arbitrary sizes and CSS font-size below 12px', () => {
    const hits = findSubFloorFonts([
      { path: 'a.tsx', text: '<i className="text-[11px] md:text-[0.7rem]" />' },
      { path: 'b.css', text: '.x { font-size: 10px; }' },
    ]);
    expect(hits).toHaveLength(3);
  });

  it('accepts 12px and above', () => {
    expect(
      findSubFloorFonts([
        { path: 'a.tsx', text: 'text-2xs text-[0.75rem] text-[12px] text-[0.92rem] font-size: 0.85rem' },
      ]),
    ).toEqual([]);
  });
});
