/**
 * Roll item_events up into item_metrics (migration 036). Calls the
 * refresh_item_metrics() SQL function via the service client. Idempotent —
 * recomputes the whole rollup each run. Wired as a step in
 * .github/workflows/pipeline.yml (reuses the daily run; no separate cron).
 *
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/refresh-item-metrics.ts
 */
/* v8 ignore start -- network IO + DB writes */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { logError, logEvent } from '../log';

async function main(): Promise<void> {
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  // refresh_item_metrics is not in the generated pipeline Database type — loose-cast the rpc.
  const loose = db as unknown as {
    rpc: (fn: string) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await loose.rpc('refresh_item_metrics');
  if (error) {
    logError('rollup', 'refresh_item_metrics failed', error);
    process.exit(1);
  }
  logEvent('info', 'rollup', 'item_metrics refreshed', {});
}

main().catch((e) => {
  logError('rollup', 'refresh-item-metrics crashed', e);
  process.exit(1);
});
/* v8 ignore end */
