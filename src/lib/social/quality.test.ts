import { describe, expect, it } from 'vitest';
import type { SocialDraft } from './types';
import { findBlindCrossPosts, runQualityGate } from './quality';

function draft(overrides: Partial<SocialDraft> = {}): SocialDraft {
  return {
    channel: 'threads',
    locale: 'en',
    format: 'conversation',
    text: 'A practical AI engineering update with enough context for builders. Why does this matter for your production workflow today?',
    assets: [],
    scheduledFor: '2027-01-01T10:00:00.000Z',
    sourceApproved: true,
    sourceFacts: ['The approved source contains this exact engineering update.'],
    sourceUrl: 'https://aitodaybrief.com/en/story',
    ...overrides,
  };
}

describe('social quality gate', () => {
  it('blocks an X URL in the root and a missing self-reply', () => {
    const report = runQualityGate(
      draft({
        channel: 'x',
        text: 'This approved AI update changes production workflows: https://example.com',
      }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['root_url', 'x_reply_url']),
    );
  });

  it('allows the X tracking URL in the structured self-reply only', () => {
    const root = 'One grounded thesis with a strong approved fact for AI builders and leaders.';
    const reply = 'Read: https://aitodaybrief.com/r/s/token';
    const report = runQualityGate(
      draft({ channel: 'x', text: root, firstComment: reply, contentParts: [root, reply] }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).not.toContain('root_url');
    expect(report.blocking.map((issue) => issue.code)).not.toContain('x_reply_url');
  });

  it('blocks artificial truncation and invalid native part counts', () => {
    const report = runQualityGate(
      draft({ text: 'A supposedly interesting update…', contentParts: ['One', 'Two'] }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['artificial_ellipsis', 'threads_parts']),
    );
  });

  it('also blocks three-dot truncation', () => {
    const report = runQualityGate(
      draft({ text: 'A supposedly interesting update...', contentParts: ['One', 'Two', 'Three'] }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toContain('artificial_ellipsis');
  });

  it('blocks Instagram without a 4:5 asset and alt text', () => {
    const report = runQualityGate(
      draft({ channel: 'instagram', text: 'A useful AI engineering update. '.repeat(8) }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toContain('asset_required');
  });

  it('blocks a revoked source', () => {
    const report = runQualityGate(
      draft({ sourceApproved: false }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toContain('source_not_approved');
  });

  it('blocks invisible and bidirectional override characters', () => {
    const report = runQualityGate(
      draft({ text: `A practical AI engineering update\u202e with enough context for builders.` }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(report.blocking.map((issue) => issue.code)).toContain('forbidden_characters');
  });

  it('detects blind cross-posting after URL removal', () => {
    const copy =
      'The same platform-agnostic copy has been pasted here with enough detail for the audience.';
    const matches = findBlindCrossPosts([
      draft({ channel: 'threads', text: `${copy} https://one.example` }),
      draft({ channel: 'facebook', locale: 'en', text: `${copy} https://two.example` }),
    ]);
    expect(matches.get('threads')?.[0].code).toBe('blind_cross_post');
    expect(matches.get('facebook')?.[0].code).toBe('blind_cross_post');
  });
});
