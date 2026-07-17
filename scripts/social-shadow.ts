/**
 * Generate review-only packages from recent approved briefs. The migration's
 * global kill switch defaults to ON, so this command cannot publish anything.
 *
 * Usage: npm run social:shadow -- --days 20
 */
import { composeDailySocial, composeWeeklySocial } from '../src/lib/social/composer';

function daysArgument() {
  const index = process.argv.indexOf('--days');
  const value = index >= 0 ? Number.parseInt(process.argv[index + 1] ?? '', 10) : 20;
  return Number.isFinite(value) ? Math.max(1, Math.min(value, 60)) : 20;
}

function dateAtOffset(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const days = daysArgument();
  const results = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = dateAtOffset(offset);
    const daily = await composeDailySocial(date);
    const weekly =
      new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? await composeWeeklySocial(date) : null;
    results.push({ date, daily, weekly });
  }
  console.log(JSON.stringify({ shadowMode: true, days, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
