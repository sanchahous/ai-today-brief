/**
 * Six-block Prompt-as-Code assembler (subject → layout → style → text →
 * aspect → constraints). Planning fields never enter the copy-ready string.
 */
import { routeTemplate, type PromptGrammar, type PromptLens } from './route';
import {
  IMAGE_PROMPT_ASPECT,
  IMAGE_PROMPT_TEMPLATE_CATALOG,
  NO_TEXT_BLOCK,
  NO_TEXT_OVERLAY,
  SHARED_NEGATIVES,
  type ImagePromptTemplateId,
} from './templates';
import { clauseSafeTake, collapseWs, stripPlanningPhrases } from './text';

export interface ImagePromptSpec {
  templateId: ImagePromptTemplateId;
  subject: string;
  action: string;
  setting: string;
  layout?: string;
  materials?: string;
  lighting?: string;
  camera?: string;
  accentHex?: string;
  aspect: '16:9';
  noText: true;
  sourceLed?: boolean;
}

export interface BriefLikeForSpec {
  conceptLens?: PromptLens | string;
  grammar?: PromptGrammar | string;
  source?: string;
  scene?: string;
  subject?: string | null;
  action?: string | null;
  setting?: string | null;
  layout?: string | null;
  materials?: string | null;
  lighting?: string | null;
  camera?: string | null;
  templateId?: string | null;
  composition?: string | null;
}

const MIDJOURNEY_NO_TEXT = '--no text, letters, logos, watermarks, UI';

export function specFromBrief(
  brief: BriefLikeForSpec,
  accentHex = '#22D3EE',
): ImagePromptSpec {
  const lens = asLens(brief.conceptLens);
  const grammar = asGrammar(brief.grammar);
  const templateId = asTemplateId(brief.templateId)
    ?? routeTemplate({
      lens,
      grammar,
      source: brief.source,
    });
  const renderable = (value: string | null | undefined) =>
    collapseWs(stripPlanningPhrases(value ?? ''));
  const cleaned = renderable(brief.scene);
  const subject = clauseSafeTake(
    renderable(brief.subject) || firstClause(cleaned) || cleaned,
    28,
  );
  const action = clauseSafeTake(renderable(brief.action), 16);
  const setting = clauseSafeTake(renderable(brief.setting) || restAfterSubject(cleaned, subject), 16);
  const catalog = IMAGE_PROMPT_TEMPLATE_CATALOG[templateId];
  const dual =
    brief.composition === 'dual_contrast'
      ? 'one continuous image with a clear causal spatial divide, not a collage'
      : '';
  return {
    templateId,
    subject: subject || catalog.taskLead,
    action,
    setting,
    layout: collapseWs([catalog.layout, dual, brief.layout ?? ''].filter(Boolean).join('; ')),
    materials: collapseWs(brief.materials || catalog.materials),
    lighting: collapseWs(brief.lighting || catalog.lighting),
    camera: collapseWs(brief.camera || catalog.camera),
    accentHex,
    aspect: IMAGE_PROMPT_ASPECT,
    noText: true,
    sourceLed: grammar === 'source_led_fallback',
  };
}

export function assembleSixBlocks(spec: ImagePromptSpec): string {
  const catalog = IMAGE_PROMPT_TEMPLATE_CATALOG[spec.templateId];
  const action = spec.action ? ` Action: ${spec.action}.` : '';
  const setting = spec.setting ? ` Setting: ${spec.setting}.` : '';
  const sourceLed = spec.sourceLed
    ? ' Grounded in the source story rather than a decorative metaphor.'
    : '';
  const causalGeometryNote =
    spec.templateId === 'infographic-engine' || spec.templateId === 'concept-breakdown'
      ? ' Show the causal contrast through unlabelled physical geometry, never interface panels or callouts.'
      : '';
  const blocks = [
    `Task: ${catalog.taskLead} of ${spec.subject}.${action}${setting}${causalGeometryNote}`,
    `Composition and layout: ${spec.layout || catalog.layout}.`,
    `Visual style and materials: ${catalog.style}; ${spec.lighting}, ${spec.camera}, ${spec.materials}` +
      `${spec.accentHex ? `, accent ${spec.accentHex}` : ''}.`,
    NO_TEXT_BLOCK,
    `Aspect ratio and output format: ${spec.aspect} single finished image, not a moodboard.`,
    `Constraints: ${[...SHARED_NEGATIVES, ...catalog.extraNegatives].join(', ')}.${sourceLed}`,
  ];
  return collapseWs(blocks.join(' '));
}

export function assembleMidjourney(spec: ImagePromptSpec): string {
  const catalog = IMAGE_PROMPT_TEMPLATE_CATALOG[spec.templateId];
  const compact = collapseWs(
    [spec.subject, spec.action, spec.setting].filter(Boolean).join(', '),
  );
  return `${compact}, ${catalog.midjourneyStyle} --ar ${spec.aspect} --style raw ${MIDJOURNEY_NO_TEXT}`;
}

export function assembleNegative(extra: readonly string[] = []): string {
  const catalogExtras = extra.length ? extra : [];
  return [...SHARED_NEGATIVES, ...catalogExtras].join(', ');
}

export function assembleNotes(input: {
  templateId: ImagePromptTemplateId;
  mechanism?: string;
  readerTest?: string;
}): string[] {
  const notes = [
    input.mechanism
      ? `The image must make this mechanism visible: ${clauseSafeTake(input.mechanism, 28)}.`
      : 'The physical cause must be the brightest, most readable action in frame.',
    input.readerTest
      ? `A reader should grasp this without a caption: ${clauseSafeTake(input.readerTest, 28)}.`
      : 'A reader should understand the claim without any on-image caption.',
    'No screens, letters, logos, or captions in the pixels — overlays are added later.',
  ];
  if (input.templateId === 'infographic-engine' || input.templateId === 'concept-breakdown') {
    notes.push('If one exact label is essential, add it later as a deterministic overlay, not in pixels.');
  }
  return notes.slice(0, 4);
}

/** Short FLUX.2 wrap for news cards — photography craft, never infographic-engine. */
export function assembleFluxCardPrompt(accent: string, scene: string): string {
  const cleaned = stripPlanningPhrases(scene);
  const catalog = IMAGE_PROMPT_TEMPLATE_CATALOG['realistic-photography'];
  return collapseWs(
    `Premium editorial illustration, pure visual storytelling only — no typography in the image. ` +
      `One strong focal subject, ${catalog.lighting}, ${catalog.camera}, ${accent} as the signature ` +
      `accent woven through the palette, ${catalog.materials} — not flat, not a generic stock render. ` +
      `Keep the top and bottom calm and empty for later layout compositing; leave those bands blank ` +
      `(do not paint titles, mastheads, captions, subtitles, or any lettering there). ` +
      `Absolutely no text, no words, no letters, no numbers, no glyphs, no logos, no watermark, ` +
      `no title bar, no newspaper headline, no UI chrome, no readable screens, no frame, no border. ` +
      `Scene: ${cleaned} Wide ${IMAGE_PROMPT_ASPECT} horizontal composition, edge-to-edge full-bleed.`,
  );
}

function asLens(value: string | undefined): PromptLens {
  if (value === 'mechanism' || value === 'consequence' || value === 'owner_direction') {
    return value;
  }
  return 'literal_context';
}

function asGrammar(value: string | undefined): PromptGrammar {
  if (value === 'deterministic_technical_hybrid' || value === 'source_led_fallback') {
    return value;
  }
  return 'cinematic_domain_scene';
}

function asTemplateId(value: string | null | undefined): ImagePromptTemplateId | null {
  if (!value) return null;
  return IMAGE_PROMPT_TEMPLATE_CATALOG[value as ImagePromptTemplateId] ? (value as ImagePromptTemplateId) : null;
}

function firstClause(scene: string): string {
  const cut = scene.indexOf('.');
  if (cut > 12) return scene.slice(0, cut);
  const comma = scene.indexOf(', ');
  if (comma > 12) return scene.slice(0, comma);
  return scene;
}

function restAfterSubject(scene: string, subject: string): string {
  if (!subject || !scene.toLowerCase().startsWith(subject.toLowerCase())) return '';
  return collapseWs(scene.slice(subject.length).replace(/^[,.\s]+/, ''));
}

export { NO_TEXT_OVERLAY };
