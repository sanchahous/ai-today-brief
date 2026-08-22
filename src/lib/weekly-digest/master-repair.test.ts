import { describe, expect, it } from 'vitest';
import {
  applyRepairValue,
  isRepairableField,
  locateSpan,
  planRepairTasks,
  readRepairValue,
  repairTargetKey,
  spanCandidatesFrom,
  repairNeedsUkrainianReadaptation,
  ukrainianCounterpart,
} from './master-repair';
import type {
  WeeklyArticleMaster,
  WeeklyMasterBundle,
  WeeklyMasterStory,
  WeeklyQualityIssue,
} from './content-studio';

function story(revisionItemId: string, overrides: Partial<WeeklyMasterStory> = {}) {
  return {
    revisionItemId,
    placement: 'feature',
    headline: `Headline ${revisionItemId}`,
    summary: 'Summary',
    hook: 'Hook',
    body: `Body of ${revisionItemId}`,
    why: 'Why it matters in one paragraph.',
    practical: 'A team could apply this in a staging environment.',
    limitation: 'The evidence covers one vendor only.',
    takeaway: 'Decide whether to pilot it.',
    editorsView: 'Our read: this is where it gets interesting.',
    discussionQuestion: 'What would you watch for next?',
    claimIds: ['claim-1'],
    ...overrides,
  } as WeeklyMasterStory;
}

function article(locale: 'en' | 'uk', stories: WeeklyMasterStory[]): WeeklyArticleMaster {
  return {
    locale,
    title: 'Edition title',
    seoTitle: 'SEO title',
    metaDescription: 'Meta description',
    ogTitle: 'OG title',
    ogDescription: 'OG description',
    standfirst: 'Standfirst sentence.',
    theme: 'Theme',
    intro: 'Intro paragraph.',
    editorNote: 'Editor note.',
    keyTakeaways: ['One takeaway'],
    topics: ['topic'],
    entities: ['entity'],
    internalLinks: [{ anchor: 'a', query: 'q' }],
    conclusion: 'Conclusion paragraph.',
    stories,
  };
}

function bundle(): WeeklyMasterBundle {
  return {
    en: article('en', [story('item-1'), story('item-2')]),
    uk: article('uk', [story('item-1'), story('item-2')]),
  };
}

const FEATURE_IDS = ['item-1', 'item-2'];

describe('field addressing', () => {
  it('reads and writes a story field without touching its siblings or the other locale', () => {
    const target = { locale: 'en' as const, revisionItemId: 'item-1', field: 'practical' as const };
    const next = applyRepairValue(bundle(), target, 'A concrete replacement.');
    expect(readRepairValue(next, target)).toBe('A concrete replacement.');
    expect(readRepairValue(next, { ...target, field: 'body' })).toBe('Body of item-1');
    expect(readRepairValue(next, { ...target, revisionItemId: 'item-2' })).toBe(
      'A team could apply this in a staging environment.',
    );
    expect(readRepairValue(next, { ...target, locale: 'uk' })).toBe(
      'A team could apply this in a staging environment.',
    );
  });

  it('addresses article-level fields with a null revisionItemId', () => {
    const target = { locale: 'uk' as const, revisionItemId: null, field: 'seoTitle' as const };
    const next = applyRepairValue(bundle(), target, 'Коротший заголовок');
    expect(next.uk.seoTitle).toBe('Коротший заголовок');
    expect(next.en.seoTitle).toBe('SEO title');
  });

  it('keeps internalLinks out of the repairable set, since a repair returns text or a string list', () => {
    expect(isRepairableField('internalLinks')).toBe(false);
    expect(isRepairableField('body')).toBe(true);
    expect(isRepairableField('nonsense')).toBe(false);
  });
});

describe('locateSpan', () => {
  it('finds the exact field holding a quoted span, so a low dimension score gets a precise target', () => {
    expect(locateSpan(bundle(), 'A team could apply this')).toEqual({
      locale: 'en',
      revisionItemId: 'item-1',
      field: 'practical',
    });
  });

  it('ignores spans too short to identify a field unambiguously', () => {
    expect(locateSpan(bundle(), 'Hook')).toBeNull();
  });

  it('pulls quoted candidates out of a free-text critic note', () => {
    expect(
      spanCandidatesFrom('The opening is abstract: "the tension is clear for leaders" — rewrite it.'),
    ).toEqual(['the tension is clear for leaders']);
  });
});

describe('planRepairTasks', () => {
  const issue = (overrides: Partial<WeeklyQualityIssue>): WeeklyQualityIssue => ({
    code: 'generic_practical',
    message: 'The practical example matches a prohibited generic template.',
    blocker: true,
    ...overrides,
  });

  it('routes a fully-addressed deterministic issue straight to its own field', () => {
    const { tasks, unmapped } = planRepairTasks(
      bundle(),
      {
        issues: [issue({ locale: 'en', revisionItemId: 'item-1', field: 'practical' })],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(unmapped).toEqual([]);
    expect(tasks).toHaveLength(1);
    expect(repairTargetKey(tasks[0]!.target)).toBe('en:item-1:practical');
  });

  it('groups several issues against the same field into one repair call', () => {
    const { tasks } = planRepairTasks(
      bundle(),
      {
        issues: [
          issue({ locale: 'en', revisionItemId: 'item-1', field: 'body', code: 'story_length' }),
          issue({
            locale: 'en',
            revisionItemId: 'item-1',
            field: 'body',
            code: 'template_leak:label_opener_why',
          }),
        ],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.issues.map((entry) => entry.code)).toEqual([
      'story_length',
      'template_leak:label_opener_why',
    ]);
  });

  // The old loop refused to repair anything at all when a factual flag was
  // present (reportIsRevisable returned false), so the most fixable defect
  // class always cost a full regenerate.
  it('turns a factual flag into a targeted repair when it quotes a locatable span', () => {
    const { tasks } = planRepairTasks(
      bundle(),
      {
        issues: [],
        factualFlags: ['Unsupported: "A team could apply this in a staging environment."'],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(tasks.map((task) => repairTargetKey(task.target))).toEqual(['en:item-1:practical']);
  });

  it('falls back to the fields a dimension actually grades when nothing else addresses it', () => {
    const { tasks } = planRepairTasks(
      bundle(),
      {
        issues: [
          issue({ code: 'dimension_low_score:usefulness', message: 'usefulness scored 60/100.' }),
        ],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(tasks.map((task) => repairTargetKey(task.target))).toEqual([
      'en:item-1:practical',
      'en:item-2:practical',
    ]);
  });

  it('routes translation dimensions to the Ukrainian side', () => {
    const { tasks } = planRepairTasks(
      bundle(),
      {
        issues: [
          issue({
            code: 'dimension_low_score:naturalness',
            message: 'naturalness scored 55/100.',
            locale: 'uk',
          }),
        ],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(tasks.every((task) => task.target.locale === 'uk')).toBe(true);
  });

  it('spreads an article_length miss over the longest bodies', () => {
    const long = bundle();
    long.en.stories[1] = story('item-2', { body: 'word '.repeat(900).trim() });
    const { tasks } = planRepairTasks(
      long,
      {
        issues: [
          issue({ code: 'article_length', locale: 'en', message: 'EN master is 3,400 words.' }),
        ],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS, maxFallbackStories: 1 },
    );
    expect(tasks.map((task) => repairTargetKey(task.target))).toEqual(['en:item-2:body']);
  });

  it('reports an issue it cannot address instead of dropping it', () => {
    const { tasks, unmapped } = planRepairTasks(
      bundle(),
      {
        issues: [issue({ code: 'bilingual_claim_parity', message: 'Claim ids differ.' })],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS },
    );
    expect(tasks).toEqual([]);
    expect(unmapped).toEqual([
      expect.objectContaining({ code: 'bilingual_claim_parity', reason: 'unmappable' }),
    ]);
  });

  // Without this the loop would keep paying to re-send the same field that
  // the model has already refused to fix twice.
  it('marks a target that has used up its attempts as unresolved rather than queueing it again', () => {
    const { tasks, unmapped } = planRepairTasks(
      bundle(),
      {
        issues: [issue({ locale: 'en', revisionItemId: 'item-1', field: 'practical' })],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS, exhaustedTargetKeys: new Set(['en:item-1:practical']) },
    );
    expect(tasks).toEqual([]);
    expect(unmapped[0]).toMatchObject({ reason: 'attempts_exhausted' });
  });

  it('skips non-blocking issues when asked to', () => {
    const { tasks } = planRepairTasks(
      bundle(),
      {
        issues: [
          issue({
            code: 'story_length',
            blocker: false,
            locale: 'en',
            revisionItemId: 'item-1',
            field: 'body',
          }),
        ],
        factualFlags: [],
      },
      { featureIds: FEATURE_IDS, includeNonBlocking: false },
    );
    expect(tasks).toEqual([]);
  });
});

describe('ukrainianCounterpart', () => {
  it('schedules a Ukrainian re-adaptation for a fact-bearing English field', () => {
    expect(
      ukrainianCounterpart({ locale: 'en', revisionItemId: 'item-1', field: 'body' }),
    ).toEqual({ locale: 'uk', revisionItemId: 'item-1', field: 'body' });
  });

  // Claim ids are copied structurally and each locale owns its own character
  // budget, so re-adapting these would be a paid call that changes nothing.
  it('does not re-adapt claim ids or per-locale metadata', () => {
    for (const field of ['claimIds', 'seoTitle', 'metaDescription', 'topics'] as const) {
      expect(ukrainianCounterpart({ locale: 'en', revisionItemId: 'item-1', field })).toBeNull();
    }
  });

  it('never schedules a counterpart for a Ukrainian repair', () => {
    expect(
      ukrainianCounterpart({ locale: 'uk', revisionItemId: 'item-1', field: 'body' }),
    ).toBeNull();
  });
});

describe('repairNeedsUkrainianReadaptation', () => {
  it('skips counterpart rewrites for splice-class language defects', () => {
    expect(
      repairNeedsUkrainianReadaptation([{ code: 'template_leak:label_opener_takeaway' }]),
    ).toBe(false);
    expect(repairNeedsUkrainianReadaptation([{ code: 'language_mechanics' }])).toBe(false);
    expect(repairNeedsUkrainianReadaptation([{ code: 'uk_language_residue' }])).toBe(false);
  });

  it('still re-adapts Ukrainian when the English repair can change facts', () => {
    expect(repairNeedsUkrainianReadaptation([{ code: 'engagement_structure' }])).toBe(true);
    expect(
      repairNeedsUkrainianReadaptation([
        { code: 'template_leak:label_opener_takeaway' },
        { code: 'story_length' },
      ]),
    ).toBe(true);
  });
});
