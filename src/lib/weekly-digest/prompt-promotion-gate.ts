/**
 * Prompt-quality promotion gate for manual digest illustrations (E3).
 * Advisory on Visuals — never a release preflight blocker. News thresholds
 * stay on the auto-FLUX path and are not read here.
 */

import {
  ownerFeedbackFromImageMetadata,
  type OwnerConceptFeedback,
  type OwnerFeedbackMap,
  type OwnerFeedbackReasonTag,
} from './owner-feedback';
import { parsePostUploadQa } from './post-upload-qa';
import { parseStoryPromptSetContent, type StoryPromptCard } from './story-prompt-set';

export const PROMPT_PROMOTION_ACCEPTABLE_RATE = 0.6;
export const PROMPT_PROMOTION_MAX_MINUTES_PER_STORY = 10;
export const PROMPT_PROMOTION_CHECK_IDS = [
  'acceptable_rate',
  'no_misleading',
  'owner_time',
  'distinct_prompts',
] as const;
export type PromptPromotionCheckId = (typeof PROMPT_PROMOTION_CHECK_IDS)[number];
export type PromptPromotionCheckStatus = 'pass' | 'fail' | 'incomplete';

/** Owner tags that mean an accepted image still asserts via labels, not pixels. */
export const MISLEADING_OWNER_TAGS: readonly OwnerFeedbackReasonTag[] = ['labels_carry_claim'];

/** Image-only QA codes that mean invented labels/numbers in accepted pixels. */
export const UNSUPPORTED_ASSERTION_QA_CODES = ['readable_text'] as const;

export interface PromptPromotionArtifact {
  artifact_type: string;
  revision_item_id: string | null;
  slot_key: string;
  content: unknown;
  metadata: unknown;
  created_at: string;
  updated_at: string;
  storage_path: string | null;
  external_url: string | null;
}

export interface PromptPromotionStoryInput {
  storyId: string;
  prompts: StoryPromptCard[];
  ownerFeedback: OwnerFeedbackMap;
  promptsReadyAt: string | null;
  uploadedAt: string | null;
  qaCodes: string[];
}

export interface PromptPromotionCheck {
  id: PromptPromotionCheckId;
  status: PromptPromotionCheckStatus;
  label: string;
}

export interface PromptPromotionResult {
  passed: boolean;
  ready: boolean;
  passedCount: number;
  total: number;
  acceptableRate: number | null;
  judgedCount: number;
  acceptableCount: number;
  misleadingCount: number;
  maxOwnerMinutes: number | null;
  distinctStories: number;
  storiesWithPrompts: number;
  checks: PromptPromotionCheck[];
  label: string;
  detail: string;
}

const ACCEPTABLE_VERDICTS = new Set(['used', 'used_with_edits']);

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function minutesBetween(start: string | null, end: string | null): number | null {
  const from = parseTimestamp(start);
  const to = parseTimestamp(end);
  if (from === null || to === null) return null;
  return Math.max(0, (to - from) / 60_000);
}

function normalizeCanon(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function judgedEntries(feedback: OwnerFeedbackMap): OwnerConceptFeedback[] {
  return Object.values(feedback);
}

function isFallbackPrompt(prompt: StoryPromptCard): boolean {
  return (
    prompt.grammar === 'source_led_fallback' ||
    prompt.sceneSource === 'fallback' ||
    prompt.motifClass === 'fallback_essence'
  );
}

function firstAcceptedAt(feedback: OwnerFeedbackMap): string | null {
  let earliest: string | null = null;
  let earliestMs = Number.POSITIVE_INFINITY;
  for (const entry of judgedEntries(feedback)) {
    if (!ACCEPTABLE_VERDICTS.has(entry.verdict)) continue;
    const ms = parseTimestamp(entry.recordedAt);
    if (ms === null || ms >= earliestMs) continue;
    earliestMs = ms;
    earliest = entry.recordedAt;
  }
  return earliest;
}

export function promptSetIsDistinct(prompts: readonly StoryPromptCard[]): boolean {
  if (prompts.length < 2) return true;
  if (prompts.length >= 3 && prompts.every(isFallbackPrompt)) return false;
  const seen = new Set<string>();
  for (const prompt of prompts) {
    const key = normalizeCanon(prompt.canonical);
    if (!key) continue;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function acceptableRateCheck(stories: readonly PromptPromotionStoryInput[]): PromptPromotionCheck {
  let judgedCount = 0;
  let acceptableCount = 0;
  for (const story of stories) {
    for (const entry of judgedEntries(story.ownerFeedback)) {
      judgedCount += 1;
      if (ACCEPTABLE_VERDICTS.has(entry.verdict)) acceptableCount += 1;
    }
  }
  if (judgedCount === 0) {
    return { id: 'acceptable_rate', status: 'incomplete', label: 'чекає вердиктів' };
  }
  const rate = acceptableCount / judgedCount;
  const pct = Math.round(rate * 100);
  if (rate >= PROMPT_PROMOTION_ACCEPTABLE_RATE) {
    return { id: 'acceptable_rate', status: 'pass', label: `прийнятні ${pct}%` };
  }
  return { id: 'acceptable_rate', status: 'fail', label: `прийнятні ${pct}%` };
}

function entryIsMisleading(entry: OwnerConceptFeedback, qaCodes: readonly string[]): boolean {
  if (!ACCEPTABLE_VERDICTS.has(entry.verdict)) return false;
  if (entry.reasonTags.some((tag) => MISLEADING_OWNER_TAGS.includes(tag))) return true;
  if (entry.verdict !== 'used') return false;
  return qaCodes.some((code) =>
    UNSUPPORTED_ASSERTION_QA_CODES.some((blocked) => blocked === code),
  );
}

function misleadingCheck(stories: readonly PromptPromotionStoryInput[]): PromptPromotionCheck {
  let judgedAccepted = 0;
  let misleadingCount = 0;
  for (const story of stories) {
    for (const entry of judgedEntries(story.ownerFeedback)) {
      if (!ACCEPTABLE_VERDICTS.has(entry.verdict)) continue;
      judgedAccepted += 1;
      if (entryIsMisleading(entry, story.qaCodes)) misleadingCount += 1;
    }
  }
  if (judgedAccepted === 0) {
    return { id: 'no_misleading', status: 'incomplete', label: 'немає прийнятих' };
  }
  if (misleadingCount === 0) {
    return { id: 'no_misleading', status: 'pass', label: '0 misleading' };
  }
  return { id: 'no_misleading', status: 'fail', label: 'misleading у прийнятих' };
}

function ownerTimeCheck(stories: readonly PromptPromotionStoryInput[]): PromptPromotionCheck {
  let maxMinutes: number | null = null;
  for (const story of stories) {
    const end = firstAcceptedAt(story.ownerFeedback) ?? story.uploadedAt;
    const minutes = minutesBetween(story.promptsReadyAt, end);
    if (minutes === null) continue;
    if (maxMinutes === null || minutes > maxMinutes) maxMinutes = minutes;
  }
  if (maxMinutes === null) {
    return { id: 'owner_time', status: 'incomplete', label: 'немає часу' };
  }
  const rounded = Math.round(maxMinutes);
  const label = `${rounded} хв`;
  if (maxMinutes <= PROMPT_PROMOTION_MAX_MINUTES_PER_STORY) {
    return { id: 'owner_time', status: 'pass', label };
  }
  return { id: 'owner_time', status: 'fail', label };
}

function distinctPromptsCheck(stories: readonly PromptPromotionStoryInput[]): PromptPromotionCheck {
  const withPrompts = stories.filter((story) => story.prompts.length > 0);
  if (withPrompts.length === 0) {
    return { id: 'distinct_prompts', status: 'incomplete', label: 'немає промптів' };
  }
  for (const story of withPrompts) {
    if (!promptSetIsDistinct(story.prompts)) {
      return { id: 'distinct_prompts', status: 'fail', label: 'копії промптів' };
    }
  }
  return { id: 'distinct_prompts', status: 'pass', label: '3 різні' };
}

function qaCodesFromMetadata(metadata: unknown): string[] {
  const qa = parsePostUploadQa(metadata);
  if (!qa) return [];
  const codes: string[] = [];
  for (const row of qa.blockers) {
    if (!row.blocker) continue;
    if (codes.includes(row.code)) continue;
    codes.push(row.code);
  }
  return codes;
}

function mergeFeedback(promptSet: unknown, metadata: unknown): OwnerFeedbackMap {
  const fromSet = parseStoryPromptSetContent(promptSet)?.ownerFeedback ?? {};
  return { ...ownerFeedbackFromImageMetadata(metadata), ...fromSet };
}

function hasUploadedFile(artifact: PromptPromotionArtifact | undefined): boolean {
  return Boolean(artifact?.storage_path || artifact?.external_url);
}

export function promptPromotionStoriesFromArtifacts(input: {
  storyIds: readonly string[];
  artifacts: readonly PromptPromotionArtifact[];
}): PromptPromotionStoryInput[] {
  const stories: PromptPromotionStoryInput[] = [];
  for (const storyId of input.storyIds) {
    let promptSet: PromptPromotionArtifact | undefined;
    let image: PromptPromotionArtifact | undefined;
    for (const artifact of input.artifacts) {
      if (artifact.revision_item_id !== storyId) continue;
      if (artifact.artifact_type === 'story_prompt_set' && !promptSet) promptSet = artifact;
      if (artifact.artifact_type === 'story_image' && !image) image = artifact;
    }
    const parsed = parseStoryPromptSetContent(promptSet?.content);
    stories.push({
      storyId,
      prompts: parsed?.prompts ?? [],
      ownerFeedback: mergeFeedback(promptSet?.content, image?.metadata),
      promptsReadyAt: parsed?.generatedAt ?? promptSet?.created_at ?? null,
      uploadedAt: hasUploadedFile(image) ? (image?.updated_at ?? image?.created_at ?? null) : null,
      qaCodes: qaCodesFromMetadata(image?.metadata),
    });
  }
  return stories;
}

function summarizeRate(stories: readonly PromptPromotionStoryInput[]): {
  judgedCount: number;
  acceptableCount: number;
  rate: number | null;
} {
  let judgedCount = 0;
  let acceptableCount = 0;
  for (const story of stories) {
    for (const entry of judgedEntries(story.ownerFeedback)) {
      judgedCount += 1;
      if (ACCEPTABLE_VERDICTS.has(entry.verdict)) acceptableCount += 1;
    }
  }
  return {
    judgedCount,
    acceptableCount,
    rate: judgedCount === 0 ? null : acceptableCount / judgedCount,
  };
}

function countMisleading(stories: readonly PromptPromotionStoryInput[]): number {
  let count = 0;
  for (const story of stories) {
    for (const entry of judgedEntries(story.ownerFeedback)) {
      if (entryIsMisleading(entry, story.qaCodes)) count += 1;
    }
  }
  return count;
}

function maxOwnerMinutes(stories: readonly PromptPromotionStoryInput[]): number | null {
  let max: number | null = null;
  for (const story of stories) {
    const end = firstAcceptedAt(story.ownerFeedback) ?? story.uploadedAt;
    const minutes = minutesBetween(story.promptsReadyAt, end);
    if (minutes === null) continue;
    if (max === null || minutes > max) max = minutes;
  }
  return max;
}

function formatGateLabel(checks: readonly PromptPromotionCheck[]): { label: string; detail: string } {
  const passedCount = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail');
  const incomplete = checks.filter((check) => check.status === 'incomplete');
  if (passedCount === checks.length) {
    return { label: 'гейт промптів: пройдено', detail: checks.map((check) => check.label).join(' · ') };
  }
  if (failed.length === 0 && incomplete.length === checks.length) {
    return { label: 'гейт промптів: чекає вердиктів', detail: '' };
  }
  const detail = checks.map((check) => check.label).join(' · ');
  return {
    label: `гейт промптів: ${passedCount}/${checks.length}`,
    detail,
  };
}

export function evaluatePromptPromotionGate(
  stories: readonly PromptPromotionStoryInput[],
): PromptPromotionResult {
  const checks = [
    acceptableRateCheck(stories),
    misleadingCheck(stories),
    ownerTimeCheck(stories),
    distinctPromptsCheck(stories),
  ];
  const passedCount = checks.filter((check) => check.status === 'pass').length;
  const ready = checks.every((check) => check.status !== 'incomplete');
  const passed = checks.every((check) => check.status === 'pass');
  const rate = summarizeRate(stories);
  const { label, detail } = formatGateLabel(checks);
  const withPrompts = stories.filter((story) => story.prompts.length > 0);
  let distinctStories = 0;
  for (const story of withPrompts) {
    if (promptSetIsDistinct(story.prompts)) distinctStories += 1;
  }
  return {
    passed,
    ready,
    passedCount,
    total: checks.length,
    acceptableRate: rate.rate,
    judgedCount: rate.judgedCount,
    acceptableCount: rate.acceptableCount,
    misleadingCount: countMisleading(stories),
    maxOwnerMinutes: maxOwnerMinutes(stories),
    distinctStories,
    storiesWithPrompts: withPrompts.length,
    checks,
    label,
    detail,
  };
}
