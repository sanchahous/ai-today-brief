import { describe, expect, it } from 'vitest';
import { premiumGeminiEditorialModels } from './editorial-llm';

describe('premiumGeminiEditorialModels', () => {
  it('finds Pro after faster models in the live-ranked queue', () => {
    expect(
      premiumGeminiEditorialModels([
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.5-pro',
      ]),
    ).toEqual(['gemini-3.5-pro']);
  });

  it('rejects non-premium model families', () => {
    expect(
      premiumGeminiEditorialModels([
        'gemini-3.6-flash',
        'gemini-3-mini',
        'gemini-3-nano',
      ]),
    ).toEqual([]);
  });
});
