/* Tension v3 — the After Hours motion language.
   Shared by the prototype and the motion studies. Static content is always the resting state;
   motion never gates interaction; everything is finite; reduced motion shows the final frame.
   Brand signature: THE RESOLVE — many signals, edited into one mark, resolved by the celadon point. */
const TensionMotion = (() => {
  const root = document.documentElement;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = matchMedia("(hover: hover) and (pointer: fine)");
  const motions = new Set(); // UI gestures (capped)
  const brandMotions = new Set(); // brand scene (atomic, own budget)
  const slots = new WeakMap();
  const timers = new Set();
  const seen = new WeakSet();
  const brandScenes = new Map();
  const counters = new Set();
  let brandSequence = 0;
  const maxActive = 32;
  const BRAND_DURATION = 3400;
  let lifecycle;
  let entrances;
  let chapters;
  let changes;
  let mounted = false;
  let quiet = false;
  let locale = "en";
  let route = "home";
  let peak = 0;
  let frameProbe = 0;
  const tr = (en, uk) => (locale === "uk" ? uk : en);
  const canMove = () => mounted && !quiet && !media.matches && !document.hidden;

  const gestures = [
    ["settle", "Weighted arrival", "Поява з вагою", "A surface finds its resting position on a damped spring.", "Площина знаходить спокій на загасаючій пружині.", "640 ms · 8 px"],
    ["curtain", "Curtain rise", "Підйом завіси", "Headlines rise out of their own baseline, like a stage curtain.", "Заголовки підіймаються з власної базової лінії, як завіса.", "720 ms · clip"],
    ["fold", "Editorial unfold", "Редакційне розкриття", "A cover opens by a few degrees.", "Обкладинка розкривається на кілька градусів.", "760 ms · 5°"],
    ["index", "Index alignment", "Вирівнювання рядків", "Rows settle along the reading axis.", "Рядки стають на місце вздовж осі читання.", "440 ms · 7 px"],
    ["rule", "Tensioned rule", "Натяг лінії", "A rule grows out from its centre.", "Лінія натягується від центру до країв.", "620 ms · scaleX"],
    ["draw", "Line drawing", "Креслення лінії", "Diagrams draw their own connections, once.", "Схеми один раз креслять власні зв’язки.", "900 ms · stroke"],
    ["count", "Count to the number", "Відлік до числа", "Figures count up to their value when they enter.", "Числа дораховують до значення, коли з’являються.", "900 ms · ease-out"],
    ["press", "Compression & release", "Стиснення й відпускання", "A short, tactile response to a decision.", "Короткий тактильний відгук на рішення.", "480 ms · 0.975 → 1"],
    ["focus", "Focus lock", "Фіксація фокусу", "The outline is immediate; its accent settles.", "Рамка миттєва; акцент спокійно фіксується.", "300 ms · line"],
    ["reveal", "Output reveal", "Розкриття результату", "The result appears as one readable block.", "Результат відкривається цілісним читабельним блоком.", "520 ms · 5 px"],
    ["confirm", "Quiet confirmation", "Тихе підтвердження", "An action locks into place without confetti.", "Дія фіксується коротким акцентом.", "420 ms · 0.985 → 1"],
    ["strum", "Strum", "Акорд", "The nested strokes of the mark ring once, outer to inner.", "Вкладені лінії знака звучать один раз — від зовнішньої до внутрішньої.", "520 ms · 3 strokes"],
  ];

  function later(action, delay) {
    const id = setTimeout(() => {
      timers.delete(id);
      action();
    }, delay);
    timers.add(id);
    return id;
  }

  function metrics() {
    root.dataset.tensionActive = String(motions.size + brandMotions.size);
    root.dataset.tensionPeak = String(peak);
    const active = document.querySelector("[data-proof-active]");
    if (active) active.textContent = `${motions.size + brandMotions.size} / ${maxActive}+brand`;
    const peakNode = document.querySelector("[data-proof-peak]");
    if (peakNode) peakNode.textContent = String(peak);
  }

  function track(pool, animation, release) {
    pool.add(animation);
    peak = Math.max(peak, motions.size + brandMotions.size);
    metrics();
    const done = () => {
      pool.delete(animation);
      release?.();
      metrics();
    };
    animation.onfinish = done;
    animation.oncancel = done;
    return animation;
  }

  function animate(element, frames, options = {}, channel = "main") {
    if (!element || !canMove() || !element.animate) return;
    let elementSlots = slots.get(element);
    if (!elementSlots) {
      elementSlots = new Map();
      slots.set(element, elementSlots);
    }
    elementSlots.get(channel)?.cancel();
    // At the cap, decorative work is skipped; the underlying content stays visible.
    if (motions.size >= maxActive) return;
    const animation = element.animate(frames, { duration: 640, easing: "cubic-bezier(.18,.82,.26,1)", fill: "none", ...options });
    elementSlots.set(channel, animation);
    return track(motions, animation, () => {
      if (elementSlots.get(channel) === animation) elementSlots.delete(channel);
    });
  }

  function spring(progress, seconds = 0.64) {
    const time = progress * seconds;
    const damp = 12;
    const frequency = Math.sqrt(240 - damp * damp);
    return Math.exp(-damp * time) * (Math.cos(frequency * time) + (damp / frequency) * Math.sin(frequency * time));
  }
  function sampled(transform, duration = 0.64) {
    return Array.from({ length: 33 }, (_, index) => {
      const progress = index / 32;
      return { offset: progress, transform: transform(index === 32 ? 0 : spring(progress, duration)) };
    });
  }

  function gesture(element, kind = "settle", delay = 0) {
    if (!element) return;
    const options = { delay, fill: "backwards" };
    if (kind === "rule" || kind === "focus") {
      const accent = kind === "focus" ? element.querySelector(".gesture-accent") || element : element;
      animate(accent, [{ transform: "scaleX(.08)", opacity: 0.4 }, { transform: "scaleX(1)", opacity: 1 }], { ...options, duration: kind === "focus" ? 300 : 620 });
    } else if (kind === "curtain") {
      animate(element, [{ clipPath: "inset(0 0 100% 0)", transform: "translateY(.32em)" }, { clipPath: "inset(0 0 -12% 0)", transform: "translateY(0)" }], { ...options, duration: 720, easing: "cubic-bezier(.2,.75,.15,1)" });
    } else if (kind === "fold") {
      animate(element, [{ transform: "perspective(900px) rotateY(-5deg) translateX(-5px)", opacity: 0.65 }, { transform: "perspective(900px) rotateY(0) translateX(0)", opacity: 1 }], { ...options, duration: 760 });
    } else if (kind === "index") {
      animate(element, [{ transform: "translateX(-7px)", opacity: 0.55 }, { transform: "translateX(0)", opacity: 1 }], { ...options, duration: 440 });
    } else if (kind === "press") {
      animate(element, sampled((r) => `scale(${1 - 0.025 * r})`, 0.48), { ...options, duration: 480, easing: "linear" });
    } else if (kind === "confirm") {
      animate(element, [{ transform: "scale(.985)", opacity: 0.65 }, { transform: "scale(1)", opacity: 1 }], { ...options, duration: 420 });
    } else if (kind === "reveal" || kind === "disclose") {
      animate(element, [{ transform: `translateY(${kind === "reveal" ? 5 : -4}px)`, opacity: 0.45 }, { transform: "translateY(0)", opacity: 1 }], { ...options, duration: kind === "reveal" ? 520 : 360 });
    } else if (kind === "draw") {
      draw(element, delay);
    } else if (kind === "count") {
      count(element);
    } else if (kind === "strum") {
      strum(element);
    } else if (kind === "grow") {
      animate(element, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { ...options, duration: 820, easing: "cubic-bezier(.2,.8,.2,1)" });
    } else if (kind === "record") {
      animate(element, [{ transform: "rotate(-28deg) scale(.96)", opacity: 0.6 }, { transform: "rotate(0) scale(1)", opacity: 1 }], { ...options, duration: 1400, easing: "cubic-bezier(.16,.84,.2,1)" });
    } else {
      animate(element, sampled((r) => `translateY(${r * 8}px)`), { ...options, duration: 640, easing: "linear" });
    }
  }

  /* SVG line drawing: every stroke with pathLength="1" draws itself once. */
  function draw(container, delay = 0) {
    const lines = container.matches?.("line,path,circle,polyline") ? [container] : [...container.querySelectorAll("line,path,circle,polyline")];
    lines.slice(0, 18).forEach((line, index) => {
      if (!line.getAttribute("pathLength")) line.setAttribute("pathLength", "1");
      animate(line, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }], { duration: 900, delay: delay + index * 45, fill: "backwards", easing: "cubic-bezier(.3,.7,.2,1)" }, "draw");
    });
  }

  /* Count-up for figures. The final number is already in the DOM (SSR-safe); rAF only rewrites it briefly. */
  function count(element) {
    const target = Number(element.dataset.count);
    if (!canMove() || !Number.isFinite(target) || counters.has(element)) return;
    counters.add(element);
    const start = performance.now();
    const duration = 900;
    const format = new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-GB");
    const step = (now) => {
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

  /* The mark rings once: outer stroke, inner stroke, crossbar, then the dot answers. */
  function strum(mark) {
    const strokes = mark?.querySelectorAll?.(".mark-stroke");
    if (!strokes?.length) return;
    strokes.forEach((stroke, index) => {
      animate(stroke, sampled((r) => `translateY(${-1.6 * r}px)`, 0.5), { duration: 520, delay: index * 55, easing: "linear" }, "strum");
    });
    animate(mark.querySelector(".mark-dot"), [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-3px) scale(1.15)", offset: 0.35 }, { transform: "translateY(0) scale(1)" }], { duration: 480, delay: 200, easing: "cubic-bezier(.3,.7,.3,1)" }, "strum-dot");
  }

  function stop() {
    brandScenes.forEach((scene) => scene.forEach((a) => a.cancel()));
    brandScenes.clear();
    for (const motion of [...motions, ...brandMotions]) motion.cancel();
    motions.clear();
    brandMotions.clear();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (frameProbe) {
      cancelAnimationFrame(frameProbe);
      const output = document.querySelector("[data-proof-frames]");
      if (output) output.textContent = tr("Measurement cancelled", "Вимірювання зупинено");
    }
    frameProbe = 0;
    document.querySelectorAll('[data-brand-state="playing"],[data-brand-state="paused"]').forEach((stage) => {
      stage.dataset.brandState = "rest";
      stage.dataset.brandPlayed = "true";
      stage.querySelector("[data-brand-replay]")?.setAttribute("aria-disabled", "false");
    });
    metrics();
  }

  function unmount() {
    mounted = false;
    stop();
    lifecycle?.abort();
    entrances?.disconnect();
    chapters?.disconnect();
    changes?.disconnect();
    delete root.dataset.tension;
    delete root.dataset.tensionMotion;
  }

  /* ── THE RESOLVE ─────────────────────────────────────────────────────── */
  const RIBS = 16;
  function ribGeometry(index) {
    const inset = index * 6.4;
    const x = 69 + inset;
    const right = 471 - inset;
    const apex = 399 - (270 - x) * 1.645;
    // Two halves meet at the crown, so each leg can rise from the baseline.
    const left = `M${x} 399 L262 ${(apex + 13.16).toFixed(2)} Q266 ${(apex + 6.58).toFixed(2)} 270 ${(apex + 6.58).toFixed(2)}`;
    const rightHalf = `M${right} 399 L278 ${(apex + 13.16).toFixed(2)} Q274 ${(apex + 6.58).toFixed(2)} 270 ${(apex + 6.58).toFixed(2)}`;
    return [left, rightHalf];
  }
  function brandMarkup(language = locale) {
    const t2 = (en, uk) => (language === "uk" ? uk : en);
    const id = `resolve-${++brandSequence}`;
    const ribs = Array.from({ length: RIBS }, (_, index) => {
      const [a, b] = ribGeometry(index);
      const w = index === 0 ? 2.6 : 1.8;
      return `<g class="rs-rib" data-rib="${index}"><path pathLength="1" d="${a}" stroke="url(#${id}-brass)" stroke-width="${w}"/><path pathLength="1" d="${b}" stroke="url(#${id}-brass)" stroke-width="${w}"/><path pathLength="1" d="${a}" stroke="url(#${id}-edge)" stroke-width=".55"/><path pathLength="1" d="${b}" stroke="url(#${id}-edge)" stroke-width=".55"/></g>`;
    }).join("");
    const maskRibs = Array.from({ length: RIBS }, (_, index) => ribGeometry(index).map((d) => `<path d="${d}"/>`).join("")).join("");
    // The picture is the SVG itself: a role="img" wrapper would swallow the replay button for screen readers.
    return `<div class="brand-stage grain" data-brand-state="rest">
      <svg viewBox="0 0 540 440" role="img" aria-label="${t2("The Resolve: many brass signals are edited into the A of AI Today Brief, and a celadon point resolves it", "The Resolve: латунні сигнали складаються в A — знак AI Today Brief, а celadon-крапка завершує його")}" focusable="false">
        <defs>
          <linearGradient id="${id}-brass" gradientUnits="userSpaceOnUse" x1="70" y1="90" x2="445" y2="375"><stop stop-color="#6f5c3d"/><stop offset=".26" stop-color="#ecd7a9"/><stop offset=".49" stop-color="#9a7f52"/><stop offset=".72" stop-color="#e8c995"/><stop offset="1" stop-color="#746247"/></linearGradient>
          <linearGradient id="${id}-edge" gradientUnits="userSpaceOnUse" x1="140" y1="95" x2="400" y2="330"><stop stop-color="#fff0d0" stop-opacity=".7"/><stop offset=".5" stop-color="#fff0d0" stop-opacity=".08"/><stop offset="1" stop-color="#fff0d0" stop-opacity=".25"/></linearGradient>
          <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5d8cc" stop-opacity=".06"/><stop offset=".5" stop-color="#b5d8cc" stop-opacity=".38"/><stop offset="1" stop-color="#b5d8cc" stop-opacity=".02"/></linearGradient>
          <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6e2" stop-opacity="0"/><stop offset=".5" stop-color="#fff6e2" stop-opacity=".95"/><stop offset="1" stop-color="#fff6e2" stop-opacity="0"/></linearGradient>
          <radialGradient id="${id}-shadow"><stop stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
          <radialGradient id="${id}-light" gradientUnits="userSpaceOnUse" cx="270" cy="150" r="270"><stop stop-color="#d4b483" stop-opacity=".22"/><stop offset=".55" stop-color="#d4b483" stop-opacity=".07"/><stop offset="1" stop-color="#d4b483" stop-opacity="0"/></radialGradient>
          <mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="440"><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">${maskRibs}</g></mask>
        </defs>
        <rect class="rs-light" x="-120" y="-160" width="780" height="700" fill="url(#${id}-light)"/>
        <ellipse class="rs-shadow" cx="270" cy="410" rx="205" ry="29" fill="url(#${id}-shadow)"/>
        <g class="rs-ribs" fill="none" stroke-linecap="round" stroke-linejoin="round">${ribs}</g>
        <g mask="url(#${id}-mask)"><rect class="rs-sheen" x="-120" y="60" width="140" height="360" fill="url(#${id}-sheen)" transform="skewX(-18)"/></g>
        <g class="rs-bridge"><path d="M176 310 L355 310 L365 328 L165 328 Z" fill="url(#${id}-glass)" stroke="#b5d8cc" stroke-opacity=".45" stroke-width=".8"/><path d="M169 325 H361" stroke="#d4b483" stroke-width="1.2"/></g>
        <g class="rs-signal"><circle class="rs-halo" cx="412" cy="107" r="23" fill="none" stroke="#b5d8cc" stroke-opacity=".35" stroke-width=".9"/><circle class="rs-ripple" cx="412" cy="107" r="23" fill="none" stroke="#b5d8cc" stroke-width="1.2"/><path class="rs-leader" pathLength="1" d="M392 143 L371 179" stroke="#b5d8cc" stroke-width=".7" stroke-opacity=".5"/><circle class="rs-dot" cx="412" cy="107" r="7" fill="#b5d8cc"/></g>
        <path class="rs-floor" d="M70 417 H470" stroke="#d4b483" stroke-opacity=".2" stroke-width=".6"/>
      </svg>
      <span class="brand-kicker" aria-hidden="true">THE RESOLVE</span>
      <ol class="brand-phases" aria-hidden="true"><li data-phase="0">${t2("01 / Signals", "01 / Сигнали")}</li><li data-phase="1">${t2("02 / Edit", "02 / Редагування")}</li><li data-phase="2">${t2("03 / Resolve", "03 / Розв’язка")}</li><li class="brand-progress"><i></i></li></ol>
      <p class="brand-caption"><span class="brand-line"><span>${t2("Many signals.", "Багато сигналів.")}</span></span><span class="brand-line"><span>${t2("One perspective.", "Один погляд.")}</span></span><small>AI TODAY BRIEF / AFTER HOURS</small></p>
      <button type="button" class="brand-replay" data-brand-replay aria-label="${t2("Replay The Resolve", "Повторити The Resolve")}">${`<svg class="icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>`}</button>
    </div>`;
  }

  /* Deterministic scatter for rib i (no randomness: every replay looks the same). */
  function scatter(i) {
    const angle = (i * 137.5 * Math.PI) / 180;
    const radius = 26 + (i % 5) * 9;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius * 0.7 - 18;
    const rot = ((i % 7) - 3) * 3.2;
    return { dx, dy, rot };
  }
  const tf = (dx, dy, rot, s) => `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${s})`;

  function brandTracks(stage) {
    const D = BRAND_DURATION;
    const o = (ms) => Math.max(0, Math.min(1, ms / D));
    const tracks = [];
    const add = (element, keys, extra = {}) => element && tracks.push({ element, keys, ...extra });
    stage.querySelectorAll(".rs-rib").forEach((rib, i) => {
      const { dx, dy, rot } = scatter(i);
      const appear = 80 + i * 22;
      const alignStart = 760 + i * 38;
      const alignEnd = alignStart + 960;
      const strumAt = 2140 + i * 24;
      add(rib, [
        { offset: 0, transform: tf(dx, dy, rot, 0.92), opacity: 0, strokeDasharray: "0.02 0.07", strokeDashoffset: 0 },
        { offset: o(appear + 320), transform: tf(dx * 0.9, dy * 0.9 - 4, rot * 0.9, 0.93), opacity: 0.55, strokeDasharray: "0.02 0.07", strokeDashoffset: -0.09, easing: "cubic-bezier(.4,0,.6,1)" },
        { offset: o(alignStart), transform: tf(dx * 0.78, dy * 0.78 - 6, rot * 0.7, 0.94), opacity: 0.62, strokeDasharray: "0.03 0.06", strokeDashoffset: -0.16, easing: "cubic-bezier(.22,.8,.2,1)" },
        { offset: o(alignEnd), transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
        { offset: o(strumAt), transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0, easing: "cubic-bezier(.3,.7,.3,1)" },
        { offset: o(strumAt + 80), transform: tf(0, 0, 0, 1.014), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
        { offset: o(strumAt + 170), transform: tf(0, 0, 0, 0.994), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
        { offset: o(strumAt + 270), transform: tf(0, 0, 0, 1.004), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
        { offset: o(strumAt + 380), transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
        { offset: 1, transform: tf(0, 0, 0, 1), opacity: 1, strokeDasharray: "1 0", strokeDashoffset: 0 },
      ]);
    });
    const hold = (el, from, to, start, end, easing = "cubic-bezier(.2,.8,.2,1)") =>
      add(el, [{ ...from, offset: 0 }, { ...from, offset: o(start), easing }, { ...to, offset: o(end) }, { ...to, offset: 1 }]);
    hold(stage.querySelector(".rs-light"), { opacity: 0 }, { opacity: 1 }, 0, 1300, "ease-out");
    hold(stage.querySelector(".rs-shadow"), { transform: "scaleX(.45)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }, 700, 1900);
    hold(stage.querySelector(".rs-bridge"), { transform: "scaleX(0)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }, 1650, 2150);
    hold(stage.querySelector(".rs-sheen"), { transform: "skewX(-18deg) translateX(0px)", opacity: 1 }, { transform: "skewX(-18deg) translateX(720px)", opacity: 1 }, 2050, 2900, "cubic-bezier(.45,0,.35,1)");
    hold(stage.querySelector(".rs-leader"), { strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }, 2280, 2620);
    // The signal lands just off the beat: after the strum has started, never on it.
    add(stage.querySelector(".rs-dot"), [
      { offset: 0, transform: "translateY(-44px) scale(.6)", opacity: 0 },
      { offset: o(2380), transform: "translateY(-44px) scale(.6)", opacity: 0, easing: "cubic-bezier(.55,0,.9,.4)" },
      { offset: o(2600), transform: "translateY(2px) scale(1.16, .84)", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
      { offset: o(2760), transform: "translateY(-3px) scale(.95, 1.06)", opacity: 1 },
      { offset: o(2900), transform: "translateY(0) scale(1)", opacity: 1 },
      { offset: 1, transform: "translateY(0) scale(1)", opacity: 1 },
    ]);
    hold(stage.querySelector(".rs-ripple"), { transform: "scale(.6)" }, { transform: "scale(2.8)" }, 2600, 3350, "ease-out");
    add(stage.querySelector(".rs-ripple"), [{ opacity: 0, offset: 0 }, { opacity: 0, offset: o(2600) }, { opacity: 0.7, offset: o(2680) }, { opacity: 0, offset: o(3350) }, { opacity: 0, offset: 1 }], { channel: "ripple-fade" });
    hold(stage.querySelector(".rs-halo"), { transform: "scale(.85)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }, 2800, 3300);
    // Phase labels follow the story; the rule underneath is the whole scene's progress.
    stage.querySelectorAll("[data-phase]").forEach((label, i) => {
      const [start, end] = [[0, 900], [900, 2050], [2050, D]][i];
      add(label, [{ opacity: 0.4, offset: 0 }, { opacity: 0.4, offset: o(Math.max(0, start - 1)) }, { opacity: 1, offset: o(start + 120) }, { opacity: 1, offset: o(end - 120) }, { opacity: i === 2 ? 1 : 0.55, offset: o(end) }, { opacity: i === 2 ? 1 : 0.55, offset: 1 }]);
    });
    add(stage.querySelector(".brand-progress i"), [{ transform: "scaleX(0)", offset: 0 }, { transform: "scaleX(1)", offset: 1 }], { easing: "linear" });
    stage.querySelectorAll(".brand-line > span").forEach((line, i) =>
      hold(line, { transform: "translateY(105%)" }, { transform: "translateY(0)" }, 2700 + i * 170, 3300 + i * 100),
    );
    return tracks;
  }

  function cancelBrand(stage) {
    const previous = brandScenes.get(stage);
    brandScenes.delete(stage);
    previous?.forEach((animation) => animation.cancel());
  }

  function playBrand(stage, options = {}) {
    if (!stage) return;
    if (!canMove()) {
      // Never leave the pre-roll state behind: without motion the finished mark is the scene.
      stage.dataset.brandPlayed = "true";
      return;
    }
    const inspecting = Number.isFinite(options.time);
    if (stage.dataset.brandState === "playing" && !inspecting) return;
    cancelBrand(stage);
    const tracks = brandTracks(stage);
    stage.dataset.brandState = inspecting ? "paused" : "playing";
    stage.dataset.brandPlayed = "true";
    stage.querySelector("[data-brand-replay]")?.setAttribute("aria-disabled", String(!inspecting));
    const started = document.timeline.currentTime;
    const scene = tracks.map(({ element, keys, easing }) => {
      const animation = element.animate(keys, { duration: BRAND_DURATION, easing: easing || "linear", fill: inspecting ? "both" : "none" });
      track(brandMotions, animation);
      if (inspecting) {
        animation.pause();
        animation.currentTime = Math.max(0, Math.min(BRAND_DURATION, options.time));
      } else animation.startTime = started;
      return animation;
    });
    brandScenes.set(stage, scene);
    if (inspecting) return;
    Promise.all(scene.map((animation) => animation.finished))
      .then(() => {
        if (brandScenes.get(stage) !== scene) return;
        brandScenes.delete(stage);
        stage.dataset.brandState = "rest";
        stage.querySelector("[data-brand-replay]")?.setAttribute("aria-disabled", "false");
      })
      .catch(() => {
        /* Cancellation restores the underlying, complete SVG. */
      });
  }

  function tensionLine(element) {
    const line = element?.querySelector(".tension-rule");
    if (!line) return;
    animate(line, [{ transform: "scaleX(0)", opacity: 0.8 }, { transform: "scaleX(1)", opacity: 0.8, offset: 0.7 }, { transform: "scaleX(1)", opacity: 0 }], { duration: 840 });
  }

  function prepareRules() {
    document.querySelectorAll(".dateline,.section-head,.newsletter").forEach((element) => {
      if (!element.querySelector(":scope > .tension-rule")) element.insertAdjacentHTML("beforeend", '<i class="tension-rule" aria-hidden="true"></i>');
    });
  }

  function navMotion() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const rail = document.createElement("i");
    rail.className = "tension-nav-rail";
    rail.setAttribute("aria-hidden", "true");
    nav.append(rail);
    let position = null;
    const moveTo = (link) => {
      if (!link || getComputedStyle(nav).display === "none") {
        rail.style.opacity = "0";
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = link.getBoundingClientRect();
      const next = `translateX(${box.left - navBox.left}px) scaleX(${box.width})`;
      rail.style.transform = next;
      rail.style.opacity = "1";
      if (position) animate(rail, [{ transform: position }, { transform: next }], { duration: 380 }, "rail");
      position = next;
    };
    moveTo(nav.querySelector(".nav-link.active"));
    nav.addEventListener("pointerover", (event) => { if (pointer.matches) moveTo(event.target.closest(".nav-link")); }, { signal: lifecycle.signal });
    nav.addEventListener("pointerleave", () => moveTo(nav.querySelector(".nav-link.active")), { signal: lifecycle.signal });
    nav.addEventListener("focusin", (event) => moveTo(event.target.closest(".nav-link")), { signal: lifecycle.signal });
    nav.addEventListener("focusout", (event) => { if (!nav.contains(event.relatedTarget)) moveTo(nav.querySelector(".nav-link.active")); }, { signal: lifecycle.signal });
  }

  /* Tables of contents mark the chapter being read with aria-current="location". */
  function setupReading() {
    const links = [...document.querySelectorAll(".toc [data-anchor], .weekly-toc [data-anchor], .toc-card [data-anchor]")];
    if (!links.length) return;
    chapters = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        const selected = visible[0].target.id;
        links.forEach((link) => {
          if (link.dataset.anchor === selected) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-12% 0px -60% 0px", threshold: 0 },
    );
    links.forEach((link) => {
      const heading = document.getElementById(link.dataset.anchor);
      if (heading) chapters.observe(heading);
    });
  }

  function pictureGesture(card) {
    const grooves = card.querySelector(".cat-banner-grooves");
    animate(grooves, [{ transform: "translateY(6px)" }, { transform: "translateY(0)" }], { duration: 700 }, "picture");
    animate(card.querySelector(".cat-banner-dot"), [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 520, delay: 120 }, "picture-dot");
  }

  function observeEntrances() {
    entrances?.disconnect();
    entrances = new IntersectionObserver(
      (entries) => {
        let offset = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          entrances.unobserve(entry.target);
          entry.target.dataset.tensionSeen = "true";
          if (entry.target.matches(".brand-stage")) {
            playBrand(entry.target);
            continue;
          }
          gesture(entry.target, entry.target.dataset.gesture, Math.min(offset, 160));
          tensionLine(entry.target);
          offset += 35;
        }
      },
      { threshold: 0.14 },
    );
    const groups = [
      [".story-card,.feature-card,.topic-tile,.path-card,.spec-card,.empty,.newsletter,.gesture-card,.format-card,.article-takeaways,.memory-stack section,.request-layers section,.metric-grid section,.use-card,.transfer-grid section,.evidence-frame section,.term-card,.question-card,.job-card,.instrument,.topic-card,.ticket,.daily-item,.chapter,.benefit-grid li,.ad-card,.process li,.try-card,.board-list li,.remember li,.cycle li,.steps li", "settle"],
      [".velvet-band,.workbench-panel,.article-hero,.guide-feature,.weekly-cover-copy,.about-art", "fold"],
      [".ranked-list li,.archive-row,.result-row,.related li,.mini-list li,.coverage-table tbody tr", "index"],
      [".callout,.why-callout,.editor-note,.editors-view", "reveal"],
      [".concept-map svg,.proto-flow,.calendar", "draw"],
      [".mix-bar span,.trend-bar span,.bench-track span", "grow"],
      [".sleeve-art.cover,.sleeve .sleeve-art", "record"],
      ["[data-count]", "count"],
      [".brand-stage", "brand"],
    ];
    groups.forEach(([selector, kind]) =>
      document.querySelectorAll(selector).forEach((element) => {
        element.dataset.gesture = kind;
        if (!seen.has(element)) entrances.observe(element);
      }),
    );
  }

  function pageEntrance() {
    document.querySelectorAll("#main h1").forEach((heading) => gesture(heading, "curtain"));
    document.querySelectorAll("#main .lede, #main .dek, .page-intro > p, .masthead-copy > p").forEach((text) => gesture(text, "reveal", 90));
    document.querySelectorAll(".lead-copy,.brief-rail,.byline,.discovery-toolbar,.format-switch,.now-playing,.shelf-toolbar").forEach((element, index) => gesture(element, "index", 60 + index * 45));
    tensionLine(document.querySelector(".dateline"));
    observeEntrances();
  }

  function confirm(element) {
    if (!element?.textContent.trim()) return;
    gesture(element, "confirm");
    element.classList.add("tension-confirm");
    later(() => element.classList.remove("tension-confirm"), 800);
  }

  function dynamicStates() {
    changes = new MutationObserver((records) => {
      const updated = new Set();
      for (const record of records) {
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (!element) continue;
        if (record.attributeName === "open" && element.open) gesture(element.matches("dialog") ? element : element.lastElementChild, "disclose");
        if (record.attributeName === "aria-pressed" && element.getAttribute("aria-pressed") === "true") confirm(element);
        if (record.attributeName === "data-visible" && element.id === "toast" && element.dataset.visible === "true") gesture(element, "reveal");
        if (record.attributeName === "hidden" && !element.hidden) gesture(element, element.matches("[data-daily-done]") ? "confirm" : "disclose");
        if (record.type === "childList" || record.type === "characterData") updated.add(element);
      }
      for (const element of updated) {
        if (element.matches(".form-status,[data-retry-status]")) confirm(element);
        if (element.matches(".lint-output,.output-code,#settings-warnings,#instructions-lint")) gesture(element, "reveal");
      }
    });
    document.querySelectorAll("dialog,#toast,.form-status,[data-retry-status],.lint-output,.output-code,#settings-warnings,#instructions-lint,[data-action='save-story'],[data-action='mark-read'],[data-action='topic'],[data-daily-done],.story-card-why,#consent-panel").forEach((element) => {
      changes.observe(element, { childList: true, characterData: true, subtree: element.matches(".output-code,.lint-output") ? false : true, attributes: true, attributeFilter: ["open", "aria-pressed", "data-visible", "hidden"] });
    });
  }

  function bindInteractions() {
    const pressable = ".button,.chip,.pill,.icon-btn,.brand-replay,.lang-btn";
    document.addEventListener("pointerup", (event) => {
      const control = event.target.closest(pressable);
      if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true") gesture(control, "press");
    }, { signal: lifecycle.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const control = event.target.closest(pressable);
      if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true") gesture(control, "press");
    }, { signal: lifecycle.signal });
    document.querySelectorAll(".story-card,.feature-card").forEach((card) => {
      card.addEventListener("pointerenter", () => { if (pointer.matches) pictureGesture(card); }, { signal: lifecycle.signal });
    });
    document.querySelectorAll(".wordmark, .nav-mark").forEach((mark) => {
      const ring = () => strum(mark.querySelector(".brand-mark"));
      mark.addEventListener("pointerenter", () => { if (pointer.matches) ring(); }, { signal: lifecycle.signal });
      mark.addEventListener("focus", ring, { signal: lifecycle.signal });
    });
    document.addEventListener("click", (event) => {
      const replay = event.target.closest("[data-brand-replay]");
      if (replay && replay.getAttribute("aria-disabled") !== "true") playBrand(replay.closest(".brand-stage"));
      const demo = event.target.closest("[data-gesture-demo]");
      if (demo) {
        const card = demo.closest(".gesture-card");
        const kind = demo.dataset.gestureDemo;
        const target = kind === "strum" ? card.querySelector(".brand-mark") : kind === "count" ? card.querySelector("[data-count]") : kind === "draw" ? card.querySelector("svg") : card.querySelector(".gesture-shape");
        if (kind === "count") counters.delete(target);
        gesture(target, kind);
      }
      if (event.target.closest("[data-tension-toggle]")) setQuiet(!quiet, true);
      if (event.target.closest("[data-frame-probe]")) measureBrand();
    }, { signal: lifecycle.signal });
  }

  function syncQuiet() {
    root.dataset.tensionMotion = quiet || media.matches ? "off" : "on";
    if (quiet || media.matches) document.querySelectorAll(".brand-stage").forEach((stage) => (stage.dataset.brandPlayed = "true"));
    document.querySelectorAll("[data-tension-toggle]").forEach((button) => {
      button.disabled = media.matches;
      button.setAttribute("aria-pressed", String(!quiet && !media.matches));
      button.textContent = media.matches ? tr("System reduced motion", "Системний спокій") : quiet ? tr("Motion off", "Рух вимкнено") : tr("Motion on", "Рух увімкнено");
    });
    document.querySelectorAll("[data-brand-replay],[data-gesture-demo],[data-frame-probe]").forEach((button) => {
      button.disabled = quiet || media.matches;
    });
  }

  function setQuiet(value, persist = false) {
    quiet = value;
    if (quiet || media.matches) stop();
    syncQuiet();
    if (persist) document.dispatchEvent(new CustomEvent("tension:preference", { detail: { quiet } }));
  }

  function mount(options = {}) {
    unmount();
    mounted = true;
    lifecycle = new AbortController();
    locale = options.lang || "en";
    route = options.route || "home";
    quiet = Boolean(options.quiet);
    peak = 0;
    root.dataset.tension = "v3";
    root.dataset.tensionRoute = route;
    // Pages render the static scene themselves (SSR-safe); empty slots are filled here.
    document.querySelectorAll("[data-brand-slot],[data-brand-example]").forEach((slot) => {
      if (!slot.querySelector(".brand-stage")) slot.innerHTML = brandMarkup(locale);
    });
    document.querySelectorAll(".workbench-panel.output-panel").forEach((section) => section.classList.add("tension-output"));
    prepareRules();
    document.querySelectorAll(".gesture-card").forEach((card) => {
      const kind = card.querySelector("[data-gesture-demo]").dataset.gestureDemo;
      card.dataset.gestureKind = kind;
    });
    navMotion();
    setupReading();
    bindInteractions();
    dynamicStates();
    syncQuiet();
    pageEntrance();
    metrics();
    media.addEventListener("change", () => { stop(); syncQuiet(); }, { signal: lifecycle.signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); }, { signal: lifecycle.signal });
    window.addEventListener("pagehide", stop, { signal: lifecycle.signal });
  }

  function replay() {
    stop();
    pageEntrance();
    document.querySelectorAll(".brand-stage").forEach((stage) => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0) playBrand(stage);
    });
  }

  // Opt-in, bounded diagnostics. No frame loop runs during ordinary reading.
  function measureBrand() {
    const stage = document.querySelector(".brand-stage");
    const output = document.querySelector("[data-proof-frames]");
    if (!stage || !output || !canMove()) return;
    stop();
    stage.scrollIntoView({ block: "center", behavior: "instant" });
    peak = 0;
    playBrand(stage);
    const started = performance.now();
    let previous = started;
    const gaps = [];
    const sample = (now) => {
      gaps.push(now - previous);
      previous = now;
      if (now - started < BRAND_DURATION + 300 && canMove()) {
        frameProbe = requestAnimationFrame(sample);
        return;
      }
      frameProbe = 0;
      const sorted = [...gaps].sort((a, b) => a - b);
      output.textContent = JSON.stringify({ samples: gaps.length, p95ms: Number((sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1)), over34ms: gaps.filter((gap) => gap > 34).length, peakWAAPI: peak, activeAfter: motions.size + brandMotions.size, viewport: `${innerWidth}×${innerHeight}` });
    };
    output.textContent = tr("Measuring one 3.7 s replay…", "Вимірюється один повтор, 3,7 с…");
    frameProbe = requestAnimationFrame(sample);
  }

  function gestureStage(kind) {
    if (kind === "strum") return `<div class="gesture-stage" aria-hidden="true">${typeof markSvg === "function" ? markSvg(72) : ""}</div>`;
    if (kind === "count") return `<div class="gesture-stage" aria-hidden="true"><span class="gesture-number" data-count="120">120</span></div>`;
    if (kind === "draw") return `<div class="gesture-stage" aria-hidden="true"><svg viewBox="0 0 160 70" class="gesture-draw"><path pathLength="1" d="M10 60 L80 10 L150 60"/><path pathLength="1" d="M40 60 L80 32 L120 60"/><circle pathLength="1" cx="140" cy="16" r="6"/></svg></div>`;
    if (kind === "curtain") return `<div class="gesture-stage" aria-hidden="true"><p class="gesture-shape gesture-headline">${tr("Tomorrow, in context.", "Майбутнє з контекстом.")}</p></div>`;
    return `<div class="gesture-stage" aria-hidden="true"><div class="gesture-shape"></div></div>`;
  }

  function catalog(tx) {
    return `<section class="motion-atlas"><header class="page-intro">${`<p class="eyebrow">After Hours / Tension v3</p>`}<h1>${tx("Tension &amp; <em>resolve.</em>", "Напруга й <em>розв’язка.</em>")}</h1><p class="lede">${tx("A jazz idea as a motion system: interface gestures build a little tension; the brand resolves it. Twelve gestures, one signature, every layout.", "Джазова ідея як система руху: жести інтерфейсу створюють легку напругу, бренд її розв’язує. Дванадцять жестів, один підпис, усі макети.")}</p></header>
      <div class="atlas-brand"><div data-brand-example></div><div class="atlas-brand-copy"><p class="eyebrow">The Resolve · 3.4 s</p><h2>${tx("Many signals.<br>One perspective.", "Багато сигналів.<br>Один погляд.")}</h2><ol class="act-list"><li><strong>${tx("Signals", "Сигнали")}</strong>${tx("Sixteen brass ribs arrive as scattered dashes — the noise of a news day.", "Шістнадцять латунних ребер з’являються розсіяними штрихами — шум новинного дня.")}</li><li><strong>${tx("Edit", "Редагування")}</strong>${tx("Fragments join into lines and every leg rises from the baseline to the crown.", "Фрагменти зливаються в лінії, кожна ніжка підіймається від основи до вершини.")}</li><li><strong>${tx("Strum", "Акорд")}</strong>${tx("A resonance wave runs through the grooves while a brass sheen crosses the mark.", "Хвиля резонансу проходить крізь ребра, а латунний відблиск перетинає знак.")}</li><li><strong>${tx("Resolve", "Розв’язка")}</strong>${tx("The celadon point lands just off the beat and rings once.", "Celadon-крапка приземляється трохи поза тактом і звучить один раз.")}</li></ol><div class="button-row"><button type="button" class="tension-quiet-toggle" data-tension-toggle aria-pressed="true">${tx("Motion on", "Рух увімкнено")}</button><a class="button outline" href="#/home">${tx("See it on the homepage", "Переглянути на головній")}</a><a class="button ghost" href="../after-hours-motion/fold-review.html">${tx("Frame by frame", "Покадрово")}</a></div></div></div>
      <div class="gesture-grid">${gestures.map(([kind, en, uk, descEn, descUk, timing], index) => `<article class="gesture-card"><p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${timing}</p><h3>${tx(en, uk)}</h3><p>${tx(descEn, descUk)}</p>${gestureStage(kind)}<button type="button" class="button outline" data-gesture-demo="${kind}">${tx("Replay gesture", "Повторити жест")}</button></article>`).join("")}</div>
      <details class="tension-proof"><summary>${tx("Performance / live diagnostics", "Performance / жива перевірка")}</summary><p>${tx("WAAPI counters are real runtime counts. The brand scene has its own atomic budget; UI gestures are capped at 32. Frame sampling runs only when requested.", "Лічильники WAAPI — реальні активні анімації. Брендова сцена має власний атомарний бюджет; жести UI обмежені 32. Замір кадрів — лише за запитом.")}</p><dl><dt>${tx("Active / cap", "Активні / ліміт")}</dt><dd data-proof-active>0</dd><dt>${tx("Peak in this view", "Пік цього перегляду")}</dt><dd data-proof-peak>0</dd><dt>SVG</dt><dd>16 ribs × 4 strokes · 1 mask · no filters</dd><dt>${tx("Frame sample", "Вимірювання кадрів")}</dt><dd><code data-proof-frames>${tx("Not measured", "Не виміряно")}</code></dd></dl><button type="button" class="button outline" data-frame-probe>${tx("Measure one replay", "Виміряти один повтор")}</button></details></section>`;
  }

  function registerCatalog() {
    if (routes.includes("motion")) return;
    routes.push("motion");
    renderers.motion = () => catalog(t);
  }

  return { mount, unmount, replay, setQuiet, registerCatalog, brandMarkup, playBrand, previewBrand: (stage, time) => playBrand(stage, { time }), duration: BRAND_DURATION };
})();
