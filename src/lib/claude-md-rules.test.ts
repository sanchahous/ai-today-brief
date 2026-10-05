import { describe, expect, it } from 'vitest';

import {
  CLAUDE_MD_CITATIONS,
  CLAUDE_MD_RULES,
  getClaudeMdRule,
} from './claude-md-rules';

describe('claude-md-rules', () => {
  it('defines 10 distinct rules with bilingual content and citations', () => {
    expect(CLAUDE_MD_RULES.length).toBe(10);
    const ids = new Set(CLAUDE_MD_RULES.map((rule) => rule.id));
    expect(ids.size).toBe(10);

    for (const rule of CLAUDE_MD_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.title.en).toBeTruthy();
      expect(rule.title.uk).toBeTruthy();
      expect(rule.description.en).toBeTruthy();
      expect(rule.description.uk).toBeTruthy();
      expect(rule.rationale.en).toBeTruthy();
      expect(rule.rationale.uk).toBeTruthy();
      expect(rule.citations.length).toBeGreaterThan(0);
      for (const citation of rule.citations) {
        expect(citation.label).toBeTruthy();
        expect(citation.url).toMatch(/^https?:\/\//);
        expect(citation.quote.en).toBeTruthy();
        expect(citation.quote.uk).toBeTruthy();
      }
    }
  });

  it('defines official citations array with 5 entries', () => {
    expect(CLAUDE_MD_CITATIONS.length).toBe(5);
    for (const citation of CLAUDE_MD_CITATIONS) {
      expect(citation.label).toBeTruthy();
      expect(citation.url).toBeTruthy();
      expect(citation.quote.en).toBeTruthy();
      expect(citation.quote.uk).toBeTruthy();
    }
  });

  it('retrieves rule by ID via getClaudeMdRule', () => {
    const rule = getClaudeMdRule('shared-agents-truth');
    expect(rule).toBeDefined();
    expect(rule?.title.en).toBe('AGENTS.md as shared truth');

    expect(getClaudeMdRule('non-existent')).toBeUndefined();
  });
});
