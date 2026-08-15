/**
 * Daily card-image content-sim adapter (fixture vision loop).
 * Production daily cards still generate post-publish; this harness backtests
 * policy/prompt changes against a captured card JPEG before changing policy.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildImageCriticPrompt,
  buildImageOnlyCriticPrompt,
  contentSimMaxImageRepairAttempts,
  contentSimMaxImageSpendUsd,
  contentSimScoreThreshold,
  contentSimVisionCriticEstimatedUsd,
  deterministicImageCritique,
  mergeTwoStageCritiques,
  parseImageCriticResponse,
  runRepairLoop,
  shouldRunStoryAwareStage,
  type ContentSimQualityReport,
} from '@/lib/content-sim';
import { generateWithVision } from '../../../../pipeline/providers/vision';

export interface DailyImageFixture {
  headline: string;
  category?: string;
  scene?: string;
  imagePath?: string;
  width?: number;
  height?: number;
  policyId?: string;
}

export async function runDailyImageFixtureSim(
  fixturePath: string,
  outDir: string,
): Promise<ContentSimQualityReport> {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as DailyImageFixture;
  mkdirSync(join(outDir, 'iterations'), { recursive: true });

  if (!fixture.imagePath || !existsSync(fixture.imagePath)) {
    return {
      adapter: 'daily-image',
      outcome: 'incomplete',
      passed: false,
      attempts: 0,
      maxAttempts: contentSimMaxImageRepairAttempts(),
      blockers: [
        {
          code: 'fixture_image_missing',
          message: 'Fixture has no readable imagePath.',
          blocker: true,
        },
      ],
      iterations: [],
      totalCostUsd: 0,
    };
  }

  const bytes = readFileSync(fixture.imagePath);
  let scene = fixture.scene ?? fixture.headline;

  const { report } = await runRepairLoop<{ bytes: Buffer; scene: string }>({
    adapter: 'daily-image',
    maxAttempts: contentSimMaxImageRepairAttempts(),
    maxSpendUsd: contentSimMaxImageSpendUsd(),
    generate: async ({ attempt, directive }) => {
      if (directive?.sceneOverride) scene = directive.sceneOverride;
      if (directive?.promptPatches?.length) {
        scene = `${scene} ${directive.promptPatches.join(' ')}`;
      }
      writeFileSync(
        join(outDir, 'iterations', `${attempt}.json`),
        `${JSON.stringify({ attempt, scene, directive }, null, 2)}\n`,
      );
      return {
        artifact: { bytes, scene },
        promptSummary: scene.slice(0, 400),
        costUsd: contentSimVisionCriticEstimatedUsd(),
        previewPath: fixture.imagePath,
      };
    },
    deterministicCritique: () =>
      deterministicImageCritique({
        width: fixture.width ?? 1600,
        height: fixture.height ?? 900,
        byteSize: bytes.length,
      }),
    critique: async (artifact) => {
      const imageOnlyResult = await generateWithVision('daily.image_critic', {
        prompt: buildImageOnlyCriticPrompt(),
        imageBytes: artifact.bytes,
        mimeType: 'image/jpeg',
      });
      const imageOnly = parseImageCriticResponse(imageOnlyResult.text, contentSimScoreThreshold(), {
        requireStorySemantics: false,
        requirePixelEvidence: false,
      });
      if (!shouldRunStoryAwareStage(imageOnly)) return imageOnly;
      const storyResult = await generateWithVision('daily.image_critic', {
        prompt: buildImageCriticPrompt({
          headline: fixture.headline,
          scene: artifact.scene,
          policyId: fixture.policyId ?? 'story-specific-editorial-v5-no-text',
          scoreThreshold: contentSimScoreThreshold(),
        }),
        imageBytes: artifact.bytes,
        mimeType: 'image/jpeg',
      });
      return mergeTwoStageCritiques(
        imageOnly,
        parseImageCriticResponse(storyResult.text, contentSimScoreThreshold()),
      );
    },
  });

  return report;
}
