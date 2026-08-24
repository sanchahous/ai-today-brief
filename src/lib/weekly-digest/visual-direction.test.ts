import { describe, expect, it } from 'vitest';
import {
  WEEKLY_DISPLAY_TITLE_MAX_CHARS,
  WEEKLY_DISPLAY_TITLE_MIN_CHARS,
  WEEKLY_VISUAL_THESIS_MAX_CHARS,
  WEEKLY_VISUAL_THESIS_MIN_CHARS,
  weeklyVisualDirection,
  weeklyVisualDirectionErrorMessage,
} from './visual-direction';

const direction = {
  displayTitleEn: 'Efficiency beats scale',
  displayTitleUk: 'Ефективність важливіша за масштаб',
  visualThesisEn:
    'Sparse activation makes a huge open model practical beyond hyperscaler clusters.',
  visualThesisUk:
    'Розріджена активація робить велику відкриту модель практичною поза кластерами гіперскейлерів.',
};

describe('weekly visual direction contract', () => {
  it('accepts a complete bilingual direction and normalizes whitespace', () => {
    expect(
      weeklyVisualDirection({ ...direction, displayTitleEn: '  Efficiency   beats scale ' }),
    ).toEqual({
      ...direction,
      displayTitleEn: 'Efficiency beats scale',
    });
    expect(weeklyVisualDirectionErrorMessage(direction)).toBeNull();
  });

  it('keeps legacy revisions valid when all direction fields are absent', () => {
    expect(weeklyVisualDirection({})).toBeNull();
    expect(weeklyVisualDirectionErrorMessage({})).toBeNull();
  });

  it('rejects a partially localized editorial direction', () => {
    expect(weeklyVisualDirectionErrorMessage({ ...direction, visualThesisUk: '' })).toContain(
      'Complete both localized',
    );
  });

  it('enforces both display and private-thesis bounds', () => {
    expect(
      weeklyVisualDirectionErrorMessage({
        ...direction,
        displayTitleEn: 'a'.repeat(WEEKLY_DISPLAY_TITLE_MIN_CHARS - 1),
      }),
    ).toContain('English display title');
    expect(
      weeklyVisualDirectionErrorMessage({
        ...direction,
        displayTitleUk: 'a'.repeat(WEEKLY_DISPLAY_TITLE_MAX_CHARS + 1),
      }),
    ).toContain('Ukrainian display title');
    expect(
      weeklyVisualDirectionErrorMessage({
        ...direction,
        visualThesisEn: 'a'.repeat(WEEKLY_VISUAL_THESIS_MIN_CHARS - 1),
      }),
    ).toContain('English visual thesis');
    expect(
      weeklyVisualDirectionErrorMessage({
        ...direction,
        visualThesisUk: 'a'.repeat(WEEKLY_VISUAL_THESIS_MAX_CHARS + 1),
      }),
    ).toContain('Ukrainian visual thesis');
    expect(
      weeklyVisualDirection({
        ...direction,
        displayTitleEn: 'a'.repeat(WEEKLY_DISPLAY_TITLE_MIN_CHARS - 1),
      }),
    ).toBeNull();
  });
});
