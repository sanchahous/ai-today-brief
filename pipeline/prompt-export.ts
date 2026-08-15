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

export const IMAGE_GRAMMARS = SCENE_GRAMMARS;
export type ImageGrammar = SceneGrammar;

export const MANUAL_PROMPT_ASPECT = '16:9' as const;

/** Flagged in tests so exported prompts never pin a model version. */
export const MODEL_VERSION_TOKEN = /sonnet-5|gpt-5|gemini-3\.[0-9]|--v\s*\d/i;

const NO_TEXT_OVERLAY =
  'Labels and captions are added later in a separate layer — the image itself carries no writing of any kind.';
const MIDJOURNEY_NO_TEXT = '--no text, letters, logos, watermarks, UI';
const REQUIRED_NEGATIVE = 'no text, no letters, no logos, no watermarks, no UI';
const FLUX_CRAFT_SPLIT = '. One instantly readable cause-and-effect moment:';

export interface ManualImagePrompt {
  conceptLens: MetaphorLens;
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
): MetaphorLens {
  if (lens === 'mechanism' || lens === 'consequence') return lens;
  return 'literal_context';
}

function titleFromLens(lens: MetaphorLens): string {
  if (lens === 'mechanism') return 'Visible mechanism';
  if (lens === 'consequence') return 'Visible consequence';
  return 'Literal context';
}

function translateFluxToCanonical(fluxPrompt: string, grammar: ImageGrammar): string {
  const collapsed = collapseWs(fluxPrompt);
  const splitAt = collapsed.indexOf(FLUX_CRAFT_SPLIT);
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
    `${takeWords(scene, 70)}. ${light}, ${lens}, shallow depth of field, photoreal materials, ` +
    `restrained grade with accent ${hex}. Photographic reportage, no illustration styling.${sourceLed} ` +
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

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
