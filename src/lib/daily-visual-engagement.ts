export const DAILY_VISUAL_EXPOSURE_THRESHOLDS = [
  { eventType: 'visual_impression', milliseconds: 1_000 },
  { eventType: 'visual_exposure_3s', milliseconds: 3_000 },
  { eventType: 'visual_exposure_8s', milliseconds: 8_000 },
] as const;

export type DailyVisualExposureEvent =
  (typeof DAILY_VISUAL_EXPOSURE_THRESHOLDS)[number]['eventType'];
export const DAILY_VISUAL_OUTCOME_EVENT_TYPES = [
  'story_open',
  'scroll_50',
  'outbound_click',
  'signup_click',
] as const;
export type DailyVisualOutcomeEvent = (typeof DAILY_VISUAL_OUTCOME_EVENT_TYPES)[number];
export const DAILY_VISUAL_ENGAGEMENT_EVENT_TYPES = [
  ...DAILY_VISUAL_EXPOSURE_THRESHOLDS.map(({ eventType }) => eventType),
  ...DAILY_VISUAL_OUTCOME_EVENT_TYPES,
] as const;
export type DailyVisualEngagementEvent = (typeof DAILY_VISUAL_ENGAGEMENT_EVENT_TYPES)[number];
export type DailyVisualEntrySource = 'entry_hero' | 'scrolled';

const DAILY_VISUAL_ENGAGEMENT_EVENT_SET = new Set<string>(DAILY_VISUAL_ENGAGEMENT_EVENT_TYPES);

export function isDailyVisualEngagementEvent(value: unknown): value is DailyVisualEngagementEvent {
  return typeof value === 'string' && DAILY_VISUAL_ENGAGEMENT_EVENT_SET.has(value);
}

function sameOriginHttpUrl(value: string, base: string): URL | null {
  try {
    const url = new URL(value, base);
    const current = new URL(base);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== current.origin) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function normalizedPathname(url: URL): string {
  return url.pathname.length > 1 && url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname;
}

/** Classifies a reader click locally; the href itself is never sent or stored. */
export function isDailyStoryHref(value: string, base: string, lang: 'en' | 'uk'): boolean {
  const url = sameOriginHttpUrl(value, base);
  if (!url) return false;
  const segments = normalizedPathname(url).split('/').filter(Boolean);
  return (
    segments.length === 4 &&
    segments[0] === lang &&
    segments[1] === 'news' &&
    Boolean(segments[2]) &&
    Boolean(segments[3])
  );
}

/** Classifies the local subscription destination without recording its URL. */
export function isDailySignupHref(value: string, base: string, lang: 'en' | 'uk'): boolean {
  const url = sameOriginHttpUrl(value, base);
  return Boolean(url && normalizedPathname(url) === `/${lang}/subscribe`);
}

/** True only for an external http(s) link; callers keep the URL transient. */
export function isExternalHttpHref(value: string, base: string): boolean {
  try {
    const url = new URL(value, base);
    const current = new URL(base);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== current.origin;
  } catch {
    return false;
  }
}

export type DailyVisualEngagementAttribution = {
  recordVisualEvent: (eventType: DailyVisualExposureEvent, source: DailyVisualEntrySource) => void;
  recordOutcome: (eventType: DailyVisualOutcomeEvent) => void;
};

export type DailyVisualEngagementAttributionRegistry = {
  attributionFor: (
    targetKey: string,
    onEvent: (eventType: DailyVisualEngagementEvent, source: DailyVisualEntrySource) => void,
  ) => DailyVisualEngagementAttribution;
};

/**
 * Joins an outcome to the first qualified visual impression only. This keeps
 * each client-side event exactly-once and avoids crediting a cover that the
 * reader never had on screen long enough to see.
 */
export function createDailyVisualEngagementAttribution(
  onEvent: (eventType: DailyVisualEngagementEvent, source: DailyVisualEntrySource) => void,
): DailyVisualEngagementAttribution {
  const sent = new Set<DailyVisualEngagementEvent>();
  let qualifiedSource: DailyVisualEntrySource | null = null;

  const emit = (eventType: DailyVisualEngagementEvent, source: DailyVisualEntrySource): void => {
    if (sent.has(eventType)) return;
    sent.add(eventType);
    onEvent(eventType, source);
  };

  return {
    recordVisualEvent(eventType, source) {
      emit(eventType, source);
      if (eventType === 'visual_impression' && qualifiedSource === null) {
        qualifiedSource = source;
      }
    },
    recordOutcome(eventType) {
      if (qualifiedSource === null) return;
      emit(eventType, qualifiedSource);
    },
  };
}

/** Shares the exactly-once state when the same visual island is mounted twice. */
export function createDailyVisualEngagementAttributionRegistry(): DailyVisualEngagementAttributionRegistry {
  const attributions = new Map<string, DailyVisualEngagementAttribution>();
  return {
    attributionFor(targetKey, onEvent) {
      const existing = attributions.get(targetKey);
      if (existing) return existing;
      const attribution = createDailyVisualEngagementAttribution(onEvent);
      attributions.set(targetKey, attribution);
      return attribution;
    },
  };
}

type TimerHandle = ReturnType<typeof setTimeout> | number;

type DailyVisualExposureTrackerOptions = {
  now?: () => number;
  schedule?: (callback: () => void, milliseconds: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
  isDocumentVisible?: () => boolean;
  onThreshold: (eventType: DailyVisualExposureEvent, source: DailyVisualEntrySource) => void;
  sourceAtFirstExposure: () => DailyVisualEntrySource;
};

export type DailyVisualExposureTracker = {
  setAtLeastHalfVisible: (visible: boolean) => void;
  setDocumentVisible: (visible: boolean) => void;
  stop: () => void;
};

/**
 * Keeps only aggregate engaged exposure in memory. It never observes pointer,
 * gaze or exact scroll positions, and reports fixed milestones exactly once.
 */
export function createDailyVisualExposureTracker(
  options: DailyVisualExposureTrackerOptions,
): DailyVisualExposureTracker {
  const now = options.now ?? (() => performance.now());
  const schedule =
    options.schedule ?? ((callback, milliseconds) => setTimeout(callback, milliseconds));
  const cancel = options.cancel ?? ((handle) => clearTimeout(handle));
  const isDocumentVisible = options.isDocumentVisible ?? (() => documentVisible);
  const sent = new Set<DailyVisualExposureEvent>();
  let atLeastHalfVisible = false;
  let documentVisible = false;
  let activeSince: number | null = null;
  let accumulatedMilliseconds = 0;
  let timer: TimerHandle | null = null;
  let source: DailyVisualEntrySource | null = null;
  let stopped = false;

  const activeMilliseconds = (): number => {
    if (activeSince === null) return accumulatedMilliseconds;
    return accumulatedMilliseconds + Math.max(0, now() - activeSince);
  };

  const clearTimer = (): void => {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  };

  const emitDueThresholds = (): void => {
    const elapsed = activeMilliseconds();
    for (const threshold of DAILY_VISUAL_EXPOSURE_THRESHOLDS) {
      if (elapsed >= threshold.milliseconds && !sent.has(threshold.eventType) && source !== null) {
        sent.add(threshold.eventType);
        options.onThreshold(threshold.eventType, source);
      }
    }
  };

  const scheduleNextThreshold = (): void => {
    clearTimer();
    if (activeSince === null || stopped) return;
    const elapsed = activeMilliseconds();
    const next = DAILY_VISUAL_EXPOSURE_THRESHOLDS.find(
      (threshold) => !sent.has(threshold.eventType),
    );
    if (!next) return;
    timer = schedule(
      () => {
        timer = null;
        if (!isDocumentVisible()) {
          // A throttled callback cannot know when the tab became hidden. Drop
          // its unaccounted interval rather than falsely claiming exposure.
          documentVisible = false;
          activeSince = null;
          return;
        }
        emitDueThresholds();
        scheduleNextThreshold();
      },
      Math.max(1, next.milliseconds - elapsed),
    );
  };

  const pause = (): void => {
    if (activeSince === null) return;
    emitDueThresholds();
    accumulatedMilliseconds = activeMilliseconds();
    activeSince = null;
    clearTimer();
  };

  const reconcile = (): void => {
    if (stopped) return;
    const shouldCount = atLeastHalfVisible && documentVisible;
    if (!shouldCount) {
      pause();
      return;
    }
    if (activeSince !== null) return;
    source ??= options.sourceAtFirstExposure();
    activeSince = now();
    scheduleNextThreshold();
  };

  return {
    setAtLeastHalfVisible(visible) {
      atLeastHalfVisible = visible;
      reconcile();
    },
    setDocumentVisible(visible) {
      documentVisible = visible;
      reconcile();
    },
    stop() {
      if (stopped) return;
      pause();
      stopped = true;
    },
  };
}
