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
