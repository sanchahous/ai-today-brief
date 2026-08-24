/**
 * The short public hero title and the private visual thesis are a single
 * editorial decision. Keeping their bounds here gives the LLM, the admin
 * action, and database-facing writers one contract without ever treating the
 * hero title as SEO metadata.
 */
export const WEEKLY_DISPLAY_TITLE_MIN_CHARS = 8;
export const WEEKLY_DISPLAY_TITLE_MAX_CHARS = 96;
export const WEEKLY_VISUAL_THESIS_MIN_CHARS = 16;
export const WEEKLY_VISUAL_THESIS_MAX_CHARS = 360;

export type WeeklyVisualDirection = {
  displayTitleEn: string;
  displayTitleUk: string;
  visualThesisEn: string;
  visualThesisUk: string;
};

export type WeeklyVisualDirectionInput = {
  displayTitleEn?: string | null;
  displayTitleUk?: string | null;
  visualThesisEn?: string | null;
  visualThesisUk?: string | null;
};

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/gu, ' ').trim() ?? '';
}

function within(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max;
}

/**
 * Historical revisions deliberately have no direction fields. A completely
 * empty object is therefore valid and means "keep canonical-title fallback".
 * A partially filled one is never valid: the two locales must be independently
 * reviewed together before a cover prompt can depend on them.
 */
export function weeklyVisualDirection(
  input: WeeklyVisualDirectionInput,
): WeeklyVisualDirection | null {
  const direction = {
    displayTitleEn: clean(input.displayTitleEn),
    displayTitleUk: clean(input.displayTitleUk),
    visualThesisEn: clean(input.visualThesisEn),
    visualThesisUk: clean(input.visualThesisUk),
  };
  if (Object.values(direction).every((value) => !value)) return null;
  if (Object.values(direction).some((value) => !value)) return null;
  if (
    !within(
      direction.displayTitleEn,
      WEEKLY_DISPLAY_TITLE_MIN_CHARS,
      WEEKLY_DISPLAY_TITLE_MAX_CHARS,
    ) ||
    !within(
      direction.displayTitleUk,
      WEEKLY_DISPLAY_TITLE_MIN_CHARS,
      WEEKLY_DISPLAY_TITLE_MAX_CHARS,
    ) ||
    !within(
      direction.visualThesisEn,
      WEEKLY_VISUAL_THESIS_MIN_CHARS,
      WEEKLY_VISUAL_THESIS_MAX_CHARS,
    ) ||
    !within(
      direction.visualThesisUk,
      WEEKLY_VISUAL_THESIS_MIN_CHARS,
      WEEKLY_VISUAL_THESIS_MAX_CHARS,
    )
  ) {
    return null;
  }
  return direction;
}

export function weeklyVisualDirectionErrorMessage(
  input: WeeklyVisualDirectionInput,
): string | null {
  const direction = {
    displayTitleEn: clean(input.displayTitleEn),
    displayTitleUk: clean(input.displayTitleUk),
    visualThesisEn: clean(input.visualThesisEn),
    visualThesisUk: clean(input.visualThesisUk),
  };
  const values = Object.values(direction);
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    return 'Complete both localized display titles and both internal visual theses, or leave all four empty.';
  }
  if (
    !within(
      direction.displayTitleEn,
      WEEKLY_DISPLAY_TITLE_MIN_CHARS,
      WEEKLY_DISPLAY_TITLE_MAX_CHARS,
    )
  ) {
    return `English display title must be ${WEEKLY_DISPLAY_TITLE_MIN_CHARS}–${WEEKLY_DISPLAY_TITLE_MAX_CHARS} characters.`;
  }
  if (
    !within(
      direction.displayTitleUk,
      WEEKLY_DISPLAY_TITLE_MIN_CHARS,
      WEEKLY_DISPLAY_TITLE_MAX_CHARS,
    )
  ) {
    return `Ukrainian display title must be ${WEEKLY_DISPLAY_TITLE_MIN_CHARS}–${WEEKLY_DISPLAY_TITLE_MAX_CHARS} characters.`;
  }
  if (
    !within(
      direction.visualThesisEn,
      WEEKLY_VISUAL_THESIS_MIN_CHARS,
      WEEKLY_VISUAL_THESIS_MAX_CHARS,
    )
  ) {
    return `English visual thesis must be ${WEEKLY_VISUAL_THESIS_MIN_CHARS}–${WEEKLY_VISUAL_THESIS_MAX_CHARS} characters.`;
  }
  if (
    !within(
      direction.visualThesisUk,
      WEEKLY_VISUAL_THESIS_MIN_CHARS,
      WEEKLY_VISUAL_THESIS_MAX_CHARS,
    )
  ) {
    return `Ukrainian visual thesis must be ${WEEKLY_VISUAL_THESIS_MIN_CHARS}–${WEEKLY_VISUAL_THESIS_MAX_CHARS} characters.`;
  }
  return null;
}

export function weeklyVisualDirectionFromArticles(input: {
  en: { displayTitle?: string | null; visualThesis?: string | null };
  uk: { displayTitle?: string | null; visualThesis?: string | null };
}): WeeklyVisualDirection | null {
  const candidate = {
    displayTitleEn: input.en.displayTitle,
    displayTitleUk: input.uk.displayTitle,
    visualThesisEn: input.en.visualThesis,
    visualThesisUk: input.uk.visualThesis,
  };
  return weeklyVisualDirectionErrorMessage(candidate) ? null : weeklyVisualDirection(candidate);
}
