import { describe, expect, it } from 'vitest';
import {
  canonicalSourceName,
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
        { name: 'naturalness', score: 84, note: 'one calque remains' },
        { name: 'parity', score: 90, note: 'aligned' },
      ],
      issues: [],
      factualFlags: [],
      approvedClaimIds: ['claim-1'],
      checkedAt: '2026-08-01T00:00:00.000Z',
    };
    expect(editorialQualityPasses(report)).toBe(false);
    report.dimensions.find((dimension) => dimension.name === 'naturalness')!.score = 85;
    expect(editorialQualityPasses(report)).toBe(true);
  });
});
