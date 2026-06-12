import { describe, expect, it } from 'vitest';

import {
  getPromptLintRule,
  OFFICIAL_PROMPT_SNIPPETS,
  PROMPT_LINT_RULES,
  type PromptSeverity,
} from './prompt-lint-rules';

const SEVERITIES: readonly PromptSeverity[] = ['issue', 'suggestion', 'info'];

describe('PROMPT_LINT_RULES', () => {
  it('contains 13 unique model-keyed rules from the Prompt Optimizer concept', () => {
    expect(PROMPT_LINT_RULES).toHaveLength(13);
    expect(new Set(PROMPT_LINT_RULES.map((rule) => rule.id)).size).toBe(13);

    for (const rule of PROMPT_LINT_RULES) {
      expect(rule.modelGuidance).toBeDefined();
      expect(Object.keys(rule.modelGuidance).sort()).toEqual([
        'fable-5',
        'haiku-4-5',
        'opus-4-8',
        'sonnet-4-6',
      ]);
    }
  });

  it('ships bilingual UI/catalog text and citation-backed recommendations for every rule', () => {
    for (const rule of PROMPT_LINT_RULES) {
      expect(rule.title.en).not.toEqual('');
      expect(rule.title.uk).not.toEqual('');
      expect(rule.triggerSummary.en).not.toEqual('');
      expect(rule.triggerSummary.uk).not.toEqual('');
      expect(rule.recommendation.en).not.toEqual('');
      expect(rule.recommendation.uk).not.toEqual('');
      expect(rule.explainer.en).not.toEqual('');
      expect(rule.explainer.uk).not.toEqual('');
      expect(rule.citations.length).toBeGreaterThan(0);
      expect(SEVERITIES).toContain(rule.severity);

      for (const citation of rule.citations) {
        expect(citation.url).toMatch(/^https:\/\/docs\.anthropic\.com\//);
        expect(citation.quote.en ?? citation.quote.uk).toBeTruthy();
      }
    }
  });

  it('gates surface-specific and model-specific rules in data', () => {
    expect(PROMPT_LINT_RULES.find((rule) => rule.id === 'reasoning-echo')?.appliesTo.surfaces).toEqual([
      'api',
      'claude-code',
    ]);
    expect(PROMPT_LINT_RULES.find((rule) => rule.id === 'fable-overprescription')?.appliesTo.models).toEqual([
      'fable-5',
    ]);
    expect(PROMPT_LINT_RULES.find((rule) => rule.id === 'fable-effort-guidance')?.appliesTo.models).toEqual([
      'sonnet-4-6',
      'fable-5',
      'opus-4-8',
    ]);
  });

  it('looks up rules by stable id', () => {
    expect(getPromptLintRule('structure-sections')?.title.en).toBe('Add explicit sections');
    expect(getPromptLintRule('missing-rule')).toBeUndefined();
  });
});

describe('OFFICIAL_PROMPT_SNIPPETS', () => {
  it('contains unique bilingual snippets with placement labels and citations', () => {
    expect(OFFICIAL_PROMPT_SNIPPETS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(OFFICIAL_PROMPT_SNIPPETS.map((snippet) => snippet.id)).size).toBe(
      OFFICIAL_PROMPT_SNIPPETS.length,
    );

    for (const snippet of OFFICIAL_PROMPT_SNIPPETS) {
      expect(snippet.title.en).not.toEqual('');
      expect(snippet.title.uk).not.toEqual('');
      expect(snippet.purpose.en).not.toEqual('');
      expect(snippet.purpose.uk).not.toEqual('');
      expect(['system-prompt', 'user-message', 'harness']).toContain(snippet.placement);
      expect(snippet.snippet).not.toEqual('');
      expect(snippet.citations[0]?.url).toMatch(/^https:\/\/docs\.anthropic\.com\//);
    }
  });
});
