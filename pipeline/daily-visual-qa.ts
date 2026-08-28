import {
  buildImageCriticPrompt,
  buildImageOnlyCriticPrompt,
  contentSimScoreThreshold,
  deterministicImageCritique,
  mergeTwoStageCritiques,
  parseImageCriticResponse,
  shouldRunStoryAwareStage,
  type ContentSimCritique,
} from '@/lib/content-sim';
import {
  DAILY_VISUAL_POLICY_ID,
  type DailyVisualDirection,
  type DailyVisualSnapshot,
} from './daily-visual-contract';
import { generateWithVision, type VisionGenerateInput } from './providers/vision';
import type { ProviderCallResult } from './providers/types';

export type DailyVisualQaStage = 'deterministic' | 'image_only' | 'story_semantic';

export interface DailyVisualQaStageReport {
  stage: DailyVisualQaStage;
  outcome: 'passed' | 'failed' | 'error';
  critique: ContentSimCritique;
  provider: string | null;
  model: string | null;
}

export interface DailyVisualQaResult {
  passed: boolean;
  critique: ContentSimCritique;
  stages: DailyVisualQaStageReport[];
  repairPatches: string[];
}

export type DailyVisualVisionGenerate = (input: VisionGenerateInput) => Promise<ProviderCallResult>;

/**
 * Production finalization wraps this hook in the monthly reservation ledger.
 * Keeping the stage explicit prevents a successful first critic from making
 * the semantic second critic an unbudgeted hidden provider call.
 */
export type DailyVisualVisionStageGenerate = (
  stage: 'image_only' | 'story_semantic',
  input: VisionGenerateInput,
) => Promise<ProviderCallResult>;

// A QA call has a fixed $0.012 reserve and a 900-token output ceiling in the
// daily-only provider. Bound the frozen story text here as well, so an
// unusually long source field cannot turn the critic into an unbounded input
// charge while still leaving it the facts needed to judge the causal scene.
const DAILY_VISUAL_QA_TITLE_CONTEXT_MAX_CHARS = 600;
const DAILY_VISUAL_QA_INTRO_CONTEXT_MAX_CHARS = 1_600;
const DAILY_VISUAL_QA_STORY_TITLE_MAX_CHARS = 480;
const DAILY_VISUAL_QA_STORY_SUMMARY_MAX_CHARS = 1_200;
const DAILY_VISUAL_QA_STORY_WHY_MAX_CHARS = 1_200;

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function excerpt(value: string, maximum: number): string {
  const normalized = compact(value);
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function failureCritique(code: string, message: string): ContentSimCritique {
  return {
    passed: false,
    scores: { overall: 0, news_legibility: 0 },
    blockers: [{ code, message, blocker: true }],
    repairDirective: {
      changeSeed: true,
      suggestedActions: ['Keep this candidate for review and inspect the visual QA failure.'],
    },
  };
}

function storyContext(snapshot: DailyVisualSnapshot): string {
  return snapshot.stories
    .slice(0, 3)
    .map((story, index) => {
      const title = excerpt(story.titleEn || story.titleUk, DAILY_VISUAL_QA_STORY_TITLE_MAX_CHARS);
      const summary = excerpt(
        story.summaryEn || story.summaryUk,
        DAILY_VISUAL_QA_STORY_SUMMARY_MAX_CHARS,
      );
      const why = excerpt(story.whyEn || story.whyUk, DAILY_VISUAL_QA_STORY_WHY_MAX_CHARS);
      return `${index + 1}. ${title}\nWhat changed: ${summary}\nWhy it matters: ${why}`;
    })
    .join('\n\n');
}

function uniquePatches(critique: ContentSimCritique): string[] {
  return [...new Set((critique.repairDirective?.promptPatches ?? []).map((entry) => entry.trim()))]
    .filter(Boolean)
    .slice(0, 8);
}

function visionGenerator(): DailyVisualVisionGenerate {
  return (input) => generateWithVision('daily.image_critic', input);
}

/**
 * Daily publishing is intentionally stricter than weekly advisory review:
 * unavailable or malformed vision QA is a failed candidate, never a pass by
 * omission. The caller retains every candidate and can still ask the owner to
 * choose one manually.
 */
export async function critiqueDailyVisualCandidate(
  input: {
    bytes: Buffer;
    mimeType: string;
    width: number;
    height: number;
    direction: DailyVisualDirection;
    snapshot: DailyVisualSnapshot;
  },
  deps: {
    generateVision?: DailyVisualVisionGenerate;
    generateVisionStage?: DailyVisualVisionStageGenerate;
  } = {},
): Promise<DailyVisualQaResult> {
  const deterministic = deterministicImageCritique({
    width: input.width,
    height: input.height,
    byteSize: input.bytes.length,
    mimeType: input.mimeType,
  });
  if (deterministic && !deterministic.passed) {
    return {
      passed: false,
      critique: deterministic,
      stages: [
        {
          stage: 'deterministic',
          outcome: 'failed',
          critique: deterministic,
          provider: null,
          model: null,
        },
      ],
      repairPatches: uniquePatches(deterministic),
    };
  }

  const generate = deps.generateVision ?? visionGenerator();
  const generateStage = (stage: 'image_only' | 'story_semantic', input: VisionGenerateInput) =>
    deps.generateVisionStage ? deps.generateVisionStage(stage, input) : generate(input);
  let imageOnlyResult: ProviderCallResult;
  try {
    imageOnlyResult = await generateStage('image_only', {
      prompt: buildImageOnlyCriticPrompt(),
      imageBytes: input.bytes,
      mimeType: input.mimeType,
    });
  } catch (error) {
    const critique = failureCritique(
      'critic_unavailable',
      `Daily visual image-only QA was unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      passed: false,
      critique,
      stages: [
        {
          stage: 'image_only',
          outcome: 'error',
          critique,
          provider: null,
          model: null,
        },
      ],
      repairPatches: uniquePatches(critique),
    };
  }

  const imageOnly = parseImageCriticResponse(imageOnlyResult.text, contentSimScoreThreshold(), {
    requireStorySemantics: false,
    requirePixelEvidence: false,
  });
  const imageOnlyStage: DailyVisualQaStageReport = {
    stage: 'image_only',
    outcome: imageOnly.passed ? 'passed' : 'failed',
    critique: imageOnly,
    provider: imageOnlyResult.provider,
    model: imageOnlyResult.model,
  };
  if (!shouldRunStoryAwareStage(imageOnly)) {
    return {
      passed: false,
      critique: imageOnly,
      stages: [imageOnlyStage],
      repairPatches: uniquePatches(imageOnly),
    };
  }

  let storyResult: ProviderCallResult;
  try {
    storyResult = await generateStage('story_semantic', {
      prompt: buildImageCriticPrompt({
        headline: input.direction.displayTitleEn,
        summary: input.direction.visualThesisEn,
        claimsExcerpt: storyContext(input.snapshot),
        storyContext: excerpt(input.snapshot.titleEn, DAILY_VISUAL_QA_TITLE_CONTEXT_MAX_CHARS),
        meaning: excerpt(input.snapshot.introEn, DAILY_VISUAL_QA_INTRO_CONTEXT_MAX_CHARS),
        mechanism: input.direction.mechanism,
        consequence: input.direction.consequence,
        visualThesis: input.direction.visualThesisEn,
        scene: input.direction.scene,
        policyId: DAILY_VISUAL_POLICY_ID,
        scoreThreshold: contentSimScoreThreshold(),
      }),
      imageBytes: input.bytes,
      mimeType: input.mimeType,
    });
  } catch (error) {
    const critique = failureCritique(
      'critic_unavailable',
      `Daily visual semantic QA was unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      passed: false,
      critique,
      stages: [
        imageOnlyStage,
        {
          stage: 'story_semantic',
          outcome: 'error',
          critique,
          provider: null,
          model: null,
        },
      ],
      repairPatches: uniquePatches(critique),
    };
  }

  const storyAware = parseImageCriticResponse(storyResult.text, contentSimScoreThreshold(), {
    requireStorySemantics: true,
    requirePixelEvidence: true,
  });
  const merged = mergeTwoStageCritiques(imageOnly, storyAware);
  return {
    passed: merged.passed,
    critique: merged,
    stages: [
      imageOnlyStage,
      {
        stage: 'story_semantic',
        outcome: storyAware.passed ? 'passed' : 'failed',
        critique: storyAware,
        provider: storyResult.provider,
        model: storyResult.model,
      },
    ],
    repairPatches: uniquePatches(merged),
  };
}
