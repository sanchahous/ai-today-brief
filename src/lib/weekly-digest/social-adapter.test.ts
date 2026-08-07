import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/social/llm-router', () => ({
  generateSocialJson: vi.fn(),
}));

import { generateSocialJson } from '@/lib/social/llm-router';
import { adaptWeeklySocialChannel } from './social-adapter';
import type { WeeklyMasterBundle } from './content-studio';

function bundle(): WeeklyMasterBundle {
  return {
    en: {
      locale: 'en',
      title: 'A theme-led weekly title',
      seoTitle: 't',
      metaDescription: 'd',
      ogTitle: 't',
      ogDescription: 'd',
      standfirst: 's',
      theme: 'Operational AI',
      intro: 'i',
      editorNote: 'e',
      keyTakeaways: ['k'],
      topics: ['t'],
      entities: ['e'],
      internalLinks: [],
      conclusion: 'c',
      stories: [],
    },
    uk: {
      locale: 'uk',
      title: 'Тема тижня',
      seoTitle: 't',
      metaDescription: 'd',
      ogTitle: 't',
      ogDescription: 'd',
      standfirst: 's',
      theme: 'Операційний ШІ',
      intro: 'i',
      editorNote: 'e',
      keyTakeaways: ['k'],
      topics: ['t'],
      entities: ['e'],
      internalLinks: [],
      conclusion: 'c',
      stories: [],
    },
  } as unknown as WeeklyMasterBundle;
}

function writerResult(overrides: { angle?: string; text?: string; firstComment?: string | null } = {}) {
  return {
    value: {
      angle: overrides.angle ?? 'Agents found a door nobody locked',
      text:
        overrides.text ??
        'A concrete opening about what actually happened this week.<CANDIDATE>A second, differently-framed opening on the same event.',
      firstComment: overrides.firstComment ?? null,
    },
    provider: 'gemini' as const,
    model: 'gemini-writer',
    fallbackUsed: false,
    attempts: [],
    usage: { promptTokens: 100, outputTokens: 200, estimatedCostUsd: 0.001 },
  };
}

function criticResult(overrides: {
  score?: number;
  flags?: string[];
  platformFitScore?: number;
  platformFlags?: string[];
  originalityScore?: number;
  originalityFlags?: string[];
} = {}) {
  return {
    value: {
      score: overrides.score ?? 95,
      flags: overrides.flags ?? [],
      platformFitScore: overrides.platformFitScore ?? 95,
      platformFlags: overrides.platformFlags ?? [],
      originalityScore: overrides.originalityScore ?? 90,
      originalityFlags: overrides.originalityFlags ?? [],
    },
    provider: 'openrouter' as const,
    model: 'openrouter-critic',
    fallbackUsed: false,
    attempts: [],
    usage: { promptTokens: 50, outputTokens: 60, estimatedCostUsd: 0.0005 },
  };
}

function baseInput() {
  return {
    channel: 'x' as const,
    locale: 'en' as const,
    bundle: bundle(),
    trackedUrl: 'https://aitodaybrief.com/r/s/token',
    scheduledFor: '2026-08-13T09:00:00.000Z',
    sourceFacts: ['Anthropic shipped a new eval.'],
  };
}

describe('adaptWeeklySocialChannel', () => {
  it('takes the hook angle from the writer\'s own JSON, not from a caller-supplied input', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ angle: 'A self-generated angle' }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.hookAngle).toBe('A self-generated angle');
  });

  it('ranks a candidate opening with a banned AI-tell phrase below a clean candidate', async () => {
    const clean = 'Anthropic found a door nobody remembered to lock.';
    const bannedOpener = "It's worth noting that this changes the calculus entirely.";
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${bannedOpener}<CANDIDATE>${clean}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.text).toBe(clean);
  });

  it('flags a low originality score as a blocking issue', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult() : criticResult({ originalityScore: 40 }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toContainEqual(
      expect.objectContaining({ code: 'originality_score' }),
    );
  });

  it('does not block on originality when the critic scores it above the floor', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult() : criticResult({ originalityScore: 85 }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).not.toContainEqual(
      expect.objectContaining({ code: 'originality_score' }),
    );
  });

  it('surfaces the critic\'s specific originality flags as blocking issues', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult()
        : criticResult({ originalityFlags: ['Generic "game-changer" framing in the opener'] }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toContainEqual(
      expect.objectContaining({
        code: 'originality_flag',
        message: 'Generic "game-changer" framing in the opener',
      }),
    );
  });
});
