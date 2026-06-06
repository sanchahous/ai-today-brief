import { describe, it, expect } from 'vitest';
import {
  classifyOpenRouterModelTier,
  sortModelQueueByTier,
  hasOpenRouterProPattern,
  hasOpenRouterVersionPattern,
  parseOpenRouterVersionScore,
  openRouterPatternRankScore,
  rankOpenRouterModelIds,
  isUnstableOpenRouterModelId,
  type OpenRouterModelRecord,
} from './openrouter-models';

function makeModel(
  id: string,
  overrides: Partial<OpenRouterModelRecord> = {},
): OpenRouterModelRecord {
  return { id, context_length: 128_000, ...overrides };
}

describe('classifyOpenRouterModelTier', () => {
  it('classifies deepseek pro variants as deepseek_pro', () => {
    expect(classifyOpenRouterModelTier('deepseek/deepseek-v4-pro')).toBe('deepseek_pro');
    expect(classifyOpenRouterModelTier('deepseek/deepseek-v3.1')).toBe('deepseek_pro');
    expect(classifyOpenRouterModelTier('deepseek/deepseek-r1')).toBe('deepseek_pro');
    expect(classifyOpenRouterModelTier('deepseek/deepseek-prover-v2')).toBe('deepseek_pro');
  });

  it('classifies deepseek-chat as deepseek_chat', () => {
    expect(classifyOpenRouterModelTier('deepseek/deepseek-chat')).toBe('deepseek_chat');
    expect(classifyOpenRouterModelTier('deepseek/deepseek-chat-v2.5')).toBe('deepseek_chat');
  });

  it('classifies qwen models as qwen', () => {
    expect(classifyOpenRouterModelTier('qwen/qwen3-235b-a22b')).toBe('qwen');
    expect(classifyOpenRouterModelTier('qwen/qwen-max')).toBe('qwen');
    expect(classifyOpenRouterModelTier('qwen/qwen-plus')).toBe('qwen');
  });

  it('classifies other models as other', () => {
    expect(classifyOpenRouterModelTier('openai/gpt-4o')).toBe('other');
    expect(classifyOpenRouterModelTier('anthropic/claude-sonnet-4')).toBe('other');
    expect(classifyOpenRouterModelTier('meta-llama/llama-3.3-70b-instruct')).toBe('other');
  });
});

describe('sortModelQueueByTier', () => {
  it('orders deepseek_pro → deepseek_chat → qwen → other', () => {
    const input = [
      'openai/gpt-4o',
      'qwen/qwen3-235b',
      'deepseek/deepseek-chat',
      'deepseek/deepseek-v4-pro',
    ];
    const sorted = sortModelQueueByTier(input);
    expect(sorted[0]).toBe('deepseek/deepseek-v4-pro');
    expect(sorted[1]).toBe('deepseek/deepseek-chat');
    expect(sorted[2]).toBe('qwen/qwen3-235b');
    expect(sorted[3]).toBe('openai/gpt-4o');
  });

  it('deduplicates ids', () => {
    const sorted = sortModelQueueByTier([
      'deepseek/deepseek-v3',
      'deepseek/deepseek-v3',
      'deepseek/deepseek-v3',
    ]);
    expect(sorted).toHaveLength(1);
  });

  it('preserves within-tier order from input', () => {
    const input = ['deepseek/deepseek-v3.1', 'deepseek/deepseek-v4-pro'];
    const sorted = sortModelQueueByTier(input);
    // both are deepseek_pro tier; input order preserved within tier
    expect(sorted).toEqual(['deepseek/deepseek-v3.1', 'deepseek/deepseek-v4-pro']);
  });
});

describe('hasOpenRouterProPattern', () => {
  it('returns true for ids containing -pro', () => {
    expect(hasOpenRouterProPattern('deepseek/deepseek-v4-pro')).toBe(true);
    expect(hasOpenRouterProPattern('vendor/model-pro-v2')).toBe(true);
  });

  it('returns false without -pro', () => {
    expect(hasOpenRouterProPattern('deepseek/deepseek-v3')).toBe(false);
    expect(hasOpenRouterProPattern('deepseek/deepseek-chat')).toBe(false);
  });
});

describe('hasOpenRouterVersionPattern', () => {
  it('detects -vX.Y patterns', () => {
    expect(hasOpenRouterVersionPattern('deepseek/deepseek-v3.1')).toBe(true);
    expect(hasOpenRouterVersionPattern('vendor/model-v4')).toBe(true);
    expect(hasOpenRouterVersionPattern('vendor/model-v10.2')).toBe(true);
  });

  it('returns false without version segment', () => {
    expect(hasOpenRouterVersionPattern('deepseek/deepseek-pro')).toBe(false);
    expect(hasOpenRouterVersionPattern('openai/gpt-4o')).toBe(false);
  });
});

describe('parseOpenRouterVersionScore', () => {
  it('parses major-only versions', () => {
    expect(parseOpenRouterVersionScore('vendor/model-v4')).toBe(4.0);
    expect(parseOpenRouterVersionScore('vendor/model-v10')).toBe(10.0);
  });

  it('parses major.minor versions', () => {
    expect(parseOpenRouterVersionScore('vendor/model-v3.2')).toBeCloseTo(3.02);
    expect(parseOpenRouterVersionScore('vendor/model-v3.1')).toBeCloseTo(3.01);
  });

  it('returns null when no version pattern', () => {
    expect(parseOpenRouterVersionScore('vendor/model-pro')).toBeNull();
    expect(parseOpenRouterVersionScore('openai/gpt-4o')).toBeNull();
  });
});

describe('openRouterPatternRankScore', () => {
  it('gives lower (better) score to -pro models', () => {
    const proScore = openRouterPatternRankScore('deepseek/v4-pro');
    const plainScore = openRouterPatternRankScore('deepseek/deepseek-chat');
    expect(proScore).toBeLessThan(plainScore);
  });

  it('gives lower score to higher versioned models', () => {
    const v4score = openRouterPatternRankScore('vendor/model-v4');
    const v3score = openRouterPatternRankScore('vendor/model-v3');
    expect(v4score).toBeLessThan(v3score);
  });

  it('penalizes distill variants', () => {
    const distillScore = openRouterPatternRankScore('vendor/model-distill');
    const normalScore = openRouterPatternRankScore('vendor/model-chat');
    expect(distillScore).toBeGreaterThan(normalScore);
  });
});

describe('isUnstableOpenRouterModelId', () => {
  it('returns true for experimental/preview/beta ids', () => {
    expect(isUnstableOpenRouterModelId('vendor/model-exp')).toBe(true);
    expect(isUnstableOpenRouterModelId('vendor/model-preview')).toBe(true);
    expect(isUnstableOpenRouterModelId('vendor/model-beta')).toBe(true);
    expect(isUnstableOpenRouterModelId('vendor/experimental-v1')).toBe(true);
  });

  it('returns false for stable ids', () => {
    expect(isUnstableOpenRouterModelId('deepseek/deepseek-v3')).toBe(false);
    expect(isUnstableOpenRouterModelId('qwen/qwen-max')).toBe(false);
  });
});

describe('rankOpenRouterModelIds', () => {
  const models: OpenRouterModelRecord[] = [
    makeModel('openai/gpt-4o'),
    makeModel('qwen/qwen3-235b-a22b'),
    makeModel('deepseek/deepseek-chat'),
    makeModel('deepseek/deepseek-v4-pro'),
    makeModel('deepseek/deepseek-v3.1'),
    makeModel('meta-llama/llama-3.3-70b-instruct:free'),
    makeModel('vendor/model-exp'),
    makeModel('vendor/vision-pro'),
    makeModel('deepseek/deepseek-r1'),
  ];

  it('filters out :free models', () => {
    const ranked = rankOpenRouterModelIds(models);
    expect(ranked).not.toContain('meta-llama/llama-3.3-70b-instruct:free');
  });

  it('filters out experimental models', () => {
    const ranked = rankOpenRouterModelIds(models);
    expect(ranked).not.toContain('vendor/model-exp');
  });

  it('filters out vision models', () => {
    const ranked = rankOpenRouterModelIds(models);
    expect(ranked).not.toContain('vendor/vision-pro');
  });

  it('places deepseek_pro models first', () => {
    const ranked = rankOpenRouterModelIds(models);
    const first = ranked[0]!;
    const tier = classifyOpenRouterModelTier(first);
    expect(tier).toBe('deepseek_pro');
  });

  it('places deepseek_pro models before qwen', () => {
    const ranked = rankOpenRouterModelIds(models);
    const qwenIdx = ranked.findIndex((id) => id.includes('qwen'));
    const deepseekProIdx = ranked.findIndex((id) => classifyOpenRouterModelTier(id) === 'deepseek_pro');
    expect(deepseekProIdx).toBeLessThan(qwenIdx);
  });

  it('filters out small context models (< 32k)', () => {
    const smallCtx = [...models, makeModel('vendor/tiny-model', { context_length: 4096 })];
    const ranked = rankOpenRouterModelIds(smallCtx);
    expect(ranked).not.toContain('vendor/tiny-model');
  });

  it('returns models ordered with -pro before unversioned deepseek chat', () => {
    const subset = [
      makeModel('deepseek/deepseek-chat'),
      makeModel('deepseek/deepseek-v4-pro'),
    ];
    const ranked = rankOpenRouterModelIds(subset);
    expect(ranked[0]).toBe('deepseek/deepseek-v4-pro');
    expect(ranked[1]).toBe('deepseek/deepseek-chat');
  });

  it('returns empty array when all models are filtered', () => {
    const filtered = [
      makeModel('vendor/exp-model-exp'),
      makeModel('vendor/free-model:free'),
    ];
    const ranked = rankOpenRouterModelIds(filtered);
    expect(ranked).toHaveLength(0);
  });
});
