/**
 * Digest illustration prompts as a copy-paste product. Assembles Prompt-as-Code
 * six-block canonical plus Midjourney / negative derivatives. No database, no network.
 */
import { accentToHex, negativePrompt, SCENE_GRAMMARS } from './card-image';
import type {
  EditorialEssence,
  MetaphorLens,
  SceneGrammar,
  WeeklyReportageSceneBriefResult,
} from './card-image';
import {
  assembleMidjourney,
  assembleNotes,
  assembleSixBlocks,
  specFromBrief,
} from './image-prompt-library/assemble';
import { clauseSafeTake } from './image-prompt-library/text';
import type { ImagePromptTemplateId } from './image-prompt-library/templates';
import { NO_TEXT_OVERLAY } from './image-prompt-library/templates';

export const IMAGE_GRAMMARS = SCENE_GRAMMARS;
export type ImageGrammar = SceneGrammar;

export const MANUAL_PROMPT_ASPECT = '16:9' as const;

export { clauseSafeTake, NO_TEXT_OVERLAY };

/**
 * Exported so `prompt-export.test.ts` can assert this marker is actually present
 * in `buildEditorialConceptPrompt`'s real output (R2.4 / F10) — the render path
 * still uses that FLUX craft string.
 */
export const FLUX_CRAFT_SPLIT = '. One instantly readable cause-and-effect moment:';

export interface ManualImagePrompt {
  /**
   * `owner_direction` is preserved, not collapsed into `literal_context`
   * (R2.5 / F12): the owner-feedback calibration dataset (E1) is keyed by
   * this field, and mislabeling an owner-typed scene as a jury-proposed
   * `literal_context` concept mixes two different signals -- whether the
   * jury's literal-context proposal was good, and whether the owner's own
   * override worked, are not the same question.
   */
  conceptLens: MetaphorLens | 'owner_direction';
  grammar: ImageGrammar;
  templateId: ImagePromptTemplateId;
  title: string;
  canonical: string;
  midjourney: string;
  negative: string;
  aspectRatio: '16:9';
  notes: string[];
}

export interface PromptExportInput {
  brief: WeeklyReportageSceneBriefResult;
  essence: EditorialEssence;
  accent?: string;
  grammar?: ImageGrammar;
}

export function exportManualImagePrompt(input: PromptExportInput): ManualImagePrompt {
  const grammar = input.grammar ?? input.brief.grammar ?? 'cinematic_domain_scene';
  const accent = input.accent?.trim() || 'cool cyan';
  const spec = specFromBrief(
    {
      ...input.brief,
      grammar,
    },
    accentToHex(accent),
  );
  const conceptLens = lensFromBrief(input.brief.conceptLens);
  return {
    conceptLens,
    grammar,
    templateId: spec.templateId,
    title: input.brief.metaphorTitle?.trim() || titleFromLens(conceptLens),
    canonical: assembleSixBlocks(spec),
    midjourney: assembleMidjourney(spec),
    negative: composeNegative(),
    aspectRatio: MANUAL_PROMPT_ASPECT,
    notes: assembleNotes({
      templateId: spec.templateId,
      mechanism: input.brief.visibleMechanism || input.essence.mechanism,
      readerTest: input.brief.readerTest || input.essence.readerTest,
    }),
  };
}

export function exportManualImagePrompts(
  briefs: readonly WeeklyReportageSceneBriefResult[],
  essence: EditorialEssence,
  accent?: string,
): ManualImagePrompt[] {
  return briefs.map((brief) =>
    exportManualImagePrompt({
      brief,
      essence,
      accent,
      grammar: brief.grammar ?? 'cinematic_domain_scene',
    }),
  );
}

function lensFromBrief(
  lens: WeeklyReportageSceneBriefResult['conceptLens'],
): MetaphorLens | 'owner_direction' {
  if (lens === 'mechanism' || lens === 'consequence' || lens === 'owner_direction') return lens;
  return 'literal_context';
}

function titleFromLens(lens: MetaphorLens | 'owner_direction'): string {
  if (lens === 'mechanism') return 'Visible mechanism';
  if (lens === 'consequence') return 'Visible consequence';
  if (lens === 'owner_direction') return 'Owner direction';
  return 'Literal context';
}

function composeNegative(): string {
  return `${negativePrompt()}, no text, no letters, no logos, no watermarks, no UI`;
}
