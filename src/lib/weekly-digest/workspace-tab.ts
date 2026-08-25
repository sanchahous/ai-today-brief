/**
 * Admin workspace tab ids. Keep in sync with WEEKLY_WORKSPACE_TABS in
 * weekly-workspace.tsx — this module is the server-action side so a thrown
 * review/save/enqueue can redirect to the tab the editor was on instead of
 * Minified React error #441.
 */
export const WEEKLY_WORKSPACE_ERROR_TABS = [
  'overview',
  'stories',
  'research',
  'article',
  'visuals',
  'social',
  'pdf',
  'video',
  'release',
] as const;

export type WeeklyWorkspaceErrorTab = (typeof WEEKLY_WORKSPACE_ERROR_TABS)[number];

const TAB_SET = new Set<string>(WEEKLY_WORKSPACE_ERROR_TABS);

const ARTIFACT_TAB: Record<string, WeeklyWorkspaceErrorTab> = {
  video_script: 'video',
  video_manifest: 'video',
  video_final: 'video',
  captions: 'video',
  thumbnail: 'video',
  heygen_preview: 'video',
  graphics_preview: 'video',
  story_image: 'visuals',
  cover: 'visuals',
  social_asset: 'visuals',
  story_prompt_set: 'visuals',
  social_copy: 'social',
  pdf: 'pdf',
  article: 'article',
  content_quality_report: 'article',
  research_pack: 'research',
};

const JOB_TAB: Record<string, WeeklyWorkspaceErrorTab> = {
  research_pack: 'research',
  editorial_master: 'article',
  story_image: 'visuals',
  cover: 'visuals',
  social_asset: 'visuals',
  social_copy: 'social',
  pdf: 'pdf',
  video_script: 'video',
  video_manifest: 'video',
};

export function isWeeklyWorkspaceErrorTab(value: string): value is WeeklyWorkspaceErrorTab {
  return TAB_SET.has(value);
}

export function weeklyWorkspaceTabForArtifactType(artifactType: string): WeeklyWorkspaceErrorTab {
  return ARTIFACT_TAB[artifactType] ?? 'overview';
}

export function weeklyWorkspaceTabForJobType(jobType: string): WeeklyWorkspaceErrorTab {
  return JOB_TAB[jobType] ?? 'overview';
}

export function weeklyWorkspaceTabFromFormValue(value: string): WeeklyWorkspaceErrorTab {
  return isWeeklyWorkspaceErrorTab(value) ? value : 'overview';
}
