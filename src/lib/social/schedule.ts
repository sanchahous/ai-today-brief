import type { SocialChannel } from './types';

export const SOCIAL_TIME_ZONE = 'Europe/Kyiv';

export interface ChannelCadence {
  days: number[];
  hour: number;
  minute: number;
}

// JavaScript day: Sunday=0. Slots are editorial defaults and stay unchanged
// until an owner explicitly accepts a metrics-based recommendation.
export const CHANNEL_CADENCE: Record<SocialChannel, ChannelCadence> = {
  telegram: { days: [0, 1, 2, 3, 4, 5, 6], hour: 21, minute: 0 },
  x: { days: [0, 1, 2, 3, 4, 5, 6], hour: 17, minute: 0 },
  threads: { days: [0, 1, 2, 3, 4, 5, 6], hour: 18, minute: 0 },
  linkedin: { days: [1, 2, 4], hour: 10, minute: 0 },
  instagram: { days: [0, 3], hour: 19, minute: 0 },
  facebook: { days: [0, 3], hour: 19, minute: 30 },
};

export function resolveCadenceSettings(value?: unknown): Record<SocialChannel, ChannelCadence> {
  const row =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    (Object.keys(CHANNEL_CADENCE) as SocialChannel[]).map((channel) => [
      channel,
      resolveChannelCadence(channel, row[channel]),
    ]),
  ) as Record<SocialChannel, ChannelCadence>;
}

function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Convert a Kyiv wall-clock value to an actual UTC instant, including DST. */
export function kyivWallClockToUtc(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = new Date(desired);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsAt(candidate, SOCIAL_TIME_ZONE);
    const represented = Date.UTC(
      Number(actual.year),
      Number(actual.month) - 1,
      Number(actual.day),
      Number(actual.hour),
      Number(actual.minute),
      Number(actual.second),
    );
    candidate = new Date(candidate.getTime() + desired - represented);
  }

  return candidate;
}

export function resolveChannelCadence(channel: SocialChannel, value?: unknown): ChannelCadence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return CHANNEL_CADENCE[channel];
  const row = value as { days?: unknown; hour?: unknown; minute?: unknown };
  const days = Array.isArray(row.days)
    ? row.days.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const hour = typeof row.hour === 'number' && row.hour >= 0 && row.hour <= 23 ? row.hour : null;
  const minute =
    typeof row.minute === 'number' && row.minute >= 0 && row.minute <= 59 ? row.minute : null;
  return days.length && hour !== null && minute !== null
    ? { days: [...new Set(days)], hour, minute }
    : CHANNEL_CADENCE[channel];
}

export function channelRunsOnDate(
  channel: SocialChannel,
  date: string,
  cadence = CHANNEL_CADENCE[channel],
): boolean {
  const noon = kyivWallClockToUtc(date, 12, 0);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: SOCIAL_TIME_ZONE,
    weekday: 'short',
  }).format(noon);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
  return cadence.days.includes(weekday);
}

export function scheduledForChannel(
  channel: SocialChannel,
  date: string,
  cadence = CHANNEL_CADENCE[channel],
): string {
  return kyivWallClockToUtc(date, cadence.hour, cadence.minute).toISOString();
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function completedWeeklyRangeForTrigger(triggerDate: string) {
  const [year, month, day] = triggerDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // Sunday–Saturday editorial window. The trigger day itself is never treated
  // as completed, so a manual retry later in the week resolves to the same
  // most recently completed Saturday.
  const weekEnd = addCalendarDays(triggerDate, -(weekday + 1));
  return { weekStart: addCalendarDays(weekEnd, -6), weekEnd };
}

/**
 * Seven editorial days ending on the digest creation date. Source records are
 * date-granular, so the creation date is included when a published brief is
 * already available and otherwise contributes no candidates.
 */
export function rollingWeeklyRangeForDate(creationDate: string) {
  return {
    weekStart: addCalendarDays(creationDate, -6),
    weekEnd: creationDate,
  };
}

export function nextScheduledForChannel(
  channel: SocialChannel,
  sourceDate: string,
  now = new Date(),
  cadence = CHANNEL_CADENCE[channel],
): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const firstDate = sourceDate < today ? today : sourceDate;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addCalendarDays(firstDate, offset);
    if (!channelRunsOnDate(channel, date, cadence)) continue;
    const slot = scheduledForChannel(channel, date, cadence);
    if (new Date(slot).getTime() > now.getTime() + 5 * 60_000) return slot;
  }
  throw new Error(`No ${channel} slot found within two weeks of ${sourceDate}.`);
}

const WEEKLY_TIMES: Record<SocialChannel, { hour: number; minute: number }> = {
  linkedin: { hour: 16, minute: 10 },
  x: { hour: 16, minute: 20 },
  threads: { hour: 16, minute: 30 },
  telegram: { hour: 18, minute: 0 },
  instagram: { hour: 19, minute: 0 },
  facebook: { hour: 19, minute: 30 },
};

export function nextWeeklyScheduledForChannel(
  channel: SocialChannel,
  anchorDate: string,
  now = new Date(),
  timeOverride?: Pick<ChannelCadence, 'hour' | 'minute'>,
): string {
  const time = timeOverride ?? WEEKLY_TIMES[channel];
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const firstDate = anchorDate < today ? today : anchorDate;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addCalendarDays(firstDate, offset);
    const noon = kyivWallClockToUtc(date, 12, 0);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: SOCIAL_TIME_ZONE,
      weekday: 'short',
    }).format(noon);
    if (weekday !== 'Mon') continue;
    const slot = kyivWallClockToUtc(date, time.hour, time.minute);
    if (slot.getTime() > now.getTime() + 5 * 60_000) return slot.toISOString();
  }
  throw new Error(`No weekly ${channel} slot found near ${anchorDate}.`);
}
