import { describe, expect, it } from 'vitest';
import {
  isWeeklyVisualRefreshPromptJob,
  isWeeklyVisualRefreshPromptJobType,
  isWeeklyVisualRefreshRevision,
  isWeeklyVisualRefreshStagedAsset,
  weeklyVisualRefreshDirectionHref,
  visualRefreshPromptJobInput,
} from './visual-refresh';

describe('weekly visual refresh contract', () => {
  it('identifies only revisions with an internal source pointer', () => {
    expect(isWeeklyVisualRefreshRevision({ visual_refresh_source_revision_id: 'source-1' })).toBe(
      true,
    );
    expect(isWeeklyVisualRefreshRevision({ visual_refresh_source_revision_id: '  ' })).toBe(false);
    expect(isWeeklyVisualRefreshRevision({})).toBe(false);
  });

  it('requires a review only for explicitly staged replacement pixels', () => {
    expect(isWeeklyVisualRefreshStagedAsset({ visual_refresh_asset_staged: true })).toBe(true);
    expect(isWeeklyVisualRefreshStagedAsset({ carried_from_artifact_id: 'published-image' })).toBe(
      false,
    );
    expect(isWeeklyVisualRefreshStagedAsset(null)).toBe(false);
  });

  it('opens a newly created refresh at the required direction fields', () => {
    const href = weeklyVisualRefreshDirectionHref({
      weeklyDigestId: 'digest/one',
      revisionId: 'refresh?two',
    });
    const url = new URL(href, 'https://aitodaybrief.com');

    expect(url.pathname).toBe('/admin/weekly/digest%2Fone');
    expect(url.searchParams.get('tab')).toBe('article');
    expect(url.searchParams.get('visual_refresh_draft')).toBe('refresh?two');
    expect(url.hash).toBe('#visual-refresh-direction-heading');
  });

  it('allows only cover and story prompt jobs', () => {
    expect(isWeeklyVisualRefreshPromptJobType('cover')).toBe(true);
    expect(isWeeklyVisualRefreshPromptJobType('story_image')).toBe(true);
    expect(isWeeklyVisualRefreshPromptJobType('pdf')).toBe(false);
    expect(isWeeklyVisualRefreshPromptJobType('social_asset')).toBe(false);
  });

  it('builds a cover input with no render, source URL, or pixel fields', () => {
    expect(
      visualRefreshPromptJobInput({ jobType: 'cover', sourceRevisionId: 'published-revision' }),
    ).toEqual({
      prompt_only: true,
      visual_refresh: true,
      visual_refresh_source_revision_id: 'published-revision',
      locale: 'neutral',
      slot_key: 'cover-prompt:neutral',
      revision_item_id: null,
    });
  });

  it('builds one story prompt input with its own stable prompt slot', () => {
    expect(
      visualRefreshPromptJobInput({
        jobType: 'story_image',
        sourceRevisionId: 'published-revision',
        revisionItemId: 'new-item',
      }),
    ).toMatchObject({
      prompt_only: true,
      visual_refresh: true,
      slot_key: 'story-prompt-set:new-item',
      revision_item_id: 'new-item',
    });
  });

  it('carries the immutable refresh revision hash when the queue supplies one', () => {
    expect(
      visualRefreshPromptJobInput({
        jobType: 'cover',
        sourceRevisionId: 'published-revision',
        revisionContentHash: 'direction-hash',
      }),
    ).toMatchObject({ visual_refresh_revision_hash: 'direction-hash' });
  });

  it('treats a job as a published visual-refresh fence only when both flags are true', () => {
    expect(isWeeklyVisualRefreshPromptJob({ visual_refresh: true, prompt_only: true })).toBe(true);
    expect(isWeeklyVisualRefreshPromptJob({ visual_refresh: true, prompt_only: false })).toBe(
      false,
    );
    expect(isWeeklyVisualRefreshPromptJob({ prompt_only: true })).toBe(false);
  });
});
