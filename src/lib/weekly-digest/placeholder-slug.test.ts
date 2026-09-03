import { describe, expect, it, vi } from 'vitest';
import {
  parseWeeklyPlaceholderSlug,
  resolveWeeklyPublicSlug,
  type WeeklySlugLookup,
} from './placeholder-slug';

describe('parseWeeklyPlaceholderSlug', () => {
  it('parses live and test date placeholders', () => {
    expect(parseWeeklyPlaceholderSlug('ai-weekly-2026-08-23')).toEqual({
      weekStart: '2026-08-23',
      isTest: false,
    });
    expect(parseWeeklyPlaceholderSlug('ai-weekly-test-2026-07-24')).toEqual({
      weekStart: '2026-07-24',
      isTest: true,
    });
  });

  it('rejects topic slugs and malformed dates', () => {
    expect(
      parseWeeklyPlaceholderSlug(
        'multiverse-s-4-bit-model-beats-16-bit-nvidia-grades-its-own-2026-08-23',
      ),
    ).toBeNull();
    expect(parseWeeklyPlaceholderSlug('ai-weekly-2026-8-23')).toBeNull();
    expect(parseWeeklyPlaceholderSlug('ai-weekly-2026-08-23-extra')).toBeNull();
    expect(parseWeeklyPlaceholderSlug('weekly-2026-08-23')).toBeNull();
  });
});

describe('resolveWeeklyPublicSlug', () => {
  it('passes an already-published slug', async () => {
    const lookup: WeeklySlugLookup = {
      isPublished: vi.fn(async () => true),
      publishedSlugForWeek: vi.fn(async () => 'should-not-run'),
    };
    await expect(resolveWeeklyPublicSlug('topic-slug-2026-08-23', lookup)).resolves.toEqual({
      kind: 'pass',
    });
    expect(lookup.publishedSlugForWeek).not.toHaveBeenCalled();
  });

  it('passes through when the exact lookup fails', async () => {
    const lookup: WeeklySlugLookup = {
      isPublished: vi.fn(async () => null),
      publishedSlugForWeek: vi.fn(async () => 'topic-slug-2026-08-23'),
    };
    await expect(resolveWeeklyPublicSlug('ai-weekly-2026-08-23', lookup)).resolves.toEqual({
      kind: 'pass',
    });
  });

  it('redirects a leftover placeholder to the published topic slug', async () => {
    const lookup: WeeklySlugLookup = {
      isPublished: vi.fn(async () => false),
      publishedSlugForWeek: vi.fn(async () => 'topic-slug-2026-08-23'),
    };
    await expect(resolveWeeklyPublicSlug('ai-weekly-2026-08-23', lookup)).resolves.toEqual({
      kind: 'redirect',
      slug: 'topic-slug-2026-08-23',
    });
    expect(lookup.publishedSlugForWeek).toHaveBeenCalledWith('2026-08-23', false);
  });

  it('404s an unpublished placeholder with no published week', async () => {
    const lookup: WeeklySlugLookup = {
      isPublished: vi.fn(async () => false),
      publishedSlugForWeek: vi.fn(async () => null),
    };
    await expect(resolveWeeklyPublicSlug('ai-weekly-2026-08-23', lookup)).resolves.toEqual({
      kind: 'missing',
    });
  });
});
