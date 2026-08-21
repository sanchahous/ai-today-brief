import type { WeeklyQualityIssue } from './content-studio';
import { qualityReportBlockingIssues } from './machine-attest';

export interface HallucinationClaimRow {
  claimId: string;
  text: string;
  locale: 'en' | 'uk';
  storyHeadline: string;
  sourceUrls: string[];
}

export interface AppliedLanguageFix {
  locale: 'en' | 'uk';
  span: string;
  replacement: string;
  field?: string;
}

export interface OwnerWaitItem {
  kind: 'upload' | 'youtube';
  label: string;
}

export interface HallucinationBoardModel {
  claims: HallucinationClaimRow[];
  languageFixes: AppliedLanguageFix[];
  unresolvedBlockers: WeeklyQualityIssue[];
  numericParityIssues: WeeklyQualityIssue[];
  waitingOnOwner: OwnerWaitItem[];
  canShip: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

export function buildHallucinationBoard(input: {
  items: Array<{
    id: string;
    rank: number;
    title_en: string;
    title_uk: string;
  }>;
  artifacts: Array<{
    artifact_type: string;
    locale: string | null;
    is_current: boolean;
    review_status: string | null;
    generation_status: string | null;
    storage_path: string | null;
    external_url: string | null;
    content: unknown;
    metadata: unknown;
    revision_item_id: string | null;
  }>;
  videoYoutubeId?: string | null;
}): HallucinationBoardModel {
  const current = input.artifacts.filter((artifact) => artifact.is_current);
  const researchPacks = current.filter((artifact) => artifact.artifact_type === 'research_pack');
  const quality = current.find((artifact) => artifact.artifact_type === 'content_quality_report');
  const claims: HallucinationClaimRow[] = [];
  for (const pack of researchPacks) {
    const content = asRecord(pack.content);
    const packClaims = Array.isArray(content.claims) ? content.claims : [];
    const item = input.items.find((row) => row.id === pack.revision_item_id);
    for (const entry of packClaims) {
      const claim = asRecord(entry);
      const id = str(claim.id);
      const text = str(claim.text);
      if (!id || !text) continue;
      claims.push({
        claimId: id,
        text,
        locale: 'en',
        storyHeadline: item?.title_en ?? id,
        sourceUrls: stringArray(claim.evidenceUrls),
      });
    }
  }
  const languageFixes: AppliedLanguageFix[] = [];
  const qualityMeta = asRecord(quality?.metadata);
  const rawFixes = qualityMeta.language_fixes;
  if (Array.isArray(rawFixes)) {
    for (const entry of rawFixes) {
      const row = asRecord(entry);
      const locale = str(row.locale);
      const span = str(row.span);
      const replacement = str(row.replacement);
      if ((locale === 'en' || locale === 'uk') && span && replacement) {
        languageFixes.push({
          locale,
          span,
          replacement,
          ...(str(row.field) ? { field: str(row.field) } : {}),
        });
      }
    }
  }
  const unresolvedBlockers = qualityReportBlockingIssues(quality?.content);
  const numericParityIssues = unresolvedBlockers.filter((issue) => issue.code === 'numeric_parity');
  const waitingOnOwner: OwnerWaitItem[] = [];
  const images = current.filter(
    (artifact) => artifact.artifact_type === 'story_image' || artifact.artifact_type === 'cover',
  );
  for (const image of images) {
    if (image.storage_path || image.external_url) continue;
    const item = input.items.find((row) => row.id === image.revision_item_id);
    waitingOnOwner.push({
      kind: 'upload',
      label:
        image.artifact_type === 'cover'
          ? 'Cover image upload'
          : `Story ${item?.rank ?? '?'} image upload`,
    });
  }
  if (!input.videoYoutubeId) {
    waitingOnOwner.push({ kind: 'youtube', label: 'Paste weekly-video-result-v2 YouTube id' });
  }
  return {
    claims,
    languageFixes,
    unresolvedBlockers,
    numericParityIssues,
    waitingOnOwner,
    canShip: unresolvedBlockers.length === 0,
  };
}
