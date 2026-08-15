/**
 * Server-only: one image-only vision pass after a manual weekly upload.
 * Never writes `content_sim` — preflight stays clear for owner files.
 */
import { generateWithVision } from '../../../pipeline/providers/vision';
import {
  buildImageOnlyCriticPrompt,
  contentSimVisionCriticEstimatedUsd,
  parseImageCriticResponse,
} from '@/lib/content-sim';
import type { PostUploadQa } from './post-upload-qa';

export async function reviewUploadedImage(input: {
  bytes: Buffer;
  mimeType?: string;
  generateVision?: typeof generateWithVision;
  now?: string;
}): Promise<PostUploadQa> {
  const generateVision = input.generateVision ?? generateWithVision;
  try {
    const result = await generateVision('weekly.image_critic', {
      prompt: buildImageOnlyCriticPrompt(),
      imageBytes: input.bytes,
      mimeType: input.mimeType ?? 'image/jpeg',
    });
    const critique = parseImageCriticResponse(result.text, undefined, {
      requireStorySemantics: false,
      requirePixelEvidence: false,
    });
    return {
      blockers: critique.blockers.map((blocker) => ({
        code: blocker.code,
        message: blocker.message,
        region: blocker.region,
        blocker: blocker.blocker,
      })),
      scores: critique.scores,
      model: result.model,
      cost_usd: result.usage.costUsd ?? contentSimVisionCriticEstimatedUsd(),
      checked_at: input.now ?? new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      blockers: [],
      scores: {},
      model: null,
      cost_usd: 0,
      checked_at: input.now ?? new Date().toISOString(),
      error: message.slice(0, 240),
    };
  }
}
