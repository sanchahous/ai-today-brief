/* Additive study layer. The editorial layout and demo actions come from After Hours. */
(() => {
  TensionMotion.registerCatalog();
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const concepts = {
    tension: {
      number: "01", name: "Tension", duration: 720, stagger: 55,
      tagline: ["Tension v2 · One material. Nine gestures. Every page.", "Tension v2 · Один матеріал. Дев’ять жестів. Усі сторінки."],
      description: ["The selected direction, developed across the whole publication. Nine distinct gestures share the same material tension. The Editorial Fold gathers brass ribs into the brand’s A on the homepage.", "Обраний напрям, розвинений для всього видання. Дев’ять різних жестів поєднані відчуттям натягу матеріалу. Editorial Fold на головній збирає латунні ребра у брендову A."],
      formula: "m = 1 · k = 240 · c = 24 · touch 160 / shift 320 / settle 640 ms",
      rows: [
        ["Entrance", "Поява", "Weighted arrival, cover unfold, index alignment", "Поява з вагою, розкриття обкладинок, вирівнювання рядків"],
        ["Rules & art", "Лінії й арт", "Centre-out tension; 2.2 s Editorial Fold signature", "Натяг від центру; брендовий Editorial Fold за 2,2 с"],
        ["Hover / press", "Hover / натискання", "Sliding navigation, illustrated card responses, 97.5% press", "Рухома навігація, різні відгуки ілюстрацій, стиснення до 97,5%"],
        ["Focus", "Фокус", "Immediate celadon outline; centred underline", "Миттєва celadon-рамка; підкреслення від центру"],
      ],
    },
    signal: {
      number: "02", name: "Quiet Signal", duration: 640, stagger: 85,
      tagline: ["One signal. A clearer point of view.", "Один сигнал. Чіткіший погляд."],
      description: ["A signal travelling through an editorial circuit. A brass rule leads; the headline and supporting stories answer. Recommended for After Hours: precise, readable and distinctive.", "Сигнал проходить редакційною схемою. Латунна лінія задає напрям, заголовок і короткі новини відгукуються. Рекомендую для After Hours: точний, читабельний і впізнаваний характер."],
      formula: "p(t) = cubic-bezier(.2,.75,.25,1) · Δt = 85 ms · line = 900 ms",
      rows: [
        ["Entrance", "Поява", "A 6 px left-to-right handoff; 85 ms between parts", "Передача зліва направо на 6 px; 85 мс між елементами"],
        ["Rules & art", "Лінії й арт", "One 900 ms trace, then rest; no blinking signal", "Одне проходження за 900 мс, потім спокій; без миготіння"],
        ["Hover / press", "Hover / натискання", "Directional fill; arrow travels 3 px; short press", "Спрямоване заповнення; стрілка рухається на 3 px; короткий відгук"],
        ["Focus", "Фокус", "Immediate outline; line connects focus to action", "Миттєва рамка; лінія пов’язує фокус із дією"],
      ],
    },
    tide: {
      number: "03", name: "Undertow", duration: 1100, stagger: 100,
      tagline: ["A gentle current beneath the page.", "М’яка течія під поверхнею сторінки."],
      description: ["A slow wave crossing glass and brass. Typography rises as a whole; contours open in a soft sequence. The most atmospheric direction, especially for weekly long reads.", "Повільна хвиля проходить крізь скло й латунь. Типографіка піднімається цілісно; контури розкриваються м’якою послідовністю. Найбільш атмосферний напрям, особливо для тижневого читання."],
      formula: "y(t) = A · (1 + cos(πt)) / 2 · A ≤ 10 px · Δt = 100 ms",
      rows: [
        ["Entrance", "Поява", "10 px cosine rise, 1100 ms; text stays whole", "Підйом 10 px за косинусом, 1100 мс; текст лишається цілісним"],
        ["Rules & art", "Лінії й арт", "Three offset contours; one 1500 ms wave", "Три зміщені контури; одна хвиля за 1500 мс"],
        ["Hover / press", "Hover / натискання", "Soft rising fill, 460 ms response; no cursor chasing", "М’яке заповнення знизу, відгук 460 мс; без стеження за курсором"],
        ["Focus", "Фокус", "Immediate outline; calm expansion from the centre", "Миттєва рамка; спокійне розкриття від центру"],
      ],
    },
  };
  let concept = Object.hasOwn(concepts, params.get("concept")) ? params.get("concept") : "tension";
  let disabled = params.get("motion") === "off";
  let observer;
  let listeners;
  const active = new Set();
  const channels = new WeakMap();
  const lab = document.getElementById("motion-lab");
  const notes = document.getElementById("motion-notes");
  const baseRender = render;
  const text = (pair) => t(pair[0], pair[1]);
  const enabled = () => !disabled && !reduced.matches && !document.hidden;

  function animate(element, frames, options, channel = "default") {
    if (!element || !enabled()) return;
    let slots = channels.get(element);
    if (!slots) { slots = new Map(); channels.set(element, slots); }
    slots.get(channel)?.cancel();
    const animation = element.animate(frames, { fill: "none", ...options });
    slots.set(channel, animation);
    active.add(animation);
    const release = () => {
      active.delete(animation);
      if (slots.get(channel) === animation) slots.delete(channel);
    };
    animation.onfinish = release;
    animation.oncancel = release;
  }

  function stop() {
    observer?.disconnect();
    for (const animation of active) animation.cancel();
    active.clear();
    if (concept === "tension") TensionMotion.setQuiet(true);
  }

  // Analytic underdamped spring: mass 1, stiffness 220, damping 26.
  function springResidual(time) {
    const damp = 13;
    const frequency = Math.sqrt(220 - damp * damp);
    return Math.exp(-damp * time) * (Math.cos(frequency * time) + damp / frequency * Math.sin(frequency * time));
  }

  function entranceFrames() {
    if (concept === "signal") return [
      { opacity: .35, transform: "translateX(-6px)" },
      { opacity: 1, transform: "translateX(0)" },
    ];
    return Array.from({ length: 41 }, (_, index) => {
      const progress = index / 40;
      const residual = concept === "tension" ? springResidual(progress * .72) : (1 + Math.cos(Math.PI * progress)) / 2;
      return { offset: progress, opacity: .35 + .65 * Math.min(1, progress * 4), transform: `translateY(${index === 40 ? 0 : residual * (concept === "tension" ? 8 : 10)}px)` };
    });
  }

  function enter(element, delay = 0) {
    animate(element, entranceFrames(), { duration: concepts[concept].duration, delay, easing: concept === "signal" ? "cubic-bezier(.2,.75,.25,1)" : "linear", fill: "backwards" });
  }

  function line(element, delay = 0) {
    if (!element) return;
    element.style.transformOrigin = concept === "signal" ? "left" : "center";
    animate(element, [
      { transform: "scaleX(0)", opacity: .7 },
      { transform: "scaleX(1)", opacity: .7, offset: .7 },
      { transform: "scaleX(1)", opacity: 0 },
    ], { duration: concept === "tide" ? 1500 : 900, delay, easing: "cubic-bezier(.22,.61,.36,1)" });
  }

  function fieldMarkup() {
    const paths = {
      tension: ["M 40 260 Q 50 60 180 56 Q 310 60 320 260", "M 62 260 Q 70 83 180 79 Q 290 83 298 260", "M 84 260 Q 92 106 180 102 Q 268 106 276 260"],
      signal: ["M 18 260 H 82 L 172 104 H 340", "M 18 274 H 91 L 181 118 H 340", "M 18 288 H 100 L 190 132 H 340"],
      tide: ["M -60 220 Q 45 70 170 200 T 440 160", "M -60 244 Q 45 94 170 224 T 440 184", "M -60 268 Q 45 118 170 248 T 440 208"],
    };
    return `<svg class="motion-field" viewBox="0 0 360 365" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${paths[concept].map((d) => `<path d="${d}" pathLength="1"/>`).join("")}</svg><span class="motion-signature" aria-hidden="true">${concepts[concept].number} / ${concepts[concept].name.toUpperCase()}</span>`;
  }

  function playField() {
    document.querySelectorAll(".motion-field path").forEach((path, index) => {
      if (concept === "signal") {
        animate(path, [{ strokeDasharray: "1 1", strokeDashoffset: 1, opacity: .2 }, { strokeDasharray: "1 1", strokeDashoffset: 0, opacity: 1 }], { duration: 1100, delay: index * 85, easing: "cubic-bezier(.2,.75,.25,1)" });
      } else if (concept === "tension") {
        animate(path, Array.from({ length: 41 }, (_, step) => ({ offset: step / 40, transform: `translateY(${step === 40 ? 0 : springResidual(step / 40 * .72) * (8 + index * 3)}px)`, opacity: .25 + .75 * step / 40 })), { duration: 720, delay: index * 40 });
      } else {
        animate(path, [{ transform: "translate(-14px,12px)", opacity: 0 }, { opacity: .9, offset: .55 }, { transform: "translate(0,0)", opacity: 1 }], { duration: 1500, delay: index * 100, easing: "cubic-bezier(.22,.61,.36,1)" });
      }
    });
    const picture = document.querySelector(".lead-art img");
    const frames = concept === "tension" ? [{ transform: "scale(1.025)" }, { transform: "scale(1)" }] : concept === "signal" ? [{ transform: "translateX(-4px) scale(1.025)" }, { transform: "translateX(0) scale(1)" }] : [{ transform: "translateY(6px) scale(1.04)" }, { transform: "translateY(0) scale(1)" }];
    animate(picture, frames, { duration: concepts[concept].duration + 350, easing: "cubic-bezier(.22,.61,.36,1)" });
  }

  function playEntrance() {
    if (concept === "tension") {
      TensionMotion.setQuiet(disabled);
      TensionMotion.replay();
      return;
    }
    stop();
    if (!enabled()) return;
    const targets = document.querySelectorAll(".masthead h1, .masthead > p, .lead-copy, .lead-art, .brief-rail > .eyebrow, .brief-rail > h2, .mini-row, .brief-rail > .button, .signal-strip");
    targets.forEach((element, index) => enter(element, Math.min(index * concepts[concept].stagger, 420)));
    line(document.querySelector(".dateline .motion-line"));
    playField();
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        enter(entry.target);
        line(entry.target.querySelector(".motion-line"));
        observer.unobserve(entry.target);
      }
    }, { threshold: .12 });
    document.querySelectorAll(".section-head, .card, .week-block, .newsletter").forEach((element) => observer.observe(element));
  }

  function drawNotes() {
    const item = concepts[concept];
    notes.innerHTML = `<div class="motion-notes-content"><form method="dialog"><button class="close" aria-label="${t("Close notes", "Закрити опис")}">×</button></form><p class="eyebrow">AFTER HOURS / MOTION STUDY ${item.number}</p><h2 id="motion-notes-title">${item.name}</h2><p>${text(item.description)}</p><table><thead><tr><th>${t("Moment", "Момент")}</th><th>${t("Motion language", "Мова руху")}</th></tr></thead><tbody>${item.rows.map((row) => `<tr><td>${t(row[0], row[1])}</td><td>${t(row[2], row[3])}</td></tr>`).join("")}</tbody></table><p class="motion-spec"><code>${item.formula}</code></p><p>${t("Try the lead CTA, navigation, cards, the email field and keyboard Tab. Scroll to see section entrances. Replay restarts the first impression; Motion off shows the static baseline.", "Спробуйте головну кнопку, навігацію, картки, email-поле та Tab на клавіатурі. Прокрутіть сторінку для появи секцій. «Повторити» відтворює перше враження; «Рух вимкнено» показує статичну основу.")}</p><p>${t("No continuous loops, flashing, sound, text retyping or scroll hijacking. System reduced-motion always wins. The focus outline appears immediately. These are design proposals, not measured performance results.", "Без нескінченних циклів, спалахів, звуку, передруковування тексту чи перехоплення скролу. Системне reduced-motion має пріоритет. Рамка фокусу з’являється миттєво. Це дизайн-пропозиції, а не виміряні результати продуктивності.")}</p><p class="motion-status">${t("Prototype content · no emails sent · no production changes", "Демонстраційний контент · листи не надсилаються · production без змін")}</p></div>`;
  }

  function drawBar() {
    root.dataset.concept = concept;
    root.dataset.motion = disabled || reduced.matches ? "off" : "on";
    lab.innerHTML = `<div class="motion-bar"><div class="motion-brand">AFTER HOURS<strong>MOTION STUDIES</strong></div><div class="motion-options" role="group" aria-label="${t("Motion concept", "Motion-концепт")}">${Object.entries(concepts).map(([key, item]) => `<button data-concept-choice="${key}" aria-pressed="${key === concept}"><small>${item.number}</small>${item.name}</button>`).join("")}</div><div class="motion-actions"><button class="motion-replay" data-replay>${t("↻ Replay", "↻ Повторити")}</button><button data-motion-toggle aria-pressed="${!disabled && !reduced.matches}" ${reduced.matches ? "disabled" : ""}>${reduced.matches ? t("Reduced motion", "Системний спокій") : disabled ? t("Motion off", "Рух вимкнено") : t("Motion on", "Рух увімкнено")}</button><button data-notes>${t("Concept notes ↗", "Про концепт ↗")}</button></div></div><div class="motion-caption"><span>${text(concepts[concept].tagline)}</span><span>${t("Hover · focus · press · scroll / illustrative content", "Hover · focus · натискання · скрол / демонстраційний контент")}</span></div>`;
    drawNotes();
    if (concept === "tension") lab.querySelector(".motion-actions")?.insertAdjacentHTML("beforeend", `<a class="motion-atlas-link" href="#/motion">${t("Motion atlas ↗", "Атлас руху ↗")}</a>`);
  }

  function saveUrl() {
    const url = new URL(location.href);
    url.searchParams.set("concept", concept);
    if (disabled) url.searchParams.set("motion", "off");
    else url.searchParams.delete("motion");
    history.replaceState(null, "", url);
  }

  function decorate() {
    if (currentRoute() === "motion" && concept !== "tension") { concept = "tension"; saveUrl(); }
    listeners?.abort();
    listeners = new AbortController();
    document.querySelectorAll('#app img[src^="assets/"]').forEach((img) => img.setAttribute("src", "../after-hours/" + img.getAttribute("src")));
    if (concept === "tension") {
      TensionMotion.mount({ route: currentRoute(), lang, quiet: disabled });
      document.title = `${labels()[currentRoute()]} — Tension v2 / After Hours`;
      drawBar();
      return;
    }
    document.querySelectorAll(".dateline, .section-head, .mini-row, .newsletter").forEach((element) => element.insertAdjacentHTML("beforeend", '<i class="motion-line" aria-hidden="true"></i>'));
    const artwork = document.querySelector(".lead-art");
    artwork?.insertAdjacentHTML("beforeend", fieldMarkup());
    artwork?.addEventListener("pointerenter", () => { if (finePointer.matches) playField(); }, { signal: listeners.signal });
    document.querySelectorAll(".mini-row, .newsletter").forEach((element) => {
      element.addEventListener("pointerenter", () => { if (finePointer.matches) line(element.querySelector(".motion-line")); }, { signal: listeners.signal });
      element.addEventListener("focusin", () => line(element.querySelector(".motion-line")), { signal: listeners.signal });
    });
    document.querySelectorAll(".button, .icon-btn").forEach((element) => {
      element.addEventListener("pointerup", () => {
        if (concept !== "tension") return;
        animate(element, Array.from({ length: 31 }, (_, step) => ({ offset: step / 30, scale: String(step === 30 ? 1 : 1 - .025 * springResidual(step / 30 * .72)) })), { duration: 720 }, "press");
      }, { signal: listeners.signal });
    });
    document.title = `${labels()[currentRoute()]} — ${concepts[concept].name} / After Hours`;
    drawBar();
    playEntrance();
  }

  // The base prototype calls this binding for language changes and hash navigation.
  render = function renderMotion(reset = true) {
    stop();
    TensionMotion.unmount();
    baseRender(reset);
    decorate();
  };

  lab.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.conceptChoice) {
      concept = button.dataset.conceptChoice;
      saveUrl();
      render(false);
      lab.querySelector(`[data-concept-choice="${concept}"]`).focus({ preventScroll: true });
    } else if (button.hasAttribute("data-replay")) {
      window.scrollTo({ top: 0, behavior: "instant" });
      playEntrance();
    } else if (button.hasAttribute("data-motion-toggle")) {
      disabled = !disabled;
      stop();
      saveUrl();
      drawBar();
      if (concept === "tension") TensionMotion.setQuiet(disabled);
      lab.querySelector("[data-motion-toggle]").focus({ preventScroll: true });
      if (!disabled) playEntrance();
    } else if (button.hasAttribute("data-notes")) {
      notes.showModal();
    }
  });
  document.addEventListener("tension:preference", (event) => {
    disabled = event.detail.quiet;
    saveUrl();
    drawBar();
  });
  reduced.addEventListener("change", () => { stop(); drawBar(); if (!reduced.matches) playEntrance(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", stop);
  decorate();
})();
