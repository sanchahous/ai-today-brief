/**
 * Free deterministic image gates run before the paid vision critic.
 */

import type { ContentSimCritique } from './types';
import { contentSimScoreThreshold } from './config';

export interface DeterministicImageInput {
  width: number;
  height: number;
  byteSize: number;
  /** Optional OCR / heuristic: true if likely readable UI/text was detected. */
  hasReadableText?: boolean;
  mimeType?: string;
}

const MIN_W = 800;
const MIN_H = 450;
const MAX_BYTES = 15 * 1024 * 1024;
/** Accept 16:9-ish and close cousins (cover crops). */
const MIN_ASPECT = 1.2;
const MAX_ASPECT = 2.2;

export function deterministicImageCritique(
  input: DeterministicImageInput,
  scoreThreshold = contentSimScoreThreshold(),
): ContentSimCritique | null {
  const blockers: ContentSimCritique['blockers'] = [];

  if (input.byteSize <= 0 || input.byteSize > MAX_BYTES) {
    blockers.push({
      code: 'image_byte_size',
      message: `Image byte size ${input.byteSize} is outside 1…${MAX_BYTES}.`,
      blocker: true,
    });
  }
  if (input.width < MIN_W || input.height < MIN_H) {
    blockers.push({
      code: 'image_dimensions',
      message: `Image ${input.width}×${input.height} is below ${MIN_W}×${MIN_H}.`,
      blocker: true,
    });
  }
  const aspect = input.height > 0 ? input.width / input.height : 0;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    blockers.push({
      code: 'image_aspect',
      message: `Aspect ${aspect.toFixed(2)} is outside ${MIN_ASPECT}–${MAX_ASPECT} (expected ~16:9).`,
      blocker: true,
    });
  }
  if (input.hasReadableText) {
    blockers.push({
      code: 'readable_text_heuristic',
      message: 'Heuristic flagged readable text/UI — house style is no-text.',
      blocker: true,
      region: 'full_frame',
    });
  }

  if (blockers.length === 0) return null;

  return {
    passed: false,
    scores: { overall: Math.max(0, scoreThreshold - 20) },
    blockers,
    repairDirective: {
      changeSeed: true,
      rejectMetaphor: blockers.some((b) => b.code === 'readable_text_heuristic'),
      suggestedActions: [
        'Regenerate with a stronger no-text constraint and a single concrete subject.',
      ],
      promptPatches: ['Absolutely no readable text, letters, logos, or UI chrome.'],
    },
  };
}
