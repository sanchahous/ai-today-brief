import type { WeeklyContentQualityReport, WeeklyQualityIssue } from './content-studio';

export const MACHINE_ATTEST_ARTIFACT_TYPES = [
  'research_pack',
  'content_quality_report',
  'article',
  'pdf',
  'video_script',
  'video_manifest',
  'story_prompt_set',
  'story_image',
  'cover',
] as const;

export type MachineAttestArtifactType = (typeof MACHINE_ATTEST_ARTIFACT_TYPES)[number];

const DIGNITY_OR_MISLEADING_QA = new Set([
  'human_dignity_risk',
  'brand_unsafe',
  'off_news',
  'wrong_subject',
  'false_thesis',
]);

export function qualityReportBlockingIssues(content: unknown): WeeklyQualityIssue[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return [];
  const issues = (content as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter((entry): entry is WeeklyQualityIssue => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return (entry as WeeklyQualityIssue).blocker === true;
  });
}

export function qualityReportForbidsApprove(content: unknown): boolean {
  return qualityReportBlockingIssues(content).length > 0;
}

function metadataFlag(metadata: unknown, key: string): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[key] === true;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

/** Invented corroboration (non-URL "sources" or an explicit risk flag). */
export function researchPackHasHallucinatedCorroboration(content: unknown): boolean {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const row = content as Record<string, unknown>;
  if (stringList(row.risks).some((flag) => /hallucin/i.test(flag))) return true;
  const sources = Array.isArray(row.corroboratingSources) ? row.corroboratingSources : [];
  return sources.some((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const url = (entry as { url?: unknown }).url;
    return typeof url === 'string' && url.trim().length > 0 && !/^https?:\/\//i.test(url.trim());
  });
}

function postUploadQaForbidsImageAttest(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return true;
  const qa = (metadata as Record<string, unknown>).post_upload_qa;
  if (!qa || typeof qa !== 'object' || Array.isArray(qa)) return true;
  const row = qa as { pending?: unknown; error?: unknown; blockers?: unknown };
  if (row.pending === true) return true;
  if (typeof row.error === 'string' && row.error.trim()) return true;
  if (!Array.isArray(row.blockers)) return false;
  return row.blockers.some((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const blocker = entry as { code?: unknown; blocker?: unknown };
    if (blocker.blocker === false) return false;
    return typeof blocker.code === 'string' && DIGNITY_OR_MISLEADING_QA.has(blocker.code);
  });
}

export function socialCopyHasUseBlock(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 40) return false;
  return (
    /\b(?:try|use|run|set|enable|install|check|measure|pilot|deploy)\b/i.test(trimmed) ||
    /(?:спроб|запуст|увімкн|перевір|постав|вимір|пілот)/iu.test(trimmed) ||
    /\d/.test(trimmed)
  );
}

export function canMachineAttest(input: {
  artifactType: string;
  content?: unknown;
  metadata?: unknown;
}): boolean {
  if (!(MACHINE_ATTEST_ARTIFACT_TYPES as readonly string[]).includes(input.artifactType)) {
    return false;
  }
  if (input.artifactType === 'research_pack') {
    return !researchPackHasHallucinatedCorroboration(input.content);
  }
  if (input.artifactType === 'content_quality_report') {
    if (qualityReportForbidsApprove(input.content)) return false;
    return metadataFlag(input.metadata, 'passed');
  }
  if (input.artifactType === 'story_image' || input.artifactType === 'cover') {
    return !postUploadQaForbidsImageAttest(input.metadata);
  }
  return true;
}

export function canApproveQualityOrArticle(input: {
  artifactType: string;
  artifactContent?: unknown;
  qualityReportContent?: unknown;
}): { ok: true } | { ok: false; reason: string } {
  if (input.artifactType === 'content_quality_report') {
    const blockers = qualityReportBlockingIssues(input.artifactContent);
    if (blockers.length > 0) {
      return {
        ok: false,
        reason: `Cannot approve a quality report while ${blockers.length} blocking issue(s) remain.`,
      };
    }
    return { ok: true };
  }
  if (input.artifactType === 'article') {
    const blockers = qualityReportBlockingIssues(input.qualityReportContent);
    if (blockers.length > 0) {
      return {
        ok: false,
        reason: `Cannot approve an article while the quality report still has ${blockers.length} blocking issue(s).`,
      };
    }
    return { ok: true };
  }
  return { ok: true };
}

export function isRetryableGenerationFailure(code: string, message: string): boolean {
  const normalized = message.toLowerCase();
  if (code === 'provider_exhausted' || code === 'network' || code === 'timeout' || code === 'resumable') {
    return true;
  }
  if (code === 'rate_limit') return true;
  if (
    /reading ['"]map['"]/.test(normalized) ||
    /cannot read propert/.test(normalized) ||
    /\b503\b/.test(normalized) ||
    /github.?dispatch/.test(normalized)
  ) {
    return true;
  }
  return false;
}

/** Shape used by the critic JSON so tests can assert the production fail mode. */
export function sampleQualityReport(issues: WeeklyQualityIssue[]): WeeklyContentQualityReport {
  return {
    schemaVersion: 'weekly-quality-v2',
    score: 82,
    dimensions: [],
    issues,
    factualFlags: [],
    approvedClaimIds: [],
    checkedAt: '2026-08-20T09:37:00.000Z',
  };
}
