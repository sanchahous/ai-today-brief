import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  findSubFloorFonts,
  runContrastAudit,
  runDriftAudit,
} from '../../../scripts/check-design-tokens';
import {
  CSS_VAR_BY_ROLE,
  LEGACY_MIGRATION_MAP,
  PRIMITIVES,
  SEMANTIC_TOKENS,
  TOKENS_VERSION,
} from './tokens';

const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('Design Tokens & Accessibility Contrast', () => {
  it('is version 2.0.0', () => {
    expect(TOKENS_VERSION).toBe('2.0.0');
  });

  it('passes all WCAG AA contrast checks in runContrastAudit', () => {
    const result = runContrastAudit();
    expect(result.reports.filter((r) => r.includes('FAIL'))).toEqual([]);
    expect(result.pass).toBe(true);
    expect(result.reports.length).toBeGreaterThanOrEqual(90);
  });

  it('keeps --faint above 4.5:1 on every surface in both themes (regression: 3.5:1 in v1)', () => {
    for (const theme of ['night', 'day'] as const) {
      const t = SEMANTIC_TOKENS[theme];
      for (const surface of [t.bg, t.bgSoft, t.surface, t.surface2, t.raised]) {
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
