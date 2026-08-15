/**
 * Digest illustration prompts as a copy-paste product. Translates the existing
 * weekly FLUX builders into a canonical natural-language prompt plus Midjourney
 * / negative derivatives. No database, no network.
 */
import {
  accentToHex,
  buildEditorialConceptPrompt,
  negativePrompt,
  SCENE_GRAMMARS,
  type EditorialEssence,
  type MetaphorLens,
  type SceneGrammar,
  type WeeklyReportageSceneBriefResult,
} from './card-image';
import { logEvent } from './log';

export const IMAGE_GRAMMARS = SCENE_GRAMMARS;
export type ImageGrammar = SceneGrammar;

export const MANUAL_PROMPT_ASPECT = '16:9' as const;

const NO_TEXT_OVERLAY =
  'Labels and captions are added later in a separate layer — the image itself carries no writing of any kind.';
const MIDJOURNEY_NO_TEXT = '--no text, letters, logos, watermarks, UI';
const REQUIRED_NEGATIVE = 'no text, no letters, no logos, no watermarks, no UI';
/**
 * Exported (not just internal) so `prompt-export.test.ts` can assert this
 * marker is actually present in `buildEditorialConceptPrompt`'s real output
 * (R2.4 / F10) -- a card-image.ts prompt-format change that drops this
 * string would otherwise silently degrade every canonical prompt to
 * `firstSentence()` with no test failure and no runtime signal.
 */
export const FLUX_CRAFT_SPLIT = '. One instantly readable cause-and-effect moment:';
/** Target canonical prompt length from the plan's worked reference (P1). */
const CANONICAL_SCENE_WORD_BUDGET = 70;

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
  const scene = collapseWs(input.brief.scene);
  const fluxPrompt = buildEditorialConceptPrompt(accent, scene);
  const canonical =
    grammar === 'deterministic_technical_hybrid'
      ? composeDiagramCanonical(scene, input.essence)
      : translateFluxToCanonical(fluxPrompt, grammar);
  const conceptLens = lensFromBrief(input.brief.conceptLens);
  return {
    conceptLens,
    grammar,
    title: input.brief.metaphorTitle?.trim() || titleFromLens(conceptLens),
    canonical,
    midjourney: composeMidjourney(scene, grammar),
    negative: composeNegative(),
    aspectRatio: MANUAL_PROMPT_ASPECT,
    notes: composeNotes(input.brief, input.essence, grammar),
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

function translateFluxToCanonical(fluxPrompt: string, grammar: ImageGrammar): string {
  const collapsed = collapseWs(fluxPrompt);
  const splitAt = collapsed.indexOf(FLUX_CRAFT_SPLIT);
  if (splitAt <= 0) {
    // buildEditorialConceptPrompt's format drifted out from under this split
    // marker -- degrading to firstSentence() below is a real quality loss
    // (loses light/lens/accent extraction entirely), so it must be visible
    // in logs even though it isn't fatal to the job (R2.4 / F10).
    logEvent('warn', 'publish', 'prompt-export: FLUX craft-split marker not found', {
      flux_prompt_preview: collapsed.slice(0, 160),
    });
  }
  const scene = (splitAt > 0 ? collapsed.slice(0, splitAt) : firstSentence(collapsed)).trim();
  const craft = splitAt > 0 ? collapsed.slice(splitAt + FLUX_CRAFT_SPLIT.length) : '';
  const hex = craft.match(/accent color (#[0-9A-Fa-f]{6})/i)?.[1] ?? accentToHex('cool cyan');
  const lens = craft.match(/shot on ([^,]+)/i)?.[1]?.trim() ?? '35mm lens';
  const light = craft.match(/([^,]*\blight)\b/i)?.[1]?.trim() ?? 'dramatic available light';
  const sourceLed =
    grammar === 'source_led_fallback'
      ? ' Grounded in the source story rather than a decorative metaphor.'
      : '';
  const body =
    `${clauseSafeTake(scene, CANONICAL_SCENE_WORD_BUDGET)}. ${light}, ${lens}, shallow depth of ` +
    `field, photoreal materials, restrained grade with accent ${hex}. Photographic reportage, ` +
    `no illustration styling.${sourceLed} ` +
    NO_TEXT_OVERLAY;
  return collapseWs(body);
}

function composeDiagramCanonical(scene: string, essence: EditorialEssence): string {
  return collapseWs(
    `${takeWords(scene, 40)}. Technical diagram, not a photograph: boxes for the named elements, ` +
      `arrows showing ${takeWords(essence.mechanism, 24)}, outcome ${takeWords(essence.consequence, 24)}. ` +
      `The owner adds captions in a separate overlay. ${NO_TEXT_OVERLAY}`,
  );
}

function composeMidjourney(scene: string, grammar: ImageGrammar): string {
  const compact = takeWords(scene.replace(/\.\s+/g, ', '), 40).replace(/,$/, '');
  const style =
    grammar === 'deterministic_technical_hybrid'
      ? 'clean technical diagram, labelled boxes added later, arrows, flat infographic'
      : 'photographic reportage, shallow depth of field, photoreal materials';
  return `${compact}, ${style} --ar ${MANUAL_PROMPT_ASPECT} --style raw ${MIDJOURNEY_NO_TEXT}`;
}

function composeNegative(): string {
  return `${negativePrompt()}, ${REQUIRED_NEGATIVE}`;
}

function composeNotes(
  brief: WeeklyReportageSceneBriefResult,
  essence: EditorialEssence,
  grammar: ImageGrammar,
): string[] {
  const mechanism = collapseWs(brief.visibleMechanism || essence.mechanism);
  const reader = collapseWs(brief.readerTest || essence.readerTest);
  const notes = [
    mechanism
      ? `The image must make this mechanism visible: ${takeWords(mechanism, 28)}.`
      : 'The physical cause must be the brightest, most readable action in frame.',
    reader
      ? `A reader should grasp this without a caption: ${takeWords(reader, 28)}.`
      : 'A reader should understand the claim without any on-image caption.',
    'No screens, letters, logos, or captions in the pixels — overlays are added later.',
  ];
  if (grammar === 'deterministic_technical_hybrid') {
    notes.push('This concept is a diagram, not a photograph: compare the named states with arrows.');
  }
  return notes.slice(0, 4);
}

function firstSentence(text: string): string {
  const cut = text.indexOf('.');
  return cut > 12 ? text.slice(0, cut) : text;
}

function takeWords(text: string, max: number): string {
  const words = collapseWs(text).split(' ').filter(Boolean);
  return words.slice(0, max).join(' ');
}

/**
 * Word-budget cut that lands on the last complete clause (comma / semicolon)
 * within the budget instead of a hard mid-thought stop -- a plain word-count
 * cut here regularly landed the canonical prompt mid-clause right before the
 * boilerplate light/lens sentence, which is exactly the "needs manual
 * editing before pasting into a tool" failure P1 promises not to produce
 * (R2.4 / F11). Falls back to the hard cut when no clause boundary is found
 * reasonably close to the end, rather than over-shortening a short scene.
 */
export function clauseSafeTake(text: string, maxWords: number): string {
  const words = collapseWs(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  const hardCut = words.slice(0, maxWords).join(' ');
  const lastSeparator = Math.max(hardCut.lastIndexOf(', '), hardCut.lastIndexOf('; '));
  return lastSeparator > hardCut.length * 0.4 ? hardCut.slice(0, lastSeparator) : hardCut;
}

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
