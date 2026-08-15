import { describe, expect, it, vi } from 'vitest';
import type { WeeklyReportageSceneBriefResult } from '../../../pipeline/card-image';
import type { ManualImagePrompt } from '../../../pipeline/prompt-export';
import {
  COVER_PROMPT_SLOT,
  essenceFromBrief,
  produceStoryPrompts,
  resolveWeeklyStoryImageMode,
  storyImageJobPath,
  storyPromptSlot,
} from './story-prompt-job';

const sceneInput = {
  headline: 'CLI tools land on the command line',
  summary: 'A plugin exposes server-side tools through a local command.',
};

function sceneBrief(
  partial: Partial<WeeklyReportageSceneBriefResult> = {},
): WeeklyReportageSceneBriefResult {
  return {
    scene: 'A brass adapter card being pushed into a teleprinter terminal',
    source: 'openrouter',
    conceptLens: 'mechanism',
    metaphorTitle: 'Teleprinter adapter',
    storyContext: sceneInput.headline,
    meaning: sceneInput.summary,
    essence: sceneInput.headline,
    mechanism: 'A CLI plugin exposes server-side tools through a local command.',
    consequence: 'Developers invoke those tools from the command line.',
    visualThesis: 'An adapter card connecting into a terminal lets the old system run new tools.',
    readerTest: 'grasp: server-side tools now plug into the command line',
    storyAnchor: 'a brass adapter card in a teleprinter slot',
    visibleMechanism: 'the card connecting server tools into the local command',
    visibleConsequence: 'the old terminal runs the new tools',
    ...partial,
  };
}

describe('resolveWeeklyStoryImageMode', () => {
  it('defaults to prompt_only unless the env is exactly render', () => {
    expect(resolveWeeklyStoryImageMode(undefined)).toBe('prompt_only');
    expect(resolveWeeklyStoryImageMode('')).toBe('prompt_only');
    expect(resolveWeeklyStoryImageMode('prompt_only')).toBe('prompt_only');
    expect(resolveWeeklyStoryImageMode('PROMPT_ONLY')).toBe('prompt_only');
    expect(resolveWeeklyStoryImageMode('render')).toBe('render');
  });
});

describe('storyImageJobPath', () => {
  it('ingests http source_url in both modes', () => {
    expect(storyImageJobPath('https://cdn.example/story.jpg', 'prompt_only')).toBe('ingest_url');
    expect(storyImageJobPath('https://cdn.example/story.jpg', 'render')).toBe('ingest_url');
  });

  it('uses the mode when there is no source_url', () => {
    expect(storyImageJobPath(null, 'prompt_only')).toBe('prompt_only');
    expect(storyImageJobPath(undefined, 'render')).toBe('render');
    expect(storyImageJobPath('not-a-url', 'prompt_only')).toBe('prompt_only');
  });
});

describe('story prompt slots', () => {
  it('keeps story and cover slot keys stable', () => {
    expect(storyPromptSlot('item-1')).toBe('story-prompt-set:item-1');
    expect(COVER_PROMPT_SLOT).toBe('cover-prompt:neutral');
  });
});

describe('essenceFromBrief', () => {
  it('fills empty semantic fields from the headline', () => {
    const essence = essenceFromBrief(undefined, 'Weekly AI Digest');
    expect(essence.storyContext).toBe('Weekly AI Digest');
    expect(essence.essence).toBe('Weekly AI Digest');
    expect(essence.mustFeel).toBe('editorial tension');
  });
});

describe('produceStoryPrompts', () => {
  it('throws when the jury returns no briefs', async () => {
    await expect(
      produceStoryPrompts({
        headline: sceneInput.headline,
        sceneBriefs: async () => [],
        exportPrompts: () => [],
        sceneInput,
        cfg: { geminiApiKey: '' },
        policy: 'weekly-semantic-story-v5.1',
      }),
    ).rejects.toThrow(/no scene briefs/i);
  });

  it('writes a prompt set and never calls the image provider', async () => {
    const generateWeeklyReportageIllustrations = vi.fn();
    const sceneBriefs = vi.fn(async () => [sceneBrief()]);
    const exportPrompts = vi.fn((): ManualImagePrompt[] => [
      {
        conceptLens: 'mechanism',
        grammar: 'cinematic_domain_scene',
        title: 'Teleprinter adapter',
        canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
        midjourney: 'a brass adapter card --ar 16:9 --style raw --no text',
        negative: 'no text, no letters',
        aspectRatio: '16:9',
        notes: [],
      },
    ]);
    const result = await produceStoryPrompts({
      headline: sceneInput.headline,
      sceneBriefs,
      exportPrompts,
      sceneInput,
      cfg: { geminiApiKey: '' },
      policy: 'weekly-semantic-story-v5.1',
      count: 1,
      generatedAt: '2026-08-15T12:00:00.000Z',
    });
    expect(generateWeeklyReportageIllustrations).not.toHaveBeenCalled();
    expect(sceneBriefs).toHaveBeenCalledWith(sceneInput, { geminiApiKey: '' }, { count: 1 });
    expect(result.content.prompts).toEqual([
      {
        ...(exportPrompts.mock.results[0]?.value[0] ?? {}),
        sceneSource: 'openrouter',
        motifClass: null,
      },
    ]);
    expect(result.output).toEqual({ needs_owner_review: true, prompt_count: 1 });
  });

  it('stamps jury fallback source onto the stored prompt set', async () => {
    const result = await produceStoryPrompts({
      headline: sceneInput.headline,
      sceneBriefs: async () => [
        sceneBrief({
          source: 'fallback',
          motifClass: 'fallback_essence',
          conceptLens: 'literal_context',
        }),
      ],
      exportPrompts: () => [
        {
          conceptLens: 'literal_context',
          grammar: 'cinematic_domain_scene',
          title: 'Literal context',
          canonical: 'A grounded tableau.',
          midjourney: 'a grounded tableau --ar 16:9 --style raw --no text',
          negative: 'no text',
          aspectRatio: '16:9',
          notes: [],
        },
      ],
      sceneInput,
      cfg: { geminiApiKey: '' },
      policy: 'weekly-semantic-story-v5.1',
      count: 1,
    });
    expect(result.content.prompts[0]?.sceneSource).toBe('fallback');
    expect(result.content.prompts[0]?.motifClass).toBe('fallback_essence');
  });

  it('a concept missing visible outcome does not enter the prompt set', async () => {
    const exportPrompts = vi.fn((briefs: readonly WeeklyReportageSceneBriefResult[]) =>
      briefs.map((brief) => ({
        conceptLens: brief.conceptLens === 'owner_direction' ? 'literal_context' : brief.conceptLens,
        grammar: 'cinematic_domain_scene' as const,
        title: brief.metaphorTitle ?? 'Concept',
        canonical: brief.scene,
        midjourney: `${brief.scene} --ar 16:9`,
        negative: 'no text',
        aspectRatio: '16:9' as const,
        notes: [],
      })),
    );
    const result = await produceStoryPrompts({
      headline: sceneInput.headline,
      sceneBriefs: async () => [
        sceneBrief({ conceptLens: 'mechanism', metaphorTitle: 'Mapped adapter' }),
        sceneBrief({
          conceptLens: 'consequence',
          metaphorTitle: 'Sewing machine',
          visibleConsequence: '',
        }),
      ],
      exportPrompts,
      sceneInput,
      cfg: { geminiApiKey: '' },
      policy: 'weekly-semantic-story-v5.1',
      count: 2,
    });
    expect(exportPrompts.mock.calls[0]?.[0]).toHaveLength(1);
    expect(result.content.prompts).toHaveLength(1);
    expect(result.content.prompts[0]?.title).toBe('Mapped adapter');
    expect(result.output.prompt_count).toBe(1);
  });

  it('throws when every brief fails the mapping gate', async () => {
    await expect(
      produceStoryPrompts({
        headline: sceneInput.headline,
        sceneBriefs: async () => [
          sceneBrief({
            storyAnchor: '',
            visibleMechanism: '',
            visibleConsequence: '',
          }),
        ],
        exportPrompts: () => [],
        sceneInput,
        cfg: { geminiApiKey: '' },
        policy: 'weekly-semantic-story-v5.1',
        count: 1,
      }),
    ).rejects.toThrow(/mapping gate/i);
  });
});
