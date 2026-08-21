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
    expect(socialCopyHasUseBlock('Qwen3.8 shipped with 95B active parameters. Try vLLM this week.')).toBe(
      true,
    );
    expect(socialCopyHasUseBlock('A model shipped.')).toBe(false);
  });
});
