import { describe, expect, it } from 'vitest';
import {
  aggregateGenerationCosts,
  DEFAULT_DAILY_GENERATION_BUDGET_USD,
  illustrationBudgetFromLedger,
  meteredSpendUsd,
  resolveDailyGenerationBudgetUsd,
} from './generation-costs';

describe('meteredSpendUsd', () => {
  it('sums real money and ignores subscription work', () => {
    expect(
      meteredSpendUsd([
        { cost_usd: 0.41, cost_source: 'reported' },
        { cost_usd: '0.24', cost_source: 'reported' },
        { cost_usd: 0.0149, cost_source: 'estimated' },
        // Claude CLI draws down a plan allowance, not the OpenRouter balance.
        { cost_usd: 0, cost_source: 'subscription' },
      ]),
    ).toBeCloseTo(0.6649, 6);
  });

  it('treats malformed costs as zero rather than NaN-poisoning the total', () => {
    expect(
      meteredSpendUsd([
        { cost_usd: 0.5, cost_source: 'reported' },
        { cost_usd: Number.NaN, cost_source: 'reported' },
        { cost_usd: -3, cost_source: 'reported' },
      ]),
    ).toBe(0.5);
  });

  it('is empty-safe', () => {
    expect(meteredSpendUsd([])).toBe(0);
  });
});

describe('resolveDailyGenerationBudgetUsd', () => {
  it('reads an owner override and falls back on anything unusable', () => {
    expect(resolveDailyGenerationBudgetUsd({ DAILY_GENERATION_BUDGET_USD: '1.5' })).toBe(1.5);
    for (const raw of [undefined, '', 'abc', '0', '-2']) {
      expect(resolveDailyGenerationBudgetUsd({ DAILY_GENERATION_BUDGET_USD: raw })).toBe(
        DEFAULT_DAILY_GENERATION_BUDGET_USD,
      );
    }
  });
});

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

describe('illustrationBudgetFromLedger', () => {
  it('illustration budget uses ledger events not policy spend caps', () => {
    const budget = illustrationBudgetFromLedger([
      {
        cost_usd: 0.015,
        kind: 'image',
        scope: 'daily',
        step_key: null,
      },
      {
        cost_usd: 0.015,
        kind: 'image',
        scope: 'daily',
        step_key: null,
      },
      {
        cost_usd: 0.008,
        kind: 'llm',
        scope: 'daily',
        step_key: 'daily.cover_scene',
      },
      {
        cost_usd: 0.01,
        kind: 'llm',
        scope: 'weekly',
        step_key: 'post_upload_qa',
      },
      {
        cost_usd: 0.4,
        kind: 'image',
        scope: 'weekly',
        step_key: 'story_image.round.0.render.0',
      },
    ]);
    expect(budget.newsImagesUsd).toBe(0.03);
    expect(budget.promptAndQaUsd).toBe(0.018);
    expect(budget.weeklyImagesUsd).toBe(0.4);
    expect(budget.newsImagesUsd).not.toBe(0.2);
  });

  it('does not treat weekly master LLM as illustration API spend', () => {
    const budget = illustrationBudgetFromLedger([
      {
        cost_usd: 1.2,
        kind: 'llm',
        scope: 'weekly',
        step_key: 'en',
      },
      {
        cost_usd: 0.4,
        kind: 'llm',
        scope: 'weekly',
        step_key: 'critic',
      },
      {
        cost_usd: 0.05,
        kind: 'llm',
        scope: 'social',
        step_key: 'social:x:writer',
      },
      {
        cost_usd: 0.09,
        kind: 'llm',
        scope: 'weekly',
        step_key: 'video_script',
      },
    ]);
    expect(budget).toEqual({
      newsImagesUsd: 0,
      weeklyImagesUsd: 0,
      promptAndQaUsd: 0,
    });
  });
});
