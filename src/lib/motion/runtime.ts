import { createBrandSceneRegistry, runBrandStrum } from '@/lib/motion/brand-resolve';
import { MotionBudget } from '@/lib/motion/budget';
import { createAnimator, runGesture } from '@/lib/motion/gestures';
import { isGestureKind } from '@/lib/motion/types';

const PRESSABLE =
  'button, [data-variant], a.rounded-pill, .chip, .pill, .brand-replay';

export type MotionRuntime = {
  mount: () => void;
  unmount: () => void;
  getPeak: () => number;
  getActiveCount: () => number;
};

export function createMotionRuntime(options: { locale: string }): MotionRuntime {
  const root = document.documentElement;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const budget = new MotionBudget();
  const slots = new WeakMap<Element, Map<string, Animation>>();
  const seen = new WeakSet<Element>();
  const counters = new WeakSet<Element>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  let lifecycle: AbortController | null = null;
  let entrances: IntersectionObserver | null = null;
  let brandEntrances: IntersectionObserver | null = null;
  let mutations: MutationObserver | null = null;
  let gestureWatch: MutationObserver | null = null;
  let mounted = false;

  const canMove = () => mounted && !media.matches && !document.hidden;

  const syncMotionFlag = () => {
    root.dataset.tensionMotion = media.matches ? 'off' : 'on';
    root.dataset.tensionActive = String(budget.activeCount);
    root.dataset.tensionPeak = String(budget.peakCount);
  };

  const onBrandMetrics = () => {
    root.dataset.tensionActive = String(budget.activeCount);
    root.dataset.tensionPeak = String(Math.max(budget.peakCount, budget.activeCount));
  };

  const brand = createBrandSceneRegistry(canMove, onBrandMetrics);
  const animate = createAnimator(budget, canMove, slots);

  const stop = () => {
    brand.cancelAll();
    budget.cancelAll();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    syncMotionFlag();
  };

  const playGesture = (element: Element, delay = 0) => {
    const kind = element.getAttribute('data-gesture');
    if (!kind || !isGestureKind(kind)) return;
    runGesture(element, kind, animate, {
      delay,
      locale: options.locale,
      canMove,
      counters,
    });
  };

  const observeBrandStages = () => {
    brandEntrances?.disconnect();
    brandEntrances = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          brandEntrances?.unobserve(entry.target);
          brand.play(entry.target);
        }
      },
      { threshold: 0.14 },
    );
    document.querySelectorAll('.brand-stage').forEach((stage) => {
      if (!seen.has(stage)) brandEntrances?.observe(stage);
    });
  };

  const observeEntrances = () => {
    entrances?.disconnect();
    entrances = new IntersectionObserver(
      (entries) => {
        let offset = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          entrances?.unobserve(entry.target);
          entry.target.setAttribute('data-tension-seen', 'true');
          playGesture(entry.target, Math.min(offset, 160));
          offset += 35;
        }
      },
      { threshold: 0.14 },
    );

    document.querySelectorAll('[data-gesture]').forEach((element) => {
      if (!seen.has(element)) entrances?.observe(element);
    });
  };

  const confirm = (element: Element) => {
    if (element instanceof HTMLElement && !element.textContent?.trim()) return;
    runGesture(element, 'confirm', animate, {
      locale: options.locale,
      canMove,
      counters,
    });
    element.classList.add('tension-confirm');
    const id = setTimeout(() => {
      timers.delete(id);
      element.classList.remove('tension-confirm');
    }, 800);
    timers.add(id);
  };

  const bindBrandInteractions = (signal: AbortSignal) => {
    document.addEventListener(
      'click',
      (event) => {
        const replay = (event.target as Element | null)?.closest('[data-brand-replay]');
        if (!replay || replay.getAttribute('aria-disabled') === 'true') return;
        const stage = replay.closest('.brand-stage');
        if (stage) brand.play(stage);
      },
      { signal },
    );

    const ringMark = (link: Element | null) => {
      if (!link) return;
      runBrandStrum(link.querySelector('.brand-mark'), animate);
    };

    document.addEventListener(
      'pointerenter',
      (event) => {
        if (!pointer.matches) return;
        const link = (event.target as Element | null)?.closest('[data-brand-strum]');
        if (link) ringMark(link);
      },
      { signal, capture: true },
    );
    document.addEventListener(
      'focusin',
      (event) => {
        const link = (event.target as Element | null)?.closest('[data-brand-strum]');
        if (link) ringMark(link);
      },
      { signal },
    );
  };

  const bindInteractions = (signal: AbortSignal) => {
    document.addEventListener(
      'pointerup',
      (event) => {
        const control = (event.target as Element | null)?.closest(PRESSABLE);
        if (!control || (control as HTMLButtonElement).disabled) return;
        if (control.getAttribute('aria-disabled') === 'true') return;
        runGesture(control, 'press', animate, {
          locale: options.locale,
          canMove,
          counters,
        });
      },
      { signal },
    );

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const control = (event.target as Element | null)?.closest(PRESSABLE);
        if (!control || (control as HTMLButtonElement).disabled) return;
        if (control.getAttribute('aria-disabled') === 'true') return;
        runGesture(control, 'press', animate, {
          locale: options.locale,
          canMove,
          counters,
        });
      },
      { signal },
    );

    bindBrandInteractions(signal);
  };

  const bindDynamicStates = () => {
    mutations = new MutationObserver((records) => {
      const updated = new Set<Element>();
      for (const record of records) {
        const element =
          record.target.nodeType === Node.ELEMENT_NODE
            ? (record.target as Element)
            : record.target.parentElement;
        if (!element) continue;

        if (record.attributeName === 'open' && (element as HTMLDialogElement).open) {
          const target = element.matches('dialog') ? element : element.lastElementChild;
          if (target) runGesture(target, 'disclose', animate, { locale: options.locale, canMove, counters });
        }
        if (
          record.attributeName === 'aria-pressed' &&
          element.getAttribute('aria-pressed') === 'true'
        ) {
          confirm(element);
        }
        if (
          record.attributeName === 'data-visible' &&
          element.id === 'toast' &&
          element.getAttribute('data-visible') === 'true'
        ) {
          runGesture(element, 'reveal', animate, { locale: options.locale, canMove, counters });
        }
        if (record.attributeName === 'hidden' && element instanceof HTMLElement && !element.hidden) {
          runGesture(
            element,
            element.matches('[data-daily-done]') ? 'confirm' : 'disclose',
            animate,
            { locale: options.locale, canMove, counters },
          );
        }
        if (record.type === 'childList' || record.type === 'characterData') {
          updated.add(element);
        }
      }

      for (const element of updated) {
        if (element.matches('.form-status,[data-retry-status]')) confirm(element);
        if (element.matches('.lint-output,.output-code,#settings-warnings,#instructions-lint')) {
          runGesture(element, 'reveal', animate, { locale: options.locale, canMove, counters });
        }
      }
    });

    document
      .querySelectorAll(
        'dialog,#toast,.form-status,[data-retry-status],.lint-output,.output-code,#settings-warnings,#instructions-lint',
      )
      .forEach((element) => {
        mutations?.observe(element, {
          childList: true,
          characterData: true,
          subtree: !element.matches('.output-code,.lint-output'),
          attributes: true,
          attributeFilter: ['open', 'aria-pressed', 'data-visible', 'hidden'],
        });
      });
  };

  return {
    mount() {
      if (typeof window === 'undefined') return;
      mounted = true;
      lifecycle = new AbortController();
      root.dataset.tension = 'v3';
      syncMotionFlag();
      if (media.matches) brand.markAllPlayed();
      bindInteractions(lifecycle.signal);
      bindDynamicStates();
      observeEntrances();
      observeBrandStages();
      gestureWatch = new MutationObserver(() => {
        document.querySelectorAll('[data-gesture]').forEach((element) => {
          if (!seen.has(element)) entrances?.observe(element);
        });
        document.querySelectorAll('.brand-stage').forEach((stage) => {
          if (!seen.has(stage)) brandEntrances?.observe(stage);
        });
      });
      gestureWatch.observe(document.body, { childList: true, subtree: true });

      media.addEventListener(
        'change',
        () => {
          stop();
          if (media.matches) brand.markAllPlayed();
          syncMotionFlag();
        },
        { signal: lifecycle.signal },
      );

      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.hidden) stop();
        },
        { signal: lifecycle.signal },
      );
      window.addEventListener('pagehide', stop, { signal: lifecycle.signal });
    },

    unmount() {
      mounted = false;
      stop();
      lifecycle?.abort();
      lifecycle = null;
      entrances?.disconnect();
      entrances = null;
      brandEntrances?.disconnect();
      brandEntrances = null;
      mutations?.disconnect();
      mutations = null;
      gestureWatch?.disconnect();
      gestureWatch = null;
      delete root.dataset.tension;
      delete root.dataset.tensionMotion;
      delete root.dataset.tensionActive;
      delete root.dataset.tensionPeak;
    },

    getPeak: () => budget.peakCount,
    getActiveCount: () => budget.activeCount,
  };
}
