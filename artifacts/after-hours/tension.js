/* Shared by the complete After Hours prototype and the motion comparison.
   Static content is always the resting state. Motion never gates interaction. */
const TensionMotion = (() => {
  const root = document.documentElement;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = matchMedia("(hover: hover) and (pointer: fine)");
  const motions = new Set();
  const slots = new WeakMap();
  const timers = new Set();
  const seen = new WeakSet();
  const brandScenes = new Map();
  let brandSequence = 0;
  const maxActive = 32;
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
  let probeResult = null;
  const tr = (en, uk) => locale === "uk" ? uk : en;
  const canMove = () => mounted && !quiet && !media.matches && !document.hidden;

  const gestures = [
    ["settle", "Weighted arrival", "Поява з вагою", "A surface finds its resting position.", "Площина м’яко знаходить положення спокою.", "640 ms · 8 px"],
    ["fold", "Editorial unfold", "Редакційне розкриття", "A cover opens by a few degrees.", "Обкладинка розкривається на кілька градусів.", "760 ms · 5°"],
    ["index", "Index alignment", "Вирівнювання рядків", "Rows settle along the reading axis.", "Рядки стають на місце вздовж осі читання.", "440 ms · 7 px"],
    ["rule", "Tensioned rule", "Натяг лінії", "A rule grows out from its centre.", "Лінія натягується від центру до країв.", "620 ms · scaleX"],
    ["press", "Compression & release", "Стиснення й відпускання", "A short, tactile response to a decision.", "Короткий тактильний відгук на рішення.", "480 ms · 0.975 → 1"],
    ["focus", "Focus lock", "Фіксація фокусу", "The outline is immediate; its accent settles.", "Рамка миттєва; акцент спокійно фіксується.", "300 ms · line"],
    ["reveal", "Output reveal", "Розкриття результату", "The result appears as one readable block.", "Результат відкривається цілісним читабельним блоком.", "520 ms · 5 px"],
    ["confirm", "Quiet confirmation", "Тихе підтвердження", "An action locks into place without confetti.", "Дія фіксується коротким акцентом.", "420 ms · 0.985 → 1"],
    ["disclose", "Open the margin", "Розкриття примітки", "Supporting detail opens with a small release.", "Додатковий контекст розкривається коротким рухом.", "360 ms · 4 px"],
  ];

  function later(action, delay) {
    const id = setTimeout(() => { timers.delete(id); action(); }, delay);
    timers.add(id);
    return id;
  }

  function metrics() {
    root.dataset.tensionActive = String(motions.size);
    root.dataset.tensionPeak = String(peak);
    const active = document.querySelector("[data-proof-active]");
    if (active) active.textContent = `${motions.size} / ${maxActive}`;
    const peakNode = document.querySelector("[data-proof-peak]");
    if (peakNode) peakNode.textContent = String(peak);
  }

  function animate(element, frames, options = {}, channel = "main") {
    if (!element || !canMove()) return;
    let elementSlots = slots.get(element);
    if (!elementSlots) { elementSlots = new Map(); slots.set(element, elementSlots); }
    elementSlots.get(channel)?.cancel();
    // Skip decorative work at the cap; its underlying content remains visible.
    if (motions.size >= maxActive) return;
    const animation = element.animate(frames, { duration: 640, easing: "cubic-bezier(.18,.82,.26,1)", fill: "none", ...options });
    elementSlots.set(channel, animation);
    motions.add(animation);
    peak = Math.max(peak, motions.size);
    metrics();
    const release = () => {
      motions.delete(animation);
      if (elementSlots.get(channel) === animation) elementSlots.delete(channel);
      metrics();
    };
    animation.onfinish = release;
    animation.oncancel = release;
    return animation;
  }

  function spring(progress, seconds = .64) {
    const time = progress * seconds;
    const damp = 12;
    const frequency = Math.sqrt(240 - damp * damp);
    return Math.exp(-damp * time) * (Math.cos(frequency * time) + damp / frequency * Math.sin(frequency * time));
  }

  function sampled(transform, duration = .64) {
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
      animate(accent, [{ transform: "scaleX(.08)", opacity: .4 }, { transform: "scaleX(1)", opacity: 1 }], { ...options, duration: kind === "focus" ? 300 : 620 });
    } else if (kind === "fold") {
      animate(element, [{ transform: "perspective(900px) rotateY(-5deg) translateX(-5px)", opacity: .65 }, { transform: "perspective(900px) rotateY(0) translateX(0)", opacity: 1 }], { ...options, duration: 760 });
    } else if (kind === "index") {
      animate(element, [{ transform: "translateX(-7px)", opacity: .55 }, { transform: "translateX(0)", opacity: 1 }], { ...options, duration: 440 });
    } else if (kind === "press") {
      animate(element, sampled((r) => `scale(${1 - .025 * r})`, .48), { ...options, duration: 480, easing: "linear" });
    } else if (kind === "confirm") {
      animate(element, [{ transform: "scale(.985)", opacity: .65 }, { transform: "scale(1)", opacity: 1 }], { ...options, duration: 420 });
    } else if (kind === "reveal" || kind === "disclose") {
      animate(element, [{ transform: `translateY(${kind === "reveal" ? 5 : -4}px)`, opacity: .45 }, { transform: "translateY(0)", opacity: 1 }], { ...options, duration: kind === "reveal" ? 520 : 360 });
    } else {
      animate(element, sampled((r) => `translateY(${r * 8}px)`), { ...options, duration: 640, easing: "linear" });
    }
  }

  function stop() {
    brandScenes.clear();
    for (const motion of motions) motion.cancel();
    motions.clear();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (frameProbe) {
      cancelAnimationFrame(frameProbe);
      const output = document.querySelector("[data-proof-frames]");
      if (output) output.textContent = tr("Measurement cancelled", "Вимірювання зупинено");
    }
    frameProbe = 0;
    document.querySelectorAll('[data-fold-state="playing"],[data-fold-state="paused"]').forEach((stage) => {
      stage.dataset.foldState = "rest";
      stage.dataset.foldPlayed = "true";
      stage.querySelector("[data-fold-replay]")?.setAttribute("aria-disabled", "false");
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

  function brandMarkup(language = locale) {
    const tr = (en, uk) => language === "uk" ? uk : en;
    const id = `fold-${++brandSequence}`;
    const ribs = Array.from({ length: 16 }, (_, index) => {
      const inset = index * 6.4;
      const x = 69 + inset;
      // Parallel legs and tangent-continuous crowns, including the inner ribs.
      const apex = 399 - (270 - x) * 1.645;
      const right = 471 - inset;
      const path = `M${x} 399 L262 ${apex + 13.16} Q270 ${apex} 278 ${apex + 13.16} L${right} 399`;
      return `<g class="fold-rib" data-rib="${index}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${path}" stroke="url(#${id}-brass)" stroke-width="${index === 0 ? 2.6 : 1.8}"/><path d="${path}" stroke="url(#${id}-edge)" stroke-width=".55"/></g>`;
    }).join("");
    return `<div class="brand-fold" data-fold-state="rest" aria-label="${tr("The Editorial Fold: brass ribbons form the A of AI Today Brief", "The Editorial Fold: латунні ребра утворюють A — знак AI Today Brief")}"><svg viewBox="0 0 540 440" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}-brass" gradientUnits="userSpaceOnUse" x1="70" y1="90" x2="445" y2="375"><stop stop-color="#6f5c3d"/><stop offset=".26" stop-color="#ecd7a9"/><stop offset=".49" stop-color="#9a7f52"/><stop offset=".72" stop-color="#e8c995"/><stop offset="1" stop-color="#746247"/></linearGradient><linearGradient id="${id}-edge" gradientUnits="userSpaceOnUse" x1="140" y1="95" x2="400" y2="330"><stop stop-color="#fff0d0" stop-opacity=".7"/><stop offset=".5" stop-color="#fff0d0" stop-opacity=".08"/><stop offset="1" stop-color="#fff0d0" stop-opacity=".25"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5d8cc" stop-opacity=".06"/><stop offset=".5" stop-color="#b5d8cc" stop-opacity=".36"/><stop offset="1" stop-color="#b5d8cc" stop-opacity=".02"/></linearGradient><radialGradient id="${id}-shadow"><stop stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse class="fold-shadow" cx="270" cy="410" rx="205" ry="29" fill="url(#${id}-shadow)"/><g class="fold-ribs">${ribs}</g><g class="fold-bridge"><path d="M176 310 L355 310 L365 328 L165 328 Z" fill="url(#${id}-glass)" stroke="#b5d8cc" stroke-opacity=".45" stroke-width=".8"/><path d="M169 325 H361" stroke="#d4b483" stroke-width="1.2"/></g><g class="fold-signal"><circle class="fold-halo" cx="412" cy="107" r="23" fill="none" stroke="#b5d8cc" stroke-opacity=".15" stroke-width=".8"/><circle class="fold-dot" cx="412" cy="107" r="7" fill="#b5d8cc"/><path class="fold-leader" d="M392 143 L371 179" stroke="#b5d8cc" stroke-width=".7" stroke-opacity=".35"/></g><path d="M70 417 H470" stroke="#d4b483" stroke-opacity=".2" stroke-width=".6"/></svg><span class="fold-kicker">THE EDITORIAL FOLD</span><div class="fold-phase" aria-hidden="true"><span>${tr("01 / GATHER", "01 / ВІДБІР")}</span><span>${tr("02 / EDIT", "02 / РЕДАКТУРА")}</span><span>${tr("03 / CLARITY", "03 / ЯСНІСТЬ")}</span></div><div class="fold-caption"><strong>${tr("Many signals.<br>One perspective.", "Багато сигналів.<br>Один погляд.")}</strong><small>AI TODAY BRIEF / AFTER HOURS</small></div><button class="fold-replay" data-fold-replay aria-label="${tr("Replay the Editorial Fold", "Повторити Editorial Fold")}">↻</button></div>`;
  }

  // All ribs stay nested: the outside opens first, on one shared baseline.
  // Brand motion uses a monotonic release, not the interface's bouncy spring.
  function brandTracks(stage, rewind = 0) {
    const duration = 2200 + rewind;
    const unfold = "cubic-bezier(.32,0,.2,1)";
    const tracks = [];
    const track = (element, folded, resting, start, end) => {
      if (!element) return;
      const keys = [];
      if (rewind) keys.push({ ...resting, offset: 0, easing: "cubic-bezier(.45,0,.7,1)" });
      keys.push({ ...folded, offset: rewind / duration });
      if (start) keys.push({ ...folded, offset: (rewind + start) / duration });
      keys[keys.length - 1].easing = unfold;
      keys.push({ ...resting, offset: (rewind + end) / duration });
      if (end < 2200) keys.push({ ...resting, offset: 1 });
      tracks.push({ element, keys, duration });
    };
    stage.querySelectorAll(".fold-rib").forEach((rib, index) => {
      track(rib, { transform: "scale(.64,.24)" }, { transform: "scale(1,1)" }, index * 10, 1420 + index * 10);
    });
    track(stage.querySelector(".fold-ribs"), { transform: "skewX(-8deg)" }, { transform: "skewX(0deg)" }, 0, 1570);
    track(stage.querySelector(".fold-shadow"), { transform: "scaleX(.64)", opacity: .45 }, { transform: "scaleX(1)", opacity: 1 }, 0, 1570);
    track(stage.querySelector(".fold-bridge"), { transform: "translateY(6px) scaleX(.86)", opacity: 0 }, { transform: "translateY(0) scaleX(1)", opacity: 1 }, 1180, 1780);
    track(stage.querySelector(".fold-leader"), { transform: "scale(.9)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }, 1640, 2000);
    track(stage.querySelector(".fold-dot"), { transform: "scale(.65)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }, 1740, 2100);
    track(stage.querySelector(".fold-halo"), { transform: "scale(.9)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }, 1880, 2200);
    return tracks;
  }

  function cancelBrand(stage) {
    const previous = brandScenes.get(stage);
    brandScenes.delete(stage);
    previous?.forEach((animation) => { animation.cancel(); motions.delete(animation); });
  }

  function playBrand(stage, options = {}) {
    if (!stage || !canMove()) return;
    const inspecting = Number.isFinite(options.time);
    if (stage.dataset.foldState === "playing" && !inspecting) return;
    cancelBrand(stage);
    const rewind = !inspecting && options.rewind !== false && stage.dataset.foldPlayed === "true" ? 320 : 0;
    const tracks = brandTracks(stage, rewind);
    // Keep the sculpture atomic if another part of the page has used the budget.
    if (motions.size + tracks.length > maxActive) {
      stage.dataset.foldPlayed = "true";
      stage.dataset.foldState = "rest";
      stage.querySelector("[data-fold-replay]")?.setAttribute("aria-disabled", "false");
      return;
    }
    stage.dataset.foldState = inspecting ? "paused" : "playing";
    stage.dataset.foldPlayed = "true";
    stage.querySelector("[data-fold-replay]")?.setAttribute("aria-disabled", String(!inspecting));
    const started = document.timeline.currentTime;
    const scene = tracks.map(({ element, keys, duration }) => {
      const animation = animate(element, keys, { duration, easing: "linear", fill: inspecting ? "both" : "none" }, "brand");
      if (inspecting) {
        animation.pause();
        animation.currentTime = Math.max(0, Math.min(2200, options.time));
      } else animation.startTime = started;
      return animation;
    });
    brandScenes.set(stage, scene);
    if (inspecting) return;
    Promise.all(scene.map((animation) => animation.finished)).then(() => {
      if (brandScenes.get(stage) !== scene) return;
      brandScenes.delete(stage);
      stage.dataset.foldState = "rest";
      stage.querySelector("[data-fold-replay]")?.setAttribute("aria-disabled", "false");
    }).catch(() => { /* Cancellation restores the underlying, complete SVG. */ });
  }

  function tensionLine(element) {
    const line = element?.querySelector(".tension-rule");
    if (!line) return;
    animate(line, [{ transform: "scaleX(0)", opacity: .8 }, { transform: "scaleX(1)", opacity: .8, offset: .7 }, { transform: "scaleX(1)", opacity: 0 }], { duration: 840 });
  }

  function prepareRules() {
    document.querySelectorAll(".dateline,.section-head,.newsletter").forEach((element) => {
      if (!element.querySelector(".tension-rule")) element.insertAdjacentHTML("beforeend", '<i class="tension-rule" aria-hidden="true"></i>');
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
      if (!link) { rail.style.opacity = "0"; return; }
      if (getComputedStyle(nav).flexDirection === "column") return;
      const navBox = nav.getBoundingClientRect();
      const box = link.getBoundingClientRect();
      const next = `translateX(${box.left - navBox.left}px) scaleX(${box.width})`;
      rail.style.transform = next;
      rail.style.opacity = "1";
      if (position) animate(rail, [{ transform: position }, { transform: next }], { duration: 380 });
      position = next;
    };
    moveTo(nav.querySelector("a.active"));
    nav.addEventListener("pointerover", (event) => { if (pointer.matches) moveTo(event.target.closest("a")); }, { signal: lifecycle.signal });
    nav.addEventListener("pointerleave", () => moveTo(nav.querySelector("a.active")), { signal: lifecycle.signal });
    nav.addEventListener("focusin", (event) => moveTo(event.target.closest("a")), { signal: lifecycle.signal });
    nav.addEventListener("focusout", (event) => { if (!nav.contains(event.relatedTarget)) moveTo(nav.querySelector("a.active")); }, { signal: lifecycle.signal });
  }

  function setupReading() {
    const links = [...document.querySelectorAll(".toc [data-anchor]")];
    if (!links.length) return;
    chapters = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (!visible.length) return;
      const selected = visible[0].target.id;
      links.forEach((link) => {
        if (link.dataset.anchor === selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-10% 0px -55% 0px", threshold: 0 });
    links.forEach((link) => {
      const heading = document.getElementById(link.dataset.anchor);
      if (heading) chapters.observe(heading);
    });
  }

  function pictureGesture(card) {
    const bars = card.querySelectorAll(".diagram-lines i");
    bars.forEach((bar, index) => animate(bar, [{ transform: `skewY(-16deg) translateY(${index === 1 ? -7 : 7}px)` }, { transform: "skewY(-16deg) translateY(0)" }], { duration: 600, delay: index * 45 }));
    const orbit = card.querySelector(".diagram-orbit");
    animate(orbit, [{ transform: "rotate(-18deg) scale(.96)" }, { transform: "rotate(0) scale(1)" }], { duration: 760 });
    const code = card.querySelector(".diagram-code");
    gesture(code, "index");
  }

  function observeEntrances() {
    entrances?.disconnect();
    entrances = new IntersectionObserver((entries) => {
      let offset = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        entrances.unobserve(entry.target);
        entry.target.dataset.tensionSeen = "true";
        if (entry.target.matches(".brand-fold")) { playBrand(entry.target); continue; }
        gesture(entry.target, entry.target.dataset.gesture, Math.min(offset, 150));
        tensionLine(entry.target);
        offset += 35;
      }
    }, { threshold: .12 });
    const groups = [
      [".card,.spec-card,.empty,.newsletter,.step,.gesture-card,.article-variant-card,.article-takeaways,.memory-stack section,.request-layers section,.metric-grid section,.use-card,.transfer-grid section,.evidence-frame section,.article-related-card", "settle"],
      [".tool-card,.week-block,.brand-art,.workbench > section,.article-hero", "fold"],
      [".feed-row,.index-row", "index"],
      [".callout,.section-head", "reveal"],
      [".brand-fold", "brand"],
    ];
    groups.forEach(([selector, kind]) => document.querySelectorAll(selector).forEach((element) => {
      element.dataset.gesture = kind;
      if (!seen.has(element)) entrances.observe(element);
    }));
  }

  function pageEntrance() {
    document.querySelectorAll(".masthead h1,.page-intro h1,.article-top h1,.center-page h1").forEach((heading) => gesture(heading));
    document.querySelectorAll(".masthead > p,.page-intro > p,.article-top .dek,.center-page > p").forEach((text) => gesture(text, "reveal", 70));
    document.querySelectorAll(".lead-copy,.brief-rail,.byline,.filters,.article-variant-picker").forEach((element, index) => gesture(element, "index", index * 45));
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
    let searchTimer;
    changes = new MutationObserver((records) => {
      const updated = new Set();
      for (const record of records) {
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (!element) continue;
        if (record.attributeName === "open" && element.open) gesture(element, "disclose");
        if (record.attributeName === "class" && element.matches(".nav.open")) gesture(element, "disclose");
        if (record.attributeName === "aria-pressed") confirm(element);
        if (record.attributeName === "style" && element.id === "toast" && element.style.display === "block") gesture(element, "reveal");
        if (record.type === "childList" || record.type === "characterData") updated.add(element);
      }
      for (const element of updated) {
        if (element.matches(".form-status,[data-retry-status]")) confirm(element);
        if (element.matches("pre")) {
          gesture(element, "reveal");
          const edge = element.parentElement.querySelector(".tension-output-edge");
          animate(edge, [{ transform: "scaleY(0)", opacity: .8 }, { transform: "scaleY(1)", opacity: .8, offset: .65 }, { transform: "scaleY(1)", opacity: 0 }], { duration: 760 });
        }
        if (element.matches("#search-results,#page-results")) {
          clearTimeout(searchTimer);
          timers.delete(searchTimer);
          searchTimer = later(() => element.querySelectorAll(".search-result,.empty").forEach((result, index) => { if (index < 4) gesture(result, "index", index * 25); }), 100);
        }
      }
    });
    document.querySelectorAll("dialog,.nav,#toast,[data-save],.form-status,[data-retry-status],.workbench pre,#page-results,#search-results").forEach((element) => {
      changes.observe(element, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["open", "class", "aria-pressed", "style"] });
    });
    document.querySelectorAll("details").forEach((detail) => detail.addEventListener("toggle", () => {
      if (detail.open) [...detail.children].filter((child) => child.tagName !== "SUMMARY").forEach((child) => gesture(child, "disclose"));
    }, { signal: lifecycle.signal }));
  }

  function bindInteractions() {
    document.addEventListener("pointerup", (event) => {
      const control = event.target.closest(".button,.chip,.icon-btn,.fold-replay");
      if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true") gesture(control, "press");
    }, { signal: lifecycle.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const control = event.target.closest(".button,.chip,.icon-btn,.fold-replay");
      if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true") gesture(control, "press");
    }, { signal: lifecycle.signal });
    document.querySelectorAll(".card,.feed-row,.tool-card,.index-row").forEach((card) => {
      card.addEventListener("pointerenter", () => { if (pointer.matches) pictureGesture(card); }, { signal: lifecycle.signal });
      card.addEventListener("focusin", () => pictureGesture(card), { signal: lifecycle.signal });
    });
    document.querySelectorAll(".newsletter").forEach((panel) => panel.addEventListener("focusin", () => tensionLine(panel), { signal: lifecycle.signal }));
    document.addEventListener("click", (event) => {
      const replay = event.target.closest("[data-fold-replay]");
      if (replay) playBrand(replay.closest(".brand-fold"));
      const demo = event.target.closest("[data-gesture-demo]");
      if (demo) gesture(demo.closest(".gesture-card").querySelector(".gesture-shape"), demo.dataset.gestureDemo);
      if (event.target.closest("[data-tension-toggle]")) setQuiet(!quiet, true);
      if (event.target.closest("[data-frame-probe]")) measureBrand();
    }, { signal: lifecycle.signal });
  }

  function syncQuiet() {
    root.dataset.tensionMotion = quiet || media.matches ? "off" : "on";
    if (quiet || media.matches) document.querySelectorAll(".brand-fold").forEach((stage) => { stage.dataset.foldPlayed = "true"; });
    document.querySelectorAll("[data-tension-toggle]").forEach((button) => {
      button.disabled = media.matches;
      button.setAttribute("aria-pressed", String(!quiet && !media.matches));
      button.textContent = media.matches ? tr("System reduced motion", "Системний спокій") : quiet ? tr("Motion off", "Рух вимкнено") : tr("Motion on", "Рух увімкнено");
    });
    document.querySelectorAll("[data-fold-replay],[data-gesture-demo],[data-frame-probe]").forEach((button) => { button.disabled = quiet || media.matches; });
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
    root.dataset.tension = "v2";
    root.dataset.tensionRoute = route;
    if (route === "system") {
      document.querySelectorAll(".spec-card p").forEach((paragraph) => {
        if (paragraph.textContent.includes("140 ms") || paragraph.textContent.includes("140 мс")) paragraph.textContent = tr("Tension v2: 160 ms touch, 320 ms shift, 640 ms settle. Nine distinct gestures and a 2.2 s Editorial Fold on the homepage. Open the motion atlas for live examples.", "Tension v2: 160 мс відгук, 320 мс зміщення, 640 мс повернення. Дев’ять різних жестів і Editorial Fold на головній за 2,2 с. Живі приклади — в атласі руху.");
      });
    }
    if (route === "home") {
      const art = document.querySelector(".lead .lead-art");
      if (art) art.outerHTML = brandMarkup();
    }
    document.querySelectorAll("[data-brand-example]").forEach((placeholder) => { placeholder.innerHTML = brandMarkup(); });
    document.querySelectorAll(".workbench > section:has(pre)").forEach((section) => {
      section.classList.add("tension-output");
      section.insertAdjacentHTML("beforeend", '<i class="tension-output-edge" aria-hidden="true"></i>');
    });
    prepareRules();
    document.querySelectorAll(".gesture-card").forEach((card) => {
      const kind = card.querySelector("[data-gesture-demo]").dataset.gestureDemo;
      card.dataset.gestureKind = kind;
      const shape = card.querySelector(".gesture-shape");
      if (kind === "focus") shape.insertAdjacentHTML("beforeend", '<i class="gesture-accent"></i>');
      if (kind === "press") shape.textContent = "↗";
      if (kind === "confirm") shape.textContent = "✓";
      if (kind === "index") shape.textContent = "01 ─────\n02 ─────\n03 ─────";
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
    document.querySelectorAll(".brand-fold").forEach((stage) => {
      const bounds = stage.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0) playBrand(stage);
    });
  }

  // Opt-in, bounded diagnostics. No frame loop runs during ordinary reading.
  function measureBrand() {
    const stage = document.querySelector(".brand-fold");
    const output = document.querySelector("[data-proof-frames]");
    if (!stage || !output || !canMove()) return;
    stop();
    stage.scrollIntoView({ block: "center", behavior: "instant" });
    peak = 0;
    playBrand(stage, { rewind: false });
    const started = performance.now();
    let previous = started;
    const gaps = [];
    const sample = (now) => {
      gaps.push(now - previous);
      previous = now;
      if (now - started < 2500 && canMove()) { frameProbe = requestAnimationFrame(sample); return; }
      frameProbe = 0;
      const sorted = [...gaps].sort((a,b) => a-b);
      probeResult = { samples: gaps.length, p95ms: Number((sorted[Math.floor(sorted.length * .95)] || 0).toFixed(1)), over34ms: gaps.filter((gap) => gap > 34).length, peakWAAPI: peak, activeAfter: motions.size, viewport: `${innerWidth}×${innerHeight}` };
      output.textContent = JSON.stringify(probeResult);
    };
    output.textContent = tr("Measuring one 2.5 s replay…", "Вимірюється один повтор, 2,5 с…");
    frameProbe = requestAnimationFrame(sample);
  }

  function catalog(translate) {
    const tx = translate;
    return `<section class="motion-atlas"><div class="page-intro"><p class="eyebrow">AFTER HOURS / TENSION V2</p><h1>${tx("One material.<br><em>Nine gestures.</em>", "Один матеріал.<br><em>Дев’ять жестів.</em>")}</h1><p>${tx("The same tension, expressed differently for reading, choosing and creating.", "Спільний натяг, різні відгуки для читання, вибору та створення.")}</p></div><div class="grid2 section"><div data-brand-example></div><div class="motion-atlas-intro"><p class="eyebrow">THE EDITORIAL FOLD</p><h2 class="spaced">${tx("Many signals.<br>One perspective.", "Багато сигналів.<br>Один погляд.")}</h2><p>${tx("Sixteen brass ribs gather, find their tension and form the A of AI Today Brief. A celadon point seals the composition. The complete gesture ends in 2.2 seconds.", "Шістнадцять латунних ребер збираються, знаходять натяг і утворюють A — знак AI Today Brief. Celadon-крапка завершує композицію. Повний жест закінчується за 2,2 секунди.")}</p><p>${tx("No endless orbit. No cursor chasing. The page becomes still so you can read.", "Без нескінченного обертання та стеження за курсором. Сторінка заспокоюється, щоб дати читати.")}</p><div class="motion-atlas-head"><button class="tension-quiet-toggle" data-tension-toggle aria-pressed="true">${tx("Motion on", "Рух увімкнено")}</button><a class="button outline" href="#/home">${tx("See it on the homepage ↗", "Переглянути на головній ↗")}</a></div></div></div><div class="gesture-grid">${gestures.map(([kind,en,uk,descEn,descUk,timing],index) => `<article class="gesture-card"><p class="eyebrow">0${index+1} / ${timing}</p><h3>${tx(en,uk)}</h3><p>${tx(descEn,descUk)}</p><div class="gesture-stage" aria-hidden="true"><div class="gesture-shape"></div></div><button class="button outline" data-gesture-demo="${kind}">${tx("Replay gesture", "Повторити жест")} ↗</button></article>`).join("")}</div><section class="motion-route-map"><h2>${tx("Across the publication.", "У всьому виданні.")}</h2><p class="spaced">${tx("Open a layout and try its real interactions. Shared physics; a gesture appropriate to the task.", "Відкрийте макет і спробуйте його дії. Спільна фізика, жест відповідно до завдання.")}</p><div class="screen-map">${routes.filter((name) => name !== "motion").map((name) => `<a href="#/${name}"><span>${labels()[name]}</span>↗</a>`).join("")}</div></section><details class="tension-proof"><summary>${tx("Performance / live diagnostics", "Performance / жива перевірка")}</summary><p>${tx("WAAPI counters are real runtime counts. Frame sampling runs only when requested, for 2.5 seconds. This is a local observation, not a Core Web Vitals score.", "Лічильники WAAPI показують реальні активні анімації. Збір кадрів працює лише за запитом протягом 2,5 секунди. Це локальне спостереження, не оцінка Core Web Vitals.")}</p><dl><dt>${tx("Active / cap", "Активні / ліміт")}</dt><dd data-proof-active>0 / 32</dd><dt>${tx("Peak in this view", "Пік цього перегляду")}</dt><dd data-proof-peak>0</dd><dt>SVG</dt><dd>16 ribs · 2 accents · no filters</dd><dt>${tx("Frame sample", "Вимірювання кадрів")}</dt><dd><code data-proof-frames>${tx("Not measured", "Не виміряно")}</code></dd></dl><button class="button outline" data-frame-probe>${tx("Measure one replay", "Виміряти один повтор")}</button></details></section>`;
  }

  function registerCatalog() {
    if (routes.includes("motion")) return;
    routes.push("motion");
    renderers.motion = () => catalog(t);
    const system = renderers.system;
    renderers.system = () => system() + `<section class="tension-system-link"><p class="eyebrow">MOTION SYSTEM / TENSION V2</p><h2>${t("A material language of motion.", "Матеріальна мова руху.")}</h2><p>${t("Nine gestures, one brand signature, every layout. Explore the selected Tension direction.", "Дев’ять жестів, один брендовий образ, усі макети. Дослідіть обраний напрям Tension.")}</p><a class="button" href="#/motion">${t("Open motion atlas ↗", "Відкрити атлас руху ↗")}</a></section>`;
  }

  return { mount, unmount, replay, setQuiet, registerCatalog, brandMarkup, playBrand, previewBrand: (stage, time) => playBrand(stage, { time }) };
})();
