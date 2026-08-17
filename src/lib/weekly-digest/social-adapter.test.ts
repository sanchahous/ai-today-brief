import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/social/llm-router', () => ({
  generateSocialJson: vi.fn(),
}));

import { generateSocialJson } from '@/lib/social/llm-router';
import {
  adaptWeeklySocialChannel,
  parseWeeklySocialCritic,
  SocialCopyQualityError,
} from './social-adapter';
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

function writerResult(
  overrides: { angle?: string; text?: string; firstComment?: string | null } = {},
) {
  return {
    value: {
      angle: overrides.angle ?? 'Agents found a door nobody locked',
      text:
        overrides.text ??
        `${xCandidate('Anthropic shipped a concrete eval that changes how teams inspect agent behavior before deployment.')}<CANDIDATE>${xCandidate('The useful signal this week came from Anthropic and its newly shipped evaluation workflow.')}`,
      firstComment: overrides.firstComment ?? null,
    },
    provider: 'gemini' as const,
    model: 'gemini-writer',
    fallbackUsed: false,
    attempts: [],
    usage: { promptTokens: 100, outputTokens: 200, estimatedCostUsd: 0.001 },
  };
}

function xCandidate(opening: string) {
  return `${opening} The practical consequence is narrower, testable deployment decisions grounded in the approved report, with fewer assumptions before an agent reaches production.`;
}

function criticResult(
  overrides: {
    score?: number;
    flags?: string[];
    platformFitScore?: number;
    platformFlags?: string[];
    originalityScore?: number;
    originalityFlags?: string[];
  } = {},
) {
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
    scheduledFor: '2099-08-13T09:00:00.000Z',
    sourceFacts: ['Anthropic shipped a new eval.'],
  };
}

describe('adaptWeeklySocialChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("takes the hook angle from the writer's own JSON, not from a caller-supplied input", async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ angle: 'A self-generated angle' }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.hookAngle).toBe('A self-generated angle');
  });

  it('ranks a candidate opening with a banned AI-tell phrase below a clean candidate', async () => {
    const clean = xCandidate('Anthropic found a door nobody remembered to lock.');
    const bannedOpener = xCandidate("It's worth noting that this changes the calculus entirely.");
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${bannedOpener}<CANDIDATE>${clean}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.text).toBe(clean);
  });

  it('repairs a rejected round and returns only approval-ready copy', async () => {
    let criticCalls = 0;
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) => {
      if (role === 'writer') return writerResult();
      criticCalls += 1;
      return criticCalls <= 2
        ? criticResult({
            originalityScore: 40,
            originalityFlags: ['Generic framing in the opener'],
          })
        : criticResult();
    });

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.repairRounds).toBe(1);
    expect(result.qualityReport!.auditedCandidates).toBe(3);
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

  it('keeps a passing originality observation as a warning, not an approval blocker', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult()
        : criticResult({
            originalityScore: 85,
            originalityFlags: ['The second sentence could be more specific'],
          }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).not.toContainEqual(
      expect.objectContaining({
        code: 'originality_flag',
      }),
    );
    expect(result.qualityReport!.warnings).toContainEqual(
      expect.objectContaining({ code: 'originality_flag' }),
    );
  });

  it('fails closed after bounded repair instead of returning blocker-filled copy', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult()
        : criticResult({ score: 60, flags: ['Unsupported claim'] }),
    );

    await expect(adaptWeeklySocialChannel(baseInput())).rejects.toBeInstanceOf(
      SocialCopyQualityError,
    );
    expect(
      vi.mocked(generateSocialJson).mock.calls.filter(([role]) => role === 'writer'),
    ).toHaveLength(3);
  });

  it('audits Instagram in its native tagged serialization', async () => {
    const slides = Array.from(
      { length: 7 },
      (_, index) => `Slide ${index + 1}: Anthropic shipped a concrete evaluation detail.`,
    ).join('<SLIDE>');
    const caption =
      'Anthropic shipped a concrete evaluation workflow. The practical question is how teams use that approved signal before deployment, where smaller and testable decisions matter more than broad claims about the market.';
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({
            text: `${slides}<CAPTION>${caption}<CANDIDATE>${slides}<CAPTION>${caption}`,
          })
        : criticResult(),
    );

    await adaptWeeklySocialChannel({
      ...baseInput(),
      channel: 'instagram',
      assets: [
        {
          url: 'https://example.com/cover.jpg',
          width: 1080,
          height: 1350,
          mimeType: 'image/jpeg',
        },
      ],
      altText: 'Weekly digest cover',
    });

    const criticCall = vi.mocked(generateSocialJson).mock.calls.find(([role]) => role === 'critic');
    expect(criticCall?.[1]).toContain('<SLIDE>Slide 1');
    expect(criticCall?.[1]).toContain('<CAPTION>Anthropic shipped');
  });
});

describe('parseWeeklySocialCritic', () => {
  it('rejects an unexplained all-zero template echo', () => {
    expect(() =>
      parseWeeklySocialCritic(
        '{"score":0,"flags":[],"platformFitScore":0,"platformFlags":[],"originalityScore":0,"originalityFlags":[]}',
      ),
    ).toThrow(/template/i);
  });

  it('rejects score deductions that have no actionable explanation', () => {
    expect(() =>
      parseWeeklySocialCritic(
        '{"score":80,"flags":[],"platformFitScore":100,"platformFlags":[],"originalityScore":100,"originalityFlags":[]}',
      ),
    ).toThrow(/actionable factual flag/i);
  });
});
