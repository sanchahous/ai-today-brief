/**
 * Parse and present weekly `story_prompt_set` artifacts. Visuals stays
 * empty-safe when the worker has not written a set yet.
 */

export const STORY_PROMPT_SET_TYPE = 'story_prompt_set' as const;

export const STORY_PROMPT_COPY_KINDS = ['canonical', 'midjourney', 'negative'] as const;
export type StoryPromptCopyKind = (typeof STORY_PROMPT_COPY_KINDS)[number];

export const STORY_IMAGE_SLOT_STATES = ['waiting', 'uploaded_on_review', 'approved'] as const;
export type StoryImageSlotState = (typeof STORY_IMAGE_SLOT_STATES)[number];

export const STORY_IMAGE_SLOT_LABEL: Record<StoryImageSlotState, string> = {
  waiting: 'очікує зображення',
  uploaded_on_review: 'завантажено, on review',
  approved: 'approved',
};

export interface StoryPromptCard {
  conceptLens: string;
  grammar: string;
  title: string;
  canonical: string;
  midjourney: string;
  negative: string;
  aspectRatio: '16:9';
  notes: string[];
  /** Jury `source`; `fallback` means this seat used fallback_essence. */
  sceneSource?: string | null;
  motifClass?: string | null;
}

export interface StoryPromptSetContent {
  prompts: StoryPromptCard[];
  policy: string | null;
  generatedAt: string | null;
}

export interface StoryPromptCopyTarget {
  kind: StoryPromptCopyKind;
  label: string;
  text: string;
}

const COPY_LABEL: Record<StoryPromptCopyKind, string> = {
  canonical: 'Canonical',
  midjourney: 'Midjourney',
  negative: 'Negative',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const notes: string[] = [];
  for (const entry of value) {
    const note = asTrimmedString(entry);
    if (note) notes.push(note);
  }
  return notes;
}

function parsePromptCard(value: unknown): StoryPromptCard | null {
  if (!isRecord(value)) return null;
  const canonical = asTrimmedString(value.canonical);
  const midjourney = asTrimmedString(value.midjourney);
  const negative = asTrimmedString(value.negative);
  if (!canonical || !midjourney || !negative) return null;
  return {
    conceptLens: asTrimmedString(value.conceptLens) ?? 'literal_context',
    grammar: asTrimmedString(value.grammar) ?? 'cinematic_domain_scene',
    title: asTrimmedString(value.title) ?? 'Concept',
    canonical,
    midjourney,
    negative,
    aspectRatio: '16:9',
    notes: parseNotes(value.notes),
    sceneSource: asTrimmedString(value.sceneSource) ?? asTrimmedString(value.scene_source),
    motifClass: asTrimmedString(value.motifClass) ?? asTrimmedString(value.motif_class),
  };
}

/** `null` = not a prompt set (missing or malformed). Empty `prompts` is valid. */
export function parseStoryPromptSetContent(value: unknown): StoryPromptSetContent | null {
  if (!isRecord(value) || !Array.isArray(value.prompts)) return null;
  const prompts: StoryPromptCard[] = [];
  for (const entry of value.prompts) {
    const card = parsePromptCard(entry);
    if (card) prompts.push(card);
  }
  return {
    prompts,
    policy: asTrimmedString(value.policy),
    generatedAt: asTrimmedString(value.generated_at),
  };
}

export function storyPromptCopyTargets(prompt: StoryPromptCard): StoryPromptCopyTarget[] {
  return STORY_PROMPT_COPY_KINDS.map((kind) => ({
    kind,
    label: COPY_LABEL[kind],
    text: prompt[kind],
  }));
}

export function storyImageSlotState(artifact?: {
  review_status?: string | null;
  generation_status?: string | null;
  external_url?: string | null;
  storage_path?: string | null;
} | null): StoryImageSlotState {
  if (!artifact) return 'waiting';
  if (artifact.review_status === 'approved') return 'approved';
  const hasFile = Boolean(artifact.external_url || artifact.storage_path);
  if (hasFile || artifact.generation_status === 'ready') return 'uploaded_on_review';
  return 'waiting';
}

/** Three-seat jury: missing seats are how B2 degradation shows up in Visuals. */
export const STORY_PROMPT_SEATS = ['literal_context', 'mechanism', 'consequence'] as const;
export type StoryPromptSeat = (typeof STORY_PROMPT_SEATS)[number];

export interface StoryPromptReadiness {
  ready: number;
  total: number;
  missingLenses: StoryPromptSeat[];
  fallbackLenses: string[];
  label: string;
  detail: string;
}

function isStoryPromptSeat(value: string): value is StoryPromptSeat {
  return STORY_PROMPT_SEATS.some((seat) => seat === value);
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function lensesFromImageMetadata(metadata: unknown): Array<{ lens: string; fallback: boolean }> {
  const root = recordFromUnknown(metadata);
  const variants = Array.isArray(root.variant_concepts) ? root.variant_concepts : [];
  if (variants.length > 0) {
    const rows: Array<{ lens: string; fallback: boolean }> = [];
    for (const entry of variants) {
      const row = recordFromUnknown(entry);
      const lens = asTrimmedString(row.concept_lens) ?? asTrimmedString(row.conceptLens);
      if (!lens) continue;
      const source = asTrimmedString(row.scene_source) ?? asTrimmedString(row.sceneSource) ?? '';
      const motif = asTrimmedString(row.motif_class) ?? asTrimmedString(row.motifClass) ?? '';
      rows.push({
        lens,
        fallback: source === 'fallback' || motif === 'fallback_essence',
      });
    }
    return rows;
  }
  const lens = asTrimmedString(root.concept_lens) ?? asTrimmedString(root.conceptLens);
  if (!lens) return [];
  const source = asTrimmedString(root.scene_source) ?? asTrimmedString(root.sceneSource) ?? '';
  const motif = asTrimmedString(root.motif_class) ?? asTrimmedString(root.motifClass) ?? '';
  return [{ lens, fallback: source === 'fallback' || motif === 'fallback_essence' }];
}

function promptIsFallback(
  prompt: Pick<StoryPromptCard, 'grammar' | 'sceneSource' | 'motifClass'>,
): boolean {
  return (
    prompt.grammar === 'source_led_fallback' ||
    prompt.sceneSource === 'fallback' ||
    prompt.motifClass === 'fallback_essence'
  );
}

export function storyPromptReadiness(
  prompts: readonly Pick<
    StoryPromptCard,
    'conceptLens' | 'grammar' | 'sceneSource' | 'motifClass'
  >[] = [],
  imageMetadata?: unknown,
): StoryPromptReadiness {
  const fromPrompts = prompts.map((prompt) => ({
    lens: prompt.conceptLens,
    fallback: promptIsFallback(prompt),
  }));
  const rows = fromPrompts.length > 0 ? fromPrompts : lensesFromImageMetadata(imageMetadata);
  const present = new Set(
    rows.map((row) => row.lens).filter((lens): lens is StoryPromptSeat => isStoryPromptSeat(lens)),
  );
  const missingLenses = STORY_PROMPT_SEATS.filter((seat) => !present.has(seat));
  const fallbackLenses = [
    ...new Set(rows.filter((row) => row.fallback).map((row) => row.lens.replaceAll('_', ' '))),
  ];
  const ready = present.size > 0 ? present.size : Math.min(rows.length, STORY_PROMPT_SEATS.length);
  const parts: string[] = [];
  if (missingLenses.length > 0) {
    parts.push(`немає ${missingLenses.join(', ')}`);
  }
  if (fallbackLenses.length > 0) {
    parts.push(`фолбек: ${fallbackLenses.join(', ')}`);
  }
  return {
    ready,
    total: STORY_PROMPT_SEATS.length,
    missingLenses,
    fallbackLenses,
    label: `${ready}/${STORY_PROMPT_SEATS.length} промпти готові`,
    detail: parts.join(' · '),
  };
}

