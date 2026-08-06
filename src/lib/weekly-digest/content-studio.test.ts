import { describe, expect, it } from 'vitest';
import {
  canonicalSourceName,
  detectTemplateLeaks,
  editorialQualityFailures,
  editorialQualityPasses,
  isRevisableIssueCode,
  reportIsRevisable,
  resolveWeeklyContentStudioMode,
  sourceNameMatchesDomain,
  validateMasterBundle,
  validateVideoScript,
  type WeeklyArticleMaster,
  type WeeklyContentQualityReport,
  type WeeklyMasterBundle,
  type WeeklyQualityDimension,
  type WeeklyResearchPack,
  type WeeklyVideoScene,
  type WeeklyVideoScript,
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
        { name: 'engagement', score: 90, note: 'clear' },
        { name: 'voice', score: 90, note: 'clear' },
        { name: 'clarity', score: 90, note: 'clear' },
        { name: 'trust', score: 90, note: 'grounded' },
        { name: 'usefulness', score: 90, note: 'specific' },
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
        { name: 'engagement', score: 90, note: 'clear' },
        { name: 'voice', score: 91, note: 'clear' },
        { name: 'clarity', score: 89, note: 'clear' },
        { name: 'trust', score: 92, note: 'grounded' },
        { name: 'usefulness', score: 90, note: 'specific' },
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

describe('validateVideoScript', () => {
  const feature1 = itemId;
  const feature2 = '66666666-6666-4666-8666-666666666666';
  const feature3 = '77777777-7777-4777-8777-777777777777';
  const expectedStories = [
    { revisionItemId: feature1, placement: 'feature' as const, claimIds: ['claim-1'] },
    { revisionItemId: feature2, placement: 'feature' as const, claimIds: ['claim-2'] },
    { revisionItemId: feature3, placement: 'feature' as const, claimIds: ['claim-3'] },
  ];

  function words(count: number) {
    return Array.from({ length: count }, (_, index) => `word${index}`).join(' ');
  }

  // Duration defaults to exactly voiceover-word-count / 2.6 so scenes pass
  // the WPS check unless a test overrides durationSeconds directly to force
  // a mismatch -- mirrors how the real generator is instructed to compute it.
  function makeScene(overrides: Partial<WeeklyVideoScene> = {}): WeeklyVideoScene {
    const voiceover = overrides.voiceover ?? words(130);
    const wordCount = voiceover.trim().split(/\s+/).filter(Boolean).length;
    return {
      id: 'scene',
      kind: 'broll',
      revisionItemId: null,
      voiceover,
      onScreenText: '',
      scenePrompt: 'A concrete reportage scene, one subject, no on-screen text.',
      durationSeconds: Math.round(wordCount / 2.6),
      ...overrides,
    };
  }

  function makeShort(overrides: Partial<WeeklyVideoScript['shorts'][number]> = {}) {
    return {
      revisionItemId: feature1,
      locale: 'uk' as const,
      hook: 'Хук',
      context: 'Контекст',
      insight: 'Інсайт',
      takeaway: 'Дія',
      factIds: ['claim-1'],
      durationSeconds: 40,
      ...overrides,
    };
  }

  function baselineScript(): WeeklyVideoScript {
    return {
      title: 'Weekly episode',
      hook: 'The week changed.',
      narration: '',
      scenes: [
        makeScene({ id: 'cold_open', kind: 'cold_open', voiceover: words(65) }),
        makeScene({ id: 'anchor_intro', kind: 'anchor', voiceover: words(45) }),
        makeScene({ id: 'broll_1', kind: 'broll', revisionItemId: feature1, voiceover: words(260) }),
        makeScene({ id: 'broll_2', kind: 'broll', revisionItemId: feature2, voiceover: words(260) }),
        makeScene({ id: 'broll_3', kind: 'broll', revisionItemId: feature3, voiceover: words(260) }),
        makeScene({ id: 'anchor_radar', kind: 'anchor', voiceover: words(90) }),
        makeScene({ id: 'outro', kind: 'outro', voiceover: words(55) }),
      ],
      shorts: [
        makeShort({ revisionItemId: feature1, factIds: ['claim-1'] }),
        makeShort({ revisionItemId: feature2, factIds: ['claim-2'] }),
        makeShort({ revisionItemId: feature3, factIds: ['claim-3'] }),
      ],
    };
  }

  it('is clean for a well-formed script', () => {
    expect(validateVideoScript(baselineScript(), expectedStories)).toEqual([]);
  });

  it('blocks fewer than three Shorts', () => {
    const script = baselineScript();
    script.shorts.pop();
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'shorts_count', blocker: true }),
    );
  });

  it('blocks a Short outside the 35-50s duration band', () => {
    const script = baselineScript();
    script.shorts[0]!.durationSeconds = 20;
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'shorts_contract', blocker: true }),
    );
  });

  it('blocks a Short citing a fact ID outside its own story\'s approved claims', () => {
    const script = baselineScript();
    script.shorts[0]!.factIds = ['claim-2'];
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'shorts_contract', blocker: true }),
    );
  });

  it('blocks a total scene runtime outside 360-480s', () => {
    const script = baselineScript();
    script.scenes = script.scenes.slice(0, 2);
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'video_duration', blocker: true }),
    );
  });

  it('blocks a script missing a broll segment for one of the three features', () => {
    const script = baselineScript();
    script.scenes = script.scenes.filter((scene) => scene.id !== 'broll_3');
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'scene_structure', blocker: true }),
    );
  });

  it('blocks a single scene duration outside the 1-180s bound', () => {
    const script = baselineScript();
    script.scenes[0]!.durationSeconds = 200;
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'scene_duration', blocker: true, field: 'durationSeconds' }),
    );
  });

  it('blocks a scene whose claimed duration does not match its voiceover length -- the "silent slideshow" bug', () => {
    // Root cause this check exists to kill: the LLM invents a duration that
    // satisfies the 360-480s total while writing voiceover text far too
    // short for that runtime (see wiki/pipeline/video-boundary.md).
    const script = baselineScript();
    // Claims 100s of runtime (the old broll target) but the voiceover is
    // only 25 words -- ~9.6s of actual speech at 2.6 words/sec.
    script.scenes[2]!.durationSeconds = 100;
    script.scenes[2]!.voiceover = words(25);
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'scene_narration_mismatch', blocker: true, field: 'voiceover' }),
    );
  });

  it('accepts a scene duration within +-20% of its voiceover word count', () => {
    const script = baselineScript();
    const scene = script.scenes[2]!;
    const exact = Math.round(words(260).trim().split(/\s+/).length / 2.6);
    scene.durationSeconds = Math.round(exact * 1.15); // inside tolerance
    expect(validateVideoScript(script, expectedStories)).not.toContainEqual(
      expect.objectContaining({ code: 'scene_narration_mismatch' }),
    );
  });

  it('blocks a broll scene with no revisionItemId', () => {
    const script = baselineScript();
    script.scenes[2]!.revisionItemId = null;
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'scene_story_link', blocker: true, field: 'revisionItemId' }),
    );
  });

  it('flags (non-blocking) a non-broll scene carrying a revisionItemId', () => {
    const script = baselineScript();
    script.scenes[0]!.revisionItemId = feature1;
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'scene_story_link', blocker: false, field: 'revisionItemId' }),
    );
  });

  it('flags a template-leak phrase inside a scene voiceover', () => {
    const script = baselineScript();
    script.scenes[2]!.voiceover = "It's worth noting that this changes the story. " + words(255);
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'template_leak:ai_tell_worth_noting', blocker: true, field: 'voiceover' }),
    );
  });

  it('flags a template-leak phrase inside a Short field', () => {
    const script = baselineScript();
    script.shorts[0]!.context = 'Варто зазначити, що це змінює ситуацію.';
    expect(validateVideoScript(script, expectedStories)).toContainEqual(
      expect.objectContaining({ code: 'template_leak:ai_tell_varto_zaznachyty', blocker: true, field: 'context' }),
    );
  });
});

const PASSING_DIMENSIONS: WeeklyQualityDimension[] = [
  'engagement',
  'voice',
  'clarity',
  'trust',
  'usefulness',
  'naturalness',
  'parity',
].map((name) => ({ name: name as WeeklyQualityDimension['name'], score: 90, note: 'fine' }));

function report(overrides: Partial<WeeklyContentQualityReport> = {}): WeeklyContentQualityReport {
  return {
    schemaVersion: 'weekly-quality-v2',
    score: 90,
    dimensions: PASSING_DIMENSIONS,
    issues: [],
    factualFlags: [],
    approvedClaimIds: ['claim-1'],
    checkedAt: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('isRevisableIssueCode', () => {
  it('accepts prose-level codes and their prefixed variants', () => {
    expect(isRevisableIssueCode('generic_practical')).toBe(true);
    expect(isRevisableIssueCode('editors_view_missing')).toBe(true);
    expect(isRevisableIssueCode('discussion_question_missing')).toBe(true);
    expect(isRevisableIssueCode('duplicate_editorial_fields')).toBe(true);
    expect(isRevisableIssueCode('article_length')).toBe(true);
    expect(isRevisableIssueCode('story_length')).toBe(true);
    expect(isRevisableIssueCode('template_leak:label_opener_practical')).toBe(true);
    expect(isRevisableIssueCode('dimension_low_score:voice')).toBe(true);
  });

  it('accepts the critic\'s controlled non-factual vocabulary', () => {
    // Added after a live shadow run (2026-08-06, ai-weekly-2026-07-27)
    // showed the critic otherwise invents ad-hoc codes like
    // "VOICE_TEMPLATE_LEAK" that never match this set.
    for (const code of [
      'voice_register',
      'engagement_structure',
      'clarity_unclear',
      'trust_attribution',
      'usefulness_generic',
      'naturalness_calque',
    ]) {
      expect(isRevisableIssueCode(code), `expected ${code} to be revisable`).toBe(true);
    }
  });

  it('rejects the pre-fix ad-hoc codes the critic actually emitted before the controlled vocabulary existed', () => {
    for (const code of [
      'VOICE_TEMPLATE_LEAK',
      'NATURALNESS_CALQUE',
      'VOICE_ABSTRACT_THESIS',
      'ENGAGEMENT_CHECKLIST_STRUCTURE',
      'CLARITY_UNEXPLAINED_TERM',
    ]) {
      expect(isRevisableIssueCode(code), `expected ${code} to NOT be revisable`).toBe(false);
    }
  });

  it('rejects structural/grounding codes -- these need a full rewrite, not a reword', () => {
    for (const code of [
      'unsupported_claim_id',
      'wrong_story_claim_id',
      'ungrounded_story',
      'story_set_mismatch',
      'story_missing',
      'placement_mismatch',
      'bilingual_claim_parity',
      'top3_radar_structure',
      'shorts_count',
      'shorts_contract',
      'video_duration',
      'scene_grounding',
      'social_angle_grounding',
      'locale_mismatch',
    ]) {
      expect(isRevisableIssueCode(code), `expected ${code} to be non-revisable`).toBe(false);
    }
  });
});

describe('reportIsRevisable', () => {
  it('is revisable when the report has zero issues but a low dimension score (e.g. voice)', () => {
    // The exact bug this exists to fix: a report that fails purely on a
    // dimension score has an empty issues[] array (dimension guidance is
    // derived separately via editorialQualityRetryGuidance), so a naive
    // `issues.length > 0 && issues.every(...)` check would wrongly say
    // "nothing to revise" here.
    expect(reportIsRevisable(report({ issues: [] }))).toBe(true);
  });

  it('is revisable when every issue present is a prose-level code', () => {
    expect(
      reportIsRevisable(
        report({
          issues: [
            { code: 'generic_practical', message: 'x', blocker: true },
            { code: 'template_leak:label_opener_limitation', message: 'x', blocker: true },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('is not revisable when any factual flag is present, regardless of issues', () => {
    expect(reportIsRevisable(report({ factualFlags: ['unsupported number: 141,006'] }))).toBe(false);
  });

  it('is not revisable when a structural/grounding issue is mixed in with prose issues', () => {
    expect(
      reportIsRevisable(
        report({
          issues: [
            { code: 'generic_practical', message: 'x', blocker: true },
            { code: 'unsupported_claim_id', message: 'x', blocker: true },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('is not revisable when the dimension set is malformed (critic misbehaved)', () => {
    expect(
      reportIsRevisable(report({ dimensions: PASSING_DIMENSIONS.slice(0, 5) })),
    ).toBe(false);
  });
});
