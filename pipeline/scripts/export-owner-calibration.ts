/**
 * Rolls owner_feedback (per-concept used / used_with_edits / rejected
 * verdicts, recorded from Visuals via saveWeeklyOwnerFeedbackAction) across
 * every `story_prompt_set` artifact into one calibration dataset file,
 * matching the `experiments/critic-ground-truth/` convention (E1 / R4.4 /
 * F22). Before this, verdicts only ever accumulated one JSONB blob per
 * artifact -- there was no path that rolled them up for training/reviewing
 * the router or the critic against, the exact gap E1's own "Навіщо" section
 * names.
 *
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/export-owner-calibration.ts [--out path]
 *
 * Pure transform lives in ../owner-calibration.ts (tested); this file does
 * IO only, same split as rerank-openrouter-models.ts / model-rerank.ts.
 */

/* v8 ignore start -- network IO + filesystem write */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadPipelineConfig } from '../config';
import { createServiceClient, type PipelineDb } from '../db';
import { logEvent } from '../log';
import {
  outPathFromArgs,
  rowsFromArtifacts,
  type OwnerCalibrationArtifactRow,
} from '../owner-calibration';

async function loadArtifactRows(db: PipelineDb): Promise<OwnerCalibrationArtifactRow[]> {
  const { data, error } = await db
    .from('weekly_digest_artifacts')
    .select('weekly_digest_id, revision_id, revision_item_id, slot_key, content')
    .eq('artifact_type', 'story_prompt_set');
  if (error) throw new Error(`[export-owner-calibration] load artifacts failed: ${error.message}`);
  return data ?? [];
}

async function main(): Promise<void> {
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const artifacts = await loadArtifactRows(db);
  const rows = rowsFromArtifacts(artifacts);
  const outPath = outPathFromArgs(process.argv.slice(2));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: 'story_prompt_set.content.owner_feedback, rolled up by pipeline/scripts/export-owner-calibration.ts',
        count: rows.length,
        rows,
      },
      null,
      2,
    ),
  );
  logEvent('info', 'publish', 'Owner calibration export written', { count: rows.length, out: outPath });
}

main().catch((error) => {
  logEvent('error', 'publish', 'Owner calibration export failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
/* v8 ignore end */
