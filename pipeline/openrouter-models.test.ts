import { describe, it, expect } from 'vitest';
import {
  isEligibleOpenRouterModel,
  isFreeOpenRouterModel,
  isOpenRouterAliasId,
  isUnstableOpenRouterModelId,
  modelHasPriceOverrides,
  openRouterEndpointsUrl,
  openRouterModelAttemptCap,
  openRouterModelFamily,
  openRouterModelSupportsJson,
  openRouterModelsUrl,
  type OpenRouterModelRecord,
} from './openrouter-models';

function makeModel(
  id: string,
  overrides: Partial<OpenRouterModelRecord> = {},
): OpenRouterModelRecord {
  return { id, context_length: 128_000, architecture: { modality: 'text' }, ...overrides };
}

describe('openRouterModelsUrl', () => {
  it('returns the bare catalog URL without a query', () => {
    expect(openRouterModelsUrl()).toBe('https://openrouter.ai/api/v1/models');
  });

  it('appends category and sort without nested quantifiers', () => {
    expect(
      openRouterModelsUrl({ category: 'marketing', sort: 'intelligence-high-to-low' }),
    ).toBe(
      'https://openrouter.ai/api/v1/models?category=marketing&sort=intelligence-high-to-low',
    );
  });
});

describe('openRouterEndpointsUrl', () => {
  it('builds the per-model endpoints path', () => {
    expect(openRouterEndpointsUrl('z-ai/glm-5.3-flash')).toBe(
      'https://openrouter.ai/api/v1/models/z-ai/glm-5.3-flash/endpoints',
    );
  });

  it('rejects aliases and malformed ids', () => {
    expect(openRouterEndpointsUrl('~openai/gpt-latest')).toBeNull();
    expect(openRouterEndpointsUrl('no-slash')).toBeNull();
  });
});

describe('isEligibleOpenRouterModel', () => {
  it('keeps a current paid text model', () => {
    expect(isEligibleOpenRouterModel(makeModel('z-ai/glm-5.3-flash'))).toBe(true);
  });

  it('keeps :free models — the limiter and quality floor handle them', () => {
    expect(isEligibleOpenRouterModel(makeModel('z-ai/glm-5.2:free'))).toBe(true);
  });

  it('drops moving aliases, :batch, distill, vision, unstable, expired, tiny context', () => {
    expect(isEligibleOpenRouterModel(makeModel('~openai/gpt-latest'))).toBe(false);
    expect(isEligibleOpenRouterModel(makeModel('openai/gpt-5.6-luna:batch'))).toBe(false);
    expect(isEligibleOpenRouterModel(makeModel('deepseek/deepseek-r1-distill-llama-70b'))).toBe(
      false,
    );
    expect(isEligibleOpenRouterModel(makeModel('vendor/vision-pro'))).toBe(false);
    expect(isEligibleOpenRouterModel(makeModel('vendor/model-exp'))).toBe(false);
    expect(isEligibleOpenRouterModel(makeModel('vendor/ok', { expiration_date: '2026-01-01' }))).toBe(
      false,
    );
    expect(isEligibleOpenRouterModel(makeModel('vendor/tiny', { context_length: 4096 }))).toBe(
      false,
    );
  });
});

describe('id helpers', () => {
  it('detects aliases, free models and families', () => {
    expect(isOpenRouterAliasId('~anthropic/claude-fable-latest')).toBe(true);
    expect(isOpenRouterAliasId('anthropic/claude-sonnet-4.5')).toBe(false);
    expect(isFreeOpenRouterModel('z-ai/glm-5.2:free')).toBe(true);
    expect(openRouterModelFamily('z-ai/glm-5.3-flash')).toBe('z-ai');
    expect(openRouterModelFamily('~openai/gpt-latest')).toBe('openai');
  });

  it('treats missing supported_parameters as JSON-capable', () => {
    expect(openRouterModelSupportsJson(makeModel('vendor/a'))).toBe(true);
    expect(
      openRouterModelSupportsJson(
        makeModel('vendor/b', { supported_parameters: ['temperature'] }),
      ),
    ).toBe(false);
    expect(
      openRouterModelSupportsJson(
        makeModel('vendor/c', { supported_parameters: ['structured_outputs'] }),
      ),
    ).toBe(true);
  });

  it('flags stepped pricing.overrides', () => {
    expect(modelHasPriceOverrides(makeModel('vendor/a'))).toBe(false);
    expect(
      modelHasPriceOverrides(makeModel('vendor/b', { pricing: { overrides: [{ start: 272000 }] } })),
    ).toBe(true);
  });

  it('still marks experimental ids unstable without flagging expensive', () => {
    expect(isUnstableOpenRouterModelId('vendor/model-exp')).toBe(true);
    expect(isUnstableOpenRouterModelId('vendor/exp-preview')).toBe(true);
    expect(isUnstableOpenRouterModelId('deepseek/deepseek-v3')).toBe(false);
    expect(isUnstableOpenRouterModelId('vendor-b/expensive-flagship')).toBe(false);
  });
});

describe('openRouterModelAttemptCap', () => {
  it('defaults to 6 and rejects non-positive values', () => {
    expect(openRouterModelAttemptCap({})).toBe(6);
    expect(openRouterModelAttemptCap({ OPENROUTER_MAX_MODEL_ATTEMPTS: '2' })).toBe(2);
    expect(openRouterModelAttemptCap({ OPENROUTER_MAX_MODEL_ATTEMPTS: '0' })).toBe(6);
  });
});
