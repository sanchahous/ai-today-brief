/**
 * Offline weekly-image sim against a fixture (headline + optional local image).
 * Does not call FLUX; reuses bytes from the fixture and runs deterministic +
 * vision critic / repair-directive loops so prompt changes can be backtested.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  contentSimMaxImageRepairAttempts,
  contentSimMaxImageSpendUsd,
  contentSimVisionCriticEstimatedUsd,
  runRepairLoop,
  type ContentSimQualityReport,
  type ContentSimRepairDirective,
} from '@/lib/content-sim';
import { critiqueWeeklyImageCandidate, type WeeklyImageSimCandidate } from './weekly-image';

export interface WeeklyImageFixture {
  headline: string;
  summary?: string;
  why?: string;
  practical?: string;
  limitation?: string;
  takeaway?: string;
  claimsExcerpt?: string;
  editorialAngle?: string;
  storyContext?: string;
  meaning?: string;
  essence?: string;
  mechanism?: string;
  consequence?: string;
  visualThesis?: string;
  readerTest?: string;
  metaphorTitle?: string;
  whyItFits?: string;
  scene?: string;
  /** Path to a JPEG/PNG to critique. */
  imagePath?: string;
  policyId?: string;
  width?: number;
  height?: number;
  siblingScenes?: string[];
}

function loadFixture(path: string): WeeklyImageFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as WeeklyImageFixture;
}

export async function runWeeklyImageFixtureSim(
  fixturePath: string,
  outDir: string,
): Promise<ContentSimQualityReport> {
  const fixture = loadFixture(fixturePath);
  mkdirSync(join(outDir, 'iterations'), { recursive: true });

  if (!fixture.imagePath || !existsSync(fixture.imagePath)) {
    const report: ContentSimQualityReport = {
      adapter: 'weekly-image',
      outcome: 'incomplete',
      passed: false,
      attempts: 0,
      maxAttempts: contentSimMaxImageRepairAttempts(),
      blockers: [
        {
          code: 'fixture_image_missing',
          message:
            'Fixture has no readable imagePath — capture a render before running vision sim.',
          blocker: true,
        },
      ],
      iterations: [],
      totalCostUsd: 0,
    };
    return report;
  }

  const bytes = readFileSync(fixture.imagePath);
  let scene = fixture.scene ?? fixture.headline;
  let promptPatches: string[] = [];

  const { report } = await runRepairLoop<WeeklyImageSimCandidate>({
    adapter: 'weekly-image',
    maxAttempts: contentSimMaxImageRepairAttempts(),
    maxSpendUsd: contentSimMaxImageSpendUsd(),
    generate: async ({ attempt, directive }) => {
      if (directive?.sceneOverride) scene = directive.sceneOverride;
      if (directive?.promptPatches?.length) {
        promptPatches = [...promptPatches, ...directive.promptPatches];
        scene = `${scene} ${directive.promptPatches.join(' ')}`;
      }
      const candidate: WeeklyImageSimCandidate = {
        bytes,
        width: fixture.width ?? 1600,
        height: fixture.height ?? 900,
        provider: 'fixture',
        model: 'fixture',
        estimatedCostUsd: 0,
        costSource: 'estimated',
        scene,
        positivePrompt: scene,
        negativePrompt: '',
        sceneSource: 'fixture',
        storyContext: fixture.storyContext,
        meaning: fixture.meaning,
        essence: fixture.essence,
        mechanism: fixture.mechanism,
        consequence: fixture.consequence,
        visualThesis: fixture.visualThesis,
        readerTest: fixture.readerTest,
        metaphorTitle: fixture.metaphorTitle,
        whyItFits: fixture.whyItFits,
        alternateBuffers: [],
      };
      const iterPath = join(outDir, 'iterations', `${attempt}.json`);
      writeFileSync(
        iterPath,
        `${JSON.stringify({ attempt, scene, promptPatches, directive }, null, 2)}\n`,
      );
      return {
        artifact: candidate,
        promptSummary: scene.slice(0, 400),
        costUsd: contentSimVisionCriticEstimatedUsd(),
        previewPath: fixture.imagePath,
      };
    },
    critique: (candidate) =>
      critiqueWeeklyImageCandidate(candidate, {
        headline: fixture.headline,
        summary: fixture.summary,
        why: fixture.why,
        practical: fixture.practical,
        limitation: fixture.limitation,
        takeaway: fixture.takeaway,
        claimsExcerpt: fixture.claimsExcerpt,
        editorialAngle: fixture.editorialAngle,
        policyId: fixture.policyId ?? 'weekly-semantic-story-v5',
        siblingScenes: fixture.siblingScenes,
      }),
  });

  return report;
}

/** Helper for tests: apply a directive onto scene text the same way the fixture runner does. */
export function applyFixtureDirective(
  scene: string,
  directive?: ContentSimRepairDirective,
): string {
  if (!directive) return scene;
  if (directive.sceneOverride) return directive.sceneOverride;
  if (directive.promptPatches?.length) return `${scene} ${directive.promptPatches.join(' ')}`;
  return scene;
}
