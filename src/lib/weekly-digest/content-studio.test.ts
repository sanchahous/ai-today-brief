import { describe, expect, it } from 'vitest';
import {
  canonicalSourceName,
  detectTemplateLeaks,
  editorialQualityFailures,
  editorialQualityPasses,
  resolveWeeklyContentStudioMode,
  sourceNameMatchesDomain,
  validateMasterBundle,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyResearchPack,
} from './content-studio';

const itemId = '33333333-3333-4333-8333-333333333333';
const research: WeeklyResearchPack = {
  schemaVersion: 'weekly-research-v2',
  digestId: '11111111-1111-4111-8111-111111111111',
  revisionId: '22222222-2222-4222-8222-222222222222',
  revisionItemId: itemId,
  placement: 'feature',
  primarySource: {
    url: 'https://openai.com/research/example',
    sourceName: 'OpenAI',
    domain: 'openai.com',
    primary: true,
    extractedText: 'Approved evidence.',
    ogImage: null,
  },
  corroboratingSources: [],
  claims: [
    {
      id: 'claim-1',
      text: 'The approved claim.',
      kind: 'fact',
      evidenceUrls: ['https://openai.com/research/example'],
    },
  ],
  context: [],
  contradictions: [],
  limitations: [],
  risks: [],
  researchedAt: '2026-08-01T00:00:00.000Z',
};

function article(
  locale: 'en' | 'uk',
  practical = 'A product lead runs this exact workflow against the named release and measures the verified completion rate.',
): WeeklyArticleMaster {
  return {
    locale,
    title: 'A theme-led weekly title',
    seoTitle: 'A useful SEO title',
    metaDescription: 'A grounded weekly description for builders and decision-makers.',
    ogTitle: 'A native social preview title',
    ogDescription: 'A native social preview description.',
    standfirst: 'The core change and why it matters now.',
    theme: 'Operational AI',
    intro: 'A human editorial opening.',
    editorNote: 'The editor explains the judgment behind the edition.',
    keyTakeaways: ['Test one grounded workflow.'],
    topics: ['AI agents'],
    entities: ['OpenAI'],
    internalLinks: [{ anchor: 'agent workflows', query: 'agent workflows' }],
    conclusion: 'What to do next week.',
    stories: [
      {
        revisionItemId: itemId,
        placement: 'feature',
        headline: 'A specific headline',
        summary: 'A concise summary.',
        hook: 'A builder discovers that the hard part moved.',
        body: 'evidence '.repeat(400),
        why: 'This changes the reliability decision for teams shipping the workflow.',
        practical,
        limitation: 'The source does not establish performance outside the reported setup.',
        takeaway: 'Require a verified completion metric before expanding the rollout.',
        editorsView: 'editorial reasoning '.repeat(10),
        discussionQuestion: 'What would you require before trusting this in production?',
        claimIds: ['claim-1'],
      },
    ],
  };
}

function bundle(practical?: string): WeeklyMasterBundle {
  return {
    en: article('en', practical),
    uk: article('uk', practical),
    video: {
      title: 'Weekly episode',
      hook: 'The week changed.',
      narration: 'Narration',
      scenes: [],
      shorts: [0, 1, 2].map(() => ({
        revisionItemId: itemId,
        locale: 'uk' as const,
        hook: 'Гук',
        context: 'Контекст',
        insight: 'Висновок',
        takeaway: 'Дія',
        factIds: ['claim-1'],
        durationSeconds: 40,
      })),
    },
    socialAngles: [],
  };
}

describe('Weekly Content Studio hard gates', () => {
  it('resolves the rollout flag conservatively', () => {
    expect(resolveWeeklyContentStudioMode(undefined)).toBe('off');
    expect(resolveWeeklyContentStudioMode('shadow')).toBe('shadow');
    expect(resolveWeeklyContentStudioMode(' production ')).toBe('production');
    expect(resolveWeeklyContentStudioMode('true')).toBe('production');
    expect(resolveWeeklyContentStudioMode('unexpected')).toBe('off');
  });

  it('normalizes source labels and rejects a source/domain mismatch', () => {
    expect(canonicalSourceName('https://openai.com/research/example')).toBe('OpenAI');
    expect(sourceNameMatchesDomain('OpenAI', 'https://openai.com/research/example')).toBe(true);
    expect(sourceNameMatchesDomain('Reuters', 'https://openai.com/research/example')).toBe(false);
  });

  it('blocks the old generic practical template', () => {
    const issues = validateMasterBundle(bundle('Run a small pilot on a representative task.'), [
      research,
    ]);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'generic_practical', blocker: true }),
    );
  });

  it('blocks unsupported claim IDs and EN/UK parity drift', () => {
    const value = bundle();
    value.uk.stories[0]!.claimIds = ['claim-invented'];
    const issues = validateMasterBundle(value, [research]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unsupported_claim_id', blocker: true }),
        expect.objectContaining({ code: 'bilingual_claim_parity', blocker: true }),
      ]),
    );
  });

  it('blocks duplicate or extra stories and claims borrowed from another story', () => {
    const value = bundle();
    value.en.stories.push({
      ...value.en.stories[0]!,
      revisionItemId: '44444444-4444-4444-8444-444444444444',
      placement: 'radar',
      body: 'A short Radar brief.',
      claimIds: ['claim-2'],
    });
    value.uk.stories[0]!.claimIds = ['claim-2'];
    const issues = validateMasterBundle(
      value,
      [],
      [
        { revisionItemId: itemId, placement: 'feature', claimIds: ['claim-1'] },
        {
          revisionItemId: '44444444-4444-4444-8444-444444444444',
          placement: 'radar',
          claimIds: ['claim-2'],
        },
      ],
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'story_set_mismatch', blocker: true, locale: 'uk' }),
        expect.objectContaining({ code: 'wrong_story_claim_id', blocker: true, locale: 'uk' }),
      ]),
    );
  });

  it('enforces the overall, dimension, naturalness and parity thresholds', () => {
    const report: WeeklyContentQualityReport = {
      schemaVersion: 'weekly-quality-v2',
      score: 90,
      dimensions: [
        { name: 'hook', score: 90, note: 'clear' },
        { name: 'clarity', score: 90, note: 'clear' },
        { name: 'trust', score: 90, note: 'grounded' },
        { name: 'usefulness', score: 90, note: 'specific' },
        { name: 'structure', score: 90, note: 'complete' },
        { name: 'naturalness', score: 79, note: 'one calque remains' },
        { name: 'parity', score: 90, note: 'aligned' },
      ],
      issues: [],
      factualFlags: [],
      approvedClaimIds: ['claim-1'],
      checkedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(editorialQualityPasses(report)).toBe(false);
    report.dimensions.find((dimension) => dimension.name === 'naturalness')!.score = 80;
    expect(editorialQualityPasses(report)).toBe(true);
  });

  it('names the specific failing dimension instead of only the overall score', () => {
    const report: WeeklyContentQualityReport = {
      schemaVersion: 'weekly-quality-v2',
      score: 88,
      dimensions: [
        { name: 'hook', score: 90, note: 'clear' },
        { name: 'clarity', score: 89, note: 'clear' },
        { name: 'trust', score: 92, note: 'grounded' },
        { name: 'usefulness', score: 90, note: 'specific' },
        { name: 'structure', score: 91, note: 'complete' },
        { name: 'naturalness', score: 80, note: 'one calque remains' },
        { name: 'parity', score: 90, note: 'aligned' },
      ],
      issues: [],
      factualFlags: [],
      approvedClaimIds: ['claim-1'],
      checkedAt: '2026-08-04T00:00:00.000Z',
    };
    // Overall score (88) and blocker count (0) both look fine in isolation —
    // this is the exact "Master quality gate failed (88/100, 0 blockers)"
    // case that gave no clue the naturalness dimension was the actual cause.
    expect(editorialQualityPasses(report)).toBe(true);
    report.dimensions.find((dimension) => dimension.name === 'naturalness')!.score = 79;
    const failures = editorialQualityFailures(report);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('naturalness');
    expect(failures[0]).toContain('79/100');
  });

  it('requires editorsView and discussionQuestion on feature stories', () => {
    const value = bundle();
    value.en.stories[0]!.editorsView = '';
    value.en.stories[0]!.discussionQuestion = '';
    const issues = validateMasterBundle(value, [research]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'editors_view_missing', blocker: true, locale: 'en' }),
        expect.objectContaining({ code: 'discussion_question_missing', blocker: true, locale: 'en' }),
      ]),
    );
  });

  it('does not require editorsView/discussionQuestion on radar stories', () => {
    const value = bundle();
    value.en.stories.push({
      ...value.en.stories[0]!,
      revisionItemId: '55555555-5555-4555-8555-555555555555',
      placement: 'radar',
      body: 'A short radar brief.',
      editorsView: '',
      discussionQuestion: '',
      claimIds: ['claim-2'],
    });
    value.uk.stories.push({ ...value.en.stories[1]! });
    const issues = validateMasterBundle(
      value,
      [],
      [
        { revisionItemId: itemId, placement: 'feature', claimIds: ['claim-1'] },
        {
          revisionItemId: '55555555-5555-4555-8555-555555555555',
          placement: 'radar',
          claimIds: ['claim-2'],
        },
      ],
    );
    expect(issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'editors_view_missing' }),
        expect.objectContaining({ code: 'discussion_question_missing' }),
      ]),
    );
  });

  it('flags a template-leak label opener inside the body as a blocker, in either locale', () => {
    const value = bundle();
    value.en.stories[0]!.body =
      'Practical scenario: a security team runs this exact workflow every week.';
    value.uk.stories[0]!.body = 'Обмеження полягає в тому, що це стосується лише одного випадку.';
    const issues = validateMasterBundle(value, [research]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'template_leak:label_opener_practical',
          blocker: true,
          locale: 'en',
          field: 'body',
        }),
        expect.objectContaining({
          code: 'template_leak:label_opener_limitation',
          blocker: true,
          locale: 'uk',
          field: 'body',
        }),
      ]),
    );
  });
});

describe('detectTemplateLeaks', () => {
  it('is clean for prose that avoids every banned pattern', () => {
    expect(detectTemplateLeaks(bundle())).toEqual([]);
  });

  it('flags AI-tell phrasing in article-level fields, not just story fields', () => {
    const value = bundle();
    value.en.intro = "It's worth noting that this changes the calculus for red-teamers.";
    const issues = detectTemplateLeaks(value);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'template_leak:ai_tell_worth_noting',
        blocker: true,
        locale: 'en',
        field: 'intro',
      }),
    );
  });
});
