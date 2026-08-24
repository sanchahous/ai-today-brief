/**
 * Curated Prompt-as-Code templates adapted from awesome-gpt-image-2.
 * The model makes a single legible physical scene; any exact labels belong to
 * a deterministic overlay, never to generated pixels.
 */

export const IMAGE_PROMPT_TEMPLATES = [
  'infographic-engine',
  'realistic-photography',
  'scene-storytelling',
  'illustration-editorial',
  'concept-breakdown',
] as const;

export type ImagePromptTemplateId = (typeof IMAGE_PROMPT_TEMPLATES)[number];

export const IMAGE_PROMPT_ASPECT = '16:9' as const;

export const NO_TEXT_OVERLAY =
  'Labels and captions are added later in a separate overlay — the image itself carries no writing of any kind.';

export const NO_TEXT_BLOCK =
  'Text and label requirements: NO readable text, letters, numbers-as-type, logos, captions, UI chrome, or gibberish glyphs. ' +
  NO_TEXT_OVERLAY;

export const SHARED_NEGATIVES = [
  'no text',
  'no letters',
  'no logos',
  'no watermarks',
  'no UI',
  'no readable screens',
  'no gibberish glyphs',
  'no fake dashboard cards',
  'no code editor panels',
  'no mascot robots',
  'no collage',
  'no moodboard',
] as const;

export interface ImagePromptTemplate {
  id: ImagePromptTemplateId;
  taskLead: string;
  layout: string;
  style: string;
  camera: string;
  lighting: string;
  materials: string;
  extraNegatives: readonly string[];
  midjourneyStyle: string;
}

export const IMAGE_PROMPT_TEMPLATE_CATALOG: Record<ImagePromptTemplateId, ImagePromptTemplate> = {
  'infographic-engine': {
    id: 'infographic-engine',
    taskLead: 'technical editorial comparison',
    layout:
      'one source state and one transformed state, joined by at most one unlabelled causal connector, generous whitespace',
    style: 'scientific editorial composition, low-saturation color contrast, light paper texture',
    camera: 'flat orthogonal view',
    lighting: 'even page lighting, no cinematic haze',
    materials: 'ink, paper, printed color blocks',
    extraNegatives: ['no photoreal studio', 'no cyberpunk', 'no numbered modules', 'no long paragraphs'],
    midjourneyStyle: 'clean technical editorial comparison, two states, one unlabelled connector',
  },
  'realistic-photography': {
    id: 'realistic-photography',
    taskLead: 'photographic reportage',
    layout: 'subject-first 16:9 frame, calm empty top and bottom bands',
    style: 'Kodak Portra 400 grain, imperfect surfaces, raw unedited look',
    camera: '35mm lens, f/2.8, eye-level',
    lighting: 'dramatic available light, physically plausible shadows',
    materials: 'photoreal materials, film grain, wear and dust',
    extraNegatives: ['no illustration styling', 'no CGI beauty skin', 'no studio catalog look'],
    midjourneyStyle: 'photographic reportage, shallow depth of field, photoreal materials',
  },
  'scene-storytelling': {
    id: 'scene-storytelling',
    taskLead: 'narrative still of a decisive moment',
    layout: 'one continuous scene, clear near/mid/far, the verb must be visible in-frame',
    style: 'cinematic atmosphere, restrained grade, storyboard-legible action',
    camera: 'wide establishing or medium narrative, 35mm lens',
    lighting: 'motivated practical light that casts long shadows',
    materials: 'photoreal materials, lived-in props',
    extraNegatives: ['no generic fantasy backdrop', 'no postcard posing', 'no illustration styling'],
    midjourneyStyle: 'cinematic narrative still, motivated light, photoreal materials',
  },
  'illustration-editorial': {
    id: 'illustration-editorial',
    taskLead: 'editorial illustration',
    layout: 'near/mid/far composition, one focal subject, generous negative space',
    style: 'flat gouache with ink line, 4-6 color palette, magazine-cover craft',
    camera: 'slight high angle',
    lighting: 'graphic lighting, clear silhouette',
    materials: 'gouache, paper tooth, ink line',
    extraNegatives: [
      'no named-master pastiche',
      'no default AI plastic',
      'no signature',
      'no photoreal skin',
    ],
    midjourneyStyle: 'editorial illustration, gouache and ink, limited palette',
  },
  'concept-breakdown': {
    id: 'concept-breakdown',
    taskLead: 'technical cutaway',
    layout:
      'one hero object with at most two physical layers revealed by a single cutaway, aligned to a quiet grid',
    style: 'R&D board, muted industrial palette, precise cutaway',
    camera: 'three-quarter product view',
    lighting: 'soft studio key, crisp contact shadows',
    materials: 'metal, glass, matte plastics',
    extraNegatives: ['no readable callout type', 'no callout zones', 'no collage panels', 'no cyberpunk glow'],
    midjourneyStyle: 'single technical cutaway, one object, quiet grid, no labels',
  },
};

export function isImagePromptTemplateId(value: string): value is ImagePromptTemplateId {
  return IMAGE_PROMPT_TEMPLATE_CATALOG[value as ImagePromptTemplateId] !== undefined;
}

export function templateLabel(id: ImagePromptTemplateId): string {
  return id.replaceAll('-', ' ');
}
