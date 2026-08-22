import { describe, expect, it } from 'vitest';
import { loadWeeklyStoriesForDownstream } from './master-bundle';
import type { Json } from '@/lib/database.types';

function revisionItem(id: string, rank: number) {
  return {
    id,
    rank,
    title_en: `English title ${rank}`,
    title_uk: `Українська назва ${rank}`,
    summary_en: 'Summary sentence.',
    summary_uk: 'Короткий опис.',
    body_en: `English body ${rank}`,
    body_uk: `Український текст ${rank}`,
    why_en: `English why ${rank}`,
    why_uk: `Українське пояснення ${rank}`,
    practical_en: `English practical ${rank}`,
    practical_uk: `Український крок ${rank}`,
    takeaway_en: `English takeaway ${rank}`,
    takeaway_uk: `Український висновок ${rank}`,
    source_snapshot: { facts_en: ['Fact one', 'Fact two'] } as Json,
  };
}

describe('loadWeeklyStoriesForDownstream', () => {
  it('rehydrates the 2026-08-17 normalized article (no stories array)', () => {
    const bundle = loadWeeklyStoriesForDownstream({
      revision: {
        title_en: 'Revision title',
        title_uk: 'Назва ревізії',
        intro_en: 'Revision intro',
        intro_uk: 'Вступ ревізії',
        editor_note_en: 'Revision editor note',
        editor_note_uk: 'Нотатка редактора',
        key_takeaways_en: ['Revision takeaway'],
        key_takeaways_uk: ['Висновок ревізії'],
      },
      items: Array.from({ length: 7 }, (_, index) => revisionItem(`item-${index + 1}`, index + 1)),
      artifacts: ['en', 'uk'].map((locale) => ({
        artifact_type: 'article',
        locale,
        is_current: true,
        content: {
          title: `${locale} title`,
          seoTitle: `${locale} SEO title`,
          metaDescription: `${locale} meta description`,
          ogTitle: `${locale} OG title`,
          ogDescription: `${locale} OG description`,
          standfirst: `${locale} standfirst`,
          theme: `${locale} theme`,
          intro: `${locale} intro`,
          editor_note: `${locale} editor note`,
          key_takeaways: [`${locale} takeaway`],
          topics: ['AI'],
          entities: ['Example'],
          internalLinks: [{ anchor: 'AI', query: 'ai' }],
        },
      })),
    });

    expect(bundle.en.stories).toHaveLength(7);
    expect(bundle.en.stories.map((story) => story.body)).not.toContain('');
    expect(bundle.uk.stories[0]?.body).toBe('Український текст 1');
  });
});
