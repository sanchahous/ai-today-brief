import { describe, expect, it } from 'vitest';

import { PROMPT_LINT_CITATIONS, PROMPT_LINT_RULES } from '@/lib/prompt-lint-rules';
import { SETTINGS_BUILDER_CITATIONS, SETTINGS_BUILDER_RULES } from '@/lib/settings-builder-rules';
import { CLAUDE_MD_CITATIONS, CLAUDE_MD_RULES } from '@/lib/claude-md-rules';
import { getTool, TOOLS, type ToolSlug } from './tools';

const WAVE_1_TOOL_SLUGS: readonly ToolSlug[] = [
  'prompt-optimizer',
  'settings-builder',
  'claude-md-generator',
];

describe('TOOLS', () => {
  it('contains unique Wave 1 slugs with locale-aware hrefs', () => {
    expect(new Set(TOOLS.map((tool) => tool.slug)).size).toBe(TOOLS.length);
    expect(TOOLS.map((tool) => tool.slug)).toEqual(WAVE_1_TOOL_SLUGS);

    for (const slug of WAVE_1_TOOL_SLUGS) {
      const tool = getTool(slug);
      expect(tool).toBeDefined();
      expect(tool?.href('en')).toBe(`/en/tools/${slug}`);
      expect(tool?.href('uk')).toBe(`/uk/tools/${slug}`);
      expect(tool?.title.en).toBeTruthy();
      expect(tool?.title.uk).toBeTruthy();
      expect(tool?.description.en).toBeTruthy();
      expect(tool?.description.uk).toBeTruthy();
      expect(tool?.lede.en).toBeTruthy();
      expect(tool?.lede.uk).toBeTruthy();
      expect(tool?.output.en).toBeTruthy();
      expect(tool?.output.uk).toBeTruthy();
    }
  });

  it('keeps shipped Wave 1 tools live', () => {
    expect(getTool('prompt-optimizer')?.status).toBe('live');
    expect(getTool('prompt-optimizer')?.title.en).toContain('Prompt Optimizer');
    expect(getTool('prompt-optimizer')?.title.uk).toContain('оптимізатор');

    expect(getTool('settings-builder')?.status).toBe('live');
    expect(getTool('settings-builder')?.title.en).toContain('settings.json Builder');
    expect(getTool('settings-builder')?.lastVerified).toBe('2026-07-16');
    expect(getTool('claude-md-generator')?.status).toBe('live');
    expect(getTool('claude-md-generator')?.lastVerified).toBe('2026-07-16');
  });

  it('ensures rule and citation counters strictly equal lengths of arrays in code', () => {
    const promptOptimizer = getTool('prompt-optimizer');
    expect(promptOptimizer).toBeDefined();
    expect(promptOptimizer?.rulesCount).toBe(PROMPT_LINT_RULES.length);
    expect(promptOptimizer?.citationsCount).toBe(PROMPT_LINT_CITATIONS.length);
    expect(PROMPT_LINT_RULES.length).toBe(13);
    expect(PROMPT_LINT_CITATIONS.length).toBe(2);

    const settingsBuilder = getTool('settings-builder');
    expect(settingsBuilder).toBeDefined();
    expect(settingsBuilder?.rulesCount).toBe(SETTINGS_BUILDER_RULES.length);
    expect(settingsBuilder?.citationsCount).toBe(SETTINGS_BUILDER_CITATIONS.length);
    expect(SETTINGS_BUILDER_RULES.length).toBe(25);
    expect(SETTINGS_BUILDER_CITATIONS.length).toBe(5);

    const claudeMdGenerator = getTool('claude-md-generator');
    expect(claudeMdGenerator).toBeDefined();
    expect(claudeMdGenerator?.rulesCount).toBe(CLAUDE_MD_RULES.length);
    expect(claudeMdGenerator?.citationsCount).toBe(CLAUDE_MD_CITATIONS.length);
    expect(CLAUDE_MD_RULES.length).toBe(10);
    expect(CLAUDE_MD_CITATIONS.length).toBe(5);

    const totalRules = TOOLS.reduce((acc, t) => acc + t.rulesCount, 0);
    const expectedTotalRules =
      PROMPT_LINT_RULES.length + SETTINGS_BUILDER_RULES.length + CLAUDE_MD_RULES.length;
    expect(totalRules).toBe(expectedTotalRules);

    const totalCitations = TOOLS.reduce((acc, t) => acc + t.citationsCount, 0);
    const expectedTotalCitations =
      PROMPT_LINT_CITATIONS.length +
      SETTINGS_BUILDER_CITATIONS.length +
      CLAUDE_MD_CITATIONS.length;
    expect(totalCitations).toBe(expectedTotalCitations);
  });
});
