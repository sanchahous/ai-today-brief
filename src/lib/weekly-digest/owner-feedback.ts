/**
 * Owner verdict per illustration *concept* (not per render). Stored on
 * `story_prompt_set` and mirrored next to `metadata.post_upload_qa` so the
 * prompt → upload → verdict triple is the calibration dataset.
 */

export const OWNER_FEEDBACK_VERDICTS = ['used', 'used_with_edits', 'rejected'] as const;
export type OwnerFeedbackVerdict = (typeof OWNER_FEEDBACK_VERDICTS)[number];

export const OWNER_FEEDBACK_REASON_TAGS = [
  'domain_context_success',
  'strong_intuitive_analogy',
  'weak_context',
  'generic_diagram',
  'weak_visual_thesis',
  'labels_carry_claim',
  'broken_arrow',
  'disconnected_prop',
  'anatomy_error',
  'unclear_causal_source',
  'good_concept_bad_execution',
] as const;
export type OwnerFeedbackReasonTag = (typeof OWNER_FEEDBACK_REASON_TAGS)[number];

export const OWNER_FEEDBACK_VERDICT_LABEL_UK: Record<OwnerFeedbackVerdict, string> = {
  used: 'використано',
  used_with_edits: 'з правками',
  rejected: 'відхилено',
};

export type OwnerFeedbackMap = Record<string, OwnerConceptFeedback>;

export interface OwnerConceptFeedback {
  verdict: OwnerFeedbackVerdict;
  reasonTags: OwnerFeedbackReasonTag[];
  recordedAt: string;
  promptTitle: string | null;
  canonical: string | null;
}

export interface OwnerCalibrationRecord extends OwnerConceptFeedback {
  conceptLens: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isOwnerFeedbackVerdict(value: unknown): value is OwnerFeedbackVerdict {
  return OWNER_FEEDBACK_VERDICTS.some((verdict) => verdict === value);
}

export function isOwnerFeedbackReasonTag(value: unknown): value is OwnerFeedbackReasonTag {
  return OWNER_FEEDBACK_REASON_TAGS.some((tag) => tag === value);
}

export function closedReasonTags(values: readonly unknown[]): OwnerFeedbackReasonTag[] {
  const tags: OwnerFeedbackReasonTag[] = [];
  for (const value of values) {
    if (!isOwnerFeedbackReasonTag(value)) continue;
    if (tags.includes(value)) continue;
    tags.push(value);
  }
  return tags;
}

export function parseOwnerConceptFeedback(value: unknown): OwnerConceptFeedback | null {
  if (!isRecord(value) || !isOwnerFeedbackVerdict(value.verdict)) return null;
  return {
    verdict: value.verdict,
    reasonTags: closedReasonTags(Array.isArray(value.reasonTags) ? value.reasonTags : []),
    recordedAt: asTrimmedString(value.recordedAt) ?? asTrimmedString(value.recorded_at) ?? '',
    promptTitle: asTrimmedString(value.promptTitle) ?? asTrimmedString(value.prompt_title),
    canonical: asTrimmedString(value.canonical),
  };
}

export function parseOwnerFeedbackMap(value: unknown): OwnerFeedbackMap {
  if (!isRecord(value)) return {};
  const out: OwnerFeedbackMap = {};
  for (const [conceptLens, entry] of Object.entries(value)) {
    const lens = conceptLens.trim();
    const parsed = parseOwnerConceptFeedback(entry);
    if (!lens || !parsed) continue;
    out[lens] = parsed;
  }
  return out;
}

export function ownerFeedbackFromPromptSet(content: unknown): OwnerFeedbackMap {
  return parseOwnerFeedbackMap(isRecord(content) ? content.owner_feedback : null);
}

export function ownerFeedbackFromImageMetadata(metadata: unknown): OwnerFeedbackMap {
  return parseOwnerFeedbackMap(isRecord(metadata) ? metadata.owner_feedback : null);
}

export function recordOwnerConceptFeedback(input: {
  verdict: unknown;
  reasonTags?: readonly unknown[];
  promptTitle?: string | null;
  canonical?: string | null;
  recordedAt?: string;
}): OwnerConceptFeedback | null {
  if (!isOwnerFeedbackVerdict(input.verdict)) return null;
  return {
    verdict: input.verdict,
    reasonTags: closedReasonTags(input.reasonTags ?? []),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    promptTitle: asTrimmedString(input.promptTitle),
    canonical: asTrimmedString(input.canonical),
  };
}

function withOwnerFeedbackMap(
  root: Record<string, unknown>,
  conceptLens: string,
  entry: OwnerConceptFeedback,
): Record<string, unknown> {
  const lens = conceptLens.trim();
  if (!lens) return root;
  return {
    ...root,
    owner_feedback: {
      ...parseOwnerFeedbackMap(root.owner_feedback),
      [lens]: entry,
    },
  };
}

/** Writes `owner_feedback` on the prompt-set JSONB; keeps existing prompts. */
export function applyOwnerFeedbackToPromptSet(
  content: unknown,
  conceptLens: string,
  entry: OwnerConceptFeedback,
): Record<string, unknown> {
  return withOwnerFeedbackMap(isRecord(content) ? { ...content } : {}, conceptLens, entry);
}

/** Mirrors the same map next to `post_upload_qa` on the uploaded file. */
export function applyOwnerFeedbackToImageMetadata(
  metadata: unknown,
  conceptLens: string,
  entry: OwnerConceptFeedback,
): Record<string, unknown> {
  return withOwnerFeedbackMap(isRecord(metadata) ? { ...metadata } : {}, conceptLens, entry);
}

export function mergeOwnerFeedbackOntoImageMetadata(
  metadata: unknown,
  feedback: OwnerFeedbackMap,
): Record<string, unknown> {
  const root = isRecord(metadata) ? { ...metadata } : {};
  if (Object.keys(feedback).length === 0) return root;
  return {
    ...root,
    owner_feedback: {
      ...parseOwnerFeedbackMap(root.owner_feedback),
      ...feedback,
    },
  };
}

export function ownerCalibrationRecords(feedback: OwnerFeedbackMap): OwnerCalibrationRecord[] {
  const records: OwnerCalibrationRecord[] = [];
  for (const conceptLens of Object.keys(feedback).sort((a, b) => a.localeCompare(b))) {
    const entry = feedback[conceptLens];
    if (!entry) continue;
    records.push({ conceptLens, ...entry });
  }
  return records;
}
