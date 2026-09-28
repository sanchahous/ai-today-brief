import { describe, expect, it } from 'vitest';
import { runContrastAudit } from '../../../scripts/check-design-tokens';
import { PRIMITIVES, SEMANTIC_TOKENS, LEGACY_MIGRATION_MAP } from './tokens';

describe('Design Tokens & Accessibility Contrast', () => {
  it('passes all WCAG AA contrast checks in runContrastAudit', () => {
    const result = runContrastAudit();
    expect(result.pass).toBe(true);
    expect(result.reports.length).toBeGreaterThanOrEqual(9);
  });

  it('defines valid semantic tokens for both night and day themes', () => {
    expect(SEMANTIC_TOKENS.night.bg).toBe('#171918');
    expect(SEMANTIC_TOKENS.night.accent).toBe('#d4b483');
    expect(SEMANTIC_TOKENS.day.bg).toBe('#f0e9dc');
    expect(SEMANTIC_TOKENS.day.accent).toBe('#72562e');
  });

  it('guarantees touch target minimum is at least 44px', () => {
    expect(PRIMITIVES.touchTargetMin).toBeGreaterThanOrEqual(44);
  });

  it('provides complete legacy migration map', () => {
    expect(LEGACY_MIGRATION_MAP['#0f0f0f']).toBe('var(--bg)');
    expect(LEGACY_MIGRATION_MAP['#f0c040']).toBe('var(--accent)');
  });
});
