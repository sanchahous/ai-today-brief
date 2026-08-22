import { describe, expect, it } from 'vitest';
import { applyLanguageMechanicsFixes } from './master-repair';
import { canApproveQualityOrArticle } from './machine-attest';
import { loadWeeklyStoriesForDownstream } from './master-bundle';
import { WEEKLY_SOCIAL_MATRIX } from './social-matrix';
import { videoScriptFromArtifactContent } from './video-script-content';
import type { WeeklyMasterBundle, WeeklyMasterStory, WeeklyQualityIssue } from './content-studio';
import type { Json } from '@/lib/database.types';

function story(id: string, overrides: Partial<WeeklyMasterStory> = {}): WeeklyMasterStory {
  return {
    revisionItemId: id,
    placement: 'feature',
    headline: 'Headline',
    summary: 'Summary',
    hook: 'Hook',
    body: 'Дані текли потокенно через пайплайн.',
    why: 'Why',
    practical: 'Practical',
    limitation: 'Limitation',
    takeaway: 'Takeaway',
    editorsView: 'View',
    discussionQuestion: 'Question?',
    claimIds: ['c1'],
    ...overrides,
  };
}

function bundleWithUkBody(): WeeklyMasterBundle {
  const uk = story('item-1');
  const en = story('item-1', { body: 'Data flowed through the pipeline.' });
  const frame = {
    locale: 'en' as const,
    title: 'Title',
    seoTitle: 'SEO',
    metaDescription: 'Meta',
    ogTitle: 'OG',
    ogDescription: 'OG desc',
    standfirst: 'Standfirst',
    theme: 'Theme',
    intro: 'Intro',
    editorNote: 'Note',
    keyTakeaways: ['Take'],
    topics: [],
    entities: [],
    internalLinks: [],
    conclusion: 'Note',
    stories: [en],
  };
  return {
    en: frame,
    uk: { ...frame, locale: 'uk', stories: [uk] },
  };
}

describe('weekly release graph (ai-weekly-2026-08-09 shapes)', () => {
  it('keeps threads on uk and seven LinkedIn pages in the matrix/contract', () => {
    expect(WEEKLY_SOCIAL_MATRIX.threads).toBe('uk');
    expect(Object.keys(WEEKLY_SOCIAL_MATRIX)).toHaveLength(6);
  });

  it('rehydrates a normalized article without stories so .map cannot throw', () => {
    const bundle = loadWeeklyStoriesForDownstream({
      revision: {
        title_en: 'T',
        title_uk: 'Т',
        intro_en: 'I',
        intro_uk: 'І',
        editor_note_en: 'N',
        editor_note_uk: 'Н',
        key_takeaways_en: ['K'],
        key_takeaways_uk: ['К'],
      },
      items: [
        {
          id: 'item-1',
          rank: 1,
          title_en: 'EN',
          title_uk: 'UK',
          summary_en: 'S',
          summary_uk: 'О',
          body_en: 'Body',
          body_uk: 'Текст',
          why_en: 'Why',
          why_uk: 'Чому',
          practical_en: 'P',
          practical_uk: 'П',
          takeaway_en: 'T',
          takeaway_uk: 'В',
          source_snapshot: {} as Json,
        },
      ],
      artifacts: ['en', 'uk'].map((locale) => ({
        artifact_type: 'article',
        locale,
        is_current: true,
        content: {
          title: 'Title',
          seoTitle: 'SEO',
          metaDescription: 'Meta',
          ogTitle: 'OG',
          ogDescription: 'OG',
          standfirst: 'Standfirst',
          theme: 'Theme',
          intro: 'Intro',
          editor_note: 'Note',
          key_takeaways: ['K'],
        },
      })),
    });
    expect(bundle.en.stories.map((row) => row.revisionItemId)).toEqual(['item-1']);
  });

  it('refuses Approve while language_mechanics blockers remain', () => {
    const issues: WeeklyQualityIssue[] = [
      {
        code: 'language_mechanics',
        message: 'Broken word',
        blocker: true,
        locale: 'uk',
        field: 'body',
        span: 'потокенно',
        suggestedFix: 'потоково',
      },
    ];
    expect(
      canApproveQualityOrArticle({
        artifactType: 'content_quality_report',
        artifactContent: { issues },
      }).ok,
    ).toBe(false);
  });

  it('applies language_mechanics suggestedFix before quality persist', () => {
    const { bundle, applied } = applyLanguageMechanicsFixes(bundleWithUkBody(), [
      {
        code: 'language_mechanics',
        message: 'Broken word',
        blocker: true,
        locale: 'uk',
        field: 'body',
        span: 'потокенно',
        suggestedFix: 'потоково',
      },
    ]);
    expect(applied).toHaveLength(1);
    expect(bundle.uk.stories[0]?.body).toContain('потоково');
    expect(bundle.uk.stories[0]?.body).not.toContain('потокенно');
  });

  it('does not splice a critic instruction quoting candidate replacements into the article', () => {
    // Live case, 2026-08-22: the critic wrote the infinitive "Замінити" (not
    // the imperative "замініть" the old prefix blacklist knew), so the whole
    // instruction sentence -- guillemets, alternatives and all -- landed in
    // the published body as if it were the replacement text.
    const withCaseStudy = bundleWithUkBody();
    withCaseStudy.uk.stories[0]!.body = 'Команда описала це За case study OpenAI детально.';
    const { bundle, applied } = applyLanguageMechanicsFixes(withCaseStudy, [
      {
        code: 'language_mechanics',
        message: 'Untranslated English phrase.',
        blocker: true,
        locale: 'uk',
        field: 'body',
        span: 'За case study OpenAI',
        suggestedFix: 'Замінити на «За кейс-стаді OpenAI» або «За звітом OpenAI про клієнта»',
      },
    ]);
    expect(applied).toHaveLength(0);
    expect(bundle.uk.stories[0]?.body).toBe('Команда описала це За case study OpenAI детально.');
  });

  it('does not persist a scenes array as narration_plan', () => {
    expect(
      videoScriptFromArtifactContent({
        script: 'Edited.',
        narration_plan: [{ id: 'cold_open' }],
      }),
    ).toBeNull();
  });
});
