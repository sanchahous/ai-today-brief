import { describe, expect, it } from 'vitest';
import {
  isWeeklyWorkspaceErrorTab,
  weeklyWorkspaceTabForArtifactType,
  weeklyWorkspaceTabForJobType,
  weeklyWorkspaceTabFromFormValue,
  WEEKLY_WORKSPACE_ERROR_TABS,
} from './workspace-tab';

describe('weekly workspace error tabs', () => {
  it('routes video artifacts and jobs to the Video tab', () => {
    expect(weeklyWorkspaceTabForArtifactType('video_script')).toBe('video');
    expect(weeklyWorkspaceTabForArtifactType('video_manifest')).toBe('video');
    expect(weeklyWorkspaceTabForJobType('video_script')).toBe('video');
    expect(weeklyWorkspaceTabForJobType('video_manifest')).toBe('video');
  });

  it('routes story images to Visuals, not Video', () => {
    expect(weeklyWorkspaceTabForArtifactType('story_image')).toBe('visuals');
    expect(weeklyWorkspaceTabForJobType('story_image')).toBe('visuals');
  });

  it('rejects unknown form tab values instead of reflecting them into the URL', () => {
    expect(isWeeklyWorkspaceErrorTab('video')).toBe(true);
    expect(isWeeklyWorkspaceErrorTab('https://evil.example')).toBe(false);
    expect(weeklyWorkspaceTabFromFormValue('video')).toBe('video');
    expect(weeklyWorkspaceTabFromFormValue('https://evil.example')).toBe('overview');
  });

  it('keeps the same tab ids as the weekly workspace nav', () => {
    expect(WEEKLY_WORKSPACE_ERROR_TABS).toEqual([
      'overview',
      'stories',
      'research',
      'article',
      'visuals',
      'social',
      'pdf',
      'video',
      'release',
    ]);
  });
});
