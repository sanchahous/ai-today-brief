import { describe, expect, it } from 'vitest';

import { getTool, TOOLS } from './tools';

describe('TOOLS', () => {
  it('contains a unique live prompt optimizer with locale-aware hrefs', () => {
    expect(new Set(TOOLS.map((tool) => tool.slug)).size).toBe(TOOLS.length);

    const tool = getTool('prompt-optimizer');
    expect(tool?.status).toBe('live');
    expect(tool?.href('en')).toBe('/en/tools/prompt-optimizer');
    expect(tool?.href('uk')).toBe('/uk/tools/prompt-optimizer');
    expect(tool?.title.en).toContain('Prompt Optimizer');
    expect(tool?.title.uk).toContain('оптимізатор');
  });
});
