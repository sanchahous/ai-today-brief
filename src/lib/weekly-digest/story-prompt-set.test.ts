import { describe, expect, it } from 'vitest';
import {
  parseStoryPromptSetContent,
  STORY_IMAGE_SLOT_LABEL,
  storyImageSlotState,
  storyPromptCopyTargets,
  storyPromptReadiness,
  type StoryPromptCard,
} from './story-prompt-set';

function prompt(partial: Partial<StoryPromptCard> = {}): StoryPromptCard {
  return {
    conceptLens: 'mechanism',
    grammar: 'cinematic_domain_scene',
    title: 'Teleprinter adapter',
    canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
    midjourney: 'a brass adapter card --ar 16:9 --style raw --no text, letters, logos',
    negative: 'no text, no letters, no logos, no watermarks, no UI',
    aspectRatio: '16:9',
    notes: ['Subject first.', 'No writing in the pixels.'],
    ...partial,
  };
}

describe('parseStoryPromptSetContent', () => {
  it('missing prompt set content is empty-safe', () => {
    expect(parseStoryPromptSetContent(undefined)).toBeNull();
    expect(parseStoryPromptSetContent(null)).toBeNull();
    expect(parseStoryPromptSetContent({ policy: 'weekly-semantic-story-v5.1' })).toBeNull();
    expect(parseStoryPromptSetContent({ prompts: [] })).toEqual({
      prompts: [],
      policy: null,
      generatedAt: null,
      ownerFeedback: {},
      mappingGateIssues: [],
    });
  });

  it('a ready story_prompt_set exposes three copy payloads and an upload slot', () => {
    const parsed = parseStoryPromptSetContent({
      prompts: [
        prompt({ conceptLens: 'literal_context', title: 'Literal' }),
        prompt({ conceptLens: 'mechanism', title: 'Mechanism' }),
        prompt({ conceptLens: 'consequence', title: 'Consequence' }),
      ],
      policy: 'weekly-semantic-story-v5.1',
      generated_at: '2026-08-15T12:00:00.000Z',
    });
    expect(parsed?.prompts).toHaveLength(3);
    expect(parsed?.policy).toBe('weekly-semantic-story-v5.1');
    const kinds = parsed!.prompts.flatMap((card) =>
      storyPromptCopyTargets(card).map((target) => target.kind),
    );
    expect(kinds.filter((kind) => kind === 'canonical')).toHaveLength(3);
    expect(kinds.filter((kind) => kind === 'midjourney')).toHaveLength(3);
    expect(kinds.filter((kind) => kind === 'negative')).toHaveLength(3);
    expect(storyImageSlotState(undefined)).toBe('waiting');
    expect(STORY_IMAGE_SLOT_LABEL.waiting).toBe('очікує зображення');
    expect(parsed?.ownerFeedback).toEqual({});
  });

  it('reads owner_feedback stored next to the copy-ready prompts', () => {
    const parsed = parseStoryPromptSetContent({
      prompts: [prompt({ conceptLens: 'mechanism' })],
      owner_feedback: {
        mechanism: {
          verdict: 'used_with_edits',
          reasonTags: ['good_concept_bad_execution', 'bogus'],
          recordedAt: '2026-08-15T12:00:00.000Z',
          promptTitle: 'Teleprinter adapter',
          canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
        },
      },
    });
    expect(parsed?.ownerFeedback.mechanism?.verdict).toBe('used_with_edits');
    expect(parsed?.ownerFeedback.mechanism?.reasonTags).toEqual(['good_concept_bad_execution']);
  });

  it('drops prompt rows that are missing a copy-ready field', () => {
    const parsed = parseStoryPromptSetContent({
      prompts: [prompt(), { title: 'broken' }, prompt({ canonical: '  ' })],
    });
    expect(parsed?.prompts).toHaveLength(1);
  });

  it('carries scene/subjectKind/composition and mapping_gate_issues for sibling diversification (R1.1/R1.2)', () => {
    const parsed = parseStoryPromptSetContent({
      prompts: [
        prompt({
          scene: 'A brass adapter card seats into a teleprinter expansion slot',
          subjectKind: 'object',
          composition: 'single',
        }),
      ],
      mapping_gate_issues: ['missing_visible_outcome', 'incomplete_mapping'],
    });
    expect(parsed?.prompts[0]?.scene).toBe(
      'A brass adapter card seats into a teleprinter expansion slot',
    );
    expect(parsed?.prompts[0]?.subjectKind).toBe('object');
    expect(parsed?.prompts[0]?.composition).toBe('single');
    expect(parsed?.mappingGateIssues).toEqual(['missing_visible_outcome', 'incomplete_mapping']);
  });

  it('an empty prompt set with no mapping_gate_issues field parses to an empty array', () => {
    const parsed = parseStoryPromptSetContent({ prompts: [] });
    expect(parsed?.mappingGateIssues).toEqual([]);
  });
});

describe('storyImageSlotState', () => {
  it('after a story_image is ready the slot state is uploaded, on review', () => {
    expect(
      storyImageSlotState({
        generation_status: 'ready',
        review_status: 'in_review',
        storage_path: 'digests/x/story.jpg',
      }),
    ).toBe('uploaded_on_review');
    expect(STORY_IMAGE_SLOT_LABEL.uploaded_on_review).toBe('завантажено, on review');
  });

  it('approved story_image maps to approved', () => {
    expect(
      storyImageSlotState({
        generation_status: 'ready',
        review_status: 'approved',
        external_url: 'https://example.test/story.jpg',
      }),
    ).toBe('approved');
    expect(STORY_IMAGE_SLOT_LABEL.approved).toBe('approved');
  });

  it('queued jobs without a file stay waiting', () => {
    expect(
      storyImageSlotState({
        generation_status: 'generating',
        review_status: 'draft',
      }),
    ).toBe('waiting');
  });
});

describe('storyPromptReadiness', () => {
  it('shows N/3 промпти готові when all three seats are present', () => {
    const result = storyPromptReadiness([
      { conceptLens: 'literal_context', grammar: 'source_led' },
      { conceptLens: 'mechanism', grammar: 'source_led' },
      { conceptLens: 'consequence', grammar: 'source_led' },
    ]);
    expect(result.label).toBe('3/3 промпти готові');
    expect(result.detail).toBe('');
    expect(result.missingLenses).toEqual([]);
  });

  it('names the missing lens when B2 returned two seats', () => {
    const result = storyPromptReadiness([
      { conceptLens: 'literal_context', grammar: 'source_led' },
      { conceptLens: 'mechanism', grammar: 'source_led' },
    ]);
    expect(result.label).toBe('2/3 промпти готові');
    expect(result.detail).toContain('немає consequence');
    expect(result.missingLenses).toEqual(['consequence']);
  });

  it('shows 0/3 промпти готові with no prompts and no image metadata', () => {
    const result = storyPromptReadiness([]);
    expect(result.label).toBe('0/3 промпти готові');
    expect(result.detail).toBe('немає literal_context, mechanism, consequence');
  });

  it('flags source_led_fallback lenses in the detail line', () => {
    const result = storyPromptReadiness([
      { conceptLens: 'literal_context', grammar: 'source_led' },
      { conceptLens: 'mechanism', grammar: 'source_led_fallback' },
    ]);
    expect(result.label).toBe('2/3 промпти готові');
    expect(result.detail).toContain('фолбек: mechanism');
    expect(result.detail).toContain('немає consequence');
  });

  it('flags fallback_essence from sceneSource even when grammar stays cinematic', () => {
    const result = storyPromptReadiness([
      {
        conceptLens: 'literal_context',
        grammar: 'cinematic_domain_scene',
        sceneSource: 'fallback',
        motifClass: 'fallback_essence',
      },
    ]);
    expect(result.label).toBe('1/3 промпти готові');
    expect(result.detail).toContain('фолбек: literal context');
    expect(result.detail).toContain('немає mechanism, consequence');
  });

  it('reads concept_lens and scene_source from story_image metadata when prompts are empty', () => {
    const result = storyPromptReadiness([], {
      variant_concepts: [
        { concept_lens: 'literal_context', scene_source: 'source' },
        { concept_lens: 'mechanism', scene_source: 'fallback', motif_class: 'fallback_essence' },
      ],
    });
    expect(result.label).toBe('2/3 промпти готові');
    expect(result.detail).toContain('немає consequence');
    expect(result.detail).toContain('фолбек: mechanism');
  });
});
