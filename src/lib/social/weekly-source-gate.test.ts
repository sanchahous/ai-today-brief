import { describe, expect, it } from 'vitest';
import { assessWeeklySocialSource } from './weekly-source-gate';

const weeklyPackage = {
  kind: 'weekly_digest',
  weekly_digest_id: 'digest-1',
  weekly_digest_revision_id: 'revision-2',
};

describe('Weekly Digest social publication gate', () => {
  it('waits until the matching web revision is published', () => {
    expect(
      assessWeeklySocialSource(weeklyPackage, {
        status: 'failed',
        published_revision_id: null,
      }),
    ).toEqual({ ready: false, code: 'weekly_digest_not_published' });
    expect(
      assessWeeklySocialSource(weeklyPackage, {
        status: 'published',
        published_revision_id: 'revision-1',
      }),
    ).toEqual({ ready: false, code: 'weekly_digest_not_published' });
  });

  it('allows only the matching published revision', () => {
    expect(
      assessWeeklySocialSource(weeklyPackage, {
        status: 'published',
        published_revision_id: 'revision-2',
      }),
    ).toEqual({ ready: true });
  });

  it('does not change daily package behavior', () => {
    expect(
      assessWeeklySocialSource(
        {
          kind: 'daily_digest',
          weekly_digest_id: null,
          weekly_digest_revision_id: null,
        },
        null,
      ),
    ).toEqual({ ready: true });
  });
});
