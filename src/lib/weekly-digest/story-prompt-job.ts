/**
 * Weekly story/cover illustration job in prompt-only mode. No pipeline/card-image
 * import at runtime — the worker lazy-loads those so empty cron claims stay light.
 */
import type {
  CardImageConfig,
  EditorialEssence,
  WeeklyReportageConceptsInput,
  WeeklyReportageSceneBriefResult,
  WeeklyReportageSceneInput,
} from '../../../pipeline/card-image';
import { mappingGateReport, type MappingGateIssue } from '../../../pipeline/concept-mapping-gate';
import type { ManualImagePrompt } from '../../../pipeline/prompt-export';
import type { StoryPromptSemanticContract } from './story-prompt-set';

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
  // R4.2 / F19: trim+lowercase before comparing, so an env value set as
  // "RENDER" or " render " (copy-paste from a doc, trailing newline in a
  // .env file) doesn't silently fall through to prompt_only -- the opposite
  // of what the operator typed.
  return raw?.trim().toLowerCase() === 'render' ? 'render' : 'prompt_only';
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
  /**
   * Sibling-diversification fields (R1.1): the raw scene blob plus subject
   * kind / composition, so other stories in the same digest can build
   * `SiblingMetaphorHint`s from `story_prompt_set` now that prompt_only mode
   * never writes a `story_image` artifact with scene metadata.
   */
  scene?: string | null;
  subjectKind?: string | null;
  composition?: string | null;
  /** Head phrases for cross-story motif-family matching (R2.3 / F9). */
  subject?: string | null;
  setting?: string | null;
  action?: string | null;
};

export interface StoryPromptSetPayload {
  prompts: StoredStoryPrompt[];
  policy: string;
  generated_at: string;
  /** Why every brief failed the mapping gate, when `prompts` is empty (R1.2). */
  mapping_gate_issues: MappingGateIssue[];
  semantic_contract?: StoryPromptSemanticContract;
}

function semanticContractFromEssence(essence: EditorialEssence): StoryPromptSemanticContract {
  return {
    storyContext: essence.storyContext,
    meaning: essence.meaning,
    essence: essence.essence,
    mechanism: essence.mechanism,
    consequence: essence.consequence,
    visualThesis: essence.visualThesis,
    readerTest: essence.readerTest,
  };
}

export function storyPromptSetArtifactContent(
  prompts: StoredStoryPrompt[],
  policy: string,
  generatedAt = new Date().toISOString(),
  mappingGateIssues: MappingGateIssue[] = [],
  essence?: EditorialEssence,
): StoryPromptSetPayload {
  return {
    prompts,
    policy,
    generated_at: generatedAt,
    mapping_gate_issues: mappingGateIssues,
    ...(essence ? { semantic_contract: semanticContractFromEssence(essence) } : {}),
  };
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
  /**
   * Used instead of `sceneBriefs` when `sceneInput.sceneOverride` is set --
   * builds the owner's typed scene as concept one plus independent jury
   * alternatives (R2.5 / F5). Before this, an owner "Edit direction" scene
   * was silently dropped in prompt_only mode: `produceStoryPrompts` only
   * ever called `sceneBriefs`/`weeklyReportageSceneBriefs`, which has no
   * sceneOverride handling -- that only ever lived in
   * `generateWeeklyReportageIllustrations`, the FLUX-rendering function
   * prompt_only mode doesn't call.
   */
  buildConcepts?: (
    conceptsInput: WeeklyReportageConceptsInput,
    cfg: CardImageConfig,
  ) => Promise<WeeklyReportageSceneBriefResult[]>;
  exportPrompts: (
    briefs: readonly WeeklyReportageSceneBriefResult[],
    essence: EditorialEssence,
    accent?: string,
  ) => ManualImagePrompt[];
  sceneInput: WeeklyReportageConceptsInput;
  cfg: CardImageConfig;
  policy: string;
  count?: number;
  accent?: string;
  generatedAt?: string;
}): Promise<{
  content: StoryPromptSetPayload;
  output: { needs_owner_review: true; prompt_count: number; mapping_gate_issues?: string[] };
}> {
  // The owner-facing default is one verified primary direction. Callers that
  // deliberately run the automatic render/vision experiment still opt into a
  // multi-concept batch explicitly.
  const count = input.count ?? 1;
  const hasOwnerScene = Boolean(input.sceneInput.sceneOverride?.trim());
  const briefs =
    hasOwnerScene && input.buildConcepts
      ? await input.buildConcepts({ ...input.sceneInput, variantCount: count }, input.cfg)
      : await input.sceneBriefs(input.sceneInput, input.cfg, { count });
  if (!briefs.length) {
    throw new Error('Illustration prompt job produced no scene briefs.');
  }
  const essence = essenceFromBrief(briefs[0], input.headline);
  const { accepted, issues } = mappingGateReport(briefs, essence);
  if (!accepted.length) {
    // A total mapping-gate wipeout is a real, reachable state (a weak
    // fallback essence can fail its own gate) -- not a job crash. Persist an
    // empty prompt set with the reasons so Visuals shows "0/3" instead of a
    // retried, permanently-red job (R1.2 / F2).
    return {
      content: storyPromptSetArtifactContent([], input.policy, input.generatedAt, issues, essence),
      output: { needs_owner_review: true, prompt_count: 0, mapping_gate_issues: issues },
    };
  }
  const prompts = input.exportPrompts(accepted, essence, input.accent).map((prompt, index) => {
    const brief = accepted[index];
    return {
      ...prompt,
      sceneSource: brief?.source ?? null,
      motifClass: brief?.motifClass ?? null,
      scene: brief?.scene ?? null,
      subjectKind: brief?.subjectKind ?? null,
      composition: brief?.composition ?? null,
      subject: brief?.subject ?? null,
      setting: brief?.setting ?? null,
      action: brief?.action ?? null,
    };
  });
  return {
    content: storyPromptSetArtifactContent(prompts, input.policy, input.generatedAt, [], essence),
    output: { needs_owner_review: true, prompt_count: prompts.length },
  };
}
