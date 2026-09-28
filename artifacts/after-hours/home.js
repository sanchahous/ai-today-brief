/* After Hours prototype v3 — home, news discovery (ADR 2026-09-26), search, reading list. */

const sectionHead = (title, route, text = t("Explore", "Переглянути"), id = "") =>
  `<div class="section-head"><h2${id ? ` id="${id}"` : ""}>${title}</h2>${route ? `<a class="section-link" href="${href(route)}">${text}${icon("arrowRight", 18)}</a>` : ""}</div>`;

const storyHref = (story) => href(`article?id=${story.id}`);
const storyMeta = (story) =>
  `<p class="card-meta"><time datetime="${story.date}">${fmtShort(story.date)}</time><span aria-hidden="true">·</span><span>${story.read} ${t("min", "хв")}</span>${story.video ? `<span aria-hidden="true">·</span><span class="has-video">${icon("play", 14)}${t("Video", "Відео")}</span>` : ""}</p>`;

/* ── Home ──────────────────────────────────────────────────────────────── */
function home() {
  const lead = NEWS_STORIES[0];
  const rail = NEWS_STORIES.slice(1, 4);
  const radar = NEWS_STORIES.slice(4, 9);
  const top6 = CATEGORIES.slice(0, 6);
  const total = CATEGORIES.reduce((sum, c) => sum + c.count, 0);
  const issue = WEEKLY_ISSUES[0];
  const maxMentions = Math.max(...TRENDING.map((x) => x.mentions));
  return `
  <section class="masthead" aria-labelledby="home-title">
    <div class="masthead-copy">
      ${eyebrow(t("Daily AI-engineering brief", "Щоденний бриф з AI-інженерії"))}
      <h1 id="home-title" class="display">${t("Tomorrow, <em>in context.</em>", "Майбутнє. <em>З контекстом.</em>")}</h1>
      <p class="lede">${t("AI news for people who build — a considered selection from 120+ sources and a clearer point of view, in five minutes a day.", "AI-новини для тих, хто створює: уважний відбір зі 120+ джерел і зрозумілий погляд — за п’ять хвилин на день.")}</p>
      <form class="hero-search" role="search" data-form="hero-search">
        <label class="sr-only" for="hero-q">${t("Search the archive", "Пошук в архіві")}</label>
        ${icon("search", 20, "hero-search-icon")}<input id="hero-q" name="q" type="search" autocomplete="off" placeholder="${t("Tool, topic or source…", "Інструмент, тема або джерело…")}"><button class="button">${t("Search", "Шукати")}</button>
      </form>
      <p class="popular"><span>${t("Popular", "Популярне")}</span>${["MCP", "Claude Code", "Prompt caching", "Local LLMs"].map((q) => `<a href="${href(`search?q=${encodeURIComponent(q)}`)}">${q}</a>`).join("")}</p>
    </div>
    <dl class="masthead-stats">
      <div><dt>${t("stories a week", "матеріалів на тиждень")}</dt><dd><span data-count="70">70</span>+</dd></div>
      <div><dt>${t("sources read daily", "джерел щодня")}</dt><dd><span data-count="120">120</span>+</dd></div>
      <div><dt>${t("editorial categories", "редакційних рубрик")}</dt><dd><span data-count="${CATEGORIES.length}">${CATEGORIES.length}</span></dd></div>
    </dl>
  </section>
  <div class="dateline"><span><span class="live-dot" aria-hidden="true"></span><strong>${t("Live edition", "Живий випуск")}</strong> · <time datetime="${TODAY.iso}">${fmtDate(TODAY.iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</time></span><span>${t("The daily edit · 5 min read", "Щоденний випуск · 5 хв")}</span></div>
  <section class="lead-grid" aria-label="${t("Today’s lead", "Головне сьогодні")}">
    <article class="lead">
      <div class="lead-copy">
        ${eyebrow(`${t("The big idea", "Головна тема")} / ${esc(catName(catById(lead.cat)))}`)}
        <h2><a href="${storyHref(lead)}">${esc(L(lead.title))}</a></h2>
        <p>${esc(L(lead.summary))}</p>
        ${storyMeta(lead)}
        <a class="button outline" href="${storyHref(lead)}">${t("Read the story", "Читати матеріал")}${icon("arrowUpRight", 18)}</a>
      </div>
      <div class="lead-stage" data-brand-slot>${TensionMotion.brandMarkup(lang)}</div>
    </article>
    <aside class="brief-rail" aria-labelledby="rail-title">
      ${eyebrow(t("Today, distilled", "Сьогодні. По суті."))}
      <h2 id="rail-title">${t("The short version.", "Коротка версія.")}</h2>
      <ol class="mini-list">${rail.map((s, i) => `<li><span class="mini-no">0${i + 1}</span><div><h3><a href="${storyHref(s)}">${esc(L(s.title))}</a></h3>${catBadge(s.cat, "cat-badge-plain")}</div></li>`).join("")}</ol>
      <a class="button" href="#/daily">${t("Read today’s brief", "Читати бриф дня")}${icon("arrowRight", 18)}</a>
    </aside>
  </section>
  <nav class="signal-strip" aria-label="${t("In focus", "У фокусі")}"><span class="eyebrow">${t("In focus", "У фокусі")}</span><ul>${["mcp", "sub-agents", "prompt-caching", "evals", "local-llm"].map((slug) => { const c = CONCEPTS.find((x) => x.slug === slug); return `<li><a href="${href(`concept?slug=${slug}`)}">${esc(c.name)}${icon("arrowUpRight", 16)}</a></li>`; }).join("")}</ul></nav>

  <section class="section radar" aria-labelledby="radar-title">
    ${sectionHead(t("Top of the week", "Головне за тиждень"), "news", t("All news", "Усі новини"), "radar-title")}
    <div class="radar-grid">
      <article class="feature-card">
        <a class="feature-media" href="${storyHref(radar[0])}" tabindex="-1" aria-hidden="true">${banner(radar[0], { glyph: 40 })}</a>
        <div class="feature-body"><div class="feature-labels"><span class="flag">${t("Editor’s pick", "Вибір редактора")}</span>${catBadge(radar[0].cat)}</div><h3><a href="${storyHref(radar[0])}">${esc(L(radar[0].title))}</a></h3><p>${esc(L(radar[0].summary))}</p>${storyMeta(radar[0])}</div>
      </article>
      <ol class="ranked-list">${radar.slice(1).map((s, i) => `<li><span class="rank">${String(i + 2).padStart(2, "0")}</span><div>${catBadge(s.cat, "cat-badge-plain")}<h3><a href="${storyHref(s)}">${esc(L(s.title))}</a></h3>${storyMeta(s)}</div></li>`).join("")}</ol>
    </div>
  </section>

  <section class="section coverage-section" aria-labelledby="coverage-title">
    ${sectionHead(t("Pick a direction.", "Оберіть напрям."), "categories", t("All categories", "Усі категорії"), "coverage-title")}
    <figure class="mix">
      <figcaption>${t("Coverage by category · latest 100 stories", "Покриття за категоріями · останні 100 матеріалів")}</figcaption>
      <div class="mix-bar" role="img" aria-label="${CATEGORIES.filter((c) => c.count).map((c) => `${catName(c)} ${c.count}`).join(", ")}">${CATEGORIES.filter((c) => c.count).map((c) => `<span style="--w:${(c.count / total) * 100}%;--art:var(--art-${c.key})"></span>`).join("")}</div>
    </figure>
    <div class="topic-bento">${top6
      .map((c, i) => {
        const latest = NEWS_STORIES.filter((s) => s.cat === c.id).slice(0, i < 2 ? 2 : 1);
        return `<article class="topic-tile${i < 2 ? " is-large" : ""}" style="--cat:var(--cat-${c.key});--art:var(--art-${c.key})"><header><span class="topic-glyph">${glyph(c.key, 22)}</span><h3><a href="${href(`category?c=${c.id}`)}">${esc(catName(c))}</a></h3><span class="topic-count">${plural(c.count, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])}</span></header><p>${esc(L(c.desc))}</p>${latest.length ? `<ul>${latest.map((s) => `<li><a href="${storyHref(s)}">${esc(L(s.title))}</a></li>`).join("")}</ul>` : ""}</article>`;
      })
      .join("")}</div>
  </section>

  <section class="velvet-band" aria-labelledby="weekly-home-title">
    <div class="velvet-cover grain">${eyebrow(`${t("Weekly", "Тижневик")} · ${numero()}&nbsp;${issue.no}`)}<p class="velvet-period">${fmtShort(issue.start)} – ${fmtShort(issue.end)}</p><p class="velvet-cover-title">${esc(L(issue.title))}</p><span class="velvet-rings" aria-hidden="true"></span></div>
    <div class="velvet-copy">
      ${eyebrow(t("The longer view", "Ширший погляд"))}
      <h2 id="weekly-home-title">${t("Less noise.<br>A longer view.", "Менше шуму.<br>Ширший погляд.")}</h2>
      <p>${esc(L(issue.dek))}</p>
      <ul class="velvet-facts"><li><strong>${issue.stories}</strong>${t("stories", "історій")}</li><li><strong>${issue.read}</strong>${t("min read", "хв читання")}</li><li><strong>${issue.sources}</strong>${t("sources", "джерел")}</li></ul>
      <div class="button-row"><a class="button" href="#/weekly">${t("Open the edition", "Відкрити випуск")}${icon("arrowRight", 18)}</a><a class="button outline" href="#/digests">${t("All editions", "Усі випуски")}</a></div>
    </div>
  </section>

  <section class="section trending" aria-labelledby="trending-title">
    ${sectionHead(t("Hot topics this week.", "Гарячі теми тижня."), "news", t("Browse the feed", "До стрічки"), "trending-title")}
    <div class="trending-grid">
      <p class="trending-note">${t("Mentions across the last seven daily briefs. Topics open the matching filtered feed.", "Згадки в останніх семи щоденних брифах. Тема відкриває відфільтровану стрічку.")}</p>
      <ol class="trend-bars">${TRENDING.map((x) => `<li><a href="${href(`news?q=${encodeURIComponent(x.name)}`)}" aria-label="${esc(x.name)}: ${x.mentions} ${t("mentions", "згадок")}${x.delta > 0 ? `, ${t("rising", "зростає")}` : ""}"><span class="trend-name">${esc(x.name)}</span><span class="trend-bar"><span style="--w:${(x.mentions / maxMentions) * 100}%"></span></span><span class="trend-num">${x.mentions}</span><span class="trend-delta ${x.delta > 0 ? "up" : "down"}" aria-hidden="true">${x.delta > 0 ? "▲" : "▼"} ${Math.abs(x.delta)}</span></a></li>`).join("")}</ol>
    </div>
  </section>

  <section class="section paths" aria-labelledby="paths-title">
    ${sectionHead(t("From knowing to building.", "Від розуміння до дії."), null, "", "paths-title")}
    <div class="path-grid">${[
      ["concepts", "compass", t("Understand the ideas", "Зрозуміти ідеї"), t(`${CONCEPTS.length} plain-language explainers, each with sources and a verification date.`, `${CONCEPTS.length} пояснень простою мовою — з джерелами й датою перевірки.`)],
      ["guides", "doc", t("Make a decision", "Ухвалити рішення"), t("Living comparisons and a reproducible benchmark, re-verified on a schedule.", "Живі порівняння й відтворюваний бенчмарк, що регулярно перевіряються.")],
      ["tools", "terminal", t("Work a little smarter", "Працювати розумніше"), t("Three local-first utilities. Your inputs never leave the browser.", "Три local-first утиліти. Ваші дані не залишають браузер.")],
    ]
      .map(([r, ic, h, p], i) => `<a class="path-card" href="${href(r)}"><span class="path-no">0${i + 1}</span><span class="path-icon">${icon(ic, 26)}</span><strong>${h}</strong><span>${p}</span><span class="path-go">${labels()[r]}${icon("arrowRight", 18)}</span></a>`)
      .join("")}</div>
  </section>

  <aside class="sponsor-slot" aria-labelledby="sponsor-title">
    <p class="sponsor-label">${t("Sponsored slot · open", "Спонсорське місце · вільне")}</p>
    <div><h2 id="sponsor-title">${t("One sponsor per issue.", "Один спонсор на випуск.")}</h2><p>${t("A single, clearly labelled placement next to the editorial — never inside it.", "Одне чітко позначене розміщення поруч із редакційним, ніколи всередині.")}</p></div>
    <details class="sponsor-why"><summary>${t("Why am I seeing this?", "Чому я це бачу?")}</summary><p>${t("Sponsorship keeps the brief free. Sponsors never influence selection or wording; placements are marked and separate.", "Спонсорство тримає бриф безкоштовним. Спонсори не впливають на відбір і формулювання; розміщення позначені й відокремлені.")}</p></details>
    <a class="button outline" href="#/advertise">${t("Claim the slot", "Забронювати місце")}</a>
  </aside>

  ${newsletter("band")}

  <section class="section faq" aria-labelledby="faq-title">
    ${sectionHead(t("Frequently asked.", "Часті питання."), null, "", "faq-title")}
    <div class="faq-list">${HOME_FAQ.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${L(f.q)}</summary><p>${L(f.a)}</p></details>`).join("")}</div>
  </section>`;
}

FORMS["hero-search"] = (form) => {
  const q = form.q.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : "#/search";
};

/* ── News discovery: URL is the source of truth (#/news?q=&cat=&topic=&period=&sort=&page=) ── */
const NEWS_PAGE_SIZE = 4;
const PERIODS = [
  ["today", () => t("Today", "Сьогодні")],
  ["week", () => t("7 days", "7 днів")],
  ["month", () => t("30 days", "30 днів")],
  ["all", () => t("All time", "Весь час")],
];
const TOPICS = ["MCP", "Claude Code", "Prompt caching", "Evals", "Ollama", "Guardrails", "Benchmarks"];

function readNewsState(forcedCategory) {
  const p = parseHash().params;
  const list = (key) => (p.get(key) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const q = p.get("q") || "";
  let sort = ["newest", "oldest", "relevance"].includes(p.get("sort")) ? p.get("sort") : "newest";
  if (sort === "relevance" && !q.trim()) sort = "newest";
  const cats = forcedCategory ? [forcedCategory] : list("cat").filter((id) => CATEGORIES.some((c) => c.id === id));
  return {
    q,
    cats,
    topics: list("topic").filter((x) => TOPICS.includes(x)),
    period: PERIODS.some(([id]) => id === p.get("period")) ? p.get("period") : "all",
    sort,
    page: Math.max(1, parseInt(p.get("page") || "1", 10) || 1),
    drawer: p.get("filters") === "open",
  };
}

function newsHash(state, route = "news") {
  const p = new URLSearchParams();
  if (route === "category" && state.cats[0]) p.set("c", state.cats[0]);
  if (state.q) p.set("q", state.q);
  if (route !== "category" && state.cats.length) p.set("cat", state.cats.join(","));
  if (state.topics.length) p.set("topic", state.topics.join(","));
  if (state.period !== "all") p.set("period", state.period);
  if (state.sort !== "newest") p.set("sort", state.sort);
  if (state.page > 1) p.set("page", String(state.page));
  const qs = p.toString();
  return `#/${route}${qs ? `?${qs}` : ""}`;
}

function filterStories(state, skip = {}) {
  const inPeriod = (story) =>
    state.period === "all" ||
    (state.period === "today" && story.period === "today") ||
    (state.period === "week" && ["today", "week"].includes(story.period)) ||
    (state.period === "month" && story.period !== "all");
  const query = state.q.trim().toLowerCase();
  return NEWS_STORIES.filter((story) => {
    if (!skip.cats && state.cats.length && !state.cats.includes(story.cat)) return false;
    if (!inPeriod(story)) return false;
    if (state.topics.length && !state.topics.some((topic) => story.tags.includes(topic))) return false;
    if (query) {
      const text = `${L(story.title)} ${L(story.summary)} ${L(story.why)} ${story.tags.join(" ")}`.toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });
}

function relevance(story, query) {
  const q = query.toLowerCase();
  return (L(story.title).toLowerCase().includes(q) ? 3 : 0) + (L(story.why).toLowerCase().includes(q) ? 2 : 0) + (L(story.summary).toLowerCase().includes(q) ? 1 : 0);
}

function newsCard(story) {
  const expanded = (news.expanded ||= new Set()).has(story.id);
  const saved = savedStories.has(story.id);
  return `<article class="story-card" aria-labelledby="t-${story.id}">
    <a class="story-card-media" href="${storyHref(story)}" tabindex="-1" aria-hidden="true">${banner(story)}</a>
    <div class="story-card-body">
      <div class="story-card-top">${catBadge(story.cat)}${storyMeta(story)}</div>
      <h2 class="story-card-title" id="t-${story.id}"><a href="${storyHref(story)}">${esc(L(story.title))}</a></h2>
      <p class="story-card-summary">${esc(L(story.summary))}</p>
      <div class="story-card-actions">
        <button type="button" class="pill" data-action="expand" data-id="${story.id}" aria-expanded="${expanded}" aria-controls="why-${story.id}">${icon(expanded ? "minus" : "plus", 16)}${expanded ? t("Hide analysis", "Сховати аналіз") : t("Why it matters", "Чому це важливо")}</button>
        <button type="button" class="pill" data-action="save-story" data-id="${story.id}" aria-pressed="${saved}">${icon("bookmark", 16)}<span>${saved ? t("Saved", "Збережено") : t("Save", "Зберегти")}</span></button>
        <button type="button" class="pill" data-action="share-story" data-id="${story.id}">${icon("link", 16)}${t("Copy link", "Посилання")}</button>
      </div>
      <div class="story-card-why" id="why-${story.id}"${expanded ? "" : " hidden"}>
        <p class="eyebrow">${t("Why it matters", "Чому це важливо")}</p><p>${esc(L(story.why))}</p>
        <p class="eyebrow">${t("Key takeaways", "Ключові висновки")}</p><ul>${L(story.takeaways).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <a class="text-link" href="${storyHref(story)}">${t("Open the full story", "Відкрити повний матеріал")}${icon("arrowRight", 16)}</a>
      </div>
    </div>
  </article>`;
}

function facetPanel(state, route, idSuffix) {
  const countFor = (catId) => filterStories({ ...state, cats: [catId] }, {}).length;
  const catList = CATEGORIES.map((c) => {
    const checked = state.cats.includes(c.id);
    const n = countFor(c.id);
    return `<li><label class="check-row${n === 0 && !checked ? " is-empty" : ""}" style="--cat:var(--cat-${c.key})"><input type="checkbox" data-facet="cat" value="${c.id}"${checked ? " checked" : ""}${route === "category" ? " disabled" : ""}><span class="check-glyph">${glyph(c.key, 16)}</span><span class="check-label">${esc(catName(c))}</span><span class="count">${n}</span></label></li>`;
  }).join("");
  return `<div class="facets">
    <fieldset class="facet"><legend>${t("Categories", "Категорії")}</legend><ul class="check-list">${catList}</ul></fieldset>
    <fieldset class="facet"><legend>${t("Period", "Період")}</legend><div class="segmented" role="radiogroup">${PERIODS.map(([id, label]) => `<label><input type="radio" name="period-${idSuffix}" data-facet="period" value="${id}"${state.period === id ? " checked" : ""}><span>${label()}</span></label>`).join("")}</div></fieldset>
    <fieldset class="facet"><legend>${t("Topics", "Теми")}</legend><div class="chip-row">${TOPICS.map((topic) => `<button type="button" class="chip" data-action="topic" data-topic="${esc(topic)}" aria-pressed="${state.topics.includes(topic)}">#${esc(topic)}</button>`).join("")}</div><p class="facet-note">${t("Topics combine with OR; different facets combine with AND.", "Теми поєднуються через АБО; різні фасети — через І.")}</p></fieldset>
  </div>`;
}

function news(forcedCategory) {
  const route = forcedCategory ? "category" : "news";
  const state = readNewsState(forcedCategory);
  let items = filterStories(state);
  items.sort((a, b) =>
    state.sort === "oldest" ? a.date.localeCompare(b.date) || a.time.localeCompare(b.time) : state.sort === "relevance" ? relevance(b, state.q) - relevance(a, state.q) : b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
  );
  const pages = Math.max(1, Math.ceil(items.length / NEWS_PAGE_SIZE));
  const page = Math.min(state.page, pages);
  const start = (page - 1) * NEWS_PAGE_SIZE;
  const shown = items.slice(start, start + NEWS_PAGE_SIZE);
  const activeCount = (route === "category" ? 0 : state.cats.length) + state.topics.length + (state.period !== "all" ? 1 : 0);
  const chips = [
    ...(route === "category" ? [] : state.cats.map((id) => [catName(catById(id)), { ...state, cats: state.cats.filter((x) => x !== id), page: 1 }])),
    ...state.topics.map((topic) => [`#${topic}`, { ...state, topics: state.topics.filter((x) => x !== topic), page: 1 }]),
    ...(state.period !== "all" ? [[PERIODS.find(([id]) => id === state.period)[1](), { ...state, period: "all", page: 1 }]] : []),
    ...(state.q ? [[`“${state.q}”`, { ...state, q: "", sort: state.sort === "relevance" ? "newest" : state.sort, page: 1 }]] : []),
  ];
  const clearAll = { q: "", cats: route === "category" ? state.cats : [], topics: [], period: "all", sort: "newest", page: 1 };
  const pageLink = (n, label, attrs = "") => `<a href="${newsHash({ ...state, page: n }, route)}"${attrs}>${label}</a>`;
  const pagination =
    pages > 1
      ? `<nav class="pagination" aria-label="${t("Pagination", "Пагінація")}"><ul>${page > 1 ? `<li>${pageLink(page - 1, `${icon("arrowLeft", 16)}<span>${t("Previous", "Назад")}</span>`, ' rel="prev"')}</li>` : `<li><span class="is-disabled" aria-disabled="true">${icon("arrowLeft", 16)}<span>${t("Previous", "Назад")}</span></span></li>`}${Array.from({ length: pages }, (_, i) => i + 1).map((n) => `<li>${n === page ? `<a href="${newsHash({ ...state, page: n }, route)}" aria-current="page">${n}</a>` : pageLink(n, n, ` aria-label="${t("Page", "Сторінка")} ${n}"`)}</li>`).join("")}${page < pages ? `<li>${pageLink(page + 1, `<span>${t("Next", "Далі")}</span>${icon("arrowRight", 16)}`, ' rel="next"')}</li>` : `<li><span class="is-disabled" aria-disabled="true"><span>${t("Next", "Далі")}</span>${icon("arrowRight", 16)}</span></li>`}</ul></nav>`
      : "";
  const sortSelect = (id) => `<label class="sort-field" for="${id}"><span>${t("Sort", "Сортування")}</span><select id="${id}" data-facet="sort"><option value="newest"${state.sort === "newest" ? " selected" : ""}>${t("Newest", "Найновіші")}</option><option value="oldest"${state.sort === "oldest" ? " selected" : ""}>${t("Oldest", "Найдавніші")}</option>${state.q ? `<option value="relevance"${state.sort === "relevance" ? " selected" : ""}>${t("Relevance", "Релевантність")}</option>` : ""}</select></label>`;
  const c = forcedCategory ? catById(forcedCategory) : null;
  const intro = c
    ? `${breadcrumbs([[t("Home", "Головна"), "home"], [t("Categories", "Категорії"), "categories"], [esc(catName(c))]])}<header class="hub-head" style="--cat:var(--cat-${c.key});--art:var(--art-${c.key})"><span class="hub-glyph">${glyph(c.key, 34)}</span><div>${eyebrow(t("Category", "Категорія"))}<h1>${esc(catName(c))}</h1><p class="lede">${esc(L(c.desc))}</p><p class="hub-meta">${plural(c.count, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])} · ${t("updated daily", "оновлюється щодня")}</p><ul class="subtopics" aria-label="${t("Subtopics", "Підтеми")}">${c.subtopics.map((s) => `<li><a href="${href(`search?q=${encodeURIComponent(s)}`)}">${esc(s)}</a></li>`).join("")}</ul></div></header>`
    : `<header class="page-intro">${eyebrow(t("The newsroom", "Стрічка новин"))}<h1>${t("A clearer <em>signal.</em>", "Чіткіший <em>сигнал.</em>")}</h1><p class="lede">${t("What is changing in AI engineering, and why it matters to your work. Every story carries its sources and a “why it matters” note.", "Що змінюється в AI-інженерії і чому це важливо для вашої роботи. Кожен матеріал має джерела й пояснення «чому це важливо».")}</p><p class="curated">${icon("check", 16)}${t("Curated by", "Відбір:")} <a href="#/author">${esc(L(EDITOR.name))}</a> · ${t("sources cited on every story", "джерела в кожному матеріалі")}</p></header>
    <details class="highlights" open><summary>${t("This week in three lines", "Тиждень у трьох рядках")}</summary><ul><li>${t("Agent tooling now competes on memory boundaries and delegation, not raw capability.", "Агентні інструменти змагаються межами пам’яті й делегуванням, а не сирою потужністю.")}</li><li>${t("Prompt caching and harness trimming are the cheapest wins teams report.", "Кешування промптів і скорочення харнесу — найдешевші виграші, про які звітують команди.")}</li><li>${t("Local inference crosses from hobby to viable for regulated teams.", "Локальний інференс переходить від хобі до реального варіанта для регульованих команд.")}</li></ul></details>`;
  return `${intro}${c && typeof categoryPrimer === "function" ? categoryPrimer(c) : ""}
  <div class="discovery" data-route="${route}">
    <div class="discovery-toolbar">
      <form class="search-field" role="search" data-form="news-search"><label class="sr-only" for="news-q">${t("Search stories", "Пошук новин")}</label>${icon("search", 18)}<input id="news-q" name="q" type="search" value="${esc(state.q)}" autocomplete="off" placeholder="${t("Search stories, tools, topics…", "Пошук новин, інструментів, тем…")}">${state.q ? `<button type="button" class="field-clear" data-action="news-clear-q" aria-label="${t("Clear search", "Очистити пошук")}">${icon("close", 16)}</button>` : ""}</form>
      <button type="button" class="button outline filters-btn" data-action="open-filters" aria-haspopup="dialog" aria-controls="filters-dialog">${icon("sliders", 18)}${t("Filters", "Фільтри")}${activeCount ? `<span class="count-badge" aria-label="${activeCount} ${t("active", "активних")}">${activeCount}</span>` : ""}</button>
      ${sortSelect(`sort-${route}`)}
    </div>
    <p class="results-line" role="status" aria-live="polite">${items.length ? t(`Showing ${start + 1}–${start + shown.length} of ${items.length} stories`, `Показано ${start + 1}–${start + shown.length} з ${items.length}`) : t("No stories match", "Немає збігів")} <span>· ${t("demo set of the latest stories", "демо-набір останніх матеріалів")}</span></p>
    ${chips.length ? `<div class="active-chips" role="group" aria-label="${t("Active filters", "Активні фільтри")}">${chips.map(([label, next]) => `<a class="chip chip-remove" href="${newsHash(next, route)}" aria-label="${t("Remove filter", "Прибрати фільтр")}: ${esc(label)}">${esc(label)}${icon("close", 14)}</a>`).join("")}<a class="text-link" href="${newsHash(clearAll, route)}">${t("Clear all", "Скинути все")}</a></div>` : ""}
    <div class="discovery-layout">
      <aside class="facet-rail" aria-label="${t("Filters", "Фільтри")}">${facetPanel(state, route, "rail")}</aside>
      <div class="feed">
        ${shown.length ? `<div class="story-list">${shown.map(newsCard).join("")}</div>` : `<div class="empty"><span class="empty-mark" aria-hidden="true">${icon("compass", 30)}</span><h2>${t("No stories match these filters.", "Жоден матеріал не відповідає фільтрам.")}</h2><p>${t("Loosen the period, remove a topic or clear the search.", "Розширте період, приберіть тему або очистьте пошук.")}</p><a class="button" href="${newsHash(clearAll, route)}">${t("Clear all filters", "Скинути всі фільтри")}</a></div>`}
        ${pagination}
      </div>
    </div>
  </div>
  <dialog class="sheet sheet-right" id="filters-dialog" aria-labelledby="filters-title">
    <div class="sheet-head"><h2 id="filters-title">${t("Filters", "Фільтри")}</h2><button type="button" class="icon-btn" data-action="close-dialog" aria-label="${t("Close filters", "Закрити фільтри")}">${icon("close")}</button></div>
    <div class="sheet-body">${sortSelect(`sort-drawer-${route}`)}${facetPanel(state, route, "drawer")}</div>
    <div class="sheet-foot"><a class="button outline" href="${newsHash(clearAll, route)}">${t("Clear all", "Скинути")}</a><button type="button" class="button" data-action="close-dialog">${t("Done", "Готово")} · ${plural(items.length, ["story", "stories"], ["матеріал", "матеріали", "матеріалів"])}</button></div>
  </dialog>
  ${newsletter("inline")}`;
}
news.expanded = new Set();

/* Filter changes push a new history entry; the view re-renders in place and keeps focus. */
function applyNews(next, focusSelector, replace = false) {
  const route = currentRoute();
  const hash = newsHash({ ...next }, route);
  history[replace ? "replaceState" : "pushState"](null, "", `${location.pathname}${location.search}${hash}`);
  const drawerOpen = document.getElementById("filters-dialog")?.open;
  render(false);
  if (drawerOpen) document.getElementById("filters-dialog")?.showModal();
  if (focusSelector) document.querySelector(drawerOpen ? `#filters-dialog ${focusSelector}` : focusSelector)?.focus();
}
function forcedCat() {
  return currentRoute() === "category" ? routeParam("c") || CATEGORIES[0].id : undefined;
}
document.addEventListener("change", (event) => {
  const el = event.target.closest("[data-facet]");
  if (!el) return;
  const state = readNewsState(forcedCat());
  const scope = el.closest("dialog") ? "" : "";
  if (el.dataset.facet === "cat") {
    const cats = el.checked ? [...state.cats, el.value] : state.cats.filter((x) => x !== el.value);
    applyNews({ ...state, cats, page: 1 }, `${scope}[data-facet="cat"][value="${el.value}"]`);
  }
  if (el.dataset.facet === "period") applyNews({ ...state, period: el.value, page: 1 }, `[data-facet="period"][value="${el.value}"]`);
  if (el.dataset.facet === "sort") applyNews({ ...state, sort: el.value, page: 1 }, `#${el.id}`);
});
let newsTyping;
document.addEventListener("input", (event) => {
  if (event.target.id !== "news-q") return;
  clearTimeout(newsTyping);
  const value = event.target.value;
  newsTyping = setTimeout(() => {
    const state = readNewsState(forcedCat());
    const input = document.getElementById("news-q");
    const caret = input?.selectionStart ?? value.length;
    applyNews({ ...state, q: value, sort: value ? state.sort : state.sort === "relevance" ? "newest" : state.sort, page: 1 }, "#news-q", true);
    const next = document.getElementById("news-q");
    next?.setSelectionRange(caret, caret);
  }, 220);
});
FORMS["news-search"] = (form) => {
  const state = readNewsState(forcedCat());
  applyNews({ ...state, q: form.q.value.trim(), page: 1 }, "#news-q");
};
Object.assign(ACTIONS, {
  expand: (el) => {
    const id = el.dataset.id;
    const panel = document.getElementById(`why-${id}`);
    const open = el.getAttribute("aria-expanded") !== "true";
    if (open) news.expanded.add(id);
    else news.expanded.delete(id);
    el.setAttribute("aria-expanded", String(open));
    el.innerHTML = `${icon(open ? "minus" : "plus", 16)}${open ? t("Hide analysis", "Сховати аналіз") : t("Why it matters", "Чому це важливо")}`;
    panel.hidden = !open;
  },
  topic: (el) => {
    const state = readNewsState(forcedCat());
    const topic = el.dataset.topic;
    const topics = state.topics.includes(topic) ? state.topics.filter((x) => x !== topic) : [...state.topics, topic];
    applyNews({ ...state, topics, page: 1 }, `[data-action="topic"][data-topic="${topic}"]`);
  },
  "news-clear-q": () => {
    const state = readNewsState(forcedCat());
    applyNews({ ...state, q: "", sort: state.sort === "relevance" ? "newest" : state.sort, page: 1 }, "#news-q");
  },
  "open-filters": (el) => {
    const dialog = document.getElementById("filters-dialog");
    dialog.returnFocus = el;
    dialog.showModal();
  },
  "share-story": (el) => copy(`${location.origin}${location.pathname}#/article?id=${el.dataset.id}`),
});

/* ── Search results page (production /news/search?q=) ─────────────────── */
function searchPage() {
  const q = routeParam("q") || "";
  const type = routeParam("type") || "all";
  const all = searchMatches(q);
  const types = [["all", t("All", "Усе")], [t("Story", "Новина"), t("Stories", "Новини")], [t("Concept", "Концепт"), t("Concepts", "Концепти")], [t("Guide", "Гайд"), t("Guides", "Гайди")], ["Toolbox", "Toolbox"]];
  const results = type === "all" ? all : all.filter((m) => m.type === type);
  const tab = ([id, label]) => {
    const n = id === "all" ? all.length : all.filter((m) => m.type === id).length;
    return `<li><a href="${href(`search?q=${encodeURIComponent(q)}${id === "all" ? "" : `&type=${encodeURIComponent(id)}`}`)}"${type === id ? ' aria-current="page"' : ""}>${label} <span class="count">${n}</span></a></li>`;
  };
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("News", "Новини"), "news"], [t("Search", "Пошук")]])}
  <header class="page-intro page-intro-compact">${eyebrow(t("Search the publication", "Пошук у виданні"))}<h1>${q ? `${t("Results for", "Результати для")} <em>“${esc(q)}”</em>` : t("Find the <em>thread.</em>", "Знайдіть <em>зв’язок.</em>")}</h1></header>
  <form class="search-field search-field-lg" role="search" data-form="page-search"><label class="sr-only" for="page-q">${t("Search", "Пошук")}</label>${icon("search", 20)}<input id="page-q" name="q" type="search" value="${esc(q)}" placeholder="${t("Agents, MCP, caching…", "Агенти, MCP, кешування…")}" autocomplete="off"><button class="button">${t("Search", "Шукати")}</button></form>
  ${q ? `<nav class="tabs" aria-label="${t("Result types", "Типи результатів")}"><ul>${types.map(tab).join("")}</ul></nav>` : ""}
  <div class="search-page-results" aria-live="polite">${
    !q
      ? `<div class="search-idle">${eyebrow(t("Popular searches", "Популярні запити"))}<div class="chip-row">${["MCP", "Claude Code", "Prompt caching", "Evals", "Ollama", "RAG"].map((s) => `<a class="chip" href="${href(`search?q=${encodeURIComponent(s)}`)}">${s}</a>`).join("")}</div></div>`
      : results.length
        ? `<ol class="result-list">${results.map((m) => `<li><a class="result-row" href="${href(m.route)}"><span class="search-type">${m.type}</span><span class="result-title">${esc(m.title)}</span><span class="result-text">${esc(m.text.slice(0, 160))}…</span></a></li>`).join("")}</ol>`
        : `<div class="empty"><span class="empty-mark" aria-hidden="true">${icon("compass", 30)}</span><h2>${t("No thread found.", "Зв’язку не знайдено.")}</h2><p>${t("Check the spelling, try a shorter phrase, or browse the concept shelf.", "Перевірте написання, спробуйте коротшу фразу або перегляньте полицю концептів.")}</p><a class="button outline" href="#/concepts">${t("Browse concepts", "Переглянути концепти")}</a></div>`
  }</div>`;
}
FORMS["page-search"] = (form) => {
  const q = form.q.value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : "#/search";
};

/* ── Reading list (local, no account) ─────────────────────────────────── */
function savedPage() {
  const items = NEWS_STORIES.filter((s) => savedStories.has(s.id));
  let storageOk = true;
  try {
    localStorage.setItem("atb-probe", "1");
    localStorage.removeItem("atb-probe");
  } catch {
    storageOk = false;
  }
  return `<header class="page-intro page-intro-compact">${eyebrow(t("Your reading list", "Ваше збережене"))}<h1>${t("For a <em>quieter moment.</em>", "Для <em>спокійнішої миті.</em>")}</h1><p class="lede">${t("Saved on this device only. No account, no sync, no tracking.", "Зберігається лише на цьому пристрої. Без акаунта, синхронізації й відстеження.")}</p></header>
  ${storageOk ? "" : `<p class="notice notice-warning" role="status">${icon("alert", 18)}${t("Your browser blocks local storage, so the list will clear when you close this tab.", "Браузер блокує локальне сховище, тож список очиститься після закриття вкладки.")}</p>`}
  ${items.length ? `<p class="results-line">${plural(items.length, ["saved story", "saved stories"], ["збережений матеріал", "збережені матеріали", "збережених матеріалів"])}</p><div class="story-list">${items.map(newsCard).join("")}</div>` : `<div class="empty"><span class="empty-mark" aria-hidden="true">${icon("bookmark", 30)}</span><h2>${t("Your reading list starts here.", "Ваш список починається тут.")}</h2><p>${t("Use Save on any story to keep it for later.", "Натисніть «Зберегти» на будь-якому матеріалі, щоб повернутися пізніше.")}</p><a class="button" href="#/news">${t("Find a story", "Знайти матеріал")}</a></div>`}`;
}

Object.assign(renderers, {
  home,
  news: () => news(),
  category: () => news(routeParam("c") || CATEGORIES[0].id),
  search: searchPage,
  saved: savedPage,
});
