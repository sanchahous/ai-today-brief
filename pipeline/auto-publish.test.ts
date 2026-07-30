import { describe, expect, it } from 'vitest';
import { autoReviewComment } from './db';
import {
  buildAutoCardText,
  buildJudgeProfile,
  buildJudgePrompt,
  CALIBRATION_CEILING,
  CALIBRATION_FLOOR,
  calibrateVerdicts,
  computeApproveRate,
  detectHardRuleReject,
  excludeAutoReviewer,
  formatAutoPublishSummary,
  formatStaleDraftsNote,
  autoApprovedBanner,
  autoRejectedBanner,
  isStaleBeforeWindow,
  isWithinAutoPublishWindow,
  parseJudgeVerdicts,
  type JudgeVerdict,
  type ReviewHistoryRow,
} from './auto-publish';

describe('detectHardRuleReject', () => {
  it('triggers on the full autoReviewComment fact-check format', () => {
    const comment = autoReviewComment({
      uk_quality_flags: [],
      unsupported_claims: ['invented price', 'invented date'],
    })!;
    const hard = detectHardRuleReject(comment);
    expect(hard).not.toBeNull();
    expect(hard!.comment).toContain(comment);
    expect(hard!.comment).toContain('авто-відхилено: факт-чек не підтверджено');
  });

  it('triggers when the fact-check note is combined with a language flag', () => {
    const comment = autoReviewComment({
      uk_quality_flags: ['machine-ish phrasing'],
      unsupported_claims: ['invented number'],
    })!;
    expect(detectHardRuleReject(comment)).not.toBeNull();
  });

  it('does not trigger on a language-only auto note', () => {
    const comment = autoReviewComment({ uk_quality_flags: ['machine-ish phrasing'], unsupported_claims: [] });
    expect(detectHardRuleReject(comment)).toBeNull();
  });

  it('does not trigger on a clean item (no auto note)', () => {
    expect(detectHardRuleReject(null)).toBeNull();
  });
});

describe('computeApproveRate', () => {
  it('returns null with zero history (no calibration possible)', () => {
    expect(computeApproveRate([])).toBeNull();
  });

  it('computes the approve fraction', () => {
    const rows = [
      { action: 'approved' as const },
      { action: 'approved' as const },
      { action: 'rejected' as const },
    ];
    expect(computeApproveRate(rows)).toBeCloseTo(2 / 3);
  });
});

describe('excludeAutoReviewer', () => {
  it('drops rows reviewed by a previous auto-publish run', () => {
    const rows = [{ reviewer: 'tg:123' }, { reviewer: 'auto:gemini-3-flash' }, { reviewer: null }];
    expect(excludeAutoReviewer(rows)).toEqual([{ reviewer: 'tg:123' }, { reviewer: null }]);
  });
});

describe('buildJudgeProfile', () => {
  const rows: ReviewHistoryRow[] = [
    { action: 'approved', reviewer: 'tg:1', category_slug: 'tools', title_en: 'A', comment: null },
    { action: 'rejected', reviewer: 'tg:1', category_slug: 'tools', title_en: 'B', comment: 'stale' },
    { action: 'approved', reviewer: 'auto:model', category_slug: 'tools', title_en: 'AUTO', comment: null },
    { action: 'approved', reviewer: 'tg:1', category_slug: 'research', title_en: 'C', comment: null },
  ];

  it('excludes auto: reviewers from the rate and examples', () => {
    const profile = buildJudgeProfile(rows, new Set(['tools']));
    expect(profile.totalDecisions).toBe(3);
    expect(profile.recentApproved.some((e) => e.title === 'AUTO')).toBe(false);
  });

  it('scopes category rates to the batch categories only', () => {
    const profile = buildJudgeProfile(rows, new Set(['tools']));
    const categories = profile.categoryApproveRates.map((c) => c.category);
    expect(categories).toEqual(['tools']);
  });

  it('carries rejection reasons into the rejected examples', () => {
    const profile = buildJudgeProfile(rows, new Set(['tools']));
    expect(profile.recentRejected[0]).toMatchObject({ title: 'B', comment: 'stale' });
  });

  it('caps examples at 40', () => {
    const many: ReviewHistoryRow[] = Array.from({ length: 60 }, (_, i) => ({
      action: 'approved',
      reviewer: 'tg:1',
      category_slug: 'tools',
      title_en: `item-${i}`,
      comment: null,
    }));
    const profile = buildJudgeProfile(many, new Set(['tools']));
    expect(profile.recentApproved).toHaveLength(40);
  });
});

describe('buildJudgePrompt', () => {
  it('surfaces the historical approve rate and rejection reasons', () => {
    const prompt = buildJudgePrompt(
      {
        approveRate: 0.4,
        totalDecisions: 10,
        categoryApproveRates: [],
        recentApproved: [],
        recentRejected: [{ title: 'Rejected story', category: 'tools', comment: 'off-topic' }],
      },
      [{ ref: 0, category: 'tools', title_en: 'Candidate', summary_en: 'summary', why_matters_en: null }],
    );
    expect(prompt).toContain('40%');
    expect(prompt).toContain('off-topic');
    expect(prompt).toContain('Candidate');
  });

  it('surfaces per-category rates and approved examples', () => {
    const prompt = buildJudgePrompt(
      {
        approveRate: 0.5,
        totalDecisions: 10,
        categoryApproveRates: [{ category: 'tools', approved: 3, rejected: 1, rate: 0.75 }],
        recentApproved: [{ title: 'Approved story', category: 'tools' }],
        recentRejected: [],
      },
      [{ ref: 0, category: 'tools', title_en: 'Candidate', summary_en: 'summary', why_matters_en: 'why' }],
    );
    expect(prompt).toContain('tools: 75%');
    expect(prompt).toContain('Approved story');
  });

  it('tells the judge to use its own judgement with no history', () => {
    const prompt = buildJudgePrompt(
      { approveRate: null, totalDecisions: 0, categoryApproveRates: [], recentApproved: [], recentRejected: [] },
      [{ ref: 0, category: null, title_en: 'X', summary_en: 'Y', why_matters_en: null }],
    );
    expect(prompt).toContain('No review history yet');
  });
});

describe('parseJudgeVerdicts', () => {
  it('parses a well-formed response', () => {
    const text = JSON.stringify({
      results: [{ ref: 0, verdict: 'approve', confidence: 0.9, reason: 'strong story' }],
    });
    const out = parseJudgeVerdicts(text, new Set([0]));
    expect(out).toEqual([{ ref: 0, verdict: 'approve', confidence: 0.9, reason: 'strong story' }]);
  });

  it('drops refs outside the valid set', () => {
    const text = JSON.stringify({ results: [{ ref: 5, verdict: 'approve', confidence: 0.9, reason: '' }] });
    expect(parseJudgeVerdicts(text, new Set([0]))).toEqual([]);
  });

  it('drops entries with an invalid verdict', () => {
    const text = JSON.stringify({ results: [{ ref: 0, verdict: 'maybe', confidence: 0.9, reason: '' }] });
    expect(parseJudgeVerdicts(text, new Set([0]))).toEqual([]);
  });

  it('throws on malformed JSON — callers treat this as total judge failure', () => {
    expect(() => parseJudgeVerdicts('not json', new Set([0]))).toThrow();
  });
});

function verdict(ref: number, verdictValue: 'approve' | 'reject', confidence: number): JudgeVerdict {
  return { ref, verdict: verdictValue, confidence, reason: '' };
}

describe('calibrateVerdicts', () => {
  it('passes verdicts through unchanged with no history (approveRate null)', () => {
    const verdicts = [verdict(0, 'approve', 0.6), verdict(1, 'reject', 0.9)];
    const out = calibrateVerdicts(verdicts, null);
    expect(out.find((v) => v.ref === 0)!.approve).toBe(true);
    expect(out.find((v) => v.ref === 1)!.approve).toBe(false);
  });

  it('keeps only the top-k by score for the historical approve rate', () => {
    // p = 0.5 over 4 items ⇒ k = 2; the two highest-scoring should be approved.
    const verdicts = [
      verdict(0, 'approve', 0.95),
      verdict(1, 'approve', 0.55),
      verdict(2, 'reject', 0.6), // score = 0.4
      verdict(3, 'reject', 0.9), // score = 0.1
    ];
    const out = calibrateVerdicts(verdicts, 0.5);
    const approvedRefs = out.filter((v) => v.approve).map((v) => v.ref);
    expect(approvedRefs.sort()).toEqual([0, 1]);
  });

  it('CEILING forces approval beyond the quota', () => {
    const verdicts = [verdict(0, 'approve', 0.99), verdict(1, 'approve', 0.9), verdict(2, 'approve', 0.1)];
    // p = 0 ⇒ k = 0, but two items score above CALIBRATION_CEILING and must still be approved.
    const out = calibrateVerdicts(verdicts, 0);
    expect(out.find((v) => v.ref === 0)!.approve).toBe(true);
    expect(out.find((v) => v.ref === 1)!.approve).toBe(true);
    expect(out.find((v) => v.ref === 2)!.approve).toBe(false);
  });

  it('FLOOR forces rejection even inside the quota', () => {
    const verdicts = [verdict(0, 'approve', CALIBRATION_FLOOR - 0.01), verdict(1, 'reject', 0.99)];
    // p = 1 ⇒ k = 2 (both would be approved by quota alone), but ref 0 scores below FLOOR.
    const out = calibrateVerdicts(verdicts, 1);
    expect(out.find((v) => v.ref === 0)!.approve).toBe(false);
  });

  it('handles N=1', () => {
    const out = calibrateVerdicts([verdict(0, 'approve', 0.6)], 1);
    expect(out).toHaveLength(1);
    expect(out[0]!.approve).toBe(true);
  });

  it('handles k=0 with no items above the ceiling', () => {
    const verdicts = [verdict(0, 'approve', 0.5), verdict(1, 'reject', 0.5)];
    const out = calibrateVerdicts(verdicts, 0);
    expect(out.every((v) => !v.approve)).toBe(true);
  });

  it('handles every item scoring above the ceiling', () => {
    const verdicts = [verdict(0, 'approve', 0.9), verdict(1, 'approve', 0.95)];
    const out = calibrateVerdicts(verdicts, 0.01);
    expect(out.every((v) => v.approve)).toBe(true);
  });

  it('sanity: CEILING is above FLOOR (no contradictory overrides)', () => {
    expect(CALIBRATION_CEILING).toBeGreaterThan(CALIBRATION_FLOOR);
  });
});

describe('isWithinAutoPublishWindow', () => {
  const today = '2026-07-30';

  it('includes yesterday', () => {
    expect(isWithinAutoPublishWindow('2026-07-29', today, 7)).toBe(true);
  });

  it('includes exactly 6 days ago', () => {
    expect(isWithinAutoPublishWindow('2026-07-24', today, 7)).toBe(true);
  });

  it('excludes 8 days ago', () => {
    expect(isWithinAutoPublishWindow('2026-07-22', today, 7)).toBe(false);
  });

  it('excludes today', () => {
    expect(isWithinAutoPublishWindow(today, today, 7)).toBe(false);
  });
});

describe('isStaleBeforeWindow', () => {
  const today = '2026-07-30';

  it('flags a draft older than the window as stale', () => {
    expect(isStaleBeforeWindow('2026-07-22', today, 7)).toBe(true);
  });

  it('does not flag a draft inside the window as stale', () => {
    expect(isStaleBeforeWindow('2026-07-24', today, 7)).toBe(false);
  });
});

describe('buildAutoCardText — mirrors src/app/api/telegram/route.ts buildCardText', () => {
  it('prefers Ukrainian title/summary and includes the why line', () => {
    const text = buildAutoCardText({
      title_en: 'EN title',
      title_uk: 'UK title',
      summary_en: 'EN summary',
      summary_uk: 'UK summary',
      why_matters_en: 'EN why',
      why_matters_uk: 'UK why',
      category_slug: 'tools',
    });
    expect(text).toContain('UK title');
    expect(text).toContain('EN title');
    expect(text).toContain('UK summary');
    expect(text).toContain('UK why');
  });

  it('falls back to English when Ukrainian fields are missing', () => {
    const text = buildAutoCardText({
      title_en: 'EN title',
      title_uk: null,
      summary_en: 'EN summary',
      summary_uk: null,
      why_matters_en: null,
      why_matters_uk: null,
      category_slug: null,
    });
    expect(text).toContain('EN title');
    expect(text).toContain('uncategorized');
  });
});

describe('banners', () => {
  it('are visually distinct from the human approve/reject banners', () => {
    expect(autoApprovedBanner()).toContain('АВТО-СХВАЛЕНО');
    expect(autoRejectedBanner('reason')).toContain('АВТО-ВІДХИЛЕНО');
    expect(autoRejectedBanner('a reason')).toContain('a reason');
  });
});

describe('formatAutoPublishSummary', () => {
  it('renders approved/rejected counts and a read link', () => {
    const text = formatAutoPublishSummary({
      title: 'Daily brief',
      edition: 1,
      approved: 3,
      rejected: 1,
      hardRejected: 0,
      readUrl: 'https://aitodaybrief.com/uk/some-brief',
    });
    expect(text).toContain('Схвалено: <b>3</b>');
    expect(text).toContain('Відхилено: <b>1</b>');
    expect(text).toContain('https://aitodaybrief.com/uk/some-brief');
  });

  it('notes the hard-rule count', () => {
    const text = formatAutoPublishSummary({
      title: 'Daily brief',
      edition: 1,
      approved: 1,
      rejected: 2,
      hardRejected: 2,
    });
    expect(text).toContain('жорстким правилом факт-чеку');
  });

  it('warns when the judge was unavailable', () => {
    const text = formatAutoPublishSummary({
      title: 'Daily brief',
      edition: 1,
      approved: 1,
      rejected: 0,
      hardRejected: 0,
      judgeUnavailable: true,
    });
    expect(text).toContain('Суддя недоступний');
  });

  it('warns when nothing was approved', () => {
    const text = formatAutoPublishSummary({
      title: 'Daily brief',
      edition: 2,
      approved: 0,
      rejected: 3,
      hardRejected: 0,
      nothingApproved: true,
    });
    expect(text).toContain('лишається чернеткою');
    expect(text).toContain('пак 2');
  });
});

describe('formatStaleDraftsNote', () => {
  it('mentions the count', () => {
    expect(formatStaleDraftsNote(3)).toContain('3 застарілих');
  });
});
