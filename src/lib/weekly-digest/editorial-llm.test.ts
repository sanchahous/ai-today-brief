import { describe, expect, it } from 'vitest';
import { normalizeWeeklySocialAngles, premiumGeminiEditorialModels } from './editorial-llm';

function socialAngle(channel: string) {
  return { channel, hookAngle: `Hook for ${channel}`, thesis: 'Thesis', factIds: ['claim-1'] };
}

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

describe('normalizeWeeklySocialAngles', () => {
  it('canonicalizes common channel variants and removes harmless duplicates', () => {
    expect(
      normalizeWeeklySocialAngles(
        [
          'Telegram',
          'facebook',
          'threads',
          'Twitter / X',
          'Linked-In',
          'instagram',
          'Instagram',
        ].map(socialAngle),
      ).map((angle) => angle.channel),
    ).toEqual(['telegram', 'facebook', 'threads', 'x', 'linkedin', 'instagram']);
  });

  it('still rejects a package that omits a required channel', () => {
    expect(() =>
      normalizeWeeklySocialAngles(
        ['telegram', 'facebook', 'threads', 'x', 'linkedin'].map(socialAngle),
      ),
    ).toThrow('exactly one social angle for each channel');
  });
});
