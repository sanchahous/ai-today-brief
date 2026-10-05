import { MotionBudget } from '@/lib/motion/budget';
import { GESTURE_DURATION_MS, TENSION_EASE } from '@/lib/motion/constants';
import { sampledSpringKeyframes } from '@/lib/motion/spring';
import type { GestureKind } from '@/lib/motion/types';

type AnimateFn = (
  element: Element,
  keyframes: Keyframe[],
  options?: KeyframeAnimationOptions,
  channel?: string,
) => Animation | undefined;

function parseDelay(element: Element, extra = 0): number {
  const raw = element.getAttribute('data-gesture-delay');
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return extra + (Number.isFinite(parsed) ? parsed : 0);
}

function drawLines(animate: AnimateFn, container: Element, delay: number): void {
  const lines = container.matches('line,path,circle,polyline')
    ? [container]
    : [...container.querySelectorAll('line,path,circle,polyline')];
  lines.slice(0, 18).forEach((line, index) => {
    if (!line.getAttribute('pathLength')) line.setAttribute('pathLength', '1');
    animate(
      line,
      [
        { strokeDasharray: '1 1', strokeDashoffset: 1 },
        { strokeDasharray: '1 1', strokeDashoffset: 0 },
      ],
      {
        duration: GESTURE_DURATION_MS.draw,
        delay: delay + index * 45,
        fill: 'backwards',
        easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)',
      },
      'draw',
    );
  });
}

function countUp(
  element: HTMLElement,
  locale: string,
  canMove: () => boolean,
  counters: WeakSet<Element>,
): void {
  const target = Number(element.dataset.count);
  if (!canMove() || !Number.isFinite(target) || counters.has(element)) return;
  counters.add(element);
  const start = performance.now();
  const duration = GESTURE_DURATION_MS.count ?? 900;
  const format = new Intl.NumberFormat(locale === 'uk' ? 'uk-UA' : 'en-GB');
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - p) ** 3;
    element.textContent = format.format(Math.round(target * eased));
    if (p < 1 && canMove()) requestAnimationFrame(step);
    else {
      element.textContent = format.format(target);
      counters.delete(element);
    }
  };
  requestAnimationFrame(step);
}

/** Run a single Tension gesture on `element` when motion is allowed. */
export function runGesture(
  element: Element,
  kind: GestureKind,
  animate: AnimateFn,
  options: {
    delay?: number;
    locale: string;
    canMove: () => boolean;
    counters: WeakSet<Element>;
  },
): void {
  if (!element || !options.canMove()) return;
  const delay = parseDelay(element, options.delay ?? 0);
  const base: KeyframeAnimationOptions = { delay, fill: 'backwards' };

  if (kind === 'rule' || kind === 'focus') {
    const accent =
      kind === 'focus'
        ? element.querySelector('.gesture-accent') ?? element
        : element;
    animate(
      accent,
      [
        { transform: 'scaleX(0.08)', opacity: 0.4 },
        { transform: 'scaleX(1)', opacity: 1 },
      ],
      {
        ...base,
        duration: kind === 'focus' ? GESTURE_DURATION_MS.focus : GESTURE_DURATION_MS.rule,
      },
    );
    return;
  }

  if (kind === 'curtain') {
    animate(
      element,
      [
        { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(0.32em)' },
        { clipPath: 'inset(0 0 -12% 0)', transform: 'translateY(0)' },
      ],
      { ...base, duration: GESTURE_DURATION_MS.curtain, easing: 'cubic-bezier(0.2, 0.75, 0.15, 1)' },
    );
    return;
  }

  if (kind === 'fold') {
    animate(
      element,
      [
        { transform: 'perspective(900px) rotateY(-5deg) translateX(-5px)', opacity: 0.65 },
        { transform: 'perspective(900px) rotateY(0deg) translateX(0)', opacity: 1 },
      ],
      { ...base, duration: GESTURE_DURATION_MS.fold },
    );
    return;
  }

  if (kind === 'index') {
    animate(
      element,
      [
        { transform: 'translateX(-7px)', opacity: 0.55 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { ...base, duration: GESTURE_DURATION_MS.index },
    );
    return;
  }

  if (kind === 'press') {
    animate(
      element,
      sampledSpringKeyframes((r) => `scale(${1 - 0.025 * r})`, 0.48),
      { ...base, duration: GESTURE_DURATION_MS.press, easing: 'linear' },
    );
    return;
  }

  if (kind === 'confirm') {
    animate(
      element,
      [
        { transform: 'scale(0.985)', opacity: 0.65 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { ...base, duration: GESTURE_DURATION_MS.confirm },
    );
    return;
  }

  if (kind === 'reveal' || kind === 'disclose') {
    const offset = kind === 'reveal' ? 5 : -4;
    animate(
      element,
      [
        { transform: `translateY(${offset}px)`, opacity: 0.45 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { ...base, duration: kind === 'reveal' ? GESTURE_DURATION_MS.reveal : GESTURE_DURATION_MS.disclose },
    );
    return;
  }

  if (kind === 'draw') {
    drawLines(animate, element, delay);
    return;
  }

  if (kind === 'count' && element instanceof HTMLElement) {
    countUp(element, options.locale, options.canMove, options.counters);
    return;
  }

  if (kind === 'grow') {
    animate(
      element,
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      {
        ...base,
        duration: GESTURE_DURATION_MS.grow,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    );
    return;
  }

  if (kind === 'record') {
    animate(
      element,
      [
        { transform: 'rotate(-28deg) scale(0.96)', opacity: 0.6 },
        { transform: 'rotate(0deg) scale(1)', opacity: 1 },
      ],
      { ...base, duration: GESTURE_DURATION_MS.record, easing: 'cubic-bezier(0.16, 0.84, 0.2, 1)' },
    );
    return;
  }

  // settle (default)
  animate(
    element,
    sampledSpringKeyframes((r) => `translateY(${r * 8}px)`),
    { ...base, duration: GESTURE_DURATION_MS.settle, easing: 'linear' },
  );
}

/** Factory for element-scoped WAAPI with budget and channel cancellation. */
export function createAnimator(
  budget: MotionBudget,
  canMove: () => boolean,
  slots: WeakMap<Element, Map<string, Animation>>,
): AnimateFn {
  return (element, keyframes, options = {}, channel = 'main') => {
    if (!element || !canMove() || typeof element.animate !== 'function') return;
    if (!budget.canStart()) return;

    let elementSlots = slots.get(element);
    if (!elementSlots) {
      elementSlots = new Map();
      slots.set(element, elementSlots);
    }
    elementSlots.get(channel)?.cancel();

    const animation = element.animate(keyframes, {
      duration: GESTURE_DURATION_MS.settle,
      easing: TENSION_EASE,
      fill: 'none',
      ...options,
    });
    elementSlots.set(channel, animation);
    budget.track(animation, () => {
      if (elementSlots?.get(channel) === animation) elementSlots.delete(channel);
    });
    return animation;
  };
}
