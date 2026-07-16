import { describe, expect, it } from 'vitest';

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
});
