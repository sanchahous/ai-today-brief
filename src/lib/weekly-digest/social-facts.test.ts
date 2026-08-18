import { describe, expect, it } from 'vitest';
import { buildWeeklySocialFactSnapshot } from './social-facts';
import type { WeeklyMasterBundle } from './content-studio';

describe('buildWeeklySocialFactSnapshot', () => {
  it('includes article body facts and approved claims, not only titles', () => {
    const bundle = {
      en: {
        locale: 'en',
        title: 'Weekly title',
        standfirst: 'Standfirst',
        theme: 'Operational AI',
        intro: 'Intro',
        editorNote: 'Note',
        keyTakeaways: ['Takeaway'],
        conclusion: 'Conclusion',
        stories: [
          {
            headline: 'Headline',
            summary: 'Summary',
            hook: 'Hook',
            body: 'Anthropic shipped eval v4 with a 37 percent pass-rate lift on internal traces.',
            why: 'Why',
            practical: 'Practical',
            limitation: 'Limitation',
            takeaway: 'Takeaway story',
            editorsView: '',
          },
        ],
      },
      uk: {
        locale: 'uk',
        title: 'Заголовок',
        standfirst: 'Лід',
        theme: 'Тема',
        intro: 'Вступ',
        editorNote: 'Нотатка',
        keyTakeaways: ['Висновок'],
        conclusion: 'Кінець',
        stories: [],
      },
    } as unknown as WeeklyMasterBundle;

    const facts = buildWeeklySocialFactSnapshot({
      locale: 'en',
      bundle,
      items: [
        {
          title_en: 'Item title',
          title_uk: 'Назва',
          summary_en: 'Item summary',
          summary_uk: 'Опис',
          why_en: 'Why item',
          why_uk: null,
          practical_en: 'Practical item',
          practical_uk: null,
          takeaway_en: 'Item takeaway',
          takeaway_uk: null,
          source_snapshot: {
            facts_en: [{ text: 'Approved claim: 12,000 traced runs.' }],
          },
        },
      ],
    });

    expect(facts.some((fact) => fact.includes('37 percent'))).toBe(true);
    expect(facts.some((fact) => fact.includes('12,000 traced runs'))).toBe(true);
    expect(facts).toEqual(expect.arrayContaining(['Item title', 'Practical item']));
  });
});
