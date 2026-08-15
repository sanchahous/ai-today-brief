/**
 * Pure transform: story_prompt_set artifacts -> flat owner-calibration rows.
 * IO (Supabase read, file write) lives in scripts/export-owner-calibration.ts
 * only -- kept separate so this stays directly testable (R4.4 / F22).
 */
import {
  ownerCalibrationRecords,
  ownerFeedbackFromPromptSet,
  type OwnerCalibrationRecord,
} from '../src/lib/weekly-digest/owner-feedback';

export const DEFAULT_OUT_PATH = 'experiments/critic-ground-truth/owner-prompt-calibration.json';

export interface OwnerCalibrationArtifactRow {
  weekly_digest_id: string;
  revision_id: string;
  revision_item_id: string | null;
  slot_key: string;
  content: unknown;
}

export interface OwnerCalibrationRow extends OwnerCalibrationRecord {
  weeklyDigestId: string;
  revisionId: string;
  revisionItemId: string | null;
  slotKey: string;
}

/** Every artifact's owner_feedback map -> flat calibration rows. */
export function rowsFromArtifacts(
  artifacts: readonly OwnerCalibrationArtifactRow[],
): OwnerCalibrationRow[] {
  const rows: OwnerCalibrationRow[] = [];
  for (const artifact of artifacts) {
    const feedback = ownerFeedbackFromPromptSet(artifact.content);
    for (const record of ownerCalibrationRecords(feedback)) {
      rows.push({
        weeklyDigestId: artifact.weekly_digest_id,
        revisionId: artifact.revision_id,
        revisionItemId: artifact.revision_item_id,
        slotKey: artifact.slot_key,
        ...record,
      });
    }
  }
  return rows;
}

export function outPathFromArgs(argv: readonly string[]): string {
  const flagIndex = argv.indexOf('--out');
  const explicit = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
  return explicit?.trim() || DEFAULT_OUT_PATH;
}
