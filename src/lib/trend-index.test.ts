import { describe, expect, it } from 'vitest';
import {
  blendTrend,
  entityKeyForTool,
  isRising,
  maxTrendForTools,
  recencyScore,
  RISING_THRESHOLD,
} from './trend-index';

describe('entityKeyForTool', () => {
  it('slugifies a plain tool name onto its entity key', () => {
    expect(entityKeyForTool('Claude Code')).toBe('claude-code');
    expect(entityKeyForTool('MCP')).toBe('mcp');
    expect(entityKeyForTool('Kling')).toBe('kling');
    expect(entityKeyForTool('  LangGraph  ')).toBe('langgraph');
  });

  it('maps known aliases onto the broader tracked entity', () => {
    expect(entityKeyForTool('GPT-5')).toBe('gpt');
    expect(entityKeyForTool('ChatGPT')).toBe('gpt');
    expect(entityKeyForTool('Model Context Protocol')).toBe('mcp');
    expect(entityKeyForTool('vibe coding')).toBe('ai-coding');
    expect(entityKeyForTool('Google Veo')).toBe('veo');
  });
});

describe('blendTrend', () => {
  it('boosts mentions by the rising signal (up to +100%)', () => {
    expect(blendTrend(4, 0)).toBe(4); // flat → mentions unchanged
    expect(blendTrend(4, 1)).toBe(8); // fully rising → doubled
    expect(blendTrend(4, 0.5)).toBe(6);
  });

  it('clamps the rising signal to [0,1]', () => {
    expect(blendTrend(4, 2)).toBe(8); // >1 clamped
    expect(blendTrend(4, -1)).toBe(4); // <0 clamped
  });

  it('keeps a rising topic ahead of an equally-mentioned flat one', () => {
    expect(blendTrend(3, 0.8)).toBeGreaterThan(blendTrend(3, 0));
  });
});

describe('isRising', () => {
  it('flags scores at or above the threshold, treats missing as not rising', () => {
    expect(isRising(0.94)).toBe(true);
    expect(isRising(RISING_THRESHOLD)).toBe(true);
    expect(isRising(0.42)).toBe(false);
    expect(isRising(undefined)).toBe(false);
  });
});

describe('recencyScore', () => {
  it('is 1 today, halves every 3 days, and never goes negative', () => {
    expect(recencyScore(0)).toBe(1);
    expect(recencyScore(3)).toBeCloseTo(0.5);
    expect(recencyScore(6)).toBeCloseTo(0.25);
    expect(recencyScore(-2)).toBe(1); // clamped
    expect(recencyScore(9)).toBeLessThan(recencyScore(6));
  });
});

describe('maxTrendForTools', () => {
  const rising = new Map([
    ['claude-code', 0.5],
    ['kling', 0.94],
  ]);

  it('returns the strongest rising signal among the tools', () => {
    expect(maxTrendForTools(['Claude Code', 'Kling', 'Unknown'], rising)).toBeCloseTo(0.94);
    expect(maxTrendForTools(['Claude Code'], rising)).toBeCloseTo(0.5);
  });

  it('returns 0 when no tool is tracked or the list is empty', () => {
    expect(maxTrendForTools(['Totally Untracked'], rising)).toBe(0);
    expect(maxTrendForTools([], rising)).toBe(0);
  });
});
