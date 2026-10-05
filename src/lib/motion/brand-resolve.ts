import { sampledSpringKeyframes } from '@/lib/motion/spring';

export const BRAND_DURATION_MS = 3400;

const RIB_COUNT = 16;

type BrandTrack = {
  element: Element;
  keys: Keyframe[];
  easing?: string;
  channel?: string;
};

function ribGeometry(index: number): [string, string] {
  const inset = index * 6.4;
  const x = 69 + inset;
  const right = 471 - inset;
  const apex = 399 - (270 - x) * 1.645;
  const left = `M${x} 399 L262 ${(apex + 13.16).toFixed(2)} Q266 ${(apex + 6.58).toFixed(2)} 270 ${(apex + 6.58).toFixed(2)}`;
  const rightHalf = `M${right} 399 L278 ${(apex + 13.16).toFixed(2)} Q274 ${(apex + 6.58).toFixed(2)} 270 ${(apex + 6.58).toFixed(2)}`;
  return [left, rightHalf];
}

/** Deterministic scatter for rib i — every replay looks the same. */
export function scatterRib(index: number): { dx: number; dy: number; rot: number } {
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = 26 + (index % 5) * 9;
  const dx = Math.cos(angle) * radius;
  const dy = Math.sin(angle) * radius * 0.7 - 18;
  const rot = ((index % 7) - 3) * 3.2;
  return { dx, dy, rot };
}

function tf(dx: number, dy: number, rot: number, s: number): string {
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${s})`;
}

function offset(ms: number): number {
  return Math.max(0, Math.min(1, ms / BRAND_DURATION_MS));
}

/** Build the 31 WAAPI tracks for one brand stage (prototype: tension.js brandTracks). */
export function brandTracks(stage: Element): BrandTrack[] {
  const o = offset;
  const tracks: BrandTrack[] = [];
  const add = (element: Element | null, keys: Keyframe[], extra: Partial<BrandTrack> = {}) => {
    if (element) tracks.push({ element, keys, ...extra });
  };
  const hold = (
    el: Element | null,
    from: Keyframe,
    to: Keyframe,
    start: number,
    end: number,
    easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  ) => {
    add(el, [
      { ...from, offset: 0 },
      { ...from, offset: o(start), easing },
      { ...to, offset: o(end) },
      { ...to, offset: 1 },
    ]);
  };

  stage.querySelectorAll('.rs-rib').forEach((rib, i) => {
    const { dx, dy, rot } = scatterRib(i);
    const appear = 80 + i * 22;
    const alignStart = 760 + i * 38;
    const alignEnd = alignStart + 960;
    const strumAt = 2140 + i * 24;
    add(rib, [
      { offset: 0, transform: tf(dx, dy, rot, 0.92), opacity: 0, strokeDasharray: '0.02 0.07', strokeDashoffset: 0 },
      {
        offset: o(appear + 320),
        transform: tf(dx * 0.9, dy * 0.9 - 4, rot * 0.9, 0.93),
        opacity: 0.55,
        strokeDasharray: '0.02 0.07',
        strokeDashoffset: -0.09,
        easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
      {
        offset: o(alignStart),
        transform: tf(dx * 0.78, dy * 0.78 - 6, rot * 0.7, 0.94),
        opacity: 0.62,
        strokeDasharray: '0.03 0.06',
        strokeDashoffset: -0.16,
        easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
      },
      { offset: o(alignEnd), transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
      {
        offset: o(strumAt),
        transform: tf(0, 0, 0, 1),
        opacity: 1,
        strokeDasharray: '1 0',
        strokeDashoffset: 0,
        easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)',
      },
      { offset: o(strumAt + 80), transform: tf(0, 0, 0, 1.014), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
      { offset: o(strumAt + 170), transform: tf(0, 0, 0, 0.994), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
      { offset: o(strumAt + 270), transform: tf(0, 0, 0, 1.004), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
      { offset: o(strumAt + 380), transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
      { offset: 1, transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: '1 0', strokeDashoffset: 0 },
    ]);
  });

  hold(stage.querySelector('.rs-light'), { opacity: 0 }, { opacity: 1 }, 0, 1300, 'ease-out');
  hold(
    stage.querySelector('.rs-shadow'),
    { transform: 'scaleX(0.45)', opacity: 0 },
    { transform: 'scaleX(1)', opacity: 1 },
    700,
    1900,
  );
  hold(
    stage.querySelector('.rs-bridge'),
    { transform: 'scaleX(0)', opacity: 0 },
    { transform: 'scaleX(1)', opacity: 1 },
    1650,
    2150,
  );
  hold(
    stage.querySelector('.rs-sheen'),
    { transform: 'skewX(-18deg) translateX(0px)', opacity: 1 },
    { transform: 'skewX(-18deg) translateX(720px)', opacity: 1 },
    2050,
    2900,
    'cubic-bezier(0.45, 0, 0.35, 1)',
  );
  hold(
    stage.querySelector('.rs-leader'),
    { strokeDasharray: '1 1', strokeDashoffset: 1 },
    { strokeDasharray: '1 1', strokeDashoffset: 0 },
    2280,
    2620,
  );
  add(stage.querySelector('.rs-dot'), [
    { offset: 0, transform: 'translateY(-44px) scale(0.6)', opacity: 0 },
    {
      offset: o(2380),
      transform: 'translateY(-44px) scale(0.6)',
      opacity: 0,
      easing: 'cubic-bezier(0.55, 0, 0.9, 0.4)',
    },
    {
      offset: o(2600),
      transform: 'translateY(2px) scale(1.16, 0.84)',
      opacity: 1,
      easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
    },
    { offset: o(2760), transform: 'translateY(-3px) scale(0.95, 1.06)', opacity: 1 },
    { offset: o(2900), transform: 'translateY(0) scale(1)', opacity: 1 },
    { offset: 1, transform: 'translateY(0) scale(1)', opacity: 1 },
  ]);
  hold(
    stage.querySelector('.rs-ripple'),
    { transform: 'scale(0.6)' },
    { transform: 'scale(2.8)' },
    2600,
    3350,
    'ease-out',
  );
  add(
    stage.querySelector('.rs-ripple'),
    [
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: o(2600) },
      { opacity: 0.7, offset: o(2680) },
      { opacity: 0, offset: o(3350) },
      { opacity: 0, offset: 1 },
    ],
    { channel: 'ripple-fade' },
  );
  hold(
    stage.querySelector('.rs-halo'),
    { transform: 'scale(0.85)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 },
    2800,
    3300,
  );

  stage.querySelectorAll('[data-phase]').forEach((label, i) => {
    const ranges: [number, number][] = [[0, 900], [900, 2050], [2050, BRAND_DURATION_MS]];
    const [start, end] = ranges[i] ?? [0, BRAND_DURATION_MS];
    add(label, [
      { opacity: 0.4, offset: 0 },
      { opacity: 0.4, offset: o(Math.max(0, start - 1)) },
      { opacity: 1, offset: o(start + 120) },
      { opacity: 1, offset: o(end - 120) },
      { opacity: i === 2 ? 1 : 0.55, offset: o(end) },
      { opacity: i === 2 ? 1 : 0.55, offset: 1 },
    ]);
  });

  add(
    stage.querySelector('.brand-progress i'),
    [{ transform: 'scaleX(0)', offset: 0 }, { transform: 'scaleX(1)', offset: 1 }],
    { easing: 'linear' },
  );

  stage.querySelectorAll('.brand-line > span').forEach((line, i) => {
    hold(
      line,
      { transform: 'translateY(105%)' },
      { transform: 'translateY(0)' },
      2700 + i * 170,
      3300 + i * 100,
    );
  });

  return tracks;
}

export function ribPaths(): Array<{ left: string; right: string; width: number }> {
  return Array.from({ length: RIB_COUNT }, (_, index) => {
    const [left, right] = ribGeometry(index);
    return { left, right, width: index === 0 ? 2.6 : 1.8 };
  });
}

type BrandSceneRegistry = {
  cancel: (stage: Element) => void;
  cancelAll: () => void;
  play: (stage: Element, options?: { time?: number }) => void;
  markAllPlayed: () => void;
};

/** Own WAAPI pool for The Resolve — atomic, separate from the 32-gesture UI cap. */
export function createBrandSceneRegistry(
  canMove: () => boolean,
  onMetrics: () => void,
): BrandSceneRegistry {
  const brandMotions = new Set<Animation>();
  const brandScenes = new Map<Element, Animation[]>();

  const track = (animation: Animation) => {
    brandMotions.add(animation);
    onMetrics();
    const done = () => {
      brandMotions.delete(animation);
      onMetrics();
    };
    animation.onfinish = done;
    animation.oncancel = done;
    return animation;
  };

  const cancel = (stage: Element) => {
    const previous = brandScenes.get(stage);
    brandScenes.delete(stage);
    previous?.forEach((animation) => animation.cancel());
  };

  const cancelAll = () => {
    brandScenes.forEach((scene) => scene.forEach((animation) => animation.cancel()));
    brandScenes.clear();
    for (const animation of [...brandMotions]) animation.cancel();
    brandMotions.clear();
    document
      .querySelectorAll('[data-brand-state="playing"],[data-brand-state="paused"]')
      .forEach((stage) => {
        if (stage instanceof HTMLElement) {
          stage.dataset.brandState = 'rest';
          stage.dataset.brandPlayed = 'true';
          stage.querySelector('[data-brand-replay]')?.setAttribute('aria-disabled', 'false');
        }
      });
    onMetrics();
  };

  const play = (stage: Element, options: { time?: number } = {}) => {
    if (!(stage instanceof HTMLElement)) return;
    if (!canMove()) {
      stage.dataset.brandPlayed = 'true';
      return;
    }
    const inspecting = Number.isFinite(options.time);
    if (stage.dataset.brandState === 'playing' && !inspecting) return;

    cancel(stage);
    const tracks = brandTracks(stage);
    stage.dataset.brandState = inspecting ? 'paused' : 'playing';
    stage.dataset.brandPlayed = 'true';
    stage.querySelector('[data-brand-replay]')?.setAttribute('aria-disabled', String(!inspecting));

    const started = document.timeline.currentTime;
    const scene = tracks.map(({ element, keys, easing }) => {
      const animation = element.animate(keys, {
        duration: BRAND_DURATION_MS,
        easing: easing ?? 'linear',
        fill: inspecting ? 'both' : 'none',
      });
      track(animation);
      if (inspecting) {
        animation.pause();
        animation.currentTime = Math.max(0, Math.min(BRAND_DURATION_MS, options.time ?? 0));
      } else {
        animation.startTime = started;
      }
      return animation;
    });
    brandScenes.set(stage, scene);
    if (inspecting) return;

    Promise.all(scene.map((animation) => animation.finished))
      .then(() => {
        if (brandScenes.get(stage) !== scene) return;
        brandScenes.delete(stage);
        stage.dataset.brandState = 'rest';
        stage.querySelector('[data-brand-replay]')?.setAttribute('aria-disabled', 'false');
      })
      .catch(() => {
        /* Cancellation restores the underlying, complete SVG. */
      });
  };

  const markAllPlayed = () => {
    document.querySelectorAll('.brand-stage').forEach((stage) => {
      if (stage instanceof HTMLElement) stage.dataset.brandPlayed = 'true';
    });
  };

  return { cancel, cancelAll, play, markAllPlayed };
}

export function runBrandStrum(
  mark: Element | null,
  animate: (
    element: Element,
    keyframes: Keyframe[],
    options?: KeyframeAnimationOptions,
    channel?: string,
  ) => Animation | undefined,
): void {
  if (!mark) return;
  const strokes = mark.querySelectorAll('.mark-stroke');
  strokes.forEach((stroke, index) => {
    animate(
      stroke,
      sampledSpringKeyframes((r) => `translateY(${-1.6 * r}px)`, 0.5),
      { duration: 520, delay: index * 55, easing: 'linear', fill: 'none' },
      'strum',
    );
  });
  const dot = mark.querySelector('.mark-dot');
  if (dot) {
    animate(
      dot,
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-3px) scale(1.15)', offset: 0.35 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 480, delay: 200, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'none' },
      'strum-dot',
    );
  }
}
