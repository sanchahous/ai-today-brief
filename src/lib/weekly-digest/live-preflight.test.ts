import { describe, expect, it } from 'vitest';
import { livePreflightUnavailable, parseLiveWeeklyPreflight } from './live-preflight';

describe('parseLiveWeeklyPreflight', () => {
  it('maps RPC artifact_stale onto the PDF tab instead of a client-side zero', () => {
    const result = parseLiveWeeklyPreflight({
      ready: false,
      revision_id: 'rev-1',
      checked_at: '2026-08-29T10:00:00Z',
      blockers: [
        {
          code: 'artifact_stale',
          message: 'Artifact pdf:en was generated from an older input.',
          slot_key: 'pdf:en',
        },
        {
          code: 'social_assets_stale',
          message: 'linkedin copy is approved but its attached image is missing or superseded.',
          channel: 'linkedin',
        },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.error).toBeNull();
    expect(result.blockers).toEqual([
      expect.objectContaining({
        code: 'artifact_stale',
        slot: 'pdf:en',
        tab: 'pdf',
      }),
      expect.objectContaining({
        code: 'social_assets_stale',
        slot: 'social:linkedin',
        tab: 'social',
      }),
    ]);
  });

  it('keeps a digest-level RPC error visible instead of crashing the page', () => {
    const result = parseLiveWeeklyPreflight({
      ready: false,
      blockers: [{ code: 'digest_not_found', message: 'Weekly digest was not found.' }],
    });
    expect(result.blockers[0]).toEqual(
      expect.objectContaining({
        code: 'release_not_ready',
        tab: 'release',
        message: 'Weekly digest was not found.',
      }),
    );
  });

  it('surfaces a non-object RPC payload as an error instead of an empty ready state', () => {
    expect(parseLiveWeeklyPreflight(null)).toEqual({
      ready: false,
      checkedAt: null,
      revisionId: null,
      blockers: [],
      error: 'Live preflight returned an unexpected payload.',
    });
  });

  it('keeps the client-side fallback banner when the RPC itself failed', () => {
    expect(livePreflightUnavailable('PGRST202')).toEqual({
      ready: false,
      checkedAt: null,
      revisionId: null,
      blockers: [],
      error: 'PGRST202',
    });
  });

  it('maps remaining RPC codes onto workspace tabs and drops non-objects', () => {
    const result = parseLiveWeeklyPreflight({
      ready: true,
      blockers: [
        { code: 'story_image_not_approved', slot_key: 'story_image:story:abc' },
        { code: 'story_count_invalid' },
        { code: 'artifact_missing', slot_key: 'article:en' },
        { code: 'youtube_missing', slot_key: 'video_final:en' },
        { code: 'editorial_master_not_approved' },
        { code: 'social_variant_not_ready', channel: 'telegram' },
        { code: 'simulation_not_passed', slot_key: 'story_image:story:abc' },
        { code: 'artifact_not_approved', slot_key: 'cover:neutral' },
        'not-an-object',
      ],
    });
    expect(result.ready).toBe(true);
    expect(result.blockers.map((blocker) => [blocker.code, blocker.tab])).toEqual([
      ['artifact_not_approved', 'visuals'],
      ['stories_count', 'stories'],
      ['artifact_missing', 'article'],
      ['release_not_ready', 'video'],
      ['release_not_ready', 'research'],
      ['social_not_approved', 'social'],
      ['simulation_not_passed', 'visuals'],
      ['artifact_not_approved', 'visuals'],
    ]);
  });
});
