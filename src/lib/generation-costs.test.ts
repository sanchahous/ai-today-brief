import { describe, expect, it } from 'vitest';
import { aggregateGenerationCosts } from './generation-costs';

describe('aggregateGenerationCosts', () => {
  it('sums by kind, provider, scope and model', () => {
    const totals = aggregateGenerationCosts([
      {
        cost_usd: 0.015,
        kind: 'image',
        provider: 'cloudflare',
        scope: 'weekly',
        model: '@cf/black-forest-labs/flux-2-klein-9b',
      },
      {
        cost_usd: 0.12,
        kind: 'llm',
        provider: 'openrouter',
        scope: 'weekly',
        model: 'anthropic/claude-sonnet-4',
      },
      {
        cost_usd: '0.03',
        kind: 'llm',
        provider: 'openrouter',
        scope: 'social',
        model: 'google/gemini-2.5-flash',
      },
    ]);
    expect(totals.eventCount).toBe(3);
    expect(totals.totalUsd).toBe(0.165);
    expect(totals.byKind.image).toBe(0.015);
    expect(totals.byKind.llm).toBe(0.15);
    expect(totals.byProvider.openrouter).toBe(0.15);
    expect(totals.byScope.weekly).toBe(0.135);
    expect(totals.byModel['@cf/black-forest-labs/flux-2-klein-9b']).toBe(0.015);
  });

  it('treats non-finite costs as zero', () => {
    const totals = aggregateGenerationCosts([
      {
        cost_usd: Number.NaN,
        kind: 'llm',
        provider: 'gemini',
        scope: 'weekly',
        model: 'x',
      },
    ]);
    expect(totals.totalUsd).toBe(0);
  });
});
