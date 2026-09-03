import { describe, expect, it } from 'vitest';
import type { QualityReport, SocialDraft } from './types';
import { findBlindCrossPosts, mergePreservedQualityProvenance, runQualityGate, socialApprovalBlockers } from './quality';

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
    const reply = 'Read: https://aitodaybrief.com/en/weekly/example?s=token';
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

  it('preserves writer / hook / platform-fit provenance across quality re-runs', () => {
    const next: QualityReport = {
      blocking: [],
      warnings: [],
      checkedAt: '2026-08-04T12:00:00.000Z',
      critic: {
        score: 92,
        flags: [],
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        auditedAt: '2026-08-04T12:00:00.000Z',
      },
    };
    const previous = {
      writer: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', fallbackUsed: false },
      platformFitScore: 91,
      hookAngle: 'risk-of-agent-misconfig',
      hookCandidates: ['A', 'B'],
    };
    const merged = mergePreservedQualityProvenance(next, previous);
    expect(merged.writer?.model).toBe('anthropic/claude-sonnet-4');
    expect(merged.platformFitScore).toBe(91);
    expect(merged.hookAngle).toBe('risk-of-agent-misconfig');
    expect(merged.hookCandidates).toEqual(['A', 'B']);
    expect(merged.critic?.score).toBe(92);
  });

  it('blocks missing MIME, missing dimensions, and stale private URLs', () => {
    const missingMime = runQualityGate(
      draft({
        channel: 'telegram',
        assets: [{ url: 'https://cdn.example/cover.jpg', width: 1200, height: 630 }],
        altText: 'Weekly cover',
      }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(missingMime.blocking.map((issue) => issue.code)).toContain('asset_format');

    const missingDims = runQualityGate(
      draft({
        channel: 'telegram',
        assets: [{ url: 'https://cdn.example/cover.jpg', mimeType: 'image/jpeg' }],
        altText: 'Weekly cover',
      }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(missingDims.blocking.map((issue) => issue.code)).toContain('asset_dimensions');

    const stalePdf = runQualityGate(
      draft({
        channel: 'linkedin',
        text: `${'A practical LinkedIn update for builders. '.repeat(10)} https://aitodaybrief.com/en/weekly/example?s=token`,
        assets: [
          {
            url: 'https://example.supabase.co/storage/v1/object/sign/weekly-digest-private/doc.pdf?token=x',
            width: 1200,
            height: 630,
            // Production JSONB stored application/pdf until repair; the gate must reject it.
            mimeType: 'application/pdf',
          } as unknown as SocialDraft['assets'][number],
        ],
        altText: 'LinkedIn document',
      }),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(stalePdf.blocking.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['asset_format', 'asset_stale_url']),
    );
  });

  it('blocks approval below critic 85 without blocking a warning-only save', () => {
    const report: QualityReport = {
      blocking: [],
      warnings: [{ code: 'linkedin_short', message: 'short' }],
      checkedAt: '2026-08-18T00:00:00.000Z',
      critic: {
        score: 80,
        flags: ['Unsupported compression'],
        provider: 'gemini',
        model: 'flash',
        auditedAt: '2026-08-18T00:00:00.000Z',
      },
    };
    expect(report.blocking).toEqual([]);
    expect(socialApprovalBlockers(report, { criticRequired: true }).map((issue) => issue.code)).toContain(
      'critic_score',
    );
    expect(
      socialApprovalBlockers(
        { blocking: [], warnings: [], checkedAt: report.checkedAt },
        { criticRequired: true },
      ).map((issue) => issue.code),
    ).toContain('critic_required');
  });
});
