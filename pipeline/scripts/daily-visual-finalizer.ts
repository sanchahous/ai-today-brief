/**
 * Finalize the previous Kyiv editorial day into one daily visual candidate set.
 *
 * Usage:
 *   node --conditions=react-server --import tsx pipeline/scripts/daily-visual-finalizer.ts
 *   node --conditions=react-server --import tsx pipeline/scripts/daily-visual-finalizer.ts --date 2026-08-24
 */
import { loadPipelineConfig } from '../config';
import { createServiceClient } from '../db';
import { finalizeDailyVisual } from '../daily-visual-finalizer';
import { logError, logEvent } from '../log';
import { getPipelineDateKyiv } from '../schedule';

function previousCalendarDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function parseDate(argv: string[]): string {
  const index = argv.indexOf('--date');
  const value = index >= 0 ? argv[index + 1]?.trim() : undefined;
  const date = value || previousCalendarDate(getPipelineDateKyiv());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('--date must use YYYY-MM-DD.');
  }
  return date;
}

async function main(): Promise<void> {
  const editorialDate = parseDate(process.argv);
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const result = await finalizeDailyVisual(db, editorialDate);
  logEvent('info', 'daily-visual', 'Daily visual finalizer completed', {
    editorial_date: result.editorialDate,
    status: result.status,
    daily_visual_set_id: result.visualSetId,
    candidate_id: result.activeCandidateId,
    reason: result.reason,
  });
  if (result.status === 'failed') process.exitCode = 1;
}

main().catch((error) => {
  logError('daily-visual', 'Daily visual finalizer crashed', error);
  process.exit(1);
});
