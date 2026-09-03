import { describe, expect, it } from 'vitest';
import type {
  WeeklyPreflightArtifact,
  WeeklyPreflightInput,
  WeeklyPreflightSocial,
} from './preflight';
import { validateWeeklyDigestPreflight, WEEKLY_SOCIAL_MATRIX, groupWeeklyPreflightBlockers } from './preflight';

function artifact(
  artifactType: WeeklyPreflightArtifact['artifactType'],
  options: Partial<WeeklyPreflightArtifact> = {},
): WeeklyPreflightArtifact {
  return { artifactType, approved: true, ...options };
}

// No video_script/video_manifest/video_final/captions/thumbnail artifacts:
// video is not a required slot (it ships separately post-Ship), so a
// complete release is ready without them.
function completeInput(): WeeklyPreflightInput {
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
  return {
    storyIds: ['story-1', 'story-2', 'story-3', 'story-4', 'story-5', 'story-6'],
    artifacts: [
      artifact('article', { locale: 'en' }),
      artifact('article', { locale: 'uk' }),
      artifact('content_quality_report'),
      artifact('research_pack', { storyId: 'story-1' }),
      artifact('research_pack', { storyId: 'story-2' }),
      artifact('research_pack', { storyId: 'story-3' }),
      artifact('pdf', { locale: 'en' }),
      artifact('pdf', { locale: 'uk' }),
      artifact('cover'),
      artifact('story_image', { storyId: 'story-1' }),
      artifact('story_image', { storyId: 'story-2' }),
      artifact('story_image', { storyId: 'story-3' }),
      artifact('story_image', { storyId: 'story-4' }),
      artifact('story_image', { storyId: 'story-5' }),
      artifact('story_image', { storyId: 'story-6' }),
    ],
    social,
  };
}

describe('Weekly Digest release preflight', () => {
  it('accepts a complete approved release', () => {
    expect(validateWeeklyDigestPreflight(completeInput())).toEqual({
      ready: true,
      blockers: [],
    });
  });

  it('blocks release when story image content-sim failed without override', () => {
    const input = completeInput();
    input.artifacts = input.artifacts.map((entry) =>
      entry.artifactType === 'story_image' && entry.storyId === 'story-1'
        ? { ...entry, contentSimCleared: false }
        : entry,
    );
    const result = validateWeeklyDigestPreflight(input);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'simulation_not_passed',
          slot: 'story_image:story:story-1',
          tab: 'visuals',
        }),
      ]),
    );
  });

  it('a failing post-upload QA does not add a preflight blocker', () => {
    const input = completeInput();
    input.artifacts = input.artifacts.map((entry) =>
      entry.artifactType === 'story_image' || entry.artifactType === 'cover'
        ? { ...entry, contentSimCleared: undefined }
        : entry,
    );
    const result = validateWeeklyDigestPreflight(input);
    expect(result.blockers.filter((blocker) => blocker.code === 'simulation_not_passed')).toEqual(
      [],
    );
    expect(result.ready).toBe(true);
  });

  it('reports missing, stale, and unapproved artifact slots', () => {
    const input = completeInput();
    input.artifacts = input.artifacts
      .filter((entry) => !(entry.artifactType === 'pdf' && entry.locale === 'uk'))
      .map((entry) =>
        entry.artifactType === 'cover' ? { ...entry, approved: true, stale: true } : entry,
      )
      .filter((entry) => !(entry.artifactType === 'story_image' && entry.storyId === 'story-2'));

    const result = validateWeeklyDigestPreflight(input);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'artifact_missing',
          slot: 'pdf:uk',
          tab: 'pdf',
          fix: expect.stringMatching(/Open PDF/i),
        }),
        expect.objectContaining({
          code: 'artifact_not_approved',
          slot: 'cover',
          tab: 'visuals',
          fix: expect.stringMatching(/Open Visuals/i),
        }),
        expect.objectContaining({
          code: 'artifact_missing',
          slot: 'story_image:story:story-2',
          tab: 'visuals',
        }),
      ]),
    );
  });

  it('artifact_missing story_image and cover guidance points to the prompt, not Regenerate', () => {
    const input = completeInput();
    input.artifacts = input.artifacts.filter(
      (entry) => entry.artifactType !== 'story_image' && entry.artifactType !== 'cover',
    );
    const result = validateWeeklyDigestPreflight(input);
    const storyFix = result.blockers.find(
      (blocker) => blocker.code === 'artifact_missing' && blocker.slot.startsWith('story_image'),
    )?.fix;
    const coverFix = result.blockers.find(
      (blocker) => blocker.code === 'artifact_missing' && blocker.slot === 'cover',
    )?.fix;
    expect(storyFix).toMatch(/copy a concept prompt/i);
    expect(storyFix).toMatch(/upload/i);
    expect(storyFix).not.toMatch(/Regenerate/i);
    expect(coverFix).toMatch(/copy the cover prompt/i);
    expect(coverFix).toMatch(/upload/i);
    expect(coverFix).not.toMatch(/Regenerate/i);
  });

  it.each([
    ['one', ['story-1']],
    ['two', ['story-1', 'story-2']],
    [
      'eight',
      ['story-1', 'story-2', 'story-3', 'story-4', 'story-5', 'story-6', 'story-7', 'story-8'],
    ],
  ])('rejects %s selected stories outside the Top 3 + Radar range', (_label, storyIds) => {
    const input = completeInput();
    input.storyIds = storyIds;

    expect(validateWeeklyDigestPreflight(input).blockers).toContainEqual(
      expect.objectContaining({
        code: 'stories_count',
        slot: 'stories',
      }),
    );
  });

  it('enforces the exact channel locale matrix and approval', () => {
    const input = completeInput();
    input.social = input.social.map((post) =>
      post.channel === 'telegram'
        ? { ...post, locale: 'en' }
        : post.channel === 'linkedin'
          ? { ...post, approved: false }
          : post,
    );
    input.social = input.social.filter((post) => post.channel !== 'threads');
    input.social.push({
      ...input.social.find((post) => post.channel === 'x')!,
    });

    const result = validateWeeklyDigestPreflight(input);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'social_locale',
          slot: 'social:telegram',
          tab: 'social',
          fix: expect.stringMatching(/UK/i),
        }),
        expect.objectContaining({
          code: 'social_not_approved',
          slot: 'social:linkedin',
          tab: 'social',
        }),
        expect.objectContaining({
          code: 'social_missing',
          slot: 'social:threads',
          tab: 'social',
        }),
        expect.objectContaining({
          code: 'social_duplicate',
          slot: 'social:x',
          tab: 'social',
        }),
      ]),
    );
  });

  it('points content_quality_report blockers at the Research tab with a concrete fix', () => {
    const input = completeInput();
    input.artifacts = input.artifacts.filter(
      (entry) => entry.artifactType !== 'content_quality_report',
    );

    expect(validateWeeklyDigestPreflight(input).blockers).toContainEqual(
      expect.objectContaining({
        code: 'artifact_missing',
        slot: 'content_quality_report',
        tab: 'research',
        fix: expect.stringMatching(/Research.*Content Studio.*Master quality/i),
      }),
    );
  });

  it('rejects channels outside the six-channel release matrix', () => {
    const input = completeInput();
    input.social.push({
      channel: 'tiktok',
      locale: 'en',
      publishEnabled: true,
      approved: true,
    } as unknown as WeeklyPreflightSocial);

    expect(validateWeeklyDigestPreflight(input).blockers).toContainEqual(
      expect.objectContaining({
        code: 'social_unexpected',
        slot: 'social:tiktok',
      }),
    );
  });

  it('requires the manual LinkedIn PDF/document handoff to be ready', () => {
    const input = completeInput();
    input.social = input.social.map((post) =>
      post.channel === 'linkedin' ? { ...post, manualDocumentStatus: 'draft_ready' } : post,
    );
    expect(validateWeeklyDigestPreflight(input).blockers).toContainEqual(
      expect.objectContaining({
        code: 'social_manual_document',
        slot: 'social:linkedin',
      }),
    );
  });

  it('allows an owner-disabled channel only when it records a reason', () => {
    const withReason = completeInput();
    withReason.social = withReason.social.map((post) =>
      post.channel === 'facebook'
        ? {
            ...post,
            publishEnabled: false,
            approved: false,
            disabledByOwner: true,
            disabledReason: 'Owner will publish this edition manually.',
          }
        : post,
    );
    expect(validateWeeklyDigestPreflight(withReason).ready).toBe(true);

    const withoutReason = completeInput();
    withoutReason.social = withoutReason.social.map((post) =>
      post.channel === 'facebook'
        ? {
            ...post,
            publishEnabled: false,
            approved: false,
            disabledByOwner: true,
            disabledReason: ' ',
          }
        : post,
    );
    expect(validateWeeklyDigestPreflight(withoutReason).blockers).toContainEqual(
      expect.objectContaining({
        code: 'social_disabled_reason',
        slot: 'social:facebook',
      }),
    );
  });

  it('rejects a non-owner social disable even when it has a reason', () => {
    const input = completeInput();
    input.social = input.social.map((post) =>
      post.channel === 'x'
        ? {
            ...post,
            publishEnabled: false,
            approved: false,
            disabledByOwner: false,
            disabledReason: 'An editor attempted to suppress this channel.',
          }
        : post,
    );
    expect(validateWeeklyDigestPreflight(input).blockers).toContainEqual(
      expect.objectContaining({
        code: 'social_disabled_owner',
        slot: 'social:x',
      }),
    );
  });

  it('orders and groups blockers along the release path', () => {
    const input = completeInput();
    input.artifacts = input.artifacts.filter(
      (entry) =>
        !(entry.artifactType === 'pdf' && entry.locale === 'uk') &&
        entry.artifactType !== 'content_quality_report' &&
        !(entry.artifactType === 'story_image' && entry.storyId === 'story-1'),
    );
    input.social = input.social.map((post) =>
      post.channel === 'telegram' ? { ...post, approved: false } : post,
    );

    const { blockers } = validateWeeklyDigestPreflight(input);
    expect(blockers.map((blocker) => blocker.slot)).toEqual([
      'content_quality_report',
      'story_image:story:story-1',
      'social:telegram',
      'pdf:uk',
    ]);

    const groups = groupWeeklyPreflightBlockers(blockers, input.storyIds);
    expect(groups.map((group) => group.section.tab)).toEqual([
      'research',
      'visuals',
      'social',
      'pdf',
    ]);
    expect(groups[0]?.section.step).toBe(2);
    expect(groups.map((group) => group.section.blurb)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Top 3 packs/i),
        expect.stringMatching(/story images/i),
      ]),
    );
  });
});
