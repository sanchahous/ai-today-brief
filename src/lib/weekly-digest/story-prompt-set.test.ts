import { describe, expect, it } from 'vitest';
import {
  parseStoryPromptSetContent,
  STORY_IMAGE_SLOT_LABEL,
  storyImageSlotState,
  storyPromptCopyTargets,
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
  });

  it('drops prompt rows that are missing a copy-ready field', () => {
    const parsed = parseStoryPromptSetContent({
      prompts: [prompt(), { title: 'broken' }, prompt({ canonical: '  ' })],
    });
    expect(parsed?.prompts).toHaveLength(1);
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
