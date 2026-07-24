export interface WeeklyRevisionContentItem {
  rank: number;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string | null;
  summary_uk: string | null;
  body_en: string | null;
  body_uk: string | null;
  why_en: string | null;
  why_uk: string | null;
  practical_en: string | null;
  practical_uk: string | null;
  takeaway_en: string | null;
  takeaway_uk: string | null;
}

export interface WeeklyRevisionContentInput {
  title_en: string | null;
  title_uk: string | null;
  intro_en: string | null;
  intro_uk: string | null;
  editor_note_en: string | null;
  editor_note_uk: string | null;
  key_takeaways_en: unknown;
  key_takeaways_uk: unknown;
  items: readonly WeeklyRevisionContentItem[];
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasCompleteTakeaways(value: unknown) {
  return Boolean(
    Array.isArray(value) &&
    value.length &&
    value.every((item) => typeof item === 'string' && Boolean(item.trim())),
  );
}

function missingFields(values: Array<[label: string, value: string | null | undefined]>) {
  return values.flatMap(([label, value]) => (hasText(value) ? [] : [label]));
}

/**
 * Keeps revisions reviewable by rejecting incomplete bilingual editorial copy
 * before an immutable revision is created. Browser `required` attributes are
 * only a convenience; this guard is authoritative for direct Server Action
 * requests as well.
 */
export function validateWeeklyRevisionContent(input: WeeklyRevisionContentInput) {
  const errors: string[] = [];
  const englishIssueMissing = missingFields([
    ['edition title', input.title_en],
    ['introduction', input.intro_en],
    ["editor's note", input.editor_note_en],
  ]);
  if (!hasCompleteTakeaways(input.key_takeaways_en)) englishIssueMissing.push('key takeaways');
  if (englishIssueMissing.length) errors.push(`English article: ${englishIssueMissing.join(', ')}`);

  const ukrainianIssueMissing = missingFields([
    ['edition title', input.title_uk],
    ['introduction', input.intro_uk],
    ["editor's note", input.editor_note_uk],
  ]);
  if (!hasCompleteTakeaways(input.key_takeaways_uk)) {
    ukrainianIssueMissing.push('key takeaways');
  }
  if (ukrainianIssueMissing.length) {
    errors.push(`Ukrainian article: ${ukrainianIssueMissing.join(', ')}`);
  }

  for (const item of input.items) {
    const englishStoryMissing = missingFields([
      ['headline', item.title_en],
      ['short summary', item.summary_en],
      ['full story', item.body_en],
      ['why it matters', item.why_en],
      ['practical example', item.practical_en],
      ['audience takeaway', item.takeaway_en],
    ]);
    if (englishStoryMissing.length) {
      errors.push(`Story ${item.rank}, English: ${englishStoryMissing.join(', ')}`);
    }

    const ukrainianStoryMissing = missingFields([
      ['headline', item.title_uk],
      ['short summary', item.summary_uk],
      ['full story', item.body_uk],
      ['why it matters', item.why_uk],
      ['practical example', item.practical_uk],
      ['audience takeaway', item.takeaway_uk],
    ]);
    if (ukrainianStoryMissing.length) {
      errors.push(`Story ${item.rank}, Ukrainian: ${ukrainianStoryMissing.join(', ')}`);
    }
  }

  return errors;
}

export function weeklyRevisionContentErrorMessage(input: WeeklyRevisionContentInput) {
  const errors = validateWeeklyRevisionContent(input);
  if (errors.length === 0) return null;
  const visibleErrors = errors.slice(0, 4);
  const remaining = errors.length - visibleErrors.length;
  return `Complete the required Weekly Digest text before saving: ${visibleErrors.join('; ')}${
    remaining > 0 ? `; and ${remaining} more section${remaining === 1 ? '' : 's'}` : ''
  }.`;
}
