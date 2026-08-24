/**
 * Server-only: one image-only vision pass after a manual weekly upload.
 * Never writes `content_sim` — preflight stays clear for owner files.
 */
import { generateWithVision } from '../../../pipeline/providers/vision';
import {
  buildImageCriticPrompt,
  buildImageOnlyCriticPrompt,
  contentSimVisionCriticEstimatedUsd,
  mergeTwoStageCritiques,
  parseImageCriticResponse,
  shouldRunStoryAwareStage,
} from '@/lib/content-sim';
import type { PostUploadQa } from './post-upload-qa';

/**
 * The authoritative story fields handed to the optional second vision pass.
 * Manual uploads remain owner-approved; this makes semantic mismatch visible
 * instead of trying to auto-publish or auto-repair the file.
 */
export interface PostUploadQaStoryContext {
  headline: string;
  summary?: string;
  why?: string;
  practical?: string;
  limitation?: string;
  takeaway?: string;
  storyContext?: string;
  meaning?: string;
  essence?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
  readerTest?: string;
  scene?: string;
  policyId?: string;
}

function qaFromCritique(input: {
  critique: ReturnType<typeof parseImageCriticResponse>;
  model: string;
  costUsd: number;
  checkedAt: string;
  storyChecked?: boolean;
}): PostUploadQa {
  const blockers = input.critique.blockers.map((blocker) => ({
    code: blocker.code,
    message: blocker.message,
    region: blocker.region,
    blocker: blocker.blocker,
  }));
  // A critic can correctly score a story below the threshold yet forget to
  // emit a code. Do not present that as "QA clean" to the owner.
  if (!input.critique.passed && blockers.length === 0) {
    blockers.push({
      code: input.storyChecked ? 'ambiguous_visual_story' : 'low_quality',
      message: input.storyChecked
        ? 'Story-aware vision scores are below the legibility threshold.'
        : 'Image-only vision score is below the quality threshold.',
      region: undefined,
      blocker: true,
    });
  }
  return {
    blockers,
    scores: input.critique.scores,
    model: input.model,
    cost_usd: input.costUsd,
    checked_at: input.checkedAt,
    story_checked: input.storyChecked === true,
  };
}

export async function reviewUploadedImage(input: {
  bytes: Buffer;
  mimeType?: string;
  storyContext?: PostUploadQaStoryContext;
  generateVision?: typeof generateWithVision;
  now?: string;
}): Promise<PostUploadQa> {
  const generateVision = input.generateVision ?? generateWithVision;
  const checkedAt = input.now ?? new Date().toISOString();
  try {
    const imageOnlyResult = await generateVision('weekly.image_critic', {
      prompt: buildImageOnlyCriticPrompt(),
      imageBytes: input.bytes,
      mimeType: input.mimeType ?? 'image/jpeg',
    });
    const imageOnly = parseImageCriticResponse(imageOnlyResult.text, undefined, {
      requireStorySemantics: false,
      requirePixelEvidence: false,
    });
    const imageOnlyCost = imageOnlyResult.usage.costUsd ?? contentSimVisionCriticEstimatedUsd();
    if (!input.storyContext || !shouldRunStoryAwareStage(imageOnly)) {
      return qaFromCritique({
        critique: imageOnly,
        model: imageOnlyResult.model,
        costUsd: imageOnlyCost,
        checkedAt,
      });
    }
    try {
      const storyResult = await generateVision('weekly.image_critic', {
        prompt: buildImageCriticPrompt(input.storyContext),
        imageBytes: input.bytes,
        mimeType: input.mimeType ?? 'image/jpeg',
      });
      const storyAware = parseImageCriticResponse(storyResult.text, undefined, {
        requireStorySemantics: true,
        requirePixelEvidence: true,
      });
      const model = [imageOnlyResult.model, storyResult.model]
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(' → ');
      return qaFromCritique({
        critique: mergeTwoStageCritiques(imageOnly, storyAware),
        model,
        costUsd:
          imageOnlyCost + (storyResult.usage.costUsd ?? contentSimVisionCriticEstimatedUsd()),
        checkedAt,
        storyChecked: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...qaFromCritique({
          critique: imageOnly,
          model: imageOnlyResult.model,
          costUsd: imageOnlyCost,
          checkedAt,
        }),
        error: `Story-aware QA unavailable: ${message.slice(0, 180)}`,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      blockers: [],
      scores: {},
      model: null,
      cost_usd: 0,
      checked_at: checkedAt,
      error: message.slice(0, 240),
    };
  }
}
