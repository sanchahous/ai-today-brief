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
  kind: 'upload';
  label: string;
  /** Preflight slot key, so a board row and a preflight blocker are the same object. */
  slotKey?: string;
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

/**
 * Mirrors the required-slot table in `weekly_digest_preflight` (SQL). The
 * board and the preflight must agree on what "ready to ship" means — a board
 * that is greener than the RPC just moves the surprise into the Ship click.
 *
 * Video (video_final/captions/thumbnail) is deliberately absent: it ships
 * separately via `publish_weekly_digest_video` after Ship, not as part of
 * this board. See wiki/pipeline/weekly-digest.md — two-phase release.
 */
const REQUIRED_SLOTS: Array<{
  artifactType: string;
  locale: string;
  label: string;
  /** Preflight slot_key prefix ("video-final", not the artifact_type spelling). */
  slotPrefix: string;
}> = [
  { artifactType: 'article', locale: 'en', label: 'EN article', slotPrefix: 'article' },
  { artifactType: 'article', locale: 'uk', label: 'UK article', slotPrefix: 'article' },
  { artifactType: 'pdf', locale: 'en', label: 'EN PDF', slotPrefix: 'pdf' },
  { artifactType: 'pdf', locale: 'uk', label: 'UK PDF', slotPrefix: 'pdf' },
  { artifactType: 'cover', locale: 'neutral', label: 'Cover image upload', slotPrefix: 'cover' },
];

/**
 * Same contract as the SQL preflight: ready + approved for every required
 * slot. Anything missing lands in waitingOnOwner with the matching preflight
 * slot key.
 */
function requiredSlotGaps(
  artifacts: Array<{
    artifact_type: string;
    locale: string | null;
    is_current: boolean;
    review_status: string | null;
    generation_status: string | null;
    storage_path: string | null;
    external_url: string | null;
    provider_id?: string | null;
  }>,
): OwnerWaitItem[] {
  const gaps: OwnerWaitItem[] = [];
  for (const slot of REQUIRED_SLOTS) {
    const found = artifacts.find(
      (artifact) =>
        artifact.artifact_type === slot.artifactType &&
        artifact.locale === slot.locale &&
        artifact.is_current,
    );
    if (!found) {
      gaps.push({
        kind: 'upload',
        label: `${slot.label} is missing`,
        slotKey: `${slot.slotPrefix}:${slot.locale}`,
      });
      continue;
    }
    if (found.generation_status !== 'ready' || found.review_status !== 'approved') {
      gaps.push({
        kind: 'upload',
        label: `${slot.label} is not ready and approved`,
        slotKey: `${slot.slotPrefix}:${slot.locale}`,
      });
    }
  }
  return gaps;
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
    provider_id?: string | null;
  }>;
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
      const locale = str(claim.locale);
      claims.push({
        claimId: id,
        text,
        locale: locale === 'uk' ? 'uk' : 'en',
        storyHeadline:
          (locale === 'uk' ? item?.title_uk : item?.title_en) ?? item?.title_en ?? id,
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

  // Story images: one approved illustration per revision item, same rule the
  // SQL preflight enforces (`story_image_not_approved`).
  const waitingOnOwner: OwnerWaitItem[] = [];
  for (const item of input.items) {
    const image = current.find(
      (artifact) =>
        artifact.artifact_type === 'story_image' && artifact.revision_item_id === item.id,
    );
    if (
      image &&
      image.generation_status === 'ready' &&
      image.review_status === 'approved'
    ) {
      continue;
    }
    waitingOnOwner.push({
      kind: 'upload',
      label: `Story ${item.rank} image upload`,
      slotKey: `story:${item.id}:image`,
    });
  }

  // Required slots, evaluated with the same conditions the preflight RPC
  // applies before it lets ship_weekly_digest succeed.
  waitingOnOwner.push(...requiredSlotGaps(current));

  return {
    claims,
    languageFixes,
    unresolvedBlockers,
    numericParityIssues,
    waitingOnOwner,
    canShip: unresolvedBlockers.length === 0 && waitingOnOwner.length === 0,
  };
}
