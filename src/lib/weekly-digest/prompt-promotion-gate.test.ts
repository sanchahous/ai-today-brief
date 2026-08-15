import { describe, expect, it } from 'vitest';
import { recordOwnerConceptFeedback, type OwnerFeedbackMap } from './owner-feedback';
import {
  evaluatePromptPromotionGate,
  promptPromotionStoriesFromArtifacts,
  promptSetIsDistinct,
  type PromptPromotionStoryInput,
} from './prompt-promotion-gate';
import {
  validateWeeklyDigestPreflight,
  WEEKLY_SOCIAL_MATRIX,
  type WeeklyPreflightArtifact,
  type WeeklyPreflightSocial,
} from './preflight';
import type { StoryPromptCard } from './story-prompt-set';

function prompt(partial: Partial<StoryPromptCard> = {}): StoryPromptCard {
  return {
    conceptLens: 'mechanism',
    grammar: 'cinematic_domain_scene',
    title: 'Teleprinter adapter',
    canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
    midjourney: 'a brass adapter card --ar 16:9 --style raw --no text',
    negative: 'no text, no letters, no logos',
    aspectRatio: '16:9',
    notes: [],
    ...partial,
  };
}

function threeDistinctPrompts(): StoryPromptCard[] {
  return [
    prompt({
      conceptLens: 'literal_context',
      canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
    }),
    prompt({
      conceptLens: 'mechanism',
      canonical: 'A clerk swaps one routing plug on a wall of labeled sockets.',
    }),
    prompt({
      conceptLens: 'consequence',
      canonical: 'A sealed envelope sits unopened beside a humming inbox hopper.',
    }),
  ];
}

function feedback(
  lens: string,
  verdict: 'used' | 'used_with_edits' | 'rejected',
  extra: { reasonTags?: string[]; recordedAt?: string } = {},
): OwnerFeedbackMap {
  const entry = recordOwnerConceptFeedback({
    verdict,
    reasonTags: extra.reasonTags ?? ['domain_context_success'],
    recordedAt: extra.recordedAt ?? '2026-08-15T12:08:00.000Z',
    promptTitle: lens,
    canonical: `${lens} scene`,
  });
  if (!entry) throw new Error('fixture');
  return { [lens]: entry };
}

function story(partial: Partial<PromptPromotionStoryInput> = {}): PromptPromotionStoryInput {
  return {
    storyId: 'story-1',
    prompts: threeDistinctPrompts(),
    ownerFeedback: {
      ...feedback('literal_context', 'used'),
      ...feedback('mechanism', 'used'),
      ...feedback('consequence', 'rejected', { reasonTags: ['weak_context'] }),
    },
    promptsReadyAt: '2026-08-15T12:00:00.000Z',
    uploadedAt: '2026-08-15T12:08:00.000Z',
    qaCodes: [],
    ...partial,
  };
}

function completeReleaseInput() {
  const social = Object.entries(WEEKLY_SOCIAL_MATRIX).map(
    ([channel, locale]) =>
      ({
        channel,
        locale,
        publishEnabled: true,
        approved: true,
        ...(channel === 'linkedin' ? { manualDocumentStatus: 'ready' } : {}),
      }) as WeeklyPreflightSocial,
  );
  const storyIds = ['story-1', 'story-2', 'story-3', 'story-4', 'story-5', 'story-6'];
  const artifacts: WeeklyPreflightArtifact[] = [
    { artifactType: 'article', locale: 'en', approved: true },
    { artifactType: 'article', locale: 'uk', approved: true },
    { artifactType: 'content_quality_report', approved: true },
    { artifactType: 'research_pack', storyId: 'story-1', approved: true },
    { artifactType: 'research_pack', storyId: 'story-2', approved: true },
    { artifactType: 'research_pack', storyId: 'story-3', approved: true },
    { artifactType: 'pdf', locale: 'en', approved: true },
    { artifactType: 'pdf', locale: 'uk', approved: true },
    { artifactType: 'cover', approved: true },
    { artifactType: 'video_final', locale: 'en', approved: true },
    { artifactType: 'video_script', locale: 'en', approved: true },
    { artifactType: 'video_manifest', locale: 'en', approved: true },
    { artifactType: 'captions', locale: 'en', approved: true },
    { artifactType: 'captions', locale: 'uk', approved: true },
    { artifactType: 'thumbnail', approved: true },
    ...storyIds.map((storyId) => ({ artifactType: 'story_image' as const, storyId, approved: true })),
  ];
  return { storyIds, artifacts, social };
}

describe('prompt promotion gate', () => {
  it('promotion gate passes when 60% of concepts are acceptable on the first or second owner attempt', () => {
    const result = evaluatePromptPromotionGate([story()]);
    expect(result.passed).toBe(true);
    expect(result.acceptableCount).toBe(2);
    expect(result.judgedCount).toBe(3);
    expect(result.acceptableRate).toBeCloseTo(2 / 3);
    expect(result.label).toBe('гейт промптів: пройдено');
    expect(
      evaluatePromptPromotionGate([
        story({
          ownerFeedback: {
            ...feedback('literal_context', 'used'),
            ...feedback('mechanism', 'used_with_edits', {
              reasonTags: ['good_concept_bad_execution'],
            }),
            ...feedback('consequence', 'rejected', { reasonTags: ['weak_context'] }),
          },
        }),
      ]).passed,
    ).toBe(true);
  });

  it('fails the acceptable-rate check below 60%', () => {
    const result = evaluatePromptPromotionGate([
      story({
        ownerFeedback: {
          ...feedback('literal_context', 'used'),
          ...feedback('mechanism', 'rejected', { reasonTags: ['weak_context'] }),
          ...feedback('consequence', 'rejected', { reasonTags: ['generic_diagram'] }),
        },
      }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === 'acceptable_rate')?.status).toBe('fail');
  });

  it('prompt promotion gate fails on misleading accepted concepts without blocking release preflight', () => {
    const result = evaluatePromptPromotionGate([
      story({
        ownerFeedback: {
          ...feedback('literal_context', 'used', { reasonTags: ['labels_carry_claim'] }),
          ...feedback('mechanism', 'used'),
        },
      }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.misleadingCount).toBe(1);
    expect(result.checks.find((check) => check.id === 'no_misleading')?.status).toBe('fail');

    const preflight = validateWeeklyDigestPreflight(completeReleaseInput());
    expect(preflight.ready).toBe(true);
    expect(preflight.blockers.map((blocker) => blocker.code)).not.toContain('simulation_not_passed');
    expect(preflight.blockers.map((blocker) => blocker.code).join('|')).not.toMatch(
      /prompt|promotion|misleading/,
    );
  });

  it('baked text on a used image counts as an unsupported assertion; edits do not', () => {
    expect(
      evaluatePromptPromotionGate([
        story({
          ownerFeedback: feedback('mechanism', 'used'),
          qaCodes: ['readable_text'],
        }),
      ]).checks.find((check) => check.id === 'no_misleading')?.status,
    ).toBe('fail');
    expect(
      evaluatePromptPromotionGate([
        story({
          ownerFeedback: feedback('mechanism', 'used_with_edits', {
            reasonTags: ['good_concept_bad_execution'],
          }),
          qaCodes: ['readable_text'],
        }),
      ]).checks.find((check) => check.id === 'no_misleading')?.status,
    ).toBe('pass');
  });

  it('fails when owner time exceeds 10 minutes per story and passes at the boundary', () => {
    const over = evaluatePromptPromotionGate([
      story({
        promptsReadyAt: '2026-08-15T12:00:00.000Z',
        ownerFeedback: feedback('mechanism', 'used', { recordedAt: '2026-08-15T12:11:00.000Z' }),
      }),
    ]);
    expect(over.checks.find((check) => check.id === 'owner_time')?.status).toBe('fail');
    expect(over.maxOwnerMinutes).toBe(11);

    const onTime = evaluatePromptPromotionGate([
      story({
        promptsReadyAt: '2026-08-15T12:00:00.000Z',
        ownerFeedback: feedback('mechanism', 'used', { recordedAt: '2026-08-15T12:10:00.000Z' }),
      }),
    ]);
    expect(onTime.checks.find((check) => check.id === 'owner_time')?.status).toBe('pass');
  });

  it('fails when a story has three copy prompts and passes when B2 kept a single lens', () => {
    const copies = [
      prompt({ conceptLens: 'literal_context', canonical: 'The same glowing tubes.' }),
      prompt({ conceptLens: 'mechanism', canonical: 'The same glowing tubes.' }),
      prompt({ conceptLens: 'consequence', canonical: 'The same glowing tubes.' }),
    ];
    expect(promptSetIsDistinct(copies)).toBe(false);
    expect(
      evaluatePromptPromotionGate([story({ prompts: copies })]).checks.find(
        (check) => check.id === 'distinct_prompts',
      )?.status,
    ).toBe('fail');

    const oneSeat = [prompt({ conceptLens: 'mechanism' })];
    expect(promptSetIsDistinct(oneSeat)).toBe(true);
    expect(
      evaluatePromptPromotionGate([story({ prompts: oneSeat })]).checks.find(
        (check) => check.id === 'distinct_prompts',
      )?.status,
    ).toBe('pass');

    const threeFallbacks = [
      prompt({
        conceptLens: 'literal_context',
        grammar: 'source_led_fallback',
        sceneSource: 'fallback',
        motifClass: 'fallback_essence',
        canonical: 'Fallback tubes A.',
      }),
      prompt({
        conceptLens: 'mechanism',
        grammar: 'source_led_fallback',
        sceneSource: 'fallback',
        motifClass: 'fallback_essence',
        canonical: 'Fallback tubes B.',
      }),
      prompt({
        conceptLens: 'consequence',
        grammar: 'source_led_fallback',
        sceneSource: 'fallback',
        motifClass: 'fallback_essence',
        canonical: 'Fallback tubes C.',
      }),
    ];
    expect(promptSetIsDistinct(threeFallbacks)).toBe(false);
  });

  it('stays incomplete without verdicts instead of pretending the gate passed', () => {
    const result = evaluatePromptPromotionGate([
      story({
        ownerFeedback: {},
        uploadedAt: null,
        prompts: [],
        promptsReadyAt: null,
      }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.label).toBe('гейт промптів: чекає вердиктів');
  });

  it('reads story prompt sets from artifacts and ignores the cover slot', () => {
    const stories = promptPromotionStoriesFromArtifacts({
      storyIds: ['story-1'],
      artifacts: [
        {
          artifact_type: 'story_prompt_set',
          revision_item_id: null,
          slot_key: 'cover-prompt:neutral',
          content: { prompts: threeDistinctPrompts(), generated_at: '2026-08-15T11:00:00.000Z' },
          metadata: {},
          created_at: '2026-08-15T11:00:00.000Z',
          updated_at: '2026-08-15T11:00:00.000Z',
          storage_path: null,
          external_url: null,
        },
        {
          artifact_type: 'story_prompt_set',
          revision_item_id: 'story-1',
          slot_key: 'story-prompt-set:story-1',
          content: {
            prompts: threeDistinctPrompts(),
            generated_at: '2026-08-15T12:00:00.000Z',
          },
          metadata: {},
          created_at: '2026-08-15T12:00:00.000Z',
          updated_at: '2026-08-15T12:00:00.000Z',
          storage_path: null,
          external_url: null,
        },
        {
          artifact_type: 'story_image',
          revision_item_id: 'story-1',
          slot_key: 'story-image:story-1',
          content: {},
          metadata: {
            post_upload_qa: {
              blockers: [{ code: 'readable_text', message: 'letters', blocker: true }],
              scores: {},
              checked_at: '2026-08-15T12:05:00.000Z',
            },
          },
          created_at: '2026-08-15T12:04:00.000Z',
          updated_at: '2026-08-15T12:05:00.000Z',
          storage_path: 'weekly/story-1.png',
          external_url: null,
        },
      ],
    });
    expect(stories).toHaveLength(1);
    expect(stories[0]?.prompts).toHaveLength(3);
    expect(stories[0]?.promptsReadyAt).toBe('2026-08-15T12:00:00.000Z');
    expect(stories[0]?.uploadedAt).toBe('2026-08-15T12:05:00.000Z');
    expect(stories[0]?.qaCodes).toEqual(['readable_text']);
  });
});
