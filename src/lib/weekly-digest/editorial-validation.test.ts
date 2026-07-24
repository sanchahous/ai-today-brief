import { describe, expect, it } from 'vitest';
import {
  validateWeeklyRevisionContent,
  weeklyRevisionContentErrorMessage,
  type WeeklyRevisionContentInput,
} from './editorial-validation';

function revision(overrides: Partial<WeeklyRevisionContentInput> = {}): WeeklyRevisionContentInput {
  return {
    title_en: 'The week in AI engineering',
    title_uk: 'Тиждень в AI-інженерії',
    intro_en: 'A concise bilingual edition.',
    intro_uk: 'Стислий двомовний випуск.',
    editor_note_en: 'Review every item before applying it.',
    editor_note_uk: 'Перевірте кожну історію перед застосуванням.',
    key_takeaways_en: ['First English takeaway'],
    key_takeaways_uk: ['Перший український висновок'],
    items: [
      {
        rank: 1,
        title_en: 'English headline',
        title_uk: 'Український заголовок',
        summary_en: 'English summary',
        summary_uk: 'Український опис',
        body_en: 'English full story',
        body_uk: 'Український повний текст',
        why_en: 'English relevance',
        why_uk: 'Українська релевантність',
        practical_en: 'English practical example',
        practical_uk: 'Український практичний приклад',
        takeaway_en: 'English audience takeaway',
        takeaway_uk: 'Український висновок для аудиторії',
      },
    ],
    ...overrides,
  };
}

describe('validateWeeklyRevisionContent', () => {
  it('accepts a complete bilingual editorial revision', () => {
    expect(validateWeeklyRevisionContent(revision())).toEqual([]);
    expect(weeklyRevisionContentErrorMessage(revision())).toBeNull();
  });

  it('reports blank issue framing and every required story field by locale', () => {
    const input = revision({
      intro_en: '   ',
      editor_note_uk: null,
      key_takeaways_en: ['   '],
      items: [
        {
          ...revision().items[0],
          body_en: '',
          why_uk: null,
          practical_uk: ' ',
          takeaway_uk: '',
        },
      ],
    });

    expect(validateWeeklyRevisionContent(input)).toEqual([
      'English article: introduction, key takeaways',
      "Ukrainian article: editor's note",
      'Story 1, English: full story',
      'Story 1, Ukrainian: why it matters, practical example, audience takeaway',
    ]);
    expect(weeklyRevisionContentErrorMessage(input)).toContain('Story 1, Ukrainian');
  });

  it('rejects a key-takeaway array with an empty item', () => {
    const input = revision({ key_takeaways_uk: ['Valid takeaway', ''] });

    expect(validateWeeklyRevisionContent(input)).toContain('Ukrainian article: key takeaways');
  });

  it('requires both titles and both short summaries instead of only full story fields', () => {
    const input = revision({
      title_en: '',
      items: [
        {
          ...revision().items[0],
          title_en: null,
          title_uk: ' ',
          summary_en: '',
          summary_uk: null,
        },
      ],
    });

    expect(validateWeeklyRevisionContent(input)).toEqual([
      'English article: edition title',
      'Story 1, English: headline, short summary',
      'Story 1, Ukrainian: headline, short summary',
    ]);
  });
});
