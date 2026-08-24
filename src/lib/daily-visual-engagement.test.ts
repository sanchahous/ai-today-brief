import { describe, expect, it, vi } from 'vitest';
import {
  createDailyVisualEngagementAttribution,
  createDailyVisualEngagementAttributionRegistry,
  createDailyVisualExposureTracker,
  isDailySignupHref,
  isDailyStoryHref,
  isExternalHttpHref,
  type DailyVisualExposureEvent,
} from './daily-visual-engagement';

function fixture() {
  let milliseconds = 0;
  const onThreshold =
    vi.fn<(event: DailyVisualExposureEvent, source: 'entry_hero' | 'scrolled') => void>();
  const tracker = createDailyVisualExposureTracker({
    now: () => milliseconds,
    schedule: vi.fn(() => 1),
    cancel: vi.fn(),
    sourceAtFirstExposure: () => 'entry_hero',
    onThreshold,
  });
  return {
    advance: (by: number) => {
      milliseconds += by;
    },
    onThreshold,
    tracker,
  };
}

describe('daily visual exposure tracker', () => {
  it('requires both half-visibility and an active tab before the one-second impression', () => {
    const { advance, onThreshold, tracker } = fixture();
    tracker.setAtLeastHalfVisible(true);
    advance(5_000);
    expect(onThreshold).not.toHaveBeenCalled();

    tracker.setDocumentVisible(true);
    advance(999);
    tracker.setDocumentVisible(false);
    expect(onThreshold).not.toHaveBeenCalled();

    tracker.setDocumentVisible(true);
    advance(1);
    tracker.setAtLeastHalfVisible(false);
    expect(onThreshold).toHaveBeenCalledWith('visual_impression', 'entry_hero');
  });

  it('accumulates exposure through visibility pauses and reports each threshold once', () => {
    const { advance, onThreshold, tracker } = fixture();
    tracker.setAtLeastHalfVisible(true);
    tracker.setDocumentVisible(true);
    advance(2_000);
    tracker.setDocumentVisible(false);
    advance(99_000);
    tracker.setDocumentVisible(true);
    advance(1_000);
    tracker.setAtLeastHalfVisible(false);
    expect(onThreshold.mock.calls).toEqual([
      ['visual_impression', 'entry_hero'],
      ['visual_exposure_3s', 'entry_hero'],
    ]);

    tracker.setAtLeastHalfVisible(true);
    advance(5_000);
    tracker.stop();
    expect(onThreshold.mock.calls).toEqual([
      ['visual_impression', 'entry_hero'],
      ['visual_exposure_3s', 'entry_hero'],
      ['visual_exposure_8s', 'entry_hero'],
    ]);
  });

  it('freezes the first exposure source instead of storing later scroll details', () => {
    let source: 'entry_hero' | 'scrolled' = 'scrolled';
    let milliseconds = 0;
    const onThreshold = vi.fn();
    const tracker = createDailyVisualExposureTracker({
      now: () => milliseconds,
      schedule: () => 1,
      cancel: () => undefined,
      sourceAtFirstExposure: () => source,
      onThreshold,
    });
    tracker.setAtLeastHalfVisible(true);
    tracker.setDocumentVisible(true);
    source = 'entry_hero';
    milliseconds = 1_000;
    tracker.stop();

    expect(onThreshold).toHaveBeenCalledWith('visual_impression', 'scrolled');
  });

  it('does not count a delayed timer after the tab has become inactive', () => {
    let milliseconds = 0;
    let documentVisible = true;
    const pending = { callback: null as (() => void) | null };
    const onThreshold = vi.fn();
    const tracker = createDailyVisualExposureTracker({
      now: () => milliseconds,
      schedule: (callback) => {
        pending.callback = callback;
        return 1;
      },
      cancel: () => undefined,
      isDocumentVisible: () => documentVisible,
      sourceAtFirstExposure: () => 'entry_hero',
      onThreshold,
    });
    tracker.setAtLeastHalfVisible(true);
    tracker.setDocumentVisible(true);
    milliseconds = 1_000;
    documentVisible = false;
    pending.callback?.();

    expect(onThreshold).not.toHaveBeenCalled();
  });
});

describe('daily visual outcome attribution', () => {
  it('does not attribute outcomes before a qualified impression and freezes its coarse source', () => {
    const onEvent = vi.fn();
    const attribution = createDailyVisualEngagementAttribution(onEvent);

    attribution.recordOutcome('story_open');
    attribution.recordVisualEvent('visual_impression', 'scrolled');
    attribution.recordOutcome('scroll_50');
    attribution.recordOutcome('outbound_click');

    expect(onEvent.mock.calls).toEqual([
      ['visual_impression', 'scrolled'],
      ['scroll_50', 'scrolled'],
      ['outbound_click', 'scrolled'],
    ]);
  });

  it('emits every visual and outcome event at most once', () => {
    const onEvent = vi.fn();
    const attribution = createDailyVisualEngagementAttribution(onEvent);

    attribution.recordVisualEvent('visual_impression', 'entry_hero');
    attribution.recordVisualEvent('visual_impression', 'scrolled');
    attribution.recordVisualEvent('visual_exposure_3s', 'entry_hero');
    attribution.recordVisualEvent('visual_exposure_3s', 'scrolled');
    attribution.recordOutcome('signup_click');
    attribution.recordOutcome('signup_click');

    expect(onEvent.mock.calls).toEqual([
      ['visual_impression', 'entry_hero'],
      ['visual_exposure_3s', 'entry_hero'],
      ['signup_click', 'entry_hero'],
    ]);
  });

  it('shares the exactly-once state across two client islands for the same visual', () => {
    const onEvent = vi.fn();
    const registry = createDailyVisualEngagementAttributionRegistry();
    const first = registry.attributionFor('set:candidate:en', onEvent);
    const second = registry.attributionFor('set:candidate:en', onEvent);

    first.recordVisualEvent('visual_impression', 'entry_hero');
    second.recordVisualEvent('visual_impression', 'entry_hero');
    first.recordOutcome('story_open');
    second.recordOutcome('story_open');

    expect(onEvent.mock.calls).toEqual([
      ['visual_impression', 'entry_hero'],
      ['story_open', 'entry_hero'],
    ]);
  });
});

describe('daily visual local click classification', () => {
  const base = 'https://aitodaybrief.com/uk/brief-2026-08-24';

  it('recognizes only a localized daily story path', () => {
    expect(isDailyStoryHref('/uk/news/agents/a-model-update', base, 'uk')).toBe(true);
    expect(isDailyStoryHref('/uk/news', base, 'uk')).toBe(false);
    expect(isDailyStoryHref('/en/news/agents/a-model-update', base, 'uk')).toBe(false);
    expect(
      isDailyStoryHref('https://elsewhere.example/uk/news/agents/a-model-update', base, 'uk'),
    ).toBe(false);
  });

  it('recognizes local signup intent and external http(s) links without returning their URLs', () => {
    expect(isDailySignupHref('/uk/subscribe/', base, 'uk')).toBe(true);
    expect(isDailySignupHref('/uk/news', base, 'uk')).toBe(false);
    expect(isExternalHttpHref('https://source.example/report', base)).toBe(true);
    expect(isExternalHttpHref('/uk/news', base)).toBe(false);
    expect(isExternalHttpHref('mailto:editor@aitodaybrief.com', base)).toBe(false);
  });
});
