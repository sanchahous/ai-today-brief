import { describe, expect, it, vi } from 'vitest';
import {
  buildDailyCoverPrompt,
  buildDailyCoverSceneInstruction,
  DAILY_COVER_SCENE_ROLE,
  fillDailyCoverPrompt,
  parseStoredCoverPrompt,
  takeTopHeadlines,
} from './daily-cover-prompt';

const EDITION = {
  title: 'Tuesday tools brief',
  intro: 'Three shifts in how developers ship agents.',
  headlines: [
    'Alpha ships MCP into the shell',
    'Beta breaks the CLI sandbox',
    'Gamma raises a round for evals',
    'Delta is a fourth story and must not enter the cover brief',
  ],
};

describe('takeTopHeadlines', () => {
  it('keeps the first three non-empty titles', () => {
    expect(takeTopHeadlines(EDITION.headlines)).toEqual([
      'Alpha ships MCP into the shell',
      'Beta breaks the CLI sandbox',
      'Gamma raises a round for evals',
    ]);
  });
});

describe('buildDailyCoverPrompt', () => {
  it('daily cover prompt is built from the edition top stories, not from a single item', async () => {
    let seenRole = '';
    let seenPrompt = '';
    const stored = await buildDailyCoverPrompt({
      edition: EDITION,
      now: () => '2026-08-15T12:00:00.000Z',
      generate: async (role, prompt) => {
        seenRole = role;
        seenPrompt = prompt;
        return {
          provider: 'openrouter',
          text: JSON.stringify({
            title: 'Shared shell',
            scene:
              'Three distinct tools on one workbench: a brass MCP plug, a cracked CLI cage, and a stamped eval coin',
            mechanism: 'The day’s tools share one bench',
            consequence: 'A reader sees the edition’s shift at a glance',
            visualThesis: 'One table, three story objects',
          }),
        };
      },
    });
    expect(seenRole).toBe(DAILY_COVER_SCENE_ROLE);
    expect(seenRole).not.toBe('weekly.card_image_scene');
    expect(seenRole).not.toBe('daily.card_image_scene');
    expect(seenPrompt).toContain('Alpha ships MCP into the shell');
    expect(seenPrompt).toContain('Beta breaks the CLI sandbox');
    expect(seenPrompt).toContain('Gamma raises a round for evals');
    expect(seenPrompt).toContain(EDITION.intro);
    expect(seenPrompt).not.toContain('Delta is a fourth story');
    expect(seenPrompt).not.toMatch(/Read this news item/i);
    expect(stored.headlines).toHaveLength(3);
    expect(stored.canonical.length).toBeGreaterThan(20);
    expect(stored.midjourney).toContain('--ar 16:9');
    expect(stored.negative.toLowerCase()).toContain('no text');
    expect(stored.source).toBe('openrouter');
  });

  it('falls back to an edition tableau when the director call fails', async () => {
    const stored = await buildDailyCoverPrompt({
      edition: EDITION,
      generate: async () => {
        throw new Error('registry exhausted');
      },
    });
    expect(stored.source).toBe('fallback');
    expect(stored.headlines).toEqual(takeTopHeadlines(EDITION.headlines));
    expect(stored.canonical.toLowerCase()).toContain('alpha ships mcp');
  });
});

describe('buildDailyCoverSceneInstruction', () => {
  it('names the edition, not a single headline, as the subject', () => {
    const instruction = buildDailyCoverSceneInstruction(EDITION);
    expect(instruction).toContain('whole daily edition');
    expect(instruction).toContain('not for a single news item');
  });
});

describe('parseStoredCoverPrompt', () => {
  it('round-trips the copy payloads used in Telegram', () => {
    const parsed = parseStoredCoverPrompt({
      title: 'Shared shell',
      canonical: 'A newsroom table.',
      midjourney: 'newsroom table --ar 16:9 --style raw --no text',
      negative: 'no text, no letters',
      headlines: ['A', 'B', 'C'],
      generatedAt: '2026-08-15T12:00:00.000Z',
      source: 'openrouter',
      notifiedAt: null,
    });
    expect(parsed?.canonical).toBe('A newsroom table.');
    expect(parsed?.headlines).toEqual(['A', 'B', 'C']);
    expect(parsed?.notifiedAt).toBeNull();
  });
});

describe('fillDailyCoverPrompt', () => {
  it('skips the director when cover_prompt is already stored', async () => {
    const generate = vi.fn();
    const status = await fillDailyCoverPrompt(
      {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  title_en: EDITION.title,
                  intro_en: EDITION.intro,
                  cover_prompt: {
                    canonical: 'already',
                    midjourney: 'already --ar 16:9',
                    negative: 'no text',
                  },
                },
                error: null,
              }),
              order: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      } as never,
      'brief-1',
      { generate },
    );
    expect(status).toBe('skipped');
    expect(generate).not.toHaveBeenCalled();
  });
});
