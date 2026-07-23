export const WEEKLY_REVIEW_REASONS = [
  {
    code: 'missing_important_story',
    label: 'Missing important story',
    help: 'A more consequential story from this week should be included.',
  },
  {
    code: 'wrong_story_selected',
    label: 'Wrong story selected',
    help: 'A selected story is not strong enough for the weekly top seven.',
  },
  {
    code: 'wrong_priority_or_order',
    label: 'Wrong priority or order',
    help: 'The lead story or sequence does not reflect editorial importance.',
  },
  {
    code: 'inaccurate_or_misleading',
    label: 'Inaccurate or misleading',
    help: 'A claim, title, or implication needs factual correction.',
  },
  {
    code: 'weak_summary_or_why',
    label: 'Weak summary or “why it matters”',
    help: 'The practical meaning is unclear or underdeveloped.',
  },
  {
    code: 'poor_tone_or_writing',
    label: 'Poor tone or writing',
    help: 'The digest needs clearer, tighter, or more professional copy.',
  },
  {
    code: 'insufficient_evidence',
    label: 'Insufficient evidence',
    help: 'The source or citations do not adequately support the story.',
  },
  {
    code: 'other',
    label: 'Other',
    help: 'A different editorial concern.',
  },
] as const;

export type WeeklyReviewReasonCode = (typeof WEEKLY_REVIEW_REASONS)[number]['code'];

export const WEEKLY_ITEM_REVIEW_ACTIONS = [
  { code: 'keep', label: 'Keep' },
  { code: 'remove', label: 'Remove' },
  { code: 'reorder', label: 'Change rank' },
  { code: 'edit', label: 'Edit content' },
  { code: 'replace', label: 'Replace' },
] as const;

export type WeeklyItemReviewAction = (typeof WEEKLY_ITEM_REVIEW_ACTIONS)[number]['code'];

export function isWeeklyReviewReasonCode(value: string): value is WeeklyReviewReasonCode {
  return WEEKLY_REVIEW_REASONS.some((reason) => reason.code === value);
}

export function isWeeklyItemReviewAction(value: string): value is WeeklyItemReviewAction {
  return WEEKLY_ITEM_REVIEW_ACTIONS.some((action) => action.code === value);
}
