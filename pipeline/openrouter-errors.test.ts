import { describe, it, expect } from 'vitest';
import {
  classifyOpenRouterFailure,
  toOpenRouterLimitError,
  OpenRouterLimitError,
  OpenRouterLimitKind,
  isOpenRouterLimitError,
  summarizeLimitFailureHint,
  resolveOpenRouterLimitBackoffMs,
} from './openrouter-errors';

describe('classifyOpenRouterFailure', () => {
  it('classifies 402 as insufficient_credits', () => {
    expect(classifyOpenRouterFailure({ httpStatus: 402 })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.insufficient_credits,
    });
  });

  it('classifies insufficient credit message', () => {
    expect(
      classifyOpenRouterFailure({ message: 'Insufficient credits to process request' }),
    ).toEqual({ isLimit: true, kind: OpenRouterLimitKind.insufficient_credits });
  });

  it('classifies 429 as rate_limit', () => {
    expect(classifyOpenRouterFailure({ httpStatus: 429 })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.rate_limit,
    });
  });

  it('classifies rate limit message', () => {
    expect(classifyOpenRouterFailure({ message: 'Too Many Requests: rate limit exceeded' })).toEqual(
      { isLimit: true, kind: OpenRouterLimitKind.rate_limit },
    );
  });

  it('classifies quota message', () => {
    expect(classifyOpenRouterFailure({ message: 'daily quota exceeded' })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.quota,
    });
  });

  it('classifies 503 as provider_capacity', () => {
    expect(classifyOpenRouterFailure({ httpStatus: 503 })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.provider_capacity,
    });
  });

  it('classifies overloaded message as provider_capacity', () => {
    expect(classifyOpenRouterFailure({ message: 'The provider is overloaded' })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.provider_capacity,
    });
  });

  it('returns isLimit=false for generic errors', () => {
    expect(classifyOpenRouterFailure({ httpStatus: 500, message: 'Internal server error' })).toEqual(
      { isLimit: false },
    );
  });

  it('returns isLimit=false for empty input', () => {
    expect(classifyOpenRouterFailure({})).toEqual({ isLimit: false });
  });

  it('classifies by code containing "rate"', () => {
    expect(classifyOpenRouterFailure({ code: 'rate_limited' })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.rate_limit,
    });
  });

  it('classifies billing mention as insufficient_credits', () => {
    expect(classifyOpenRouterFailure({ message: 'billing issues' })).toEqual({
      isLimit: true,
      kind: OpenRouterLimitKind.insufficient_credits,
    });
  });
});

describe('toOpenRouterLimitError', () => {
  it('returns null for non-limit errors', () => {
    expect(toOpenRouterLimitError('my-model', { httpStatus: 500, message: 'oops' })).toBeNull();
  });

  it('returns an OpenRouterLimitError for 429', () => {
    const err = toOpenRouterLimitError('deepseek/v3', {
      httpStatus: 429,
      message: 'rate limit hit',
    });
    expect(err).toBeInstanceOf(OpenRouterLimitError);
    expect(err!.kind).toBe(OpenRouterLimitKind.rate_limit);
    expect(err!.modelId).toBe('deepseek/v3');
    expect(err!.httpStatus).toBe(429);
  });

  it('preserves provider code', () => {
    const err = toOpenRouterLimitError('qwen', { httpStatus: 402, code: 'insufficient_credits' });
    expect(err!.providerCode).toBe('insufficient_credits');
  });

  it('falls back to kind name as detail when no message', () => {
    const err = toOpenRouterLimitError('model', { httpStatus: 429 });
    expect(err!.message).toContain(OpenRouterLimitKind.rate_limit);
  });
});

describe('isOpenRouterLimitError', () => {
  it('returns true for OpenRouterLimitError', () => {
    const err = new OpenRouterLimitError(OpenRouterLimitKind.quota, 'mod', 'msg');
    expect(isOpenRouterLimitError(err)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isOpenRouterLimitError(new Error('nope'))).toBe(false);
  });
});

describe('summarizeLimitFailureHint', () => {
  it('returns credits hint when insufficient_credits present', () => {
    const hint = summarizeLimitFailureHint([{ limit_kind: 'insufficient_credits' }]);
    expect(hint).toContain('credits');
  });

  it('returns rate limit hint for rate_limit', () => {
    const hint = summarizeLimitFailureHint([{ limit_kind: 'rate_limit' }]);
    expect(hint).toContain('rate limit');
  });

  it('returns generic hint for provider_capacity', () => {
    const hint = summarizeLimitFailureHint([{ limit_kind: 'provider_capacity' }]);
    expect(hint).toContain('pipeline_runs');
  });

  it('returns undefined when no limit kinds', () => {
    expect(summarizeLimitFailureHint([{ limit_kind: undefined }])).toBeUndefined();
    expect(summarizeLimitFailureHint([])).toBeUndefined();
  });
});

describe('resolveOpenRouterLimitBackoffMs', () => {
  it('returns default 4000', () => {
    expect(resolveOpenRouterLimitBackoffMs({})).toBe(4000);
  });

  it('parses env override', () => {
    expect(resolveOpenRouterLimitBackoffMs({ OPENROUTER_LIMIT_BACKOFF_MS: '2000' })).toBe(2000);
  });

  it('returns default for invalid value', () => {
    expect(resolveOpenRouterLimitBackoffMs({ OPENROUTER_LIMIT_BACKOFF_MS: 'abc' })).toBe(4000);
  });

  it('accepts 0 (disable backoff)', () => {
    expect(resolveOpenRouterLimitBackoffMs({ OPENROUTER_LIMIT_BACKOFF_MS: '0' })).toBe(0);
  });
});
