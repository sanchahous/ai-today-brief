import { describe, it, expect } from 'vitest';
import {
  parseOpenRouterSseChunk,
  createStreamProgress,
  applyStreamChunks,
  checkStreamStall,
  OpenRouterStallError,
  resolveOpenRouterAdaptiveTimeouts,
  shouldLogCharsMilestone,
  STREAM_CHARS_MILESTONE,
  type OpenRouterAdaptiveTimeouts,
} from './openrouter-adaptive';

const DEFAULT_TIMEOUTS: OpenRouterAdaptiveTimeouts = {
  firstTokenMs: 90_000,
  idleMs: 45_000,
  absoluteCeilingMs: 720_000,
  progressLogMs: 15_000,
};

describe('parseOpenRouterSseChunk', () => {
  it('parses content delta from data line', () => {
    const raw = 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';
    const { chunks, buffer } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('Hello');
    expect(buffer).toBe('');
  });

  it('parses finish_reason=stop with no content', () => {
    const raw = 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.finishReason).toBe('stop');
    expect(chunks[0]!.content).toBeUndefined();
  });

  it('ignores [DONE] sentinel', () => {
    const raw = 'data: [DONE]\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(0);
  });

  it('skips non-data lines', () => {
    const raw = ': ping\n\ndata: {"choices":[{"delta":{"content":"x"}}]}\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(1);
  });

  it('accumulates incomplete lines in buffer', () => {
    const partial = 'data: {"choices":[{"delta":{"conte';
    const { chunks, buffer } = parseOpenRouterSseChunk('', partial);
    expect(chunks).toHaveLength(0);
    expect(buffer).toBe(partial);
  });

  it('uses existing buffer prefix', () => {
    const prev = 'data: {"choices":[{"delta":{"content":"Hi"';
    const next = '},"finish_reason":null}]}\n\n';
    const { chunks } = parseOpenRouterSseChunk(prev, next);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('Hi');
  });

  it('parses SSE error payload into finishReason', () => {
    const raw =
      'data: {"error":{"code":"rate_limited","message":"Too many requests"}}\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.finishReason).toContain('rate_limited');
    expect(chunks[0]!.finishReason).toContain('Too many requests');
  });

  it('handles multiple content chunks in one incoming buffer', () => {
    const lines = [
      'data: {"choices":[{"delta":{"content":"A"}}]}',
      'data: {"choices":[{"delta":{"content":"B"}}]}',
      '',
    ].join('\n');
    const { chunks } = parseOpenRouterSseChunk('', lines + '\n');
    expect(chunks.map((c) => c.content)).toEqual(['A', 'B']);
  });

  it('parses real billed cost from the final usage chunk', () => {
    const raw =
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"cost":1.2345}}\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      costUsd: 1.2345,
    });
  });

  it('ignores usage-less chunks (no cost field means no real usage yet)', () => {
    const raw = 'data: {"choices":[{"delta":{"content":"x"}}]}\n\n';
    const { chunks } = parseOpenRouterSseChunk('', raw);
    expect(chunks[0]!.usage).toBeUndefined();
  });

  it.each(['reasoning', 'reasoning_content'])(
    'surfaces a %s delta separately from content',
    (field) => {
      const { chunks } = parseOpenRouterSseChunk(
        '',
        `data: ${JSON.stringify({ choices: [{ delta: { [field]: 'weighing options' } }] })}\n`,
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.reasoning).toBe('weighing options');
      expect(chunks[0]!.content).toBeUndefined();
    },
  );
});

describe('createStreamProgress', () => {
  it('initializes with zero chars and null firstTokenMs', () => {
    const p = createStreamProgress(1000);
    expect(p.content).toBe('');
    expect(p.chars).toBe(0);
    expect(p.firstTokenMs).toBeNull();
    expect(p.lastActivityMs).toBe(1000);
    expect(p.startedMs).toBe(1000);
  });
});

describe('applyStreamChunks', () => {
  it('appends content and updates chars', () => {
    const p = createStreamProgress(0);
    const next = applyStreamChunks(p, [{ content: 'Hello' }, { content: ' World' }], 100);
    expect(next.content).toBe('Hello World');
    expect(next.chars).toBe(11);
    expect(next.lastActivityMs).toBe(100);
    expect(next.firstTokenMs).toBe(100); // 100 - startedMs(0)
  });

  it('does not set firstTokenMs on chunks without content', () => {
    const p = createStreamProgress(0);
    const next = applyStreamChunks(p, [{ finishReason: 'stop' }], 100);
    expect(next.firstTokenMs).toBeNull();
  });

  it('does not overwrite firstTokenMs once set', () => {
    let p = createStreamProgress(0);
    p = applyStreamChunks(p, [{ content: 'A' }], 50);
    const p2 = applyStreamChunks(p, [{ content: 'B' }], 200);
    expect(p2.firstTokenMs).toBe(50); // set on first token at t=50
  });

  it('ignores chunks without content for activity tracking', () => {
    const p = createStreamProgress(0);
    const next = applyStreamChunks(p, [{ finishReason: 'stop' }], 99);
    expect(next.lastActivityMs).toBe(0); // unchanged from init
  });

  it('counts reasoning as activity without letting it reach the parsed content', () => {
    const p = createStreamProgress(0);
    const next = applyStreamChunks(p, [{ reasoning: 'let me think' }], 100);
    expect(next.content).toBe('');
    expect(next.chars).toBe(0);
    expect(next.reasoningChars).toBe('let me think'.length);
    expect(next.firstReasoningMs).toBe(100);
    expect(next.firstTokenMs).toBeNull();
    expect(next.lastActivityMs).toBe(100);
  });
});

describe('checkStreamStall', () => {
  it('returns null when within limits', () => {
    const p = createStreamProgress(0);
    const stall = checkStreamStall(p, DEFAULT_TIMEOUTS, 1000);
    expect(stall).toBeNull();
  });

  it('returns first_token stall when no content after firstTokenMs', () => {
    const p = createStreamProgress(0);
    const stall = checkStreamStall(p, DEFAULT_TIMEOUTS, 90_001);
    expect(stall).toBeInstanceOf(OpenRouterStallError);
    expect(stall!.reason).toBe('first_token');
  });

  it('returns null when first token arrives before firstTokenMs', () => {
    const p = createStreamProgress(0);
    // Content arrives at t=5000 — well before firstTokenMs(90s)
    const withToken = applyStreamChunks(p, [{ content: 'Hi' }], 5000);
    // Check at t=5100: 100ms since first token — well within idle(45s) and firstToken(90s)
    const stall = checkStreamStall(withToken, DEFAULT_TIMEOUTS, 5100);
    expect(stall).toBeNull();
  });

  it('returns idle stall when silent after content', () => {
    const p = createStreamProgress(0);
    const withContent = applyStreamChunks(p, [{ content: 'hello' }], 1000);
    const stall = checkStreamStall(withContent, DEFAULT_TIMEOUTS, 1000 + 45_001);
    expect(stall).toBeInstanceOf(OpenRouterStallError);
    expect(stall!.reason).toBe('idle');
  });

  it('returns wall stall when absolute ceiling hit with active content', () => {
    const p = createStreamProgress(0);
    const withContent = applyStreamChunks(p, [{ content: 'data...' }], 100);
    // Keep updating lastActivity so idle doesn't trigger
    const fresh = { ...withContent, lastActivityMs: 720_000 };
    const stall = checkStreamStall(fresh, DEFAULT_TIMEOUTS, 720_001);
    expect(stall).toBeInstanceOf(OpenRouterStallError);
    expect(stall!.reason).toBe('wall');
  });

  it('first_token check does not fire once content has arrived', () => {
    const p = createStreamProgress(0);
    const withContent = applyStreamChunks(p, [{ content: 'chunk' }], 10);
    // well past firstTokenMs but content has arrived
    const stall = checkStreamStall(withContent, DEFAULT_TIMEOUTS, 200_000);
    // 200s idle since last activity at 10 → should be idle stall, not first_token
    expect(stall!.reason).toBe('idle');
  });

  // The live regression this guards: a reasoning model streams its chain of
  // thought for minutes before the first content delta, and the old detector
  // counted that as silence and rotated to the next model (2026-08-09 master
  // run: twelve models, ~20 minutes, zero output).
  it('does not kill a model that is still streaming reasoning', () => {
    let p = createStreamProgress(0);
    for (let t = 1_000; t <= 200_000; t += 1_000) {
      p = applyStreamChunks(p, [{ reasoning: 'thinking' }], t);
      expect(checkStreamStall(p, DEFAULT_TIMEOUTS, t)).toBeNull();
    }
    expect(p.chars).toBe(0);
  });

  it('still kills a model whose reasoning goes silent', () => {
    const p = applyStreamChunks(createStreamProgress(0), [{ reasoning: 'thinking' }], 1_000);
    const stall = checkStreamStall(p, DEFAULT_TIMEOUTS, 1_000 + 45_001);
    expect(stall!.reason).toBe('idle');
  });

  it('still enforces the absolute ceiling on an endlessly reasoning model', () => {
    const p = applyStreamChunks(createStreamProgress(0), [{ reasoning: 'thinking' }], 719_000);
    const stall = checkStreamStall({ ...p, lastActivityMs: 720_000 }, DEFAULT_TIMEOUTS, 720_001);
    expect(stall!.reason).toBe('wall');
  });
});

describe('OpenRouterStallError', () => {
  it('has correct reason property', () => {
    const err = new OpenRouterStallError('idle', 'model-x', 'detail');
    expect(err.name).toBe('OpenRouterStallError');
    expect(err.reason).toBe('idle');
    expect(err.message).toContain('model-x');
  });
});

describe('resolveOpenRouterAdaptiveTimeouts', () => {
  it('returns defaults when env is empty', () => {
    const t = resolveOpenRouterAdaptiveTimeouts({});
    expect(t.firstTokenMs).toBe(90_000);
    expect(t.idleMs).toBe(45_000);
    expect(t.absoluteCeilingMs).toBe(720_000);
    expect(t.progressLogMs).toBe(15_000);
  });

  it('reads env overrides', () => {
    const t = resolveOpenRouterAdaptiveTimeouts({
      OPENROUTER_FIRST_TOKEN_MS: '30000',
      OPENROUTER_IDLE_MS: '20000',
      OPENROUTER_ABSOLUTE_CEILING_MS: '300000',
      OPENROUTER_PROGRESS_LOG_MS: '10000',
    });
    expect(t.firstTokenMs).toBe(30_000);
    expect(t.idleMs).toBe(20_000);
    expect(t.absoluteCeilingMs).toBe(300_000);
    expect(t.progressLogMs).toBe(10_000);
  });

  it('falls back to OPENROUTER_WALL_MS for absoluteCeilingMs', () => {
    const t = resolveOpenRouterAdaptiveTimeouts({ OPENROUTER_WALL_MS: '600000' });
    expect(t.absoluteCeilingMs).toBe(600_000);
  });

  it('ignores invalid env values', () => {
    const t = resolveOpenRouterAdaptiveTimeouts({
      OPENROUTER_FIRST_TOKEN_MS: 'NaN',
      OPENROUTER_IDLE_MS: '-100',
    });
    expect(t.firstTokenMs).toBe(90_000);
    expect(t.idleMs).toBe(45_000);
  });
});

describe('shouldLogCharsMilestone', () => {
  it('returns true when crossing a milestone boundary', () => {
    expect(shouldLogCharsMilestone(9_999, 10_000)).toBe(true);
    expect(shouldLogCharsMilestone(9_999, 10_500)).toBe(true);
    expect(shouldLogCharsMilestone(19_000, 20_100)).toBe(true);
  });

  it('returns false when within the same bucket', () => {
    expect(shouldLogCharsMilestone(10_000, 10_500)).toBe(false);
    expect(shouldLogCharsMilestone(0, 500)).toBe(false);
  });

  it('returns false when nextChars is zero', () => {
    expect(shouldLogCharsMilestone(0, 0)).toBe(false);
    expect(shouldLogCharsMilestone(STREAM_CHARS_MILESTONE - 1, 0)).toBe(false);
  });

  it('uses STREAM_CHARS_MILESTONE correctly', () => {
    expect(shouldLogCharsMilestone(STREAM_CHARS_MILESTONE - 1, STREAM_CHARS_MILESTONE)).toBe(true);
  });
});
