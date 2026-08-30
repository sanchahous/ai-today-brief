import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/social/llm-router', () => ({
  generateSocialJson: vi.fn(),
}));

import { generateSocialJson } from '@/lib/social/llm-router';
import {
  adaptWeeklySocialChannel,
  normalizeTelegramCandidate,
  parseWeeklySocialCritic,
  parseWeeklySocialWriter,
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

/**
 * Builds Telegram copy whose length, bold/backtick markers, and block count
 * can be toggled independently, so each contract requirement can be tested
 * in isolation from the others. Defaults to the required four separate
 * blocks (lead, Top 3, radar, CTA).
 */
function telegramCandidate(
  overrides: { bold?: boolean; code?: boolean; targetLength?: number; blocks?: number } = {},
) {
  const bold = overrides.bold ?? true;
  const code = overrides.code ?? true;
  const targetLength = overrides.targetLength ?? 1100;
  const blockCount = overrides.blocks ?? 4;
  const boldSpan = bold ? '**97%**' : '97%';
  const codeSpan = code ? '`agent-eval`' : 'agent-eval';
  const url = 'https://aitodaybrief.com/r/s/token';
  const pieces = [
    `Anthropic shipped a concrete evaluation harness for agent behavior this week, and the ${boldSpan} catch rate is the number worth remembering.`,
    `Top 3: the harness itself, a new open benchmark for tool-use safety, and a routing change that cuts inference cost for agentic workloads.`,
    `Radar: teams can run ${codeSpan} against their own tool-calling agent before the next release and compare the catch rate against their own traces, not the vendor benchmark, because coverage varies by tool surface.`,
    `Read more: ${url}`,
  ];
  const kept = Math.min(Math.max(1, blockCount), pieces.length);
  const blocks = pieces.slice(0, kept);
  // Merge any remaining pieces into the last kept block instead of dropping
  // them, so every fact (and the URL) survives even at a low block count --
  // this mirrors the production defect (blocks merged), not missing content.
  blocks[kept - 1] = [blocks[kept - 1], ...pieces.slice(kept)].join(' ');
  const filler =
    'It keeps a steady operational cadence across the week without repeating the same claim twice, since this padding only holds the paragraph inside the target character range for the test fixture.';
  // Pad a content block, never the CTA -- a long last block with the URL is
  // itself a contract violation (CTA merged into analysis).
  const padIndex = Math.min(2, kept - 1);
  while (blocks.reduce((sum, block) => sum + block.length, 0) < targetLength) {
    blocks[padIndex] += ` ${filler}`;
  }
  return blocks.join('\n\n');
}

function telegramInput() {
  return { ...baseInput(), channel: 'telegram' as const };
}

function facebookInput() {
  return { ...baseInput(), channel: 'facebook' as const };
}

function linkedinInput() {
  return { ...baseInput(), channel: 'linkedin' as const };
}

/**
 * Builds copy for a channel that requires blank-line-separated blocks, with
 * every block joined by a single `\n` instead -- the exact "1495 chars, 9
 * line breaks, 0 blank lines" shape from the production incident.
 */
function gluedBlocksCandidate(channel: 'telegram' | 'facebook' | 'linkedin') {
  const boldSpan = channel === 'telegram' ? '**97%**' : '97%';
  const codeSpan = channel === 'telegram' ? '`agent-eval`' : 'agent-eval';
  const lead = `Anthropic shipped a concrete evaluation harness for agent behavior this week. Teams can run ${codeSpan} against their own tool-calling agent before the next release and compare the ${boldSpan} catch rate against their own traces, not the vendor benchmark, because coverage varies by tool surface.`;
  const second =
    'It keeps a steady operational cadence across the week without repeating the same claim twice, since the padding here only holds the paragraph inside the target character range for this specific test fixture and reads as a second block.';
  const third =
    channel === 'linkedin'
      ? 'Which part of that pipeline is your own team still doing by hand.'
      : `Read more: https://aitodaybrief.com/r/s/token`;
  // Single \n between blocks, never a blank line -- the exact defect under test.
  return `${lead}\n${second}\n${third}`;
}

function facebookCandidate(targetLength = 900) {
  const lead =
    'Anthropic shipped a concrete evaluation harness for agent behavior this week.\n\nTeams can run agent-eval against their own tool-calling agent before the next release and compare the 97% catch rate against their own traces, not the vendor benchmark, because coverage varies by tool surface.';
  const filler =
    '\n\nIt keeps a steady operational cadence across the week without repeating the same claim twice in a row for this test fixture.';
  let text = lead;
  while (text.length < targetLength) {
    text += filler;
  }
  return `${text}\n\nRead more: https://aitodaybrief.com/r/s/token`;
}

function linkedinCandidate(targetLength = 900) {
  const lead =
    'Anthropic shipped a concrete evaluation harness for agent behavior this week.\n\nOnly the coverage number tells you whether it is safe to trust in production.\n\nTeams can run agent-eval against their own tool-calling agent before the next release and compare the catch rate against their own traces, not the vendor benchmark.';
  const filler =
    '\n\nIt keeps a steady operational cadence across the week without repeating the same claim twice in a row.';
  let text = lead;
  while (text.length < targetLength) {
    text += filler;
  }
  return text;
}

/** Has blank-line breaks between blocks, but one block is a single dense paragraph. */
function linkedinDenseParagraphCandidate() {
  const denseBlock = Array.from(
    { length: 8 },
    (_, i) =>
      `Point ${i + 1} in the same breath as the last one, never a line break in between, which is exactly the wall-of-text shape the contract calls out by name as a single dense paragraph.`,
  ).join(' ');
  return `A short opening line sets up the thesis in one breath.\n\n${denseBlock}\n\nWhich part of that pipeline is your own team still doing by hand.`;
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

  // --- prompt caching contract -------------------------------------------
  //
  // Providers reuse a cached prompt only up to the first byte that differs.
  // These tests pin the block order that makes that reuse possible: if a
  // future edit moves a volatile block (REPAIR REQUIRED, COPY ALREADY USED,
  // the copy under audit) back above a stable one, the shared prefix collapses
  // and the largest stable block -- the full article JSON -- gets re-billed on
  // every round. That regression cost real money on 2026-08-28: the writer
  // cached 34.8% of its input and the critic only 3.1%, paying more in cache
  // writes than it saved in reads.

  const promptsFor = (role: 'writer' | 'critic') =>
    vi
      .mocked(generateSocialJson)
      .mock.calls.filter(([callRole]) => callRole === role)
      .map(([, prompt]) => prompt as string);

  const sharedPrefix = (left: string, right: string) => {
    let i = 0;
    while (i < left.length && i < right.length && left[i] === right[i]) i += 1;
    return left.slice(0, i);
  };

  it('keeps the article inside the prefix shared across repair rounds', async () => {
    let criticCalls = 0;
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) => {
      if (role === 'writer') return writerResult();
      criticCalls += 1;
      return criticCalls === 1
        ? criticResult({ originalityScore: 40, originalityFlags: ['Generic opener'] })
        : criticResult();
    });

    await adaptWeeklySocialChannel(baseInput());

    const [first, second] = promptsFor('writer');
    expect(second).toBeDefined();
    // Round 2 differs from round 1 only by the appended REPAIR REQUIRED block.
    expect(second).toContain('REPAIR REQUIRED');
    expect(first).not.toContain('REPAIR REQUIRED');
    const prefix = sharedPrefix(first!, second!);
    expect(prefix).toContain('APPROVED ARTICLE');
    expect(prefix).toContain('CHANNEL CONTRACT');
    expect(prefix.length / first!.length).toBeGreaterThan(0.9);
  });

  it('keeps the article inside the prefix shared across channels', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult() : criticResult(),
    );

    await adaptWeeklySocialChannel(baseInput());
    await adaptWeeklySocialChannel({ ...baseInput(), channel: 'linkedin' as const });

    const [x, linkedin] = promptsFor('writer');
    const prefix = sharedPrefix(x!, linkedin!);
    // The channel block is per-channel and legitimately breaks the prefix;
    // everything digest-wide must sit above it.
    expect(prefix).toContain('APPROVED ARTICLE');
    expect(prefix).not.toContain('CHANNEL CONTRACT');
  });

  it('keeps the critic instructions and facts shared across channels', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult() : criticResult(),
    );

    await adaptWeeklySocialChannel(baseInput());
    await adaptWeeklySocialChannel({ ...baseInput(), channel: 'linkedin' as const });

    const [x, linkedin] = promptsFor('critic');
    const prefix = sharedPrefix(x!, linkedin!);
    expect(prefix).toContain('APPROVED FACTS');
    expect(prefix).not.toContain('CHANNEL CONTRACT');
  });

  it('keeps writer copy when every critic provider is exhausted', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) => {
      if (role === 'writer') return writerResult();
      throw new Error('All configured social LLM providers failed');
    });

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.text.length).toBeGreaterThan(40);
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
      return criticCalls === 1
        ? criticResult({
            originalityScore: 40,
            originalityFlags: ['Generic framing in the opener'],
          })
        : criticResult();
    });

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.repairRounds).toBe(1);
    expect(result.qualityReport!.auditedCandidates).toBe(2);
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

  it('keeps factual and platform observations as warnings when both dimensions pass', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult()
        : criticResult({
            score: 90,
            flags: ['Tighten the factual compression'],
            platformFitScore: 88,
            platformFlags: ['The ending could be more native'],
          }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'critic_flag' }),
        expect.objectContaining({ code: 'platform_flag' }),
      ]),
    );
    expect(result.qualityReport!.repairRounds).toBe(0);
  });

  it('releases the best candidate for owner review after bounded repair instead of failing the job', async () => {
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult()
        : criticResult({ score: 60, flags: ['Unsupported claim'] }),
    );

    const result = await adaptWeeklySocialChannel(baseInput());
    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'critic_flag', message: 'Unsupported claim' }),
      ]),
    );
    expect(
      vi.mocked(generateSocialJson).mock.calls.filter(([role]) => role === 'writer'),
    ).toHaveLength(3);
  });

  it('audits Instagram in its native tagged serialization', async () => {
    const caption =
      'Anthropic shipped a concrete evaluation workflow. The practical question is how teams use that approved signal before deployment, where smaller and testable decisions matter more than broad claims about the market.';
    const candidate = [
      '<COVER>Inspect agents before they ship',
      '<STORY>Shipped eval||The approved report shows a concrete eval workflow.',
      '<STORY>Narrower gate||Teams can test traces before a production rollout.',
      '<STORY>Fewer assumptions||Demos no longer stand in for a measurable check.',
      '<COMPARISON>Before vs after||Old reviews were narrative; the new eval is checkable.',
      '<CAVEAT>Not automatic||It does not replace human review of high-risk agents.',
      '<TAKEAWAY>Use the eval||Adopt the shipped eval before the next agent rollout.',
      `<CAPTION>${caption}`,
    ].join('');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({
            text: `${candidate}<CANDIDATE>${candidate}`,
          })
        : criticResult(),
    );

    await adaptWeeklySocialChannel({
      ...baseInput(),
      channel: 'instagram',
      instagramStoryIds: ['item-1', 'item-2', 'item-3'],
      currentRevisionItemIds: ['item-1', 'item-2', 'item-3'],
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
    expect(criticCall?.[1]).toContain('SLIDE 1 COVER');
    expect(criticCall?.[1]).toContain('CAPTION');
    expect(criticCall?.[1]).toContain('Anthropic shipped');
  });

  it('accepts Telegram copy that carries a bold number, a backticked tool name and the contracted length', async () => {
    const candidate = telegramCandidate();
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
  });

  it('accepts Telegram copy whose radar block is headed На радарі rather than a bare Radar label', async () => {
    const candidate = telegramCandidate().replace(/^Radar:/m, 'На радарі:');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
  });

  it('bolds the first number on Telegram copy that arrived without a **span**', async () => {
    const candidate = telegramCandidate({ bold: false });
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.text).toContain('**97%**');
  });

  it('keeps a missing Telegram backtick as a warning after bounded repair so the job can continue', async () => {
    const candidate = telegramCandidate({ code: false });
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'telegram_backticks_required' })]),
    );
  });

  it('squeezes over-length Telegram copy into the 900-1600 contract before the critic gate', async () => {
    const tooLong = telegramCandidate({ targetLength: 1_900 });
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${tooLong}<CANDIDATE>${tooLong}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.text.length).toBeGreaterThanOrEqual(900);
    expect(result.text.length).toBeLessThanOrEqual(1_600);
    expect(result.qualityReport!.blocking).toEqual([]);
  });

  it('keeps merged Telegram Top 3/radar blocks as a warning after bounded repair', async () => {
    const merged = telegramCandidate({ blocks: 2 });
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ text: `${merged}<CANDIDATE>${merged}` }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'telegram_block_structure' })]),
    );
  });

  it('rejects Telegram copy that dumps the three lead stories into Радар even when there are four blocks', async () => {
    const url = 'https://aitodaybrief.com/r/s/token';
    const blocks = [
      'Anthropic shipped a concrete evaluation harness for agent behavior this week, and the **97%** catch rate is the number worth remembering.',
      'Try it this week: run `agent-eval` against your own tool-calling agent before the next release and compare the catch rate against your traces, not the vendor benchmark.',
      '📡 Радар: the harness itself, a new open benchmark for tool-use safety, and a routing change that cuts inference cost — three lead stories sitting where radar should be.',
      `Read more: ${url}`,
    ];
    const filler =
      'Coverage varies by tool surface, so keep the comparison on your own traces rather than the advertised number.';
    while (blocks.reduce((sum, block) => sum + block.length, 0) < 1100) {
      blocks[1] += ` ${filler}`;
    }
    const candidate = blocks.join('\n\n');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'telegram_top3_block_required' })]),
    );
  });

  it('rejects Telegram copy whose URL sits inside a long analysis block instead of a short CTA', async () => {
    const blocks = telegramCandidate().split('\n\n');
    const urlBlock = blocks[blocks.length - 1] ?? '';
    const analysis =
      'If you only watch parameter counts you will miss the operational point: coverage, routing cost and the licence term decide whether the harness is usable this week, and that reading has to stay in the analysis rather than in the CTA.';
    blocks[blocks.length - 1] = `${analysis} ${urlBlock}`;
    const mergedCta = blocks.join('\n\n');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ text: `${mergedCta}<CANDIDATE>${mergedCta}` }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'telegram_cta_merged' })]),
    );
  });

  it('rejects Telegram copy whose blocks are joined by a single line break instead of a blank line', async () => {
    const glued = gluedBlocksCandidate('telegram');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ text: `${glued}<CANDIDATE>${glued}` }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(telegramInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'paragraph_breaks_required' })]),
    );
  });

  it('accepts Facebook copy with a blank line between every block', async () => {
    const candidate = facebookCandidate();
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${candidate}<CANDIDATE>${candidate}` })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(facebookInput());

    expect(result.qualityReport!.blocking).toEqual([]);
  });

  it('rejects Facebook copy whose blocks are joined by a single line break instead of a blank line', async () => {
    const glued = gluedBlocksCandidate('facebook');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer' ? writerResult({ text: `${glued}<CANDIDATE>${glued}` }) : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(facebookInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'paragraph_breaks_required' })]),
    );
  });

  it('accepts LinkedIn copy with a blank line between every short block', async () => {
    const candidate = linkedinCandidate();
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({
            text: `${candidate}<CANDIDATE>${candidate}`,
            firstComment: baseInput().trackedUrl,
          })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(linkedinInput());

    expect(result.qualityReport!.blocking).toEqual([]);
  });

  it('rejects LinkedIn copy whose blocks are joined by a single line break instead of a blank line', async () => {
    const glued = gluedBlocksCandidate('linkedin');
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${glued}<CANDIDATE>${glued}`, firstComment: baseInput().trackedUrl })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(linkedinInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'paragraph_breaks_required' })]),
    );
  });

  it('rejects LinkedIn copy with blank lines but one block that is a single dense paragraph', async () => {
    const dense = linkedinDenseParagraphCandidate();
    vi.mocked(generateSocialJson).mockImplementation(async (role: string) =>
      role === 'writer'
        ? writerResult({ text: `${dense}<CANDIDATE>${dense}`, firstComment: baseInput().trackedUrl })
        : criticResult(),
    );

    const result = await adaptWeeklySocialChannel(linkedinInput());

    expect(result.qualityReport!.blocking).toEqual([]);
    expect(result.qualityReport!.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'linkedin_dense_paragraph' })]),
    );
  });
});

describe('normalizeTelegramCandidate', () => {
  it('wraps the first percent in bold and squeezes past 1600 characters', () => {
    const raw = telegramCandidate({ bold: false, targetLength: 1_900 });
    expect(raw.includes('**')).toBe(false);
    expect(raw.length).toBeGreaterThan(1_600);
    const normalized = normalizeTelegramCandidate(raw);
    expect(normalized).toContain('**97%**');
    expect(normalized.length).toBeGreaterThanOrEqual(900);
    expect(normalized.length).toBeLessThanOrEqual(1_600);
  });

  it('strips Threads <PART> markers that do not belong on Telegram', () => {
    const withPart = `${telegramCandidate()}<PART>leftover`;
    expect(normalizeTelegramCandidate(withPart)).not.toMatch(/<PART>/i);
  });
});

describe('parseWeeklySocialWriter', () => {
  it('accepts a writer response with multiple explicit candidates', () => {
    expect(
      parseWeeklySocialWriter(
        '{"angle":"Concrete angle","text":"First hook<CANDIDATE>Second hook","firstComment":""}',
      ),
    ).toMatchObject({ angle: 'Concrete angle' });
  });

  it('accepts a single complete text body when the writer omitted <CANDIDATE>', () => {
    expect(
      parseWeeklySocialWriter(
        '{"angle":"Concrete angle","text":"Only one hook","firstComment":""}',
      ),
    ).toMatchObject({ angle: 'Concrete angle', text: 'Only one hook' });
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
