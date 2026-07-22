/** Monday monitor: fail when the latest completed weekly digest is not public. */

import { createServiceClient } from '../db';
import { logError, logEvent } from '../log';
import { assessWeeklyDigestHealth, completedWeekForDate } from '../weekly-health';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function kyivDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function anchorDate(): string {
  const value = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length);
  return value || kyivDate();
}

async function main(): Promise<void> {
  const { weekStart, weekEnd } = completedWeekForDate(anchorDate());
  const db = createServiceClient(
    requiredEnv('SCRAPPER_BASE_URL'),
    process.env.SCRAPPER_SERVICE_KEY?.trim() || requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
  const { data, error } = await db
    .from('weekly_digests')
    .select('week_start,status,published_at')
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw new Error(`Weekly digest health query failed: ${error.message}`);

  const result = assessWeeklyDigestHealth(weekStart, data);
  logEvent(result.health === 'healthy' ? 'info' : 'error', 'publish', result.message, {
    health: result.health,
    week_start: weekStart,
    week_end: weekEnd,
  });
  if (result.health !== 'healthy') process.exitCode = 1;
}

main().catch((error) => {
  logError('publish', 'Weekly digest health check failed', error);
  process.exit(1);
});
