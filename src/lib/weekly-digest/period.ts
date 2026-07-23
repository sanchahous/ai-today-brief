import { completedWeeklyRangeForTrigger, kyivWallClockToUtc } from '@/lib/social/schedule';

export const WEEKLY_DIGEST_TIME_ZONE = 'Europe/Kyiv';
export const WEEKLY_PREFLIGHT_TIME = { hour: 15, minute: 45 } as const;
export const WEEKLY_RELEASE_TIME = { hour: 16, minute: 0 } as const;

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export interface WeeklyDigestPeriod {
  weekStart: string;
  weekEnd: string;
  releaseDate: string;
  preflightAt: string;
  releaseAt: string;
}

/**
 * Resolves the most recently completed Sunday–Saturday editorial window.
 * A Sunday generation trigger therefore targets the previous seven days and
 * schedules its operational gates for the following Monday in Kyiv.
 */
export function weeklyDigestPeriodForTrigger(triggerDate: string): WeeklyDigestPeriod {
  const { weekStart, weekEnd } = completedWeeklyRangeForTrigger(triggerDate);
  const releaseDate = addCalendarDays(weekEnd, 2);
  return {
    weekStart,
    weekEnd,
    releaseDate,
    preflightAt: kyivWallClockToUtc(
      releaseDate,
      WEEKLY_PREFLIGHT_TIME.hour,
      WEEKLY_PREFLIGHT_TIME.minute,
    ).toISOString(),
    releaseAt: kyivWallClockToUtc(
      releaseDate,
      WEEKLY_RELEASE_TIME.hour,
      WEEKLY_RELEASE_TIME.minute,
    ).toISOString(),
  };
}

export function isWeeklyDigestReleaseDue(releaseAt: string, now = new Date()) {
  const releaseTime = new Date(releaseAt).getTime();
  return Number.isFinite(releaseTime) && releaseTime <= now.getTime();
}
