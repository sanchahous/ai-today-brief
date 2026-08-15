/**
 * Weekly story/cover illustration job in prompt-only mode. No pipeline/card-image
 * import at runtime — the worker lazy-loads those so empty cron claims stay light.
 */
import type {
  CardImageConfig,
  EditorialEssence,
  WeeklyReportageSceneBriefResult,
  WeeklyReportageSceneInput,
} from '../../../pipeline/card-image';
import { briefsPassingMappingGate } from '../../../pipeline/concept-mapping-gate';
import type { ManualImagePrompt } from '../../../pipeline/prompt-export';

export const WEEKLY_STORY_IMAGE_MODES = ['prompt_only', 'render'] as const;
export type WeeklyStoryImageMode = (typeof WEEKLY_STORY_IMAGE_MODES)[number];

export const STORY_IMAGE_JOB_PATHS = ['ingest_url', 'prompt_only', 'render'] as const;
export type StoryImageJobPath = (typeof STORY_IMAGE_JOB_PATHS)[number];

export const COVER_PROMPT_SLOT = 'cover-prompt:neutral';

export function storyPromptSlot(revisionItemId: string): string {
  return `story-prompt-set:${revisionItemId}`;
}

export function resolveWeeklyStoryImageMode(
  raw: string | undefined = process.env.WEEKLY_STORY_IMAGE_MODE,
): WeeklyStoryImageMode {
  return raw === 'render' ? 'render' : 'prompt_only';
}

export function storyImageJobPath(
  sourceUrl: string | null | undefined,
  mode: WeeklyStoryImageMode = resolveWeeklyStoryImageMode(),
): StoryImageJobPath {
  if (sourceUrl?.startsWith('http')) return 'ingest_url';
  return mode === 'render' ? 'render' : 'prompt_only';
}

export type StoredStoryPrompt = ManualImagePrompt & {
  sceneSource?: string | null;
  motifClass?: string | null;
};

export interface StoryPromptSetPayload {
  prompts: StoredStoryPrompt[];
  policy: string;
  generated_at: string;
}

export function storyPromptSetArtifactContent(
  prompts: StoredStoryPrompt[],
  policy: string,
  generatedAt = new Date().toISOString(),
): StoryPromptSetPayload {
  return { prompts, policy, generated_at: generatedAt };
}

export function essenceFromBrief(
  brief: WeeklyReportageSceneBriefResult | undefined,
  fallbackHeadline: string,
): EditorialEssence {
  const fallback = fallbackHeadline.trim() || 'weekly technology story';
  return {
    storyContext: brief?.storyContext?.trim() || fallback,
    meaning: brief?.meaning?.trim() || fallback,
    essence: brief?.essence?.trim() || fallback,
    mustFeel: 'editorial tension',
    forbiddenCliches: [],
    mechanism: brief?.mechanism?.trim() || fallback,
    consequence: brief?.consequence?.trim() || fallback,
    visualThesis: brief?.visualThesis?.trim() || fallback,
    readerTest: brief?.readerTest?.trim() || fallback,
  };
}

export async function produceStoryPrompts(input: {
  headline: string;
  sceneBriefs: (
    sceneInput: WeeklyReportageSceneInput,
    cfg: CardImageConfig,
    options: { count: number },
  ) => Promise<WeeklyReportageSceneBriefResult[]>;
  exportPrompts: (
    briefs: readonly WeeklyReportageSceneBriefResult[],
    essence: EditorialEssence,
    accent?: string,
  ) => ManualImagePrompt[];
  sceneInput: WeeklyReportageSceneInput;
  cfg: CardImageConfig;
  policy: string;
  count?: number;
  accent?: string;
  generatedAt?: string;
}): Promise<{
  content: StoryPromptSetPayload;
  output: { needs_owner_review: true; prompt_count: number };
}> {
  const count = input.count ?? 3;
  const briefs = await input.sceneBriefs(input.sceneInput, input.cfg, { count });
  if (!briefs.length) {
    throw new Error('Illustration prompt job produced no scene briefs.');
  }
  const essence = essenceFromBrief(briefs[0], input.headline);
  const accepted = briefsPassingMappingGate(briefs, essence);
  if (!accepted.length) {
    throw new Error(
      'Illustration prompt job produced no scene briefs that passed the mapping gate.',
    );
  }
  const prompts = input.exportPrompts(accepted, essence, input.accent).map((prompt, index) => {
    const brief = accepted[index];
    return {
      ...prompt,
      sceneSource: brief?.source ?? null,
      motifClass: brief?.motifClass ?? null,
    };
  });
  return {
    content: storyPromptSetArtifactContent(prompts, input.policy, input.generatedAt),
    output: { needs_owner_review: true, prompt_count: prompts.length },
  };
}
