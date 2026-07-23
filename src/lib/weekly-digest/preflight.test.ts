import { describe, expect, it } from 'vitest';
import type {
  WeeklyPreflightArtifact,
  WeeklyPreflightInput,
  WeeklyPreflightSocial,
} from './preflight';
import { validateWeeklyDigestPreflight, WEEKLY_SOCIAL_MATRIX } from './preflight';

function artifact(
  artifactType: WeeklyPreflightArtifact['artifactType'],
  options: Partial<WeeklyPreflightArtifact> = {},
): WeeklyPreflightArtifact {
  return { artifactType, approved: true, ...options };
}

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
    storyIds: ['story-1', 'story-2', 'story-3'],
    artifacts: [
      artifact('article', { locale: 'en' }),
      artifact('article', { locale: 'uk' }),
      artifact('pdf', { locale: 'en' }),
      artifact('pdf', { locale: 'uk' }),
      artifact('cover'),
      artifact('story_image', { storyId: 'story-1' }),
      artifact('story_image', { storyId: 'story-2' }),
      artifact('story_image', { storyId: 'story-3' }),
      artifact('video_final', { locale: 'en' }),
      artifact('captions', { locale: 'en' }),
      artifact('captions', { locale: 'uk' }),
      artifact('thumbnail'),
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
        expect.objectContaining({ code: 'artifact_missing', slot: 'pdf:uk' }),
        expect.objectContaining({ code: 'artifact_not_approved', slot: 'cover' }),
        expect.objectContaining({
          code: 'artifact_missing',
          slot: 'story_image:story:story-2',
        }),
      ]),
    );
  });

  it.each([
    ['one', ['story-1']],
    ['two', ['story-1', 'story-2']],
    [
      'eight',
      ['story-1', 'story-2', 'story-3', 'story-4', 'story-5', 'story-6', 'story-7', 'story-8'],
    ],
  ])('rejects %s selected stories outside the 3–7 product range', (_label, storyIds) => {
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
        expect.objectContaining({ code: 'social_locale', slot: 'social:telegram' }),
        expect.objectContaining({ code: 'social_not_approved', slot: 'social:linkedin' }),
        expect.objectContaining({ code: 'social_missing', slot: 'social:threads' }),
        expect.objectContaining({ code: 'social_duplicate', slot: 'social:x' }),
      ]),
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
});
