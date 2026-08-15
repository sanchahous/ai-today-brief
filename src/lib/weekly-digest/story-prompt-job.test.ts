import { describe, expect, it, vi } from 'vitest';
import type { WeeklyReportageSceneBriefResult } from '../../../pipeline/card-image';
import type { ManualImagePrompt } from '../../../pipeline/prompt-export';
import {
  COVER_PROMPT_SLOT,
  essenceFromBrief,
  produceStoryPrompts,
  resolveWeeklyStoryImageMode,
  storyImageJobPath,
  storyPromptSetArtifactContent,
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
    expect(result.content).toEqual(
      storyPromptSetArtifactContent(
        exportPrompts.mock.results[0]?.value ?? [],
        'weekly-semantic-story-v5.1',
        '2026-08-15T12:00:00.000Z',
      ),
    );
    expect(result.output).toEqual({ needs_owner_review: true, prompt_count: 1 });
  });
});
