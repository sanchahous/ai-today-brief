/**
 * Deterministic lens → template routing. The jury fills slots; it does not
 * pick the visual language.
 */
import {
  IMAGE_PROMPT_TEMPLATE_CATALOG,
  type ImagePromptTemplateId,
} from './templates';

export type PromptLens = 'literal_context' | 'mechanism' | 'consequence' | 'owner_direction';
export type PromptGrammar =
  | 'cinematic_domain_scene'
  | 'deterministic_technical_hybrid'
  | 'source_led_fallback';

const EVENT_LIKE =
  /\b(launch|shipped|crash|breach|outage|incident|announce|release|broke|breaking|attack|exploit)\b/i;

const LENS_ORDER: readonly PromptLens[] = [
  'literal_context',
  'mechanism',
  'consequence',
  'owner_direction',
] as const;

export interface RouteTemplateInput {
  lens: PromptLens;
  grammar?: PromptGrammar;
  source?: string;
  headline?: string;
  summary?: string;
  occupied?: readonly ImagePromptTemplateId[];
}

function firstFree(
  preferred: readonly ImagePromptTemplateId[],
  occupied: ReadonlySet<ImagePromptTemplateId>,
): ImagePromptTemplateId {
  for (const id of preferred) {
    if (!occupied.has(id)) return id;
  }
  for (const id of Object.keys(IMAGE_PROMPT_TEMPLATE_CATALOG) as ImagePromptTemplateId[]) {
    if (!occupied.has(id)) return id;
  }
  return preferred[0] ?? 'realistic-photography';
}

function preferredForLens(input: RouteTemplateInput): ImagePromptTemplateId[] {
  if (input.source === 'fallback' || input.grammar === 'source_led_fallback') {
    return ['realistic-photography', 'illustration-editorial', 'scene-storytelling'];
  }
  const story = `${input.headline ?? ''} ${input.summary ?? ''}`;
  if (input.lens === 'mechanism') {
    if (input.grammar === 'deterministic_technical_hybrid') {
      return ['infographic-engine', 'concept-breakdown', 'illustration-editorial'];
    }
    return ['concept-breakdown', 'infographic-engine', 'illustration-editorial'];
  }
  if (input.lens === 'consequence') {
    return ['scene-storytelling', 'illustration-editorial', 'realistic-photography'];
  }
  if (input.lens === 'owner_direction') {
    return ['realistic-photography', 'scene-storytelling', 'illustration-editorial'];
  }
  if (EVENT_LIKE.test(story)) {
    return ['scene-storytelling', 'realistic-photography', 'illustration-editorial'];
  }
  return ['realistic-photography', 'scene-storytelling', 'illustration-editorial'];
}

export function routeTemplate(input: RouteTemplateInput): ImagePromptTemplateId {
  const occupied = new Set(input.occupied ?? []);
  return firstFree(preferredForLens(input), occupied);
}

export function routeSeatTemplates(input: {
  lenses: readonly PromptLens[];
  grammarByLens?: Partial<Record<PromptLens, PromptGrammar>>;
  source?: string;
  headline?: string;
  summary?: string;
  occupied?: readonly ImagePromptTemplateId[];
}): Partial<Record<PromptLens, ImagePromptTemplateId>> {
  const occupied = [...(input.occupied ?? [])];
  const assigned: Partial<Record<PromptLens, ImagePromptTemplateId>> = {};
  const ordered = LENS_ORDER.filter((lens) => input.lenses.includes(lens));
  for (const lens of ordered) {
    const id = routeTemplate({
      lens,
      grammar: input.grammarByLens?.[lens],
      source: input.source,
      headline: input.headline,
      summary: input.summary,
      occupied,
    });
    assigned[lens] = id;
    occupied.push(id);
  }
  return assigned;
}
