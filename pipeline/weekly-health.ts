export type WeeklyDigestHealth = 'healthy' | 'missing' | 'unpublished';

export type WeeklyDigestHealthRow = {
  week_start: string;
  status: string;
  published_at: string | null;
};

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid ISO date: ${date}`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/** The latest Saturday-ended Sunday–Saturday period before the Kyiv date. */
export function completedWeekForDate(anchorDate: string): {
  weekStart: string;
  weekEnd: string;
} {
  const parsed = new Date(`${anchorDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || !Number.isFinite(parsed.getTime())) {
    throw new Error(`Invalid ISO date: ${anchorDate}`);
  }
  const day = parsed.getUTCDay();
  const daysSinceCompletedSaturday = day === 6 ? 7 : day + 1;
  const weekEnd = shiftDate(anchorDate, -daysSinceCompletedSaturday);
  return { weekStart: shiftDate(weekEnd, -6), weekEnd };
}

export function assessWeeklyDigestHealth(
  expectedWeekStart: string,
  digest: WeeklyDigestHealthRow | null,
): { health: WeeklyDigestHealth; message: string } {
  if (!digest) {
    return {
      health: 'missing',
      message: `Weekly digest for ${expectedWeekStart} was not created.`,
    };
  }
  if (digest.status !== 'published' || !digest.published_at) {
    return {
      health: 'unpublished',
      message: `Weekly digest for ${expectedWeekStart} is still ${digest.status}.`,
    };
  }
  return {
    health: 'healthy',
    message: `Weekly digest for ${expectedWeekStart} is published.`,
  };
}
