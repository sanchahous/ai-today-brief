/* After Hours prototype v3 — knowledge: Concepts shelf + detail, Guides library + detail, Categories map.
   Every hub leads with the reader’s job (find, compare, decide), then exposes the full index. */

const TYPE_LABELS = () => ({
  concept: t("Concept", "Концепт"),
  pattern: t("Pattern", "Патерн"),
  protocol: t("Protocol", "Протокол"),
  product: t("Product", "Продукт"),
  model: t("Model", "Модель"),
  library: t("Library / API", "Бібліотека / API"),
});
const conceptBySlug = (slug) => CONCEPTS.find((c) => c.slug === slug);

/* ── Concept map: HTML nodes over an SVG edge layer (keyboard- and screen-reader-friendly) ── */
const MAP_NODES = {
  "ai-agent": [50, 46], "tool-use": [24, 22], harness: [76, 24], mcp: [12, 50], "claude-code": [20, 80],
  "context-engineering": [80, 58], "prompt-caching": [92, 84], rag: [62, 86], "sub-agents": [42, 82], evals: [94, 36], "function-calling": [36, 10],
};
function conceptMap() {
  const edges = CONCEPT_LINKS.map(([a, b]) => {
    const [x1, y1] = MAP_NODES[a];
    const [x2, y2] = MAP_NODES[b];
    return `<line data-edge="${a} ${b}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="1"/>`;
  }).join("");
  // Short labels keep the map inside narrow screens; the full name stays the accessible name.
  const SHORT = { mcp: "MCP", "context-engineering": t("Context", "Контекст"), "prompt-caching": t("Caching", "Кешування"), "function-calling": t("Functions", "Функції"), harness: t("Harness", "Харнес") };
  const nodes = Object.entries(MAP_NODES)
    .map(([slug, [x, y]]) => {
      const c = conceptBySlug(slug);
      const label = SHORT[slug] ? `<span class="map-full">${esc(c.name)}</span><span class="map-short" aria-hidden="true">${esc(SHORT[slug])}</span>` : esc(c.name);
      return `<li style="--x:${x}%;--y:${y}%"><a class="map-node${slug === "ai-agent" ? " is-hub" : ""}" data-node="${slug}" href="${href(`concept?slug=${slug}`)}"${SHORT[slug] ? ` aria-label="${esc(c.name)}"` : ""}>${label}</a></li>`;
    })
    .join("");
  return `<figure class="concept-map" aria-labelledby="map-caption"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="map-edges">${edges}</g></svg><ul class="map-nodes">${nodes}</ul><figcaption id="map-caption">${t("How the core ideas connect. Hover or focus a term to trace its links.", "Як пов’язані ключові ідеї. Наведіть або сфокусуйтеся на терміні, щоб побачити зв’язки.")}</figcaption></figure>`;
}
function highlightMap(slug) {
  document.querySelectorAll(".concept-map [data-edge]").forEach((line) => line.classList.toggle("is-lit", Boolean(slug) && line.dataset.edge.split(" ").includes(slug)));
  document.querySelectorAll(".concept-map [data-node]").forEach((node) => {
    const linked = slug && CONCEPT_LINKS.some(([a, b]) => (a === slug && b === node.dataset.node) || (b === slug && a === node.dataset.node));
    node.classList.toggle("is-linked", Boolean(linked));
  });
}
["pointerover", "focusin"].forEach((type) =>
  document.addEventListener(type, (event) => {
    const node = event.target.closest?.(".concept-map [data-node]");
    if (node) highlightMap(node.dataset.node);
  }),
);
["pointerout", "focusout"].forEach((type) =>
  document.addEventListener(type, (event) => {
    if (event.target.closest?.(".concept-map [data-node]")) highlightMap(null);
  }),
);

/* ── 07 / Concepts ─────────────────────────────────────────────────────── */
function concepts() {
  const type = routeParam("type") || "all";
  const types = TYPE_LABELS();
  const list = CONCEPTS.filter((c) => type === "all" || c.type === type).sort((a, b) => a.name.localeCompare(b.name));
  const letters = [...new Set(list.map((c) => c.name[0].toUpperCase()))];
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const groups = letters.map((letter) => [letter, list.filter((c) => c.name[0].toUpperCase() === letter)]);
  const typeTab = (id, label) => {
    const n = id === "all" ? CONCEPTS.length : CONCEPTS.filter((c) => c.type === id).length;
    return `<li><a href="#/concepts${id === "all" ? "" : `?type=${id}`}"${type === id ? ' aria-current="page"' : ""}>${label}<span class="count">${n}</span></a></li>`;
  };
  const verifiedCount = CONCEPTS.filter((c) => c.verified === "verified").length;
  return `
  <header class="shelf-hero">
    <div class="shelf-copy">
      ${eyebrow(t("The reference shelf", "Полиця знань"))}
      <h1>${t("Know the language.<br><em>See the connections.</em>", "Знати мову.<br><em>Бачити зв’язки.</em>")}</h1>
      <p class="lede">${t("Plain-language explainers for the building blocks of AI engineering — each one cross-checked against official documentation and linked to the stories that use it.", "Пояснення простою мовою для будівельних блоків AI-інженерії — кожне звірене з офіційною документацією й пов’язане з матеріалами, де воно трапляється.")}</p>
      <dl class="shelf-stats"><div><dt>${t("entries", "статей")}</dt><dd>${CONCEPTS.length}</dd></div><div><dt>${t("types", "типів")}</dt><dd>${Object.keys(types).length}</dd></div><div><dt>${t("fully verified", "повністю перевірено")}</dt><dd>${verifiedCount}</dd></div></dl>
    </div>
    ${conceptMap()}
  </header>

  <section class="shelf-questions" aria-labelledby="questions-title">
    <h2 id="questions-title" class="eyebrow">${t("Start with a question", "Почніть із питання")}</h2>
    <ul>${[
      [t("How do agents use tools?", "Як агенти використовують інструменти?"), "concept?slug=tool-use", "agents"],
      [t("What belongs in the context window?", "Що має бути в контекстному вікні?"), "concept?slug=context-engineering", "cost"],
      [t("Which coding agent fits my workflow?", "Який агент для коду пасує моєму процесу?"), "guide?slug=claude-code-vs-cursor-vs-codex", "tools"],
    ]
      .map(([q, r, key]) => `<li><a class="question-card" href="${href(r)}" style="--cat:var(--cat-${key})"><span class="q-mark" aria-hidden="true">?</span><strong>${q}</strong>${icon("arrowRight", 20)}</a></li>`)
      .join("")}</ul>
  </section>

  <section class="shelf" aria-labelledby="shelf-title">
    <div class="shelf-toolbar">
      <h2 id="shelf-title" class="sr-only">${t("All entries", "Усі статті")}</h2>
      <nav class="tabs tabs-wrap" aria-label="${t("Entry type", "Тип статті")}"><ul>${typeTab("all", t("All", "Усі"))}${Object.entries(types).map(([id, label]) => typeTab(id, label)).join("")}</ul></nav>
      <div class="search-field search-field-sm"><label class="sr-only" for="shelf-q">${t("Filter entries", "Фільтр статей")}</label>${icon("search", 18)}<input id="shelf-q" type="search" placeholder="${t("Filter this shelf…", "Фільтр полиці…")}" autocomplete="off" aria-describedby="shelf-count"></div>
    </div>
    <nav class="az" aria-label="${t("Jump to letter", "Перейти до літери")}"><ul>${alphabet.map((l) => (letters.includes(l) ? `<li><a href="#letter-${l}" data-anchor="letter-${l}">${l}</a></li>` : `<li><span aria-hidden="true">${l}</span></li>`)).join("")}</ul></nav>
    <p class="results-line" id="shelf-count" role="status" aria-live="polite">${plural(list.length, ["entry", "entries"], ["стаття", "статті", "статей"])}</p>
    <div class="shelf-index">${groups
      .map(
        ([letter, items]) => `<section class="letter-group" id="letter-${letter}" aria-labelledby="lh-${letter}"><h3 class="letter" id="lh-${letter}">${letter}</h3><ul class="term-grid">${items
          .map(
            (c) => `<li data-term="${esc(`${c.name} ${L(c.def)}`.toLowerCase())}"><a class="term-card" href="${href(`concept?slug=${c.slug}`)}"><span class="term-top"><span class="term-type type-${c.type}">${types[c.type]}</span>${c.verified === "verified" ? `<span class="term-verified" title="${t("Verified against official docs", "Звірено з офіційною документацією")}">${icon("check", 14)}<span class="sr-only">${t("Verified", "Перевірено")}</span></span>` : ""}</span><strong>${esc(c.name)}</strong><span class="term-def">${esc(L(c.def))}</span><span class="term-meta">${plural(c.stories, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])} · ${t("checked", "перевірено")} ${fmtShort(c.verifiedAt)}</span></a></li>`,
          )
          .join("")}</ul></section>`,
      )
      .join("")}</div>
    <div class="empty" data-shelf-empty hidden><h3>${t("No entry matches.", "Немає збігів.")}</h3><p>${t("Try a shorter word, or search all stories.", "Спробуйте коротше слово або шукайте в усіх матеріалах.")}</p><a class="button outline" href="#/search">${t("Search everything", "Шукати всюди")}</a></div>
  </section>
  ${newsletter("inline")}`;
}

document.addEventListener("input", (event) => {
  if (event.target.id !== "shelf-q") return;
  const q = event.target.value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(".shelf-index [data-term]").forEach((item) => {
    const show = !q || item.dataset.term.includes(q);
    item.hidden = !show;
    if (show) visible++;
  });
  document.querySelectorAll(".letter-group").forEach((group) => (group.hidden = !group.querySelector("[data-term]:not([hidden])")));
  document.querySelector("[data-shelf-empty]").hidden = visible > 0;
  document.getElementById("shelf-count").textContent = plural(visible, ["entry", "entries"], ["стаття", "статті", "статей"]);
});

/* ── 08 / Concept detail ───────────────────────────────────────────────── */
function concept() {
  const c = conceptBySlug(routeParam("slug")) || conceptBySlug("mcp");
  const types = TYPE_LABELS();
  const related = CONCEPT_LINKS.filter(([a, b]) => a === c.slug || b === c.slug).map(([a, b]) => conceptBySlug(a === c.slug ? b : a));
  const extra = CONCEPTS.filter((x) => x.type === c.type && x.slug !== c.slug && !related.includes(x)).slice(0, 4 - Math.min(related.length, 3));
  const relatedAll = [...related, ...extra].slice(0, 5);
  const stories = NEWS_STORIES.filter((s) => s.tags.some((tag) => tag.toLowerCase() === c.name.toLowerCase() || c.slug.includes(tag.toLowerCase().replace(/\s+/g, "-")))).slice(0, 3);
  const feed = stories.length ? stories : NEWS_STORIES.slice(0, 3);
  const isMcp = c.slug === "mcp";
  const faq = isMcp
    ? [[t("Is a protocol the same as an agent?", "Протокол — це те саме, що агент?"), t("No. A protocol describes how software communicates; an agent is a system that acts toward a goal and may use MCP to reach tools.", "Ні. Протокол описує комунікацію; агент — система, що діє до мети й може використовувати MCP для доступу до інструментів.")], [t("Do I need MCP to use tools?", "Чи потрібен MCP для інструментів?"), t("No. Function calling works without it. MCP standardises the connection so one server works across many AI applications.", "Ні. Function calling працює і без нього. MCP стандартизує з’єднання, тож один сервер працює з багатьма застосунками.")], [t("Is MCP safe by default?", "Чи MCP безпечний за замовчуванням?"), t("It is as safe as the servers and permissions you grant. Treat every server like a dependency with access to your data.", "Настільки, наскільки безпечні сервери й дозволи, які ви надаєте. Ставтеся до кожного сервера як до залежності з доступом до даних.")]]
    : [[t(`What is ${c.name}?`, `Що таке ${c.name}?`), L(c.def)], [t("Where does it show up in practice?", "Де це трапляється на практиці?"), t(`In ${c.stories} stories from the last months — see the list below.`, `У ${c.stories} матеріалах за останні місяці — див. список нижче.`)]];
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("Concepts", "Концепти"), "concepts"], [esc(c.name)]])}
  <header class="concept-head">
    <div class="story-labels"><span class="term-type type-${c.type}">${types[c.type]}</span>${c.verified === "verified" ? `<span class="verified-chip">${icon("check", 14)}${t("Verified against official docs", "Звірено з офіційною документацією")}</span>` : `<span class="verified-chip is-partial">${icon("info", 14)}${t("Partially verified", "Частково перевірено")}</span>`}</div>
    <h1>${esc(c.name)}</h1>
    ${isMcp ? `<p class="aliases">${t("Also known as", "Також відомий як")}: <span>MCP</span></p>` : ""}
    <p class="dek definition"><strong>${esc(c.name)}</strong> — ${esc(L(c.def)).replace(/^./, (m) => m.toLowerCase())}</p>
    <ul class="concept-meta"><li><a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener">${t("Official site", "Офіційний сайт")}${icon("external", 14)}</a></li><li>${plural(c.stories, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])}</li><li>${t("Last verified", "Перевірено")} <time datetime="${c.verifiedAt}">${fmtDate(c.verifiedAt)}</time></li></ul>
  </header>
  <div class="article-layout concept-layout">
    <nav class="toc" aria-label="${t("On this page", "На цій сторінці")}"><p class="toc-title">${t("On this page", "На цій сторінці")}</p><ol><li><a href="#overview" data-anchor="overview">${t("In one sentence", "Одним реченням")}</a></li><li><a href="#how" data-anchor="how">${t("How it works", "Як це працює")}</a></li><li><a href="#fit" data-anchor="fit">${t("Where it fits", "Де застосовується")}</a></li><li><a href="#faq" data-anchor="faq">FAQ</a></li><li><a href="#verification" data-anchor="verification">${t("Verification", "Перевірка")}</a></li></ol></nav>
    <div class="reading">
      <div class="callout" id="overview">${eyebrow(t("In one sentence", "Одним реченням"))}<p>${esc(L(c.def))}</p></div>
      <h2 id="how">${t("How it works", "Як це працює")}</h2>
      ${isMcp ? `<figure class="protocol-diagram" aria-labelledby="proto-cap"><ol class="proto-flow"><li><span class="proto-role">Host</span><strong>${t("The AI application", "AI-застосунок")}</strong><small>${t("Claude, an IDE, your app", "Claude, IDE, ваш застосунок")}</small></li><li class="proto-arrow" aria-hidden="true">${icon("arrowRight", 22)}</li><li><span class="proto-role">Client</span><strong>${t("One connection per server", "Одне з’єднання на сервер")}</strong><small>JSON-RPC</small></li><li class="proto-arrow" aria-hidden="true">${icon("arrowRight", 22)}</li><li class="is-server"><span class="proto-role">Server</span><strong>${t("Tools · resources · prompts", "Інструменти · ресурси · промпти")}</strong><small>${t("GitHub, a database, files", "GitHub, база даних, файли")}</small></li></ol><figcaption id="proto-cap">${t("The host runs one client per server; each server exposes capabilities the model may call with permission.", "Host запускає по одному client на сервер; кожен сервер відкриває можливості, які модель може викликати з дозволу.")}</figcaption></figure>` : ""}
      <p>${t("The concept page leads with a direct answer, then expands into a small mental model, practical context and related terms. Production copy comes from the reviewed concept body and keeps its own verification date.", "Сторінка концепту починається з прямої відповіді, далі — модель роботи, практичний контекст і пов’язані терміни. Production-текст береться з перевіреного тіла концепту й має власну дату перевірки.")}</p>
      <h2 id="fit">${t("Where it fits", "Де застосовується")}</h2>
      <div class="table-scroll" role="region" aria-labelledby="fit" tabindex="0"><table><thead><tr><th scope="col">${t("If you need…", "Якщо потрібно…")}</th><th scope="col">${t("Reach for", "Беріть")}</th><th scope="col">${t("Watch for", "Стежте за")}</th></tr></thead><tbody><tr><td>${t("One tool in one app", "Один інструмент в одному застосунку")}</td><td>Function calling</td><td>${t("Duplicated glue code", "Дубльований glue-код")}</td></tr><tr><td>${t("The same tools across apps", "Ті самі інструменти в різних застосунках")}</td><td>MCP</td><td>${t("Server permissions", "Дозволи серверів")}</td></tr><tr><td>${t("Fresh documents in the prompt", "Свіжі документи в промпті")}</td><td>RAG</td><td>${t("Retrieval quality", "Якість пошуку")}</td></tr></tbody></table></div>
      <h2 id="faq">FAQ</h2>
      <div class="faq-list">${faq.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
      <section class="verification" id="verification" aria-labelledby="verification-title"><h2 id="verification-title">${t("Verification", "Перевірка")}</h2><p>${c.verified === "verified" ? t("Specific claims on this page were cross-checked against the official documentation.", "Конкретні твердження на цій сторінці звірено з офіційною документацією.") : t("Background statements could not all be cross-checked; treat them as orientation, not specification.", "Не всі фонові твердження вдалося звірити; сприймайте їх як орієнтир, а не специфікацію.")}</p><p class="meta">${t("Last verified", "Перевірено")} <time datetime="${c.verifiedAt}">${fmtDate(c.verifiedAt)}</time> · ${esc(L(EDITOR.name))}</p></section>
    </div>
    <aside class="concept-aside"><div class="rail-card"><p class="rail-title">${t("Related concepts", "Пов’язані концепти")}</p><ul class="tool-chips">${relatedAll.map((x) => `<li><a class="tag" href="${href(`concept?slug=${x.slug}`)}">${esc(x.name)}</a></li>`).join("")}</ul></div><div class="rail-card"><p class="rail-title">${t("Put it to work", "Застосуйте")}</p><a class="text-link" href="#/guide?slug=claude-code-vs-cursor-vs-codex">${t("Choose a coding-agent workflow", "Обрати процес з агентом")}${icon("arrowRight", 16)}</a><a class="text-link" href="#/tools">${t("Open the Toolbox", "Відкрити Toolbox")}${icon("arrowRight", 16)}</a></div></aside>
  </div>
  <section class="section" aria-labelledby="concept-stories"><div class="section-head"><h2 id="concept-stories">${t("Stories on this topic", "Матеріали на цю тему")}</h2><a class="section-link" href="${href(`news?q=${encodeURIComponent(c.name)}`)}">${t("All", "Усі")} ${c.stories}${icon("arrowRight", 18)}</a></div><div class="story-list">${feed.map(newsCard).join("")}</div></section>`;
}

/* ── 09 / Guides ───────────────────────────────────────────────────────── */
function guideMatrix() {
  const rows = [
    [t("Where it lives", "Де працює"), t("Terminal", "Термінал"), "IDE", t("Cloud sandbox", "Хмарна пісочниця")],
    [t("Autonomy", "Автономність"), "●●●", "●●○", "●●●"],
    [t("Best for", "Найкраще для"), t("Scripting & CI", "Скрипти й CI"), t("Inner loop", "Внутрішній цикл"), t("Delegation", "Делегування")],
  ];
  return `<div class="matrix" role="img" aria-label="${t("Preview of the comparison matrix", "Прев’ю матриці порівняння")}"><div class="matrix-row matrix-head"><span></span><span>Claude Code</span><span>Cursor</span><span>Codex</span></div>${rows.map((r) => `<div class="matrix-row">${r.map((cell, i) => `<span${i === 0 ? ' class="matrix-key"' : ""}>${cell}</span>`).join("")}</div>`).join("")}</div>`;
}
function benchChart() {
  const dims = [["Planning", "Планування", 82], ["Memory", "Пам’ять", 64], ["Token economy", "Токен-економіка", 71], ["Code", "Код", 88], ["Self-review", "Само-рев’ю", 58], ["Tests", "Тести", 76], ["Design", "Дизайн", 69], ["Debt honesty", "Чесність техборгу", 61]];
  return `<ol class="bench-bars" aria-label="${t("Illustrative score dimensions", "Демонстраційні виміри оцінки")}">${dims.map(([en, uk, v]) => `<li><span>${t(en, uk)}</span><span class="bench-track"><span style="--w:${v}%"></span></span><span class="bench-val">${v}</span></li>`).join("")}</ol>`;
}
function guides() {
  const [comparison, bench] = GUIDES;
  const meta = (g) => `<ul class="guide-meta"><li>${esc(L(g.level))}</li><li>${icon("clock", 16)}${g.read} ${t("min", "хв")}</li><li>${icon("check", 16)}${t("Verified", "Перевірено")} <time datetime="${g.lastVerified}">${fmtDate(g.lastVerified)}</time></li><li>${g.sections} ${t("sections", "розділів")}</li></ul>`;
  return `
  <header class="library-hero">
    <div>${eyebrow(t("The practical library", "Практична бібліотека"))}<h1>${t("Less guessing.<br><em>Better decisions.</em>", "Менше здогадок.<br><em>Кращі рішення.</em>")}</h1><p class="lede">${t("Living references for the decisions you actually face. We re-verify them on a schedule — the date on every guide is the trust signal.", "Живі довідники для рішень, які ви реально ухвалюєте. Ми регулярно їх перевіряємо — дата на кожному гайді і є сигнал довіри.")}</p></div>
    <ul class="promise-list"><li>${icon("calendar", 20)}<span><strong>${t("Re-verified every 90 days", "Перевірка кожні 90 днів")}</strong>${t("or when a release changes a claim", "або коли реліз змінює твердження")}</span></li><li>${icon("layers", 20)}<span><strong>${t("Structural claims only", "Лише структурні твердження")}</strong>${t("no prices or versions unless freshly checked", "без цін і версій, якщо не перевірено щойно")}</span></li><li>${icon("doc", 20)}<span><strong>${t("A changelog on every page", "Changelog на кожній сторінці")}</strong>${t("so you see what moved", "щоб бачити, що змінилося")}</span></li></ul>
  </header>
  <section class="guide-feature" aria-labelledby="g1-title">
    <div class="guide-feature-copy"><span class="format-chip">${t("Comparison", "Порівняння")}</span><h2 id="g1-title"><a href="#/guide?slug=${comparison.slug}">${esc(L(comparison.title))}</a></h2><p>${esc(L(comparison.description))}</p><p class="guide-outcome">${icon("check", 18)}<span>${esc(L(comparison.outcome))}</span></p>${meta(comparison)}<a class="button" href="#/guide?slug=${comparison.slug}">${t("Read the comparison", "Читати порівняння")}${icon("arrowRight", 18)}</a></div>
    <div class="guide-feature-visual">${guideMatrix()}</div>
  </section>
  <section class="guide-feature is-alt" aria-labelledby="g2-title">
    <div class="guide-feature-copy"><span class="format-chip">${t("Benchmark", "Бенчмарк")}</span><h2 id="g2-title"><a href="#/guide?slug=${bench.slug}">${esc(L(bench.title))}</a></h2><p>${esc(L(bench.description))}</p><p class="guide-outcome">${icon("check", 18)}<span>${esc(L(bench.outcome))}</span></p>${meta(bench)}<a class="button outline" href="#/guide?slug=${bench.slug}">${t("See the scores", "Переглянути оцінки")}${icon("arrowRight", 18)}</a></div>
    <div class="guide-feature-visual">${benchChart()}<p class="chart-note">${t("Illustrative dimensions; real run logs live in the guide.", "Демонстраційні виміри; реальні логи прогонів — у гайді.")}</p></div>
  </section>
  <section class="section job-chooser" aria-labelledby="jobs-title">
    ${sectionHead(t("Start from your job.", "Почніть зі своєї задачі."), null, "", "jobs-title")}
    <ul class="job-grid">${[
      ["compass", t("Choose a coding agent", "Обрати агента для коду"), t("Structural bets, team fit and a “choose this if” checklist.", "Структурні ставки, командний фіт і чекліст «обирайте, якщо»."), `guide?slug=${comparison.slug}`],
      ["eye", t("Evaluate a new release", "Оцінити новий реліз"), t("Read a result by its conditions: epic, harness, retries, review.", "Читайте результат за умовами: епік, харнес, повтори, рев’ю."), `guide?slug=${bench.slug}`],
      ["bolt", t("Cut agent spend", "Скоротити витрати агента"), t("A field guide to cache boundaries and what to measure.", "Технічний гайд про межі кешу й метрики."), "article?variant=technical"],
      ["shield", t("Ship with guardrails", "Випускати із запобіжниками"), t("Permissions and hooks you can review before exporting.", "Дозволи й hooks, які можна перевірити до експорту."), "settings"],
    ]
      .map(([ic, h, p, r]) => `<li><a class="job-card" href="${href(r)}"><span class="job-icon">${icon(ic, 24)}</span><strong>${h}</strong><span>${p}</span>${icon("arrowRight", 18)}</a></li>`)
      .join("")}</ul>
  </section>
  <section class="section verify-cycle" aria-labelledby="cycle-title">
    ${sectionHead(t("How a guide stays true.", "Як гайд лишається актуальним."), null, "", "cycle-title")}
    <ol class="cycle">${[[t("Draft", "Чернетка"), t("Structural claims, sourced.", "Структурні твердження з джерелами.")], [t("Verify", "Перевірка"), t("Editor’s fact pass against docs.", "Фактчек редактора за документацією.")], [t("Publish", "Публікація"), t("Date shown on page and in schema.", "Дата на сторінці та в schema.")], [t("Re-check", "Повторна перевірка"), t("Every 90 days or on a release.", "Кожні 90 днів або після релізу.")]].map(([h, p], i) => `<li><span class="cycle-no">0${i + 1}</span><strong>${h}</strong><span>${p}</span></li>`).join("")}</ol>
  </section>
  <section class="section" aria-labelledby="all-guides-title">
    ${sectionHead(t("All guides", "Усі гайди"), null, "", "all-guides-title")}
    <div class="table-scroll" role="region" aria-labelledby="all-guides-title" tabindex="0"><table class="guide-table"><thead><tr><th scope="col">${t("Guide", "Гайд")}</th><th scope="col">${t("Format", "Формат")}</th><th scope="col">${t("Reading", "Читання")}</th><th scope="col">${t("Last verified", "Перевірено")}</th></tr></thead><tbody>${GUIDES.map((g) => `<tr><th scope="row"><a href="#/guide?slug=${g.slug}">${esc(L(g.title))}</a></th><td>${esc(L(g.level))}</td><td>${g.read} ${t("min", "хв")}</td><td><time datetime="${g.lastVerified}">${fmtDate(g.lastVerified)}</time></td></tr>`).join("")}</tbody></table></div>
    <p class="suggest">${t("Missing a decision you face?", "Бракує рішення, з яким ви стикаєтесь?")} <a href="mailto:editor@aitodaybrief.com?subject=Guide%20request">${t("Suggest a guide", "Запропонуйте гайд")}</a></p>
  </section>
  ${newsletter("band")}`;
}

/* ── 10 / Guide detail ─────────────────────────────────────────────────── */
function guide() {
  const g = GUIDES.find((x) => x.slug === routeParam("slug")) || GUIDES[0];
  const isBench = g.format === "benchmark";
  const toc = isBench
    ? [["overview", t("What it measures", "Що вимірює")], ["epic", t("The fixed epic", "Фіксований епік")], ["scores", t("Scores", "Оцінки")], ["read", t("How to read a run", "Як читати прогін")], ["changelog", "Changelog"]]
    : [["overview", t("The core difference", "Головна різниця")], ["compare", t("Compare the bets", "Порівняння ставок")], ["choose", t("Choose this if", "Обирайте, якщо")], ["try", t("Try one task", "Спробуйте одну задачу")], ["changelog", "Changelog"]];
  const body = isBench
    ? `<div class="callout" id="overview">${eyebrow(t("The short answer", "Коротка відповідь"))}<p>${t("Leaderboards score isolated problems. This benchmark scores orchestrated delivery: an end-to-end epic with planning, memory, a token budget, self-review, tests and honest tech debt.", "Рейтинги оцінюють ізольовані задачі. Цей бенчмарк оцінює оркестровану доставку: епік під ключ з плануванням, пам’яттю, бюджетом токенів, само-рев’ю, тестами й чесним техборгом.")}</p></div><h2 id="epic">${t("The fixed epic", "Фіксований епік")}</h2><p>${t("Every tool receives the same one-page spec — a “Standup Tracker” with team CRUD, daily entries, analytics and responsive UI — in a fixed reference repository.", "Кожен інструмент отримує однакову специфікацію — «Standup Tracker» з CRUD команд, щоденними записами, аналітикою й адаптивним UI — у фіксованому репозиторії.")}</p><h2 id="scores">${t("Scores", "Оцінки")}</h2>${benchChart()}<p class="article-caption">${t("Illustrative values in the prototype; production shows dated run logs.", "У прототипі значення демонстраційні; production показує датовані логи прогонів.")}</p><h2 id="read">${t("How to read a run", "Як читати прогін")}</h2><ol class="rollout-list"><li><span>01</span><div><strong>${t("Check the harness version.", "Перевірте версію харнесу.")}</strong><p>${t("Scores move with the harness as much as with the model.", "Оцінки змінюються з харнесом не менше, ніж із моделлю.")}</p></div></li><li><span>02</span><div><strong>${t("Read retries and interventions.", "Дивіться на повтори й втручання.")}</strong><p>${t("They are part of the result, not setup noise.", "Вони — частина результату, а не шум налаштувань.")}</p></div></li></ol>`
    : `<div class="callout" id="overview">${eyebrow(t("The core difference", "Головна різниця"))}<p>${t("All three put a frontier model in your development loop, but they make different structural bets: where the agent lives, how much it does alone, and how it is extended.", "Усі три вбудовують передову модель у цикл розробки, але роблять різні структурні ставки: де живе агент, скільки робить сам і як розширюється.")}</p></div><h2 id="compare">${t("Compare the bets", "Порівняння ставок")}</h2><div class="table-scroll" role="region" aria-labelledby="compare" tabindex="0"><table><thead><tr><th scope="col"></th><th scope="col">Claude Code</th><th scope="col">Cursor</th><th scope="col">Codex</th></tr></thead><tbody><tr><th scope="row">${t("Interface", "Інтерфейс")}</th><td>${t("Terminal-first", "Термінал")}</td><td>${t("AI-native editor", "AI-native редактор")}</td><td>${t("Cloud tasks", "Хмарні задачі")}</td></tr><tr><th scope="row">${t("Autonomy", "Автономність")}</th><td>${t("High, scriptable", "Висока, скриптується")}</td><td>${t("Inline → agent", "Inline → агент")}</td><td>${t("Delegated, sandboxed", "Делегована, ізольована")}</td></tr><tr><th scope="row">${t("Extensibility", "Розширюваність")}</th><td>MCP, hooks</td><td>${t("Rules, MCP", "Rules, MCP")}</td><td>AGENTS.md</td></tr></tbody></table></div><h2 id="choose">${t("Choose this if", "Обирайте, якщо")}</h2><div class="use-grid"><section class="use-card positive">${eyebrow("Claude Code")}<ul><li>${t("You live in the terminal and CI.", "Ви живете в терміналі й CI.")}</li><li>${t("You want to script and pipe the agent.", "Хочете скриптувати агента.")}</li></ul></section><section class="use-card caution">${eyebrow("Cursor")}<ul><li>${t("The inner edit loop is your bottleneck.", "Вузьке місце — внутрішній цикл редагування.")}</li><li>${t("Your team shares one editor.", "Команда працює в одному редакторі.")}</li></ul></section></div><h2 id="try">${t("Try one small task", "Спробуйте одне мале завдання")}</h2><ol class="rollout-list"><li><span>01</span><div><strong>${t("Define the result before starting.", "Визначте результат до початку.")}</strong><p>${t("One sentence, one test.", "Одне речення, один тест.")}</p></div></li><li><span>02</span><div><strong>${t("Keep inputs identical across tools.", "Однакові вхідні дані для всіх інструментів.")}</strong><p>${t("Same repo, same prompt, same budget.", "Той самий репозиторій, промпт і бюджет.")}</p></div></li><li><span>03</span><div><strong>${t("Review the actual diff.", "Перегляньте фактичний diff.")}</strong><p>${t("Not the summary.", "Не підсумок.")}</p></div></li></ol>`;
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("Guides", "Гайди"), "guides"], [esc(L(g.title))]])}
  <header class="story-head guide-head"><div class="story-labels"><span class="format-chip">${esc(L(g.level))}</span><span class="verified-chip">${icon("check", 14)}${t("Last verified", "Перевірено")} <time datetime="${g.lastVerified}">${fmtDate(g.lastVerified)}</time></span></div><h1>${esc(L(g.title))}</h1><p class="dek">${esc(L(g.description))}</p>${byline({ updated: g.lastVerified, read: g.read })}</header>
  <div class="article-layout">
    <nav class="toc" aria-label="${t("On this page", "На цій сторінці")}"><p class="toc-title">${t("In this guide", "У гайді")}</p><ol>${toc.map(([id, label]) => `<li><a href="#${id}" data-anchor="${id}">${label}</a></li>`).join("")}</ol></nav>
    <div class="reading">${body}<section class="changelog" id="changelog" aria-labelledby="changelog-title"><h2 id="changelog-title">Changelog</h2><ol><li><time datetime="${g.lastVerified}">${fmtDate(g.lastVerified)}</time><span>${t("Re-verified; no structural changes.", "Повторно перевірено; структурних змін немає.")}</span></li><li><time datetime="2026-06-11">${fmtDate("2026-06-11")}</time><span>${t("First published.", "Перша публікація.")}</span></li></ol></section></div>
    <aside class="article-tools"><div class="format-note">${eyebrow(t("Guide", "Гайд"))}<p>${g.read} ${t("min", "хв")} · ${g.sections} ${t("sections", "розділів")}</p></div>${saveButton(`guide-${g.slug}`)}<button type="button" class="button outline" data-action="copy-link">${icon("link", 18)}${t("Copy link", "Копіювати")}</button><a class="text-link" href="#/guides">${icon("arrowLeft", 16)}${t("All guides", "Усі гайди")}</a></aside>
  </div>`;
}

/* ── 13 / Categories ───────────────────────────────────────────────────── */
function categories() {
  const total = CATEGORIES.reduce((sum, c) => sum + c.count, 0);
  const size = (n) => (n >= 20 ? "is-xl" : n >= 6 ? "is-md" : "is-sm");
  return `
  <header class="topics-hero">
    <div>${eyebrow(t("Explore by topic", "Досліджуйте за темою"))}<h1>${t("Follow your <em>curiosity.</em>", "Рухайтеся за <em>цікавістю.</em>")}</h1><p class="lede">${t("Nine editorial categories, sized by how much we covered them in the latest 100 stories. Each opens a filtered newsroom with its own concepts and guides.", "Дев’ять редакційних рубрик за обсягом покриття в останніх 100 матеріалах. Кожна відкриває відфільтровану стрічку з власними концептами й гайдами.")}</p></div>
    <figure class="mix mix-lg"><figcaption>${t("Coverage · latest 100 stories", "Покриття · останні 100 матеріалів")}</figcaption><div class="mix-bar" role="img" aria-label="${CATEGORIES.filter((c) => c.count).map((c) => `${catName(c)} ${c.count}`).join(", ")}">${CATEGORIES.filter((c) => c.count).map((c) => `<span data-cat-seg="${c.id}" style="--w:${(c.count / total) * 100}%;--art:var(--art-${c.key})"></span>`).join("")}</div><ul class="mix-legend">${CATEGORIES.map((c) => `<li style="--art:var(--art-${c.key})"><i aria-hidden="true"></i>${esc(catName(c))}<span>${c.count}</span></li>`).join("")}</ul></figure>
  </header>
  <section class="topic-map" aria-label="${t("All categories", "Усі категорії")}">
    ${CATEGORIES.map((c) => {
      const latest = NEWS_STORIES.find((s) => s.cat === c.id);
      return `<article class="topic-card ${size(c.count)}${c.count ? "" : " is-empty"}" data-cat-card="${c.id}" style="--cat:var(--cat-${c.key});--art:var(--art-${c.key})">
        <header><span class="topic-glyph">${glyph(c.key, 26)}</span><span class="topic-share">${c.count ? `${Math.round((c.count / total) * 100)}%` : "—"}</span></header>
        <h2><a href="${href(`category?c=${c.id}`)}">${esc(catName(c))}</a></h2>
        <p>${esc(L(c.desc))}</p>
        <ul class="subtopic-chips" aria-label="${t("Subtopics", "Підтеми")}">${c.subtopics.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        ${latest ? `<p class="topic-latest"><span>${t("Latest", "Найсвіжіше")}</span><a href="${href(`article?id=${latest.id}`)}">${esc(L(latest.title))}</a></p>` : c.count ? "" : `<p class="topic-latest is-empty">${t("No stories in the latest 100. The category stays so older coverage remains findable.", "Немає матеріалів серед останніх 100. Рубрика лишається, щоб давні матеріали було легко знайти.")}</p>`}
        <p class="topic-foot"><span>${plural(c.count, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])}</span><span class="topic-go">${t("Open", "Відкрити")}${icon("arrowRight", 16)}</span></p>
      </article>`;
    }).join("")}
  </section>
  ${newsletter("band")}`;
}
["pointerover", "focusin"].forEach((type) =>
  document.addEventListener(type, (event) => {
    const card = event.target.closest?.("[data-cat-card]");
    document.querySelectorAll("[data-cat-seg]").forEach((seg) => seg.classList.toggle("is-dim", Boolean(card) && seg.dataset.catSeg !== card.dataset.catCard));
  }),
);

/* Category hub primer: concepts to start with and a related guide (production CategoryHeader + hub body). */
function categoryPrimer(c) {
  const picks = CONCEPTS.filter((x) => c.subtopics.some((s) => x.name.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(x.name.toLowerCase()))).slice(0, 4);
  const fallback = picks.length ? picks : CONCEPTS.slice(0, 3);
  return `<section class="primer" aria-labelledby="primer-title"><h2 id="primer-title" class="eyebrow">${t("Start with the basics", "Почніть з основ")}</h2><ul class="tool-chips">${fallback.map((x) => `<li><a class="tag" href="${href(`concept?slug=${x.slug}`)}">${esc(x.name)}</a></li>`).join("")}</ul><a class="text-link" href="#/guides">${t("Related guide", "Пов’язаний гайд")}: ${esc(L(GUIDES[0].title)).split(":")[0]}${icon("arrowRight", 16)}</a></section>`;
}

Object.assign(renderers, { concepts, concept, guides, guide, categories });
