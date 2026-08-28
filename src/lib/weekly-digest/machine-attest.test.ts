import { describe, expect, it } from 'vitest';
import {
  canApproveQualityOrArticle,
  canMachineAttest,
  qualityReportForbidsApprove,
  sampleQualityReport,
  socialCopyHasUseBlock,
} from './machine-attest';

describe('machine attest gates', () => {
  it('forbids approving a quality report with language blockers (ai-weekly-2026-08-09)', () => {
    const report = sampleQualityReport([
      {
        code: 'language_mechanics',
        message: 'Malformed Ukrainian.',
        blocker: true,
        locale: 'uk',
        field: 'body',
        span: 'потокенно',
        suggestedFix: 'потоково',
      },
    ]);
    expect(qualityReportForbidsApprove(report)).toBe(true);
    expect(
      canApproveQualityOrArticle({
        artifactType: 'content_quality_report',
        artifactContent: report,
      }).ok,
    ).toBe(false);
    expect(
      canMachineAttest({
        artifactType: 'content_quality_report',
        content: report,
        metadata: { passed: true },
      }),
    ).toBe(false);
  });

  it('attests a passing quality report with zero blockers', () => {
    const report = sampleQualityReport([]);
    expect(
      canMachineAttest({
        artifactType: 'content_quality_report',
        content: report,
        metadata: { passed: true },
      }),
    ).toBe(true);
  });

  it('does not attest a research pack with hallucinated corroboration', () => {
    expect(
      canMachineAttest({
        artifactType: 'research_pack',
        content: {
          risks: ['hallucinated_corroboration'],
          corroboratingSources: [{ url: 'https://huggingface.co/Qwen' }],
        },
      }),
    ).toBe(false);
    expect(
      canMachineAttest({
        artifactType: 'research_pack',
        content: { risks: [], corroboratingSources: [{ url: 'https://huggingface.co/Qwen' }] },
      }),
    ).toBe(true);
  });

  it('requires a practical USE signal before social auto-approve', () => {
    expect(
      socialCopyHasUseBlock('Qwen3.8 shipped with 95B active parameters. Try vLLM this week.'),
    ).toBe(true);
    expect(socialCopyHasUseBlock('A model shipped.')).toBe(false);
  });

  it('does not attest a stat-only post that names no action', () => {
    expect(
      socialCopyHasUseBlock('Qwen3.8 shipped with 95B active parameters, not the 2.4T headline.'),
    ).toBe(false);
  });

  it('keeps every active manual-image QA finding for owner review', () => {
    for (const code of ['missing_mechanism', 'ambiguous_visual_story', 'readable_text']) {
      expect(
        canMachineAttest({
          artifactType: 'story_image',
          metadata: {
            post_upload_qa: { story_checked: true, blockers: [{ code, blocker: true }] },
          },
        }),
      ).toBe(false);
    }
    expect(
      canMachineAttest({
        artifactType: 'story_image',
        metadata: {
          post_upload_qa: { story_checked: true, blockers: [{ code: 'off_news', blocker: false }] },
        },
      }),
    ).toBe(true);
  });

  it('fails closed when a story image did not receive source-story QA', () => {
    expect(
      canMachineAttest({
        artifactType: 'story_image',
        metadata: { post_upload_qa: { story_checked: false, blockers: [] } },
      }),
    ).toBe(false);
    expect(
      canMachineAttest({
        artifactType: 'story_image',
        metadata: { post_upload_qa: { story_checked: true, blockers: [] } },
      }),
    ).toBe(true);
    expect(
      canMachineAttest({
        artifactType: 'cover',
        metadata: { post_upload_qa: { story_checked: false, blockers: [] } },
      }),
    ).toBe(true);
  });

  it('fails closed for a malformed post-upload QA result', () => {
    expect(
      canMachineAttest({
        artifactType: 'cover',
        metadata: { post_upload_qa: { story_checked: true } },
      }),
    ).toBe(false);
  });
});
