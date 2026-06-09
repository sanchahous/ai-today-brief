import { describe, expect, it } from 'vitest';
import {
  geminiSummarizeRankScore,
  isEligibleGeminiSummarizeModel,
  isUnstableGeminiModelId,
  modelIdFromGeminiName,
  parseGeminiVersionScore,
  rankGeminiModelIds,
  type GeminiModelRecord,
} from './gemini-models';

function makeModel(name: string, methods: string[] = ['generateContent']): GeminiModelRecord {
  return { name: `models/${name}`, supportedGenerationMethods: methods };
}

describe('modelIdFromGeminiName', () => {
  it('strips models/ prefix', () => {
    expect(modelIdFromGeminiName('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });
});

describe('parseGeminiVersionScore', () => {
  it('parses major.minor versions', () => {
    expect(parseGeminiVersionScore('gemini-3.5-flash')).toBeCloseTo(3.05);
    expect(parseGeminiVersionScore('gemini-2.5-flash')).toBeCloseTo(2.05);
    expect(parseGeminiVersionScore('gemini-2-flash')).toBe(2);
  });

  it('returns null without version segment', () => {
    expect(parseGeminiVersionScore('gemini-flash')).toBeNull();
  });
});

describe('isEligibleGeminiSummarizeModel', () => {
  it('accepts generateContent flash/pro gemini models', () => {
    expect(isEligibleGeminiSummarizeModel(makeModel('gemini-3.5-flash'))).toBe(true);
    expect(isEligibleGeminiSummarizeModel(makeModel('gemini-2.5-pro'))).toBe(true);
  });

  it('rejects embedding and non-generateContent models', () => {
    expect(isEligibleGeminiSummarizeModel(makeModel('gemini-embedding-001'))).toBe(false);
    expect(isEligibleGeminiSummarizeModel(makeModel('gemini-2.5-flash', ['embedContent']))).toBe(
      false,
    );
  });

  it('rejects unstable preview ids', () => {
    expect(isEligibleGeminiSummarizeModel(makeModel('gemini-2.5-flash-preview-05-20'))).toBe(false);
  });
});

describe('isUnstableGeminiModelId', () => {
  it('flags preview and experimental ids', () => {
    expect(isUnstableGeminiModelId('gemini-2.0-flash-exp')).toBe(true);
    expect(isUnstableGeminiModelId('gemini-2.5-flash')).toBe(false);
  });
});

describe('rankGeminiModelIds', () => {
  it('orders newer flash models before older ones', () => {
    const ranked = rankGeminiModelIds([
      makeModel('gemini-2.5-flash'),
      makeModel('gemini-3.5-flash'),
      makeModel('gemini-2.0-flash'),
    ]);
    expect(ranked[0]).toBe('gemini-3.5-flash');
    expect(ranked[1]).toBe('gemini-2.5-flash');
    expect(ranked[2]).toBe('gemini-2.0-flash');
  });

  it('prefers flash over pro at similar version', () => {
    const ranked = rankGeminiModelIds([
      makeModel('gemini-2.5-pro'),
      makeModel('gemini-2.5-flash'),
    ]);
    expect(ranked[0]).toBe('gemini-2.5-flash');
    expect(ranked[1]).toBe('gemini-2.5-pro');
  });

  it('deduplicates ids', () => {
    const ranked = rankGeminiModelIds([
      makeModel('gemini-2.5-flash'),
      makeModel('gemini-2.5-flash'),
    ]);
    expect(ranked).toHaveLength(1);
  });

  it('applies GEMINI_MODEL_PRIORITY substring bias when versions tie', () => {
    const ranked = rankGeminiModelIds(
      [makeModel('gemini-2.5-pro'), makeModel('gemini-2.5-flash')],
      ['gemini-2.5-pro'],
    );
    expect(ranked[0]).toBe('gemini-2.5-pro');
  });
});

describe('geminiSummarizeRankScore', () => {
  it('scores newer versions lower (earlier in sort)', () => {
    expect(geminiSummarizeRankScore('gemini-3.5-flash', [])).toBeLessThan(
      geminiSummarizeRankScore('gemini-2.5-flash', []),
    );
  });
});
