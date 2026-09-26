/* Standalone design prototype. Illustrative editorial content; no production API calls. */
let lang = "en";
let theme = "night";
let activeFilter = "all";
let saved = false;
const t = (en, uk) => (lang === "uk" ? uk : en);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const routes = [
  "home",
  "news",
  "article",
  "digests",
  "daily",
  "weekly",
  "concepts",
  "concept",
  "guides",
  "guide",
  "tools",
  "tool",
  "categories",
  "category",
  "about",
  "subscribe",
  "search",
  "saved",
  "advertise",
  "policy",
  "404",
  "system",
  "states",
];
const labels = () => ({
  home: t("Home", "Головна"),
  news: t("News", "Новини"),
  article: t("News article", "Матеріал новини"),
  digests: t("Digests", "Дайджести"),
  daily: t("Daily brief", "Щоденний бриф"),
  weekly: t("Weekly edition", "Тижневий випуск"),
  concepts: t("Concepts", "Концепти"),
  concept: t("Concept detail", "Сторінка концепту"),
  guides: t("Guides", "Гайди"),
  guide: t("Guide detail", "Сторінка гайду"),
  tools: "Toolbox",
  settings: "settings.json Builder",
  instructions: "AGENTS.md Generator",
  tool: t("Tool workspace", "Робочий простір утиліти"),
  categories: t("Categories", "Категорії"),
  category: t("Category hub", "Хаб категорії"),
  about: t("About", "Про нас"),
  subscribe: t("Subscribe", "Підписка"),
  search: t("Search", "Пошук"),
  saved: t("Reading list", "Збережене"),
  advertise: t("Advertise", "Співпраця"),
  policy: t("Editorial & legal", "Політики"),
  system: t("Design system", "Дизайн-система"),
  states: t("UI states", "Стани UI"),
  motion: t("Motion atlas", "Атлас руху"),
  404: "404",
});
const href = (route) => `#/${route}`;
const link = (route, text, cls = "") => `<a class="${cls}" href="${href(route)}">${text}</a>`;
const btn = (route, text, outline = false) =>
  link(route, `${text}<span aria-hidden="true">↗</span>`, `button${outline ? " outline" : ""}`);
const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;
const arrow = '<span aria-hidden="true">↗</span>';
const art = (caption = true) => {
  const comparison = document.getElementById("motion-lab");
  const direction = new URLSearchParams(location.search).get("concept");
  const tensionHome = !comparison || (direction !== "signal" && direction !== "tide");
  // Render vector art immediately: do not download the old 1.8 MB hero only to replace it.
  if (currentRoute() === "home" && tensionHome && typeof TensionMotion !== "undefined") return TensionMotion.brandMarkup(lang);
  return `<div class="lead-art"><img src="assets/after-hours.png" alt="${t("Abstract brass sculpture with a pale green glass edge", "Абстрактна латунна скульптура зі світло-зеленим скляним краєм")}" width="1672" height="941">${caption ? `<span class="art-caption">${t("CONCEPT ART · AFTER HOURS", "КОНЦЕПТ-АРТ · AFTER HOURS")}</span>` : ""}</div>`;
};
const visual = (n) =>
  `<div class="card-visual" aria-hidden="true">${n % 3 === 0 ? '<div class="diagram-lines"><i></i><i></i><i></i></div>' : n % 3 === 1 ? '<div class="diagram-code">{ context }<br>→ action →</div>' : '<div class="diagram-orbit"></div>'}</div>`;
const stories = () => [
  {
    title: t("The agent era needs a better memory.", "Епосі агентів потрібна краща пам’ять."),
    cat: "agents",
    label: "Agents & MCP",
    summary: t(
      "The next useful question is what an agent remembers, and who gets to decide.",
      "Наступне важливе питання — що агент пам’ятає і хто це вирішує.",
    ),
    time: "09:40",
    route: "article?variant=analysis",
  },
  {
    title: t("Prompt caching, beyond the price tag", "Prompt caching: більше, ніж економія"),
    cat: "cost",
    label: t("Cost & performance", "Вартість і продуктивність"),
    summary: t(
      "A practical lens on stable context, cache boundaries and useful measurements.",
      "Практичний погляд на стабільний контекст, межі кешу та корисні вимірювання.",
    ),
    time: "09:15",
    route: "article?variant=technical",
  },
  {
    title: t(
      "When your coding agent needs a second opinion",
      "Коли агенту для коду потрібна друга думка",
    ),
    cat: "tools",
    label: t("Developer tools", "Інструменти розробника"),
    summary: t(
      "Design the review step before giving a workflow more autonomy.",
      "Спершу спроєктуйте перевірку, а потім додавайте автономність.",
    ),
    time: "08:50",
    route: "article?variant=analysis",
  },
  {
    title: t("A benchmark is a starting point. What comes next?", "Бенчмарк — початок. Що далі?"),
    cat: "models",
    label: t("Models & research", "Моделі й дослідження"),
    summary: t(
      "Read the task, setup and constraints before reading the leaderboard.",
      "Читайте завдання, умови та обмеження до таблиці лідерів.",
    ),
    time: "08:20",
    route: "article?variant=evidence",
  },
  {
    title: t("Make the context window work for you", "Змусьте контекстне вікно працювати на вас"),
    cat: "agents",
    label: "Agents & MCP",
    summary: t(
      "A small map of what belongs in a reusable agent instruction.",
      "Коротка карта того, що варто включати в інструкції агента.",
    ),
    time: "07:45",
    route: "article?variant=technical",
  },
];
const categoryNames = () => [
  t("All stories", "Усі новини"),
  "Agents & MCP",
  t("Developer tools", "Інструменти"),
  t("Models & research", "Моделі"),
  t("Cost & performance", "Оптимізація"),
];
const sectionHead = (title, route, text = t("Explore", "Переглянути")) =>
  `<div class="section-head"><h2>${title}</h2>${route ? link(route, `${text} ${arrow}`) : ""}</div>`;
function header(route) {
  const l = labels();
  const nav = [
    "news",
    "digests",
    "concepts",
    "guides",
    "tools",
    "categories",
    "about",
    "subscribe",
  ];
  return `<div class="preview"><span>${t("DESIGN CONCEPT · AFTER HOURS · Illustrative content", "КОНЦЕПЦІЯ ДИЗАЙНУ · AFTER HOURS · Демонстраційний контент")}</span>${link("system", t("Explore the concept ↗", "Огляд концепції ↗"))}</div><header class="header"><div class="wrap"><div class="header-top">${link("home", `<img src="assets/mark.svg" alt=""><span>AI Today Brief<small>${t("THE INTELLIGENCE EDIT", "РЕДАКЦІЯ AI-НОВИН")}</small></span>`, "wordmark")}<button class="icon-btn" data-search aria-label="${t("Open search", "Відкрити пошук")}">⌕</button><button class="icon-btn" data-lang aria-label="${t("Switch to Ukrainian", "Switch to English")}">${lang === "en" ? "UK" : "EN"}</button><button class="icon-btn" data-theme aria-label="${t("Change reading theme", "Змінити тему читання")}">${theme === "night" ? "☼" : "◐"}</button>${link("subscribe", t("Get the brief ↗", "Отримувати бриф ↗"), "button header-subscribe")}<button class="icon-btn mobile-menu" aria-label="${t("Open menu", "Відкрити меню")}" aria-expanded="false" data-menu>☰</button></div><nav class="nav" aria-label="${t("Main navigation", "Головна навігація")}">${nav.map((r) => link(r, l[r], route === r || { article: "news", daily: "digests", weekly: "digests", concept: "concepts", guide: "guides", tool: "tools", category: "categories" }[route] === r ? "active" : "")).join("")}<span class="nav-note">${t("HUMAN-EDITED. FUTURE-FOCUSED.", "ЛЮДСЬКИЙ ПОГЛЯД НА МАЙБУТНЄ.")}</span></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="wrap"><div class="footer-grid"><div>${link("home", 'AI Today Brief<span aria-hidden="true">.</span>', "wordmark")}<p>${t("A little perspective. Every day.", "Трохи перспективи. Щодня.")}</p></div><div class="footer-links">${["news", "digests", "concepts", "guides", "tools", "about", "subscribe", "advertise", "policy"].map((r) => link(r, labels()[r])).join("")}</div></div><div class="footer-bottom"><p>© 2026 AI Today Brief · EN / UK</p><div>${link("saved", t("Reading list", "Збережене"))} · ${link("system", t("Design system", "Дизайн-система"))} · ${link("states", t("UI states", "Стани UI"))}</div></div></div></footer>`;
}
function newsletter() {
  return `<section class="newsletter"><div>${eyebrow(t("YOUR DAILY READING RITUAL", "ВАШ ЩОДЕННИЙ РИТУАЛ ЧИТАННЯ"))}<h2 class="mt">${t("Make room for perspective.", "Знайдіть час для перспективи.")}</h2><p>${t("A considered AI briefing, delivered to your inbox.", "Вдумливий AI-бриф у вашій пошті.")}</p></div><div><form class="inline-form" data-subscribe><label class="sr-only" for="email-inline">Email</label><input id="email-inline" type="email" required placeholder="you@example.com" autocomplete="email"><button class="button">${t("Get the brief", "Отримувати бриф")} ↗</button><p class="form-status" aria-live="polite"></p></form><p class="form-note">${t("Free to read. Unsubscribe whenever you like.", "Безкоштовно. Відписатися можна будь-коли.")} ${link("policy", t("Privacy", "Приватність"))}</p></div></section>`;
}
function home() {
  return `<div class="masthead"><h1>${t("Tomorrow, <em>in context.</em>", "Майбутнє. <em>З контекстом.</em>")}</h1><p>${t("AI news for people who build. A considered selection, a clearer point of view.", "AI-новини для тих, хто створює. Уважний відбір. Зрозумілий погляд.")}</p></div><div class="dateline"><span><i class="live-dot"></i>${t("SATURDAY, 05 SEPTEMBER 2026", "СУБОТА, 05 ВЕРЕСНЯ 2026")}</span><span>${t("THE DAILY EDIT / 5 MIN READ", "ЩОДЕННИЙ ВИПУСК / 5 ХВ")}</span></div><div class="lead-grid"><article class="lead"><div class="lead-copy">${eyebrow(t("THE BIG IDEA / AGENTS & MCP", "ГОЛОВНА ТЕМА / AGENTS & MCP"))}<h2>${link("article", stories()[0].title)}</h2><p>${stories()[0].summary}</p>${btn("article", t("Read the story", "Читати матеріал"), true)}<p class="meta mt">${t("EDITORIAL PREVIEW · 4 MIN", "РЕДАКЦІЙНИЙ ПРИКЛАД · 4 ХВ")}</p></div>${art()}</article><aside class="brief-rail">${eyebrow(t("TODAY, DISTILLED", "СЬОГОДНІ. ПО СУТІ."))}<h2>${t("The short version.", "Коротка версія.")}</h2>${stories()
    .slice(1, 4)
    .map(
      (s, i) =>
        `<div class="mini-row"><span>0${i + 1}</span><div><h3>${link("daily", s.title)}</h3><p>${s.label}</p></div></div>`,
    )
    .join(
      "",
    )}${btn("daily", t("Read today’s brief", "Читати бриф дня"))}</aside></div><div class="signal-strip">${eyebrow(t("IN FOCUS", "У ФОКУСІ"))}${["MCP", t("Agent memory", "Пам’ять агентів"), "Prompt caching", t("Coding workflows", "Робота з кодом")].map((s) => link("concept", s + " ↗")).join("")}</div><section class="section">${sectionHead(t("On the radar", "У полі зору"), "news", t("All news", "Усі новини"))}<div class="grid3">${stories()
    .slice(1, 4)
    .map(
      (s, i) =>
        `<article class="card">${visual(i)}${eyebrow(s.label)}<h3>${link("article", s.title)}</h3><p>${s.summary}</p><span class="meta">${t("EDITORIAL PREVIEW", "РЕДАКЦІЙНИЙ ПРИКЛАД")} · ${i + 3} ${t("MIN", "ХВ")}</span></article>`,
    )
    .join(
      "",
    )}</div></section><section class="section">${sectionHead(t("The longer view", "Ширший погляд"), "digests", t("The archive", "Архів"))}${weeklyFeature()}</section><section class="section">${sectionHead(t("From knowing to building.", "Від розуміння до дії."), "concepts")}<div class="grid3">${[
    [
      "concepts",
      t("Understand the ideas", "Зрозуміти ідеї"),
      t(
        "A living reference for the language of AI engineering.",
        "Живий довідник мови AI-інженерії.",
      ),
    ],
    [
      "guides",
      t("Find your next move", "Обрати наступний крок"),
      t(
        "Comparisons and practical frameworks for real decisions.",
        "Порівняння й практичні підходи для реальних рішень.",
      ),
    ],
    [
      "tools",
      t("Work a little smarter", "Працювати розумніше"),
      t(
        "Small, local-first utilities. Built to be useful.",
        "Невеликі локальні утиліти. Створені для користі.",
      ),
    ],
  ]
    .map(
      ([r, h, p], i) =>
        `<div class="card">${eyebrow("0" + (i + 1) + " / " + labels()[r])}<h3>${link(r, h + " ↗")}</h3><p>${p}</p></div>`,
    )
    .join("")}</div></section>${newsletter()}`;
}
function weeklyFeature() {
  return `<div class="week-block"><div class="week-cover">${eyebrow("AI TODAY BRIEF / WEEKLY")}<h3>${t("The shape<br>of what’s next.", "Контури<br>майбутнього.")}</h3><p class="meta spaced" style="color:#d4b483">${t("DESIGN EDITION / 01", "ДИЗАЙН-ВИПУСК / 01")}</p></div><div class="week-copy">${eyebrow(t("THE WEEKLY EDITION", "ТИЖНЕВИЙ ВИПУСК"))}<h2>${t("Less noise.<br>A longer view.", "Менше шуму.<br>Ширший погляд.")}</h2><p>${t("Three shifts, the connections between them, and what to try next week.", "Три зрушення, зв’язки між ними й те, що варто спробувати наступного тижня.")}</p>${btn("weekly", t("Open the edition", "Відкрити випуск"), true)}</div></div>`;
}
const intro = (tag, title, description) =>
  `<div class="page-intro">${eyebrow(tag)}<h1>${title}</h1><p>${description}</p></div>`;
function filterBar(kind = "news") {
  const values =
    kind === "digests"
      ? ["all", "daily", "weekly"]
      : kind === "concepts"
        ? ["all", "concept", "product", "library"]
        : ["all", "agents", "tools", "models", "cost"];
  const names =
    kind === "digests"
      ? [t("All editions", "Усі випуски"), "Daily", "Weekly"]
      : kind === "concepts"
        ? [
            t("All entries", "Усі записи"),
            t("Concepts", "Концепти"),
            t("Products", "Продукти"),
            t("Libraries & APIs", "Бібліотеки й API"),
          ]
        : categoryNames();
  return `<div class="filters" aria-label="${t("Filter content", "Фільтр матеріалів")}">${values.map((v, i) => `<button class="chip" data-filter="${v}" aria-pressed="${activeFilter === v}">${names[i]}</button>`).join("")}</div>`;
}
const feedRows = (items) =>
  items
    .map(
      (s, i) =>
        `<article class="feed-row"><span class="meta">${s.time}<br>${t("05 SEP", "05 ВЕР")}</span><div>${eyebrow(s.label)}<h2 class="mt">${link(s.route, s.title)}</h2><p>${s.summary}</p></div>${visual(i)}</article>`,
    )
    .join("");
function news(category = false) {
  return `${intro(category ? t("TOPIC / 01", "ТЕМА / 01") : t("THE NEWSROOM", "СТРІЧКА НОВИН"), category ? "Agents <em>& MCP.</em>" : t("A clearer <em>signal.</em>", "Чіткіший <em>сигнал.</em>"), category ? t("Follow how agents connect, remember and act. Start with the concepts, then read the latest.", "Як агенти з’єднуються, пам’ятають і діють. Почніть із концептів, далі — останні матеріали.") : t("What is changing in AI, and why it matters to your work.", "Що змінюється в AI і чому це важливо для вашої роботи."))}${category ? `<div class="filters">${link("concept", "MCP ↗", "chip")}${link("concept", t("AI agents ↗", "AI-агенти ↗"), "chip")}${link("guide", t("Start with a guide ↗", "Почати з гайду ↗"), "chip")}</div>` : filterBar()}<div class="feed-layout"><div id="feed-content">${feedRows(stories().filter((s) => (category ? s.cat === "agents" : activeFilter === "all" || s.cat === activeFilter)))}<p class="meta spaced">${t("End of this demo selection.", "Кінець демонстраційної добірки.")}</p></div><aside class="sidebar">${eyebrow(t("READ IT YOUR WAY", "ЧИТАЙТЕ У СВОЄМУ ТЕМПІ"))}<h3>${t("Only have five minutes?", "Маєте лише п’ять хвилин?")}</h3><p>${t("Start with the daily brief for a focused overview.", "Почніть зі щоденного брифу для стислого огляду.")}</p>${link("daily", t("Read the daily brief ↗", "Читати щоденний бриф ↗"))}${link("saved", t("Your reading list ↗", "Ваше збережене ↗"))}<hr style="border:0;border-top:1px solid var(--line);margin:25px 0">${eyebrow(t("EXPLORE THE CONTEXT", "ДОСЛІДИТИ КОНТЕКСТ"))}${link("concept", "Model Context Protocol ↗")}${link("guide", t("Choosing a coding agent ↗", "Вибір агента для коду ↗"))}</aside></div><section class="section">${newsletter()}</section>`;
}
function byline(readTime = 4, format = t("DEMONSTRATION LAYOUT", "ДЕМОНСТРАЦІЙНИЙ МАКЕТ")) {
  return `<div class="byline"><span class="avatar">OK</span><div>${t("Oleksandr Kuzmenko", "Олександр Кузьменко")}<br><span class="meta">${t("EDITOR", "РЕДАКТОР")} · ${format}</span></div><span class="meta">05.09.2026 · ${readTime} ${t("MIN READ", "ХВ ЧИТАННЯ")}</span></div>`;
}
function readShell(title, dek, tag, content, toc = ["overview", "context", "next", "sources"]) {
  const tocLabels = {
    overview: t("In brief", "Коротко"),
    context: t("The context", "Контекст"),
    next: t("What to do next", "Що робити далі"),
    sources: t("Sources & notes", "Джерела й примітки"),
  };
  return `<div class="breadcrumb">${link("home", t("Home", "Головна"))} / ${tag}</div><div class="article-top">${eyebrow(tag)}<h1>${title}</h1><p class="dek">${dek}</p>${byline()}</div><div class="article-layout"><nav class="toc" aria-label="${t("On this page", "На цій сторінці")}">${eyebrow(t("IN THIS STORY", "У МАТЕРІАЛІ"))}${toc.map((id) => `<a href="#${id}" data-anchor="${id}">${tocLabels[id]}</a>`).join("")}</nav><article class="reading">${content}</article><aside class="article-tools">${currentRoute() === "article" ? `<button class="button outline" data-save aria-pressed="${saved}">${saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +")}</button>` : ""}<button class="button outline" data-copy-link>${t("Copy link ↗", "Копіювати ↗")}</button></aside></div>`;
}

const articleVariantIds = ["analysis", "technical", "evidence"];

function currentArticleVariant() {
  const query = location.hash.split("?")[1] || "";
  const value = new URLSearchParams(query).get("variant");
  return articleVariantIds.includes(value) ? value : "analysis";
}

function articleVariantCards() {
  return [
    {
      id: "analysis",
      number: "01",
      format: t("EDITORIAL ANALYSIS", "РЕДАКЦІЙНИЙ РОЗБІР"),
      title: t("The agent era needs a better memory", "Епосі агентів потрібна краща пам’ять"),
      description: t(
        "A narrative news analysis with a thesis, architecture map, implications and uncertainty.",
        "Наративний аналіз новини з тезою, картою архітектури, наслідками й невизначеністю.",
      ),
    },
    {
      id: "technical",
      number: "02",
      format: t("TECHNICAL FIELD GUIDE", "ТЕХНІЧНИЙ РОЗБІР"),
      title: t("Prompt caching, beyond the price tag", "Prompt caching: більше, ніж економія"),
      description: t(
        "A practical developer story with a request anatomy, code, measurements and a rollout checklist.",
        "Практичний матеріал для розробників: анатомія запиту, код, вимірювання й чекліст запуску.",
      ),
    },
    {
      id: "evidence",
      number: "03",
      format: t("EVIDENCE NOTE", "ДОКАЗОВА НОТАТКА"),
      title: t("A benchmark is a starting point", "Бенчмарк — лише початок"),
      description: t(
        "An evidence-led research read with a claim ledger, confidence levels and transfer limits.",
        "Доказовий розбір дослідження: реєстр тверджень, рівні впевненості й межі перенесення.",
      ),
    },
  ];
}

function articleVariantPicker(active) {
  const cards = articleVariantCards();
  return `<section class="article-variant-picker" aria-labelledby="article-variant-title"><div class="article-variant-intro"><div>${eyebrow(t("ARTICLE SYSTEM / THREE FULL EXAMPLES", "СИСТЕМА СТАТЕЙ / ТРИ ПОВНІ ПРИКЛАДИ"))}<h2 id="article-variant-title">${t("One publication. Different reading jobs.", "Одне видання. Різні сценарії читання.")}</h2></div><p>${t("Switch formats to compare hierarchy, density and editorial modules. Each link opens a complete, shareable state.", "Перемикайте формати, щоб порівняти ієрархію, щільність і редакційні модулі. Кожне посилання відкриває повний стан із власною адресою.")}</p></div><div class="article-variant-grid">${cards
    .map(
      (card) =>
        `<a class="article-variant-card${card.id === active ? " active" : ""}" href="#/article?variant=${card.id}"${card.id === active ? ' aria-current="page"' : ""}><span class="article-variant-number">${card.number}</span><span class="meta">${card.format}</span><strong>${card.title}</strong><span>${card.description}</span><i aria-hidden="true">↗</i></a>`,
    )
    .join("")}</div></section>`;
}

function articleTakeaways(items) {
  return `<section class="article-takeaways" aria-labelledby="takeaways-title">${eyebrow(t("IN BRIEF / THREE SIGNALS", "КОРОТКО / ТРИ СИГНАЛИ"))}<h2 id="takeaways-title" class="sr-only">${t("Key takeaways", "Ключові висновки")}</h2><ol>${items
    .map((item, index) => `<li><span>0${index + 1}</span><p>${item}</p></li>`)
    .join("")}</ol></section>`;
}

function articleSourceLedger(items) {
  return `<ol class="source-ledger">${items
    .map(
      ([label, note], index) =>
        `<li><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${label}</strong><p>${note}</p></div></li>`,
    )
    .join("")}</ol>`;
}

function articleShell(data) {
  const related = articleVariantCards().filter((card) => card.id !== data.id);
  return `<div class="breadcrumb">${link("home", t("Home", "Головна"))} / ${link("news", t("News", "Новини"))} / ${data.format}</div>${articleVariantPicker(data.id)}<div class="article-top article-top-rich">${eyebrow(data.tag)}<h1>${data.title}</h1><p class="dek">${data.dek}</p>${byline(data.readTime, data.format)}<div class="article-trust-row"><span>${t("HUMAN-EDITED", "ВІДРЕДАГОВАНО ЛЮДИНОЮ")}</span><span>${t("ILLUSTRATIVE CONCEPT COPY", "ДЕМОНСТРАЦІЙНИЙ ТЕКСТ")}</span><span>${data.sourceCount} ${t("SOURCE SLOTS", "ПОЗИЦІЇ ДЖЕРЕЛ")}</span></div></div><div class="article-layout article-layout-rich"><nav class="toc" aria-label="${t("On this page", "На цій сторінці")}">${eyebrow(t("IN THIS STORY", "У МАТЕРІАЛІ"))}${data.toc.map(([id, label]) => `<a href="#${id}" data-anchor="${id}">${label}</a>`).join("")}</nav><article class="reading reading-rich">${data.content}</article><aside class="article-tools article-tools-rich"><div class="article-format-note">${eyebrow(data.format)}<p>${data.readTime} ${t("min", "хв")} · ${data.sourceCount} ${t("source slots", "позиції джерел")}</p></div><button class="button outline" data-save aria-pressed="${saved}">${saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +")}</button><button class="button outline" data-copy-link>${t("Copy link ↗", "Копіювати ↗")}</button></aside></div><section class="article-related section" aria-labelledby="article-related-title">${sectionHead(t("Two other ways to tell the story.", "Ще два способи розповісти історію."))}<h2 class="sr-only" id="article-related-title">${t("Other article examples", "Інші приклади статей")}</h2><div class="grid2">${related.map((card) => `<a class="article-related-card" href="#/article?variant=${card.id}"><span class="meta">${card.number} / ${card.format}</span><strong>${card.title}</strong><span>${card.description}</span><i aria-hidden="true">↗</i></a>`).join("")}</div></section>${newsletter()}`;
}

function analysisArticle() {
  const content = `<div class="article-disclosure">${t(
    "This is a complete layout sample, not a published report. Named systems and evidence slots demonstrate the editorial structure without presenting demo claims as news.",
    "Це повний приклад верстки, а не опублікований матеріал. Назви систем і місця для доказів демонструють редакційну структуру, не видаючи демо-твердження за новини.",
  )}</div><div class="callout" id="overview">${eyebrow(t("WHY IT MATTERS", "ЧОМУ ЦЕ ВАЖЛИВО"))}<p>${t(
    "Agent memory is becoming an architecture decision rather than a convenience feature. The useful question is not how much a system can retain, but which decisions should survive, for how long, and under whose authority.",
    "Пам’ять агента стає архітектурним рішенням, а не зручною додатковою функцією. Важливе питання не в тому, скільки система може зберегти, а які рішення мають пережити сесію, як довго і під чиїм контролем.",
  )}</p></div><figure class="article-hero article-hero-editorial">${art(false)}<figcaption>${t(
    "Editorial concept image. In production, the caption identifies the image source, generation disclosure and verification status.",
    "Редакційне концепт-зображення. У production підпис містить джерело, позначку про генерацію та статус перевірки.",
  )}</figcaption></figure>${articleTakeaways([
    t(
      "Separate working context from durable memory. A transcript is not automatically a useful record.",
      "Відокремлюйте робочий контекст від сталої пам’яті. Транскрипт не стає корисним записом автоматично.",
    ),
    t(
      "Store decisions with provenance, scope and an expiry rule so future agents can challenge them.",
      "Зберігайте рішення разом із походженням, межами дії та правилом завершення, щоб майбутній агент міг їх оскаржити.",
    ),
    t(
      "Keep a human review gate wherever remembered context can change permissions, publishing or customer-facing output.",
      "Залишайте людський review-gate там, де пам’ять може змінити дозволи, публікацію або результат для клієнта.",
    ),
  ])}<h2 id="signal">${t("The shift is governed memory, not endless context.", "Зміна — у керованій пам’яті, а не в безмежному контексті.")}</h2><p>${t(
    "Early agent workflows treated every run as a clean room: instructions went in, a result came out, and the next session started again. That made failures visible, but repeated work expensive. The reaction was to retain more—longer transcripts, larger project files, automatically generated summaries and personal preferences.",
    "Перші агентні процеси сприймали кожен запуск як чисту кімнату: інструкції входили, результат виходив, а наступна сесія починалася з нуля. Помилки були видимими, але повторення коштувало дорого. Відповіддю стало збереження більшого: довших транскриптів, більших файлів проєкту, автоматичних підсумків і персональних уподобань.",
  )}</p><p>${t(
    "More retained text solves repetition only until it becomes another source of ambiguity. A stale workaround can look like a current rule. An experiment can quietly become policy. A confident summary can outlive the evidence that produced it. The design problem is therefore editorial as much as technical: memory needs selection, hierarchy and correction.",
    "Більше збереженого тексту вирішує повторення лише доти, доки саме не стає джерелом неоднозначності. Застарілий workaround може виглядати чинним правилом. Експеримент — непомітно перетворитися на політику. Впевнений підсумок — пережити докази, з яких виник. Тому це не лише технічна, а й редакційна задача: пам’яті потрібні відбір, ієрархія та виправлення.",
  )}</p><blockquote>${t(
    "The durable unit should be a decision with context—not a transcript without an editor.",
    "Сталою одиницею має бути рішення з контекстом, а не транскрипт без редактора.",
  )}</blockquote><h2 id="architecture">${t("A three-layer memory model.", "Тришарова модель пам’яті.")}</h2><p>${t(
    "A practical system can divide remembered material by lifespan and authority. The layers below are not a vendor feature list; they are a review model that helps a team decide where information belongs.",
    "Практична система може ділити збережену інформацію за тривалістю й рівнем повноважень. Шари нижче — не список функцій конкретного вендора, а модель перевірки, що допомагає команді визначити місце кожного факту.",
  )}</p><div class="memory-stack"><section><span>01</span><div>${eyebrow(t("WORKING CONTEXT", "РОБОЧИЙ КОНТЕКСТ"))}<h3>${t("Useful for this run.", "Корисне для цього запуску.")}</h3><p>${t("Files, tool output and temporary hypotheses. Cheap to discard; dangerous to canonise automatically.", "Файли, відповіді інструментів і тимчасові гіпотези. Їх легко відкинути й небезпечно автоматично канонізувати.")}</p></div></section><section><span>02</span><div>${eyebrow(t("PROJECT MEMORY", "ПАМ’ЯТЬ ПРОЄКТУ"))}<h3>${t("Useful across a body of work.", "Корисне в межах спільної роботи.")}</h3><p>${t("Confirmed constraints, architecture decisions and named owners. Versioned, reviewable and close to the work they govern.", "Підтверджені обмеження, архітектурні рішення та відповідальні. Версійні, доступні для review і близькі до роботи, якою керують.")}</p></div></section><section><span>03</span><div>${eyebrow(t("ORGANISATIONAL POLICY", "ОРГАНІЗАЦІЙНА ПОЛІТИКА"))}<h3>${t("Useful only with explicit authority.", "Корисне лише з явними повноваженнями.")}</h3><p>${t("Security rules, publication gates and customer commitments. Changes need provenance, approval and an audit trail.", "Правила безпеки, publish-gates і зобов’язання перед клієнтами. Зміни потребують походження, схвалення й audit trail.")}</p></div></section></div><h2 id="decisions">${t("What changes for a product team?", "Що це змінює для продуктової команди?")}</h2><p>${t(
    "Memory design begins before a database choice. Teams need to name the decisions an agent may make, the evidence it may retain and the point at which a person must intervene. Those boundaries should be visible in the product—not buried in a system prompt that only an engineer can inspect.",
    "Проєктування пам’яті починається до вибору бази даних. Команда має назвати рішення, які агент може ухвалювати, докази, які може зберігати, і момент, коли має втрутитися людина. Ці межі мають бути видимими в продукті, а не захованими в system prompt, доступному лише інженеру.",
  )}</p><div class="table-scroll"><table class="decision-table"><thead><tr><th>${t("If the agent remembers…", "Якщо агент пам’ятає…")}</th><th>${t("Require…", "Потрібно…")}</th><th>${t("Watch for…", "Стежте за…")}</th></tr></thead><tbody><tr><td>${t("A user preference", "Уподобання користувача")}</td><td>${t("Visibility and a delete control", "Видимість і можливість видалення")}</td><td>${t("Inference presented as consent", "Припущенням, виданим за згоду")}</td></tr><tr><td>${t("A project constraint", "Обмеження проєкту")}</td><td>${t("Owner, source and review date", "Власник, джерело й дата review")}</td><td>${t("A temporary workaround becoming permanent", "Перетворенням тимчасового workaround на правило")}</td></tr><tr><td>${t("A publishing decision", "Рішення про публікацію")}</td><td>${t("Human approval and an audit event", "Людське схвалення й audit event")}</td><td>${t("A summary replacing primary evidence", "Підміною першоджерела підсумком")}</td></tr></tbody></table></div><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "The strongest memory feature may be a clear way to forget. Expiry, supersession and visible correction reduce the authority of stale context without forcing every session to begin from zero.",
    "Найсильнішою функцією пам’яті може бути зрозумілий спосіб забувати. Строк дії, заміна новішим рішенням і видиме виправлення зменшують авторитет застарілого контексту, не змушуючи кожну сесію починати з нуля.",
  )}</p></div><h2 id="uncertainty">${t("What remains uncertain.", "Що лишається невизначеним.")}</h2><div class="uncertainty-grid"><section><strong>${t("Product evidence", "Продуктові докази")}</strong><p>${t("Teams still need longitudinal evidence that remembered context improves completed work rather than only reducing repeated prompts.", "Командам ще потрібні довгострокові докази, що збережений контекст покращує завершену роботу, а не лише скорочує повторні запити.")}</p></section><section><strong>${t("User control", "Контроль користувача")}</strong><p>${t("A technically correct memory can still surprise a person if it appears in the wrong place or cannot be inspected and corrected.", "Навіть технічно коректна пам’ять може здивувати людину, якщо з’являється не там або її неможливо переглянути й виправити.")}</p></section></div><h2 id="sources">${t("Sources & verification notes.", "Джерела й примітки перевірки.")}</h2><p>${t(
    "A production story would link every factual claim to the primary report and mark the editor’s verification date. This concept shows the full source treatment while keeping the copy explicitly illustrative.",
    "Production-матеріал пов’язує кожне фактичне твердження з першоджерелом і позначає дату редакторської перевірки. Концепт показує повне оформлення джерел, лишаючи текст явно демонстраційним.",
  )}</p>${articleSourceLedger([
    [t("Primary announcement / documentation", "Первинний анонс / документація"), t("Canonical source, publication date, version and the exact claim it supports.", "Канонічне джерело, дата публікації, версія й точне твердження, яке воно підтверджує.")],
    [t("Independent technical analysis", "Незалежний технічний аналіз"), t("Used to test the vendor framing and identify limitations or missing context.", "Потрібен, щоб перевірити framing вендора й знайти обмеження або відсутній контекст.")],
    [t("Editor verification log", "Журнал редакторської перевірки"), t("Names the checked facts, unresolved questions, corrections and final review date.", "Називає перевірені факти, відкриті питання, виправлення й дату фінального review.")],
  ])}<div class="article-topic-links">${link("concept", "Model Context Protocol ↗")}${link("guide", t("Choosing an agent workflow ↗", "Вибір агентного процесу ↗"))}${link("policy", t("How we edit ↗", "Як ми редагуємо ↗"))}</div>`;
  return {
    id: "analysis",
    format: t("EDITORIAL ANALYSIS", "РЕДАКЦІЙНИЙ РОЗБІР"),
    tag: t("NEWS ANALYSIS / AGENTS & MCP", "АНАЛІЗ НОВИН / AGENTS & MCP"),
    title: t("The agent era needs a better memory.", "Епосі агентів потрібна краща пам’ять."),
    dek: t(
      "The next useful question is not how much an agent remembers. It is which decisions survive, who can correct them, and when the system should forget.",
      "Наступне важливе питання — не скільки агент пам’ятає. А які рішення зберігаються, хто може їх виправити й коли система має забути.",
    ),
    readTime: 8,
    sourceCount: 3,
    toc: [
      ["overview", t("In brief", "Коротко")],
      ["signal", t("The signal", "Головний сигнал")],
      ["architecture", t("Memory model", "Модель пам’яті")],
      ["decisions", t("Product decisions", "Продуктові рішення")],
      ["uncertainty", t("Uncertainty", "Невизначеність")],
      ["sources", t("Sources & notes", "Джерела й примітки")],
    ],
    content,
  };
}

function technicalArticle() {
  const content = `<div class="article-disclosure">${t(
    "This field guide is production-shaped demonstration copy. The request structure and measurement plan are realistic; example values are labelled and are not benchmark results.",
    "Це демонстраційний технічний матеріал із production-подібною структурою. Будова запиту й план вимірювання реалістичні; прикладні значення позначені й не є результатами бенчмарку.",
  )}</div><div class="callout" id="overview">${eyebrow(t("THE PRACTICAL ANSWER", "ПРАКТИЧНА ВІДПОВІДЬ"))}<p>${t(
    "Prompt caching works best when the request itself has an information architecture: stable instructions first, volatile task data last, and a clear boundary between the two. Cost is one outcome; predictable latency and easier debugging are often the more valuable ones.",
    "Prompt caching найкраще працює, коли сам запит має інформаційну архітектуру: сталі інструкції на початку, змінні дані завдання наприкінці й чітка межа між ними. Економія — лише один наслідок; передбачувана затримка й простіше налагодження часто цінніші.",
  )}</p></div><figure class="article-hero article-hero-system" aria-labelledby="cache-flow-caption"><div class="cache-flow" role="img" aria-label="${t("Stable project context flows into a cache boundary before task-specific input and verification", "Сталий контекст проєкту проходить через межу кешу перед даними конкретного завдання та перевіркою")}"><span><small>01</small>${t("System rules", "Системні правила")}</span><i aria-hidden="true">→</i><span><small>02</small>${t("Stable project context", "Сталий контекст проєкту")}</span><i aria-hidden="true">→</i><span class="cache-boundary"><small>03</small>${t("Cache boundary", "Межа кешу")}</span><i aria-hidden="true">→</i><span><small>04</small>${t("Task + evidence", "Завдання + докази")}</span></div><figcaption id="cache-flow-caption">${t(
    "A cacheable prefix is a content contract, not a pile of text. Put stable material before the boundary and keep per-run evidence after it.",
    "Кешований префікс — це контракт контенту, а не купа тексту. Розміщуйте сталі матеріали до межі, а докази конкретного запуску — після неї.",
  )}</figcaption></figure>${articleTakeaways([
    t("Optimise structure before token count: the same stable prefix should mean the same thing across requests.", "Оптимізуйте структуру до кількості токенів: той самий сталий префікс має означати те саме в різних запитах."),
    t("Track cache hit rate together with first-token latency, output quality and the reason for every miss.", "Відстежуйте cache hit rate разом із first-token latency, якістю результату й причиною кожного промаху."),
    t("Roll out by one repeated workflow. Caching a poorly scoped prompt only makes the wrong contract cheaper.", "Запускайте на одному повторюваному процесі. Кешування погано окресленого промпту лише здешевлює неправильний контракт."),
  ])}<h2 id="anatomy">${t("The anatomy of a cacheable request.", "Анатомія запиту, який варто кешувати.")}</h2><p>${t(
    "Start by reading the request in the order a model receives it. Global safety rules and stable role instructions usually change rarely. Project conventions change more often, but still belong to a versioned layer. The task, selected files, retrieved evidence and user correction are volatile by design.",
    "Почніть із читання запиту в тому порядку, у якому його отримує модель. Глобальні правила безпеки й сталі інструкції ролі зазвичай змінюються рідко. Конвенції проєкту змінюються частіше, але теж належать до версійного шару. Завдання, вибрані файли, знайдені докази й уточнення користувача навмисно змінні.",
  )}</p><p>${t(
    "A good boundary is observable. You can name the version of the stable context, explain which change invalidated it and reproduce the uncached request. If a team cannot do those three things, the cache is hiding coupling rather than removing work.",
    "Хороша межа спостережувана. Ви можете назвати версію сталого контексту, пояснити, яка зміна його інвалідувала, і відтворити запит без кешу. Якщо команда не може зробити ці три речі, кеш приховує зв’язність, а не прибирає роботу.",
  )}</p><div class="request-layers"><section><span class="meta">STABLE / VERSIONED</span><h3>${t("Role and non-negotiables", "Роль і незмінні правила")}</h3><p>${t("Safety limits, output contract, durable project instructions and tool descriptions that truly belong in every run.", "Безпекові межі, контракт результату, сталі інструкції проєкту й описи інструментів, які справді потрібні в кожному запуску.")}</p></section><section><span class="meta">SEMI-STABLE / SELECTIVE</span><h3>${t("Workflow context", "Контекст процесу")}</h3><p>${t("Repository map, active decision records and the smallest reference set needed for this family of tasks.", "Карта репозиторію, активні decision records і найменший набір довідок, потрібний для цього типу завдань.")}</p></section><section><span class="meta">VOLATILE / PER RUN</span><h3>${t("Task and evidence", "Завдання й докази")}</h3><p>${t("User intent, changed files, tool output, current measurements and anything expected to differ on the next call.", "Намір користувача, змінені файли, відповіді інструментів, поточні вимірювання й усе, що має відрізнятися в наступному виклику.")}</p></section></div><h3>${t("A minimal request builder", "Мінімальний конструктор запиту")}</h3><pre class="article-code" aria-label="${t("JavaScript request builder example", "Приклад конструктора запиту JavaScript")}"><code><span class="code-comment">// stable-context@2026-09-05</span>&#10;const stablePrefix = await loadProjectContract();&#10;const taskEvidence = await collectCurrentEvidence(task);&#10;&#10;const request = {&#10;  system: stablePrefix,&#10;  input: { task, evidence: taskEvidence },&#10;  verify: ["goal", "diff", "tests", "uncertainty"],&#10;};&#10;&#10;const result = await runAgent(request);&#10;await reviewBeforePublish(result);</code></pre><p class="article-caption">${t(
    "The example keeps the review step outside the generated result. A cache hit never grants permission to publish or apply a risky change.",
    "Приклад залишає review-крок поза згенерованим результатом. Cache hit ніколи не дає дозволу на публікацію чи ризиковану зміну.",
  )}</p><h2 id="measurement">${t("Measure the workflow, not the invoice alone.", "Вимірюйте процес, а не лише рахунок.")}</h2><p>${t(
    "A lower token bill can coincide with a worse workflow if stale context increases retries or if a larger prefix delays the first useful output. Establish a small baseline before changing the request, then compare the same task family under the same review standard.",
    "Нижчий рахунок за токени може співіснувати з гіршим процесом, якщо застарілий контекст збільшує кількість повторів або великий префікс затримує перший корисний результат. Зафіксуйте малу baseline до зміни запиту, а потім порівнюйте той самий тип завдань за однаковим стандартом review.",
  )}</p><div class="metric-grid"><section><span>${t("HIT RATE", "ЧАСТКА HIT")}</span><strong>72%</strong><p>${t("Illustrative target for a repeated workflow, not a universal threshold.", "Демонстраційна ціль для повторюваного процесу, не універсальний поріг.")}</p></section><section><span>${t("FIRST TOKEN", "ПЕРШИЙ ТОКЕН")}</span><strong>−18%</strong><p>${t("Example comparison after keeping the stable prefix warm.", "Приклад порівняння після прогрівання сталого префікса.")}</p></section><section><span>${t("RETRY RATE", "ЧАСТКА RETRY")}</span><strong>0↔</strong><p>${t("Quality guard: savings do not count if retries increase.", "Quality guard: економія не рахується, якщо retry зростають.")}</p></section><section><span>${t("MISS REASONS", "ПРИЧИНИ MISS")}</span><strong>4</strong><p>${t("Version change, ordering, TTL and provider routing—name each one.", "Зміна версії, порядок, TTL і provider routing — назвіть кожну.")}</p></section></div><div class="table-scroll"><table><thead><tr><th>${t("Measure", "Метрика")}</th><th>${t("Why it matters", "Навіщо")}</th><th>${t("Failure signal", "Сигнал проблеми")}</th></tr></thead><tbody><tr><td>Cache hit rate</td><td>${t("Shows whether the boundary is stable in real traffic", "Показує, чи стабільна межа в реальному трафіку")}</td><td>${t("High variance between equivalent tasks", "Висока різниця між еквівалентними задачами")}</td></tr><tr><td>Time to first token</td><td>${t("Captures perceived responsiveness", "Відображає відчутну швидкість відповіді")}</td><td>${t("A larger prefix erases the benefit", "Більший префікс з’їдає виграш")}</td></tr><tr><td>Accepted-result rate</td><td>${t("Keeps quality attached to cost", "Пов’язує якість із вартістю")}</td><td>${t("More manual repair after a hit", "Більше ручного ремонту після hit")}</td></tr><tr><td>Miss reason</td><td>${t("Turns cache behaviour into a debuggable system", "Робить поведінку кешу придатною для налагодження")}</td><td>${t("Unknown misses become normal", "Невідомі промахи стають нормою")}</td></tr></tbody></table></div><h2 id="rollout">${t("A safe rollout in one afternoon.", "Безпечний запуск за один робочий цикл.")}</h2><div class="use-grid"><section class="use-card positive">${eyebrow(t("USE IT WHEN", "ВИКОРИСТОВУЙТЕ, КОЛИ"))}<ul><li>${t("The same instruction prefix serves a repeated task family.", "Той самий префікс інструкцій обслуговує повторюваний тип завдань.")}</li><li>${t("You can version the stable context independently of task data.", "Сталий контекст можна версіонувати окремо від даних завдання.")}</li><li>${t("Latency, quality and cost can be observed together.", "Затримку, якість і вартість можна спостерігати разом.")}</li></ul></section><section class="use-card caution">${eyebrow(t("WAIT WHEN", "ЗАЧЕКАЙТЕ, КОЛИ"))}<ul><li>${t("Every request assembles a different tool or evidence set.", "Кожен запит збирає інший набір інструментів або доказів.")}</li><li>${t("The prompt contract changes several times a day.", "Контракт промпту змінюється кілька разів на день.")}</li><li>${t("The team cannot explain why a miss occurred.", "Команда не може пояснити причину промаху.")}</li></ul></section></div><ol class="rollout-list"><li><span>01</span><div><strong>${t("Choose one repeated workflow.", "Оберіть один повторюваний процес.")}</strong><p>${t("Use a task with enough volume to observe, but low enough risk to review manually.", "Візьміть завдання з достатнім обсягом для спостереження, але низьким ризиком для ручного review.")}</p></div></li><li><span>02</span><div><strong>${t("Freeze and name the prefix.", "Зафіксуйте й назвіть префікс.")}</strong><p>${t("Record content hash, version, owner and the reason a future change should invalidate it.", "Запишіть content hash, версію, власника й причину, з якої майбутня зміна має його інвалідувати.")}</p></div></li><li><span>03</span><div><strong>${t("Run a paired comparison.", "Проведіть парне порівняння.")}</strong><p>${t("Compare equivalent tasks with the same model, provider route, output contract and reviewer.", "Порівнюйте еквівалентні задачі з тією самою моделлю, provider route, контрактом результату й reviewer.")}</p></div></li><li><span>04</span><div><strong>${t("Add a miss ledger before scaling.", "Додайте реєстр miss до масштабування.")}</strong><p>${t("Every miss needs a reason. Unknown is useful temporarily, not as a permanent category.", "Кожен miss потребує причини. Unknown корисний тимчасово, але не як постійна категорія.")}</p></div></li></ol><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "Prompt caching exposes whether a team actually knows what is stable in its own workflow. The cost graph is useful, but the sharper benefit is a better-separated request contract.",
    "Prompt caching показує, чи команда справді розуміє, що є сталим у її процесі. Графік вартості корисний, але сильніший результат — краще розділений контракт запиту.",
  )}</p></div><h2 id="sources">${t("Implementation notes & source slots.", "Примітки реалізації й позиції джерел.")}</h2>${articleSourceLedger([
    [t("Provider caching documentation", "Документація провайдера про кешування"), t("Exact eligibility rules, TTL, billing semantics and invalidation behaviour for the selected route.", "Точні правила придатності, TTL, billing semantics і поведінка інвалідації для обраного маршруту.")],
    [t("Application telemetry", "Телеметрія застосунку"), t("Request version, hit or miss, reason, latency and accepted-result signal—without storing private prompt text.", "Версія запиту, hit або miss, причина, затримка й accepted-result signal — без збереження приватного тексту промпту.")],
    [t("Controlled comparison", "Контрольоване порівняння"), t("Same workflow, model route, reviewer and quality bar before and after the change.", "Той самий процес, маршрут моделі, reviewer і quality bar до та після зміни.")],
    [t("Change log", "Журнал змін"), t("Every prefix version states what changed, who approved it and when results should be rechecked.", "Кожна версія префікса пояснює зміну, того, хто її схвалив, і момент повторної перевірки результатів.")],
  ])}<div class="article-topic-links">${link("concept", t("Prompt caching concept ↗", "Концепт prompt caching ↗"))}${link("tool", t("Structure a prompt ↗", "Структурувати промпт ↗"))}${link("guide", t("Choose a coding workflow ↗", "Обрати процес роботи з кодом ↗"))}</div>`;
  return {
    id: "technical",
    format: t("TECHNICAL FIELD GUIDE", "ТЕХНІЧНИЙ РОЗБІР"),
    tag: t("FIELD GUIDE / COST & PERFORMANCE", "ТЕХНІЧНИЙ ГАЙД / ВАРТІСТЬ І ШВИДКІСТЬ"),
    title: t("Prompt caching, beyond the price tag.", "Prompt caching: більше, ніж економія."),
    dek: t("A cacheable prompt is an information architecture. Here is how to separate the stable prefix, measure the boundary and roll it out without hiding quality regressions.", "Промпт, який варто кешувати, — це інформаційна архітектура. Як відділити сталий префікс, виміряти межу й запустити її без прихованої втрати якості."),
    readTime: 10,
    sourceCount: 4,
    toc: [
      ["overview", t("Practical answer", "Практична відповідь")],
      ["anatomy", t("Request anatomy", "Анатомія запиту")],
      ["measurement", t("What to measure", "Що вимірювати")],
      ["rollout", t("Safe rollout", "Безпечний запуск")],
      ["sources", t("Notes & sources", "Примітки й джерела")],
    ],
    content,
  };
}
function evidenceArticle() {
  const content = `<div class="article-disclosure">${t(
    "This research-note layout uses an illustrative benchmark scenario. The evidence hierarchy is the product: every score, setup and confidence label would link to a reproducible source in a published article.",
    "Цей макет research note використовує демонстраційний сценарій бенчмарку. Ієрархія доказів — частина продукту: кожна оцінка, умова й рівень впевненості в опублікованій статті ведуть до відтворюваного джерела.",
  )}</div><div class="callout" id="overview">${eyebrow(t("THE CLAIM IN ONE SENTENCE", "ТВЕРДЖЕННЯ ОДНИМ РЕЧЕННЯМ"))}<p>${t(
    "A benchmark can show how a system behaved under one defined setup. It cannot, by itself, tell you whether the system fits your repository, review process or tolerance for failure.",
    "Бенчмарк може показати поведінку системи в одних визначених умовах. Сам по собі він не відповідає, чи підходить система вашому репозиторію, процесу review або допустимому рівню помилок.",
  )}</p></div><figure class="article-hero article-hero-evidence" aria-labelledby="evidence-hero-caption"><div class="evidence-frame"><section><span>01 / TASK</span><strong>${t("Repository change", "Зміна в репозиторії")}</strong><small>${t("Defined issue + hidden tests", "Визначена задача + приховані тести")}</small></section><section><span>02 / SETUP</span><strong>${t("Same tools", "Ті самі інструменти")}</strong><small>${t("Pinned model, budget and environment", "Зафіксовані модель, бюджет і середовище")}</small></section><section><span>03 / RESULT</span><strong>${t("Accepted diff", "Прийнятий diff")}</strong><small>${t("Not just a generated answer", "Не лише згенерована відповідь")}</small></section><section><span>04 / TRANSFER</span><strong>${t("Your workflow?", "Ваш процес?")}</strong><small>${t("Still needs a local check", "Ще потребує локальної перевірки")}</small></section></div><figcaption id="evidence-hero-caption">${t(
    "Read a benchmark left to right, then test transferability right to left. The headline score is only one cell in the chain.",
    "Читайте бенчмарк зліва направо, а перенесення перевіряйте справа наліво. Підсумкова оцінка — лише одна клітинка в ланцюгу.",
  )}</figcaption></figure>${articleTakeaways([
    t("Inspect the task definition and pass condition before comparing model names or aggregate scores.", "Перевірте визначення завдання й умову проходження до порівняння назв моделей або загальних балів."),
    t("Treat tool access, retry budget and reviewer intervention as part of the result—not incidental setup details.", "Вважайте доступ до інструментів, бюджет retry і втручання reviewer частиною результату, а не другорядними деталями setup."),
    t("Run a small local transfer test before changing a production workflow. Reproducibility is necessary; relevance is separate.", "Проведіть малий локальний transfer test до зміни production-процесу. Відтворюваність необхідна, але доречність — окреме питання."),
  ])}<h2 id="reading">${t("Read the score backwards.", "Читайте оцінку у зворотному напрямку.")}</h2><p>${t(
    "A leaderboard invites the eye to start with rank. A useful review begins at the other end: what counted as success, who judged it, what the system was allowed to do and which failures disappeared inside an average. Only then does the aggregate score become interpretable.",
    "Таблиця лідерів спонукає починати з місця. Корисний review починається з іншого боку: що вважали успіхом, хто це оцінював, що система мала право робити й які провали зникли всередині середнього. Лише тоді загальний бал можна інтерпретувати.",
  )}</p><p>${t(
    "This is especially important for agent evaluations. A model, harness, tool policy and retry controller act together. Reporting only the model name compresses a system result into a product label. That may be convenient for a headline, but it is weak evidence for an engineering decision.",
    "Це особливо важливо для оцінювання агентів. Модель, harness, tool policy і retry controller працюють разом. Якщо повідомляти лише назву моделі, системний результат стискається до product label. Для заголовка це зручно, але для інженерного рішення — слабкий доказ.",
  )}</p><div class="evidence-ledger"><div class="evidence-ledger-head"><span>${t("CLAIM", "ТВЕРДЖЕННЯ")}</span><span>${t("EVIDENCE NEEDED", "ПОТРІБНИЙ ДОКАЗ")}</span><span>${t("TRANSFER RISK", "РИЗИК ПЕРЕНЕСЕННЯ")}</span></div><div><strong>${t("System A completes more tasks", "Система A завершує більше завдань")}</strong><p>${t("Per-task outcomes, pass condition and excluded runs", "Результати кожного завдання, умова проходження й виключені запуски")}</p><span class="confidence medium">${t("MEDIUM", "СЕРЕДНІЙ")}</span></div><div><strong>${t("The improvement comes from the model", "Покращення дає саме модель")}</strong><p>${t("Ablation across harness, tools, prompt and retry policy", "Ablation для harness, інструментів, промпту й retry policy")}</p><span class="confidence high">${t("HIGH", "ВИСОКИЙ")}</span></div><div><strong>${t("The result will hold in our repository", "Результат повториться в нашому репозиторії")}</strong><p>${t("Local task sample with the same review bar", "Локальна вибірка завдань із тим самим стандартом review")}</p><span class="confidence high">${t("HIGH", "ВИСОКИЙ")}</span></div><div><strong>${t("The workflow is cheaper overall", "Процес загалом дешевший")}</strong><p>${t("Total attempts, reviewer time and provider cost", "Усі спроби, час reviewer і вартість провайдера")}</p><span class="confidence medium">${t("MEDIUM", "СЕРЕДНІЙ")}</span></div></div><h2 id="evidence">${t("An evidence matrix, not a winner card.", "Матриця доказів, а не картка переможця.")}</h2><p>${t(
    "The compact table below shows how a production article can keep numbers attached to their conditions. The values are intentionally illustrative; their job is to demonstrate hierarchy, footnotes and uncertainty without implying a real model comparison.",
    "Компактна таблиця нижче показує, як production-стаття може тримати числа поруч з умовами. Значення навмисно демонстраційні: вони показують ієрархію, примітки й невизначеність, не імітуючи реальне порівняння моделей.",
  )}</p><div class="table-scroll"><table class="benchmark-table"><thead><tr><th>${t("Illustrative system", "Демонстраційна система")}</th><th>${t("Accepted tasks", "Прийняті задачі")}</th><th>${t("Median attempts", "Медіана спроб")}</th><th>${t("Human repair", "Ручний ремонт")}</th><th>${t("Evidence grade", "Рівень доказу")}</th></tr></thead><tbody><tr><td>Baseline / A</td><td>18 / 30</td><td>1.8</td><td>7</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>Treatment / B</td><td>21 / 30</td><td>2.4</td><td>9</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>${t("Local transfer", "Локальне перенесення")}</td><td>4 / 8</td><td>2.0</td><td>3</td><td><span class="confidence low">C / ${t("small n", "мала n")}</span></td></tr></tbody></table></div><aside class="method-note"><strong>${t("How to read the demo", "Як читати демо")}</strong><p>${t(
    "Treatment B has a higher accepted-task count, but also more attempts and repair. Without task-level data and a larger transfer sample, the strongest defensible conclusion is narrow: the setup deserves another controlled test.",
    "Treatment B має більше прийнятих задач, але також більше спроб і ремонту. Без даних по кожному завданню й більшої transfer-вибірки найсильніший обґрунтований висновок вузький: setup заслуговує ще одного контрольованого тесту.",
  )}</p></aside><h2 id="transfer">${t("Transfer is a second experiment.", "Перенесення — це другий експеримент.")}</h2><p>${t(
    "Reproducibility asks whether another team can obtain the reported result under the documented setup. Transferability asks whether the result survives a change in repository, task mix, tool permissions, latency budget and reviewer expectations. The first protects the claim; the second protects your decision.",
    "Відтворюваність питає, чи інша команда отримає заявлений результат у задокументованому setup. Переносимість — чи переживе результат зміну репозиторію, набору задач, дозволів інструментів, бюджету затримки й очікувань reviewer. Перше захищає твердження, друге — ваше рішення.",
  )}</p><div class="transfer-grid"><section>${eyebrow(t("KEEP CONSTANT", "ЗАЛИШТЕ СТАЛИМ"))}<ul><li>${t("Task acceptance criteria", "Критерії прийняття задачі")}</li><li>${t("Review rubric", "Рубрику review")}</li><li>${t("Maximum attempts", "Максимальну кількість спроб")}</li><li>${t("Cost accounting", "Облік вартості")}</li></ul></section><section>${eyebrow(t("CHANGE DELIBERATELY", "ЗМІНЮЙТЕ НАВМИСНО"))}<ul><li>${t("Repository and codebase shape", "Репозиторій і форму кодової бази")}</li><li>${t("Task distribution", "Розподіл типів задач")}</li><li>${t("Tool and permission policy", "Політику інструментів і дозволів")}</li><li>${t("Reviewer familiarity", "Обізнаність reviewer")}</li></ul></section><section>${eyebrow(t("REPORT SEPARATELY", "ЗВІТУЙТЕ ОКРЕМО"))}<ul><li>${t("Correct first attempts", "Коректні перші спроби")}</li><li>${t("Recovered attempts", "Відновлені спроби")}</li><li>${t("Unsafe or unverifiable output", "Небезпечні або неперевірні результати")}</li><li>${t("Human repair time", "Час ручного ремонту")}</li></ul></section></div><h2 id="decision">${t("A decision framework for the next trial.", "Рамка рішення для наступного тесту.")}</h2><ol class="rollout-list"><li><span>01</span><div><strong>${t("Name the decision.", "Назвіть рішення.")}</strong><p>${t("Are you selecting a model, a complete agent system, a review policy or only a candidate for further testing?", "Ви обираєте модель, повну агентну систему, політику review чи лише кандидата на наступне тестування?")}</p></div></li><li><span>02</span><div><strong>${t("Set the local failure budget.", "Встановіть локальний бюджет помилки.")}</strong><p>${t("Define which failures are recoverable, which require a person and which stop the trial immediately.", "Визначте, які помилки відновлювані, які потребують людини, а які негайно зупиняють тест.")}</p></div></li><li><span>03</span><div><strong>${t("Choose representative tasks.", "Оберіть репрезентативні задачі.")}</strong><p>${t("Include ordinary work, one difficult edge case and one task the system should refuse or escalate.", "Додайте звичайну роботу, один складний edge case і одну задачу, яку система має відхилити або ескалувати.")}</p></div></li><li><span>04</span><div><strong>${t("Keep the evidence package.", "Збережіть пакет доказів.")}</strong><p>${t("Store inputs, environment, versions, outputs, review notes and the reason for every exclusion.", "Збережіть inputs, середовище, версії, outputs, review notes і причину кожного виключення.")}</p></div></li></ol><div class="voice-pair"><blockquote><p>${t("A score is useful when it narrows a decision. It is misleading when it replaces the conditions that produced it.", "Оцінка корисна, коли звужує рішення. Вона вводить в оману, коли замінює умови, що її створили.")}</p><cite>${t("Editorial interpretation", "Редакційна інтерпретація")}</cite></blockquote><blockquote><p>${t("The most honest outcome of a benchmark review can be: promising, not yet transferable.", "Найчеснішим результатом review бенчмарку може бути: перспективно, але ще не переноситься.")}</p><cite>${t("Decision note", "Примітка до рішення")}</cite></blockquote></div><h2 id="sources">${t("Evidence package & source ledger.", "Пакет доказів і реєстр джерел.")}</h2>${articleSourceLedger([
    [t("Benchmark specification", "Специфікація бенчмарку"), t("Task set, exclusions, acceptance rules, evaluator and aggregation method.", "Набір задач, виключення, правила прийняття, evaluator і метод агрегації.")],
    [t("Reproduction bundle", "Пакет відтворення"), t("Environment, versions, prompts, tool policy, seeds and task-level outcomes.", "Середовище, версії, промпти, tool policy, seeds і результати по кожній задачі.")],
    [t("Independent review", "Незалежний review"), t("A second reader checks whether the written claim is narrower than—or equal to—the evidence.", "Другий читач перевіряє, що письмове твердження не ширше за докази.")],
    [t("Local transfer run", "Локальний transfer run"), t("Representative internal tasks, the same quality bar and a separately reported small-sample limitation.", "Репрезентативні внутрішні задачі, той самий quality bar і окремо позначене обмеження малої вибірки.")],
    [t("Correction history", "Історія виправлень"), t("Changes to data, interpretation or confidence remain visible after publication.", "Зміни даних, інтерпретації або рівня впевненості лишаються видимими після публікації.")],
  ])}<div class="article-topic-links">${link("guide", t("Read the evaluation guide ↗", "Читати гайд з оцінювання ↗"))}${link("concept", t("Explore agent systems ↗", "Дослідити агентні системи ↗"))}${link("policy", t("Corrections policy ↗", "Політика виправлень ↗"))}</div>`;
  return {
    id: "evidence",
    format: t("EVIDENCE NOTE", "ДОКАЗОВА НОТАТКА"),
    tag: t("RESEARCH NOTE / MODELS & EVALUATION", "RESEARCH NOTE / МОДЕЛІ Й ОЦІНЮВАННЯ"),
    title: t("A benchmark is a starting point. What comes next?", "Бенчмарк — початок. Що далі?"),
    dek: t("A useful benchmark article keeps the task, setup, result and transfer limit together—then turns the headline score into a bounded engineering decision.", "Корисна стаття про бенчмарк тримає разом завдання, setup, результат і межу перенесення, а підсумкову оцінку перетворює на обмежене інженерне рішення."),
    readTime: 9,
    sourceCount: 5,
    toc: [
      ["overview", t("The claim", "Твердження")],
      ["reading", t("Read the score", "Як читати оцінку")],
      ["evidence", t("Evidence matrix", "Матриця доказів")],
      ["transfer", t("Transfer test", "Transfer test")],
      ["decision", t("Decision framework", "Рамка рішення")],
      ["sources", t("Evidence ledger", "Реєстр доказів")],
    ],
    content,
  };
}

function articleVariant() {
  const variant = currentArticleVariant();
  if (variant === "technical") return technicalArticle();
  if (variant === "evidence") return evidenceArticle();
  return analysisArticle();
}

function article() {
  return articleShell(articleVariant());
}
function digests() {
  return `${intro(t("THE EDITIONS", "ВИПУСКИ"), t("Daily context.<br><em>Weekly perspective.</em>", "Контекст щодня.<br><em>Перспектива щотижня.</em>"), t("Choose a quick catch-up or make time for a deeper read.", "Оберіть короткий огляд або знайдіть час для глибшого читання."))}${filterBar("digests")}<div class="grid2">${activeFilter === "all" || activeFilter === "daily" ? `<article class="tool-card">${eyebrow(t("DAILY / 05 SEP 2026", "DAILY / 05 ВЕР 2026"))}<div class="tool-number">05<span style="font-size:18px"> / 09</span></div><h2>${t("Today, in five minutes.", "Сьогодні, за п’ять хвилин.")}</h2><p>${t("Memory, context and the decisions behind useful agents. A compact, finite read.", "Пам’ять, контекст і рішення за корисними агентами. Короткий завершений огляд.")}</p>${btn("daily", t("Read the daily brief", "Читати бриф дня"))}</article>` : ""}${activeFilter === "all" || activeFilter === "weekly" ? `<article class="week-cover">${eyebrow("WEEKLY / DESIGN EDITION")}<h3>${t("The shape<br>of what’s next.", "Контури<br>майбутнього.")}</h3><div class="spaced" style="position:relative;z-index:2">${btn("weekly", t("Read the weekly edition", "Читати тижневий випуск"))}</div></article>` : ""}</div><section class="section">${sectionHead(t("Previous editions", "Попередні випуски"))}${activeFilter === "weekly" ? `<p class="meta">${t("This preview contains one weekly edition.", "У цьому перегляді один тижневий випуск.")}</p>` : ""}${(activeFilter === "weekly" ? [] : ["04", "03", "02"]).map((d) => `<div class="index-row"><span class="term-letter">${d}</span><h2>${link("daily", t("The daily intelligence edit", "Щоденний редакційний бриф"))}</h2><p>${t("Illustrative archive entry · five-minute format", "Демонстраційний запис архіву · п’ятихвилинний формат")}</p><span class="meta">DAILY / SEP</span></div>`).join("")}</section>${newsletter()}`;
}
function daily() {
  return `${intro("THE DAILY BRIEF / 05.09.2026", t("A little clarity.<br><em>Before you begin.</em>", "Трохи ясності.<br><em>Перед початком дня.</em>"), t("Your five-minute edit: three things to understand, one thing to try.", "Ваш п’ятихвилинний огляд: три речі для розуміння й одна для дії."))}<div class="dateline"><span>${t("DEMONSTRATION EDITION", "ДЕМОНСТРАЦІЙНИЙ ВИПУСК")}</span><span>${link("digests", t("ALL EDITIONS ↗", "УСІ ВИПУСКИ ↗"))}</span></div><div class="feed-layout"><div>${stories()
    .slice(0, 3)
    .map(
      (s, i) =>
        `<article class="index-row" style="grid-template-columns:45px 1fr" id="daily-${i}"><span class="term-letter">0${i + 1}</span><div>${eyebrow(s.label)}<h2 class="mt">${link("article", s.title)}</h2><p class="spaced">${s.summary}</p><div class="status-banner spaced">${t("The takeaway:", "Головне:")} ${t("Connect the change to one concrete decision in your own workflow.", "Пов’яжіть зміну з одним конкретним рішенням у власному процесі.")}</div>${link("article", t("Read the full context ↗", "Читати повний контекст ↗"))}</div></article>`,
    )
    .join(
      "",
    )}<div class="sidebar spaced">${eyebrow(t("ONE THING TO TRY", "ОДНА РІЧ ДЛЯ ПРАКТИКИ"))}<h3>${t("Audit one agent instruction.", "Перевірте одну інструкцію агента.")}</h3><p>${t("Separate the goal, the context and the check. Start with a small example in Toolbox.", "Розділіть мету, контекст і перевірку. Почніть із невеликого прикладу в Toolbox.")}</p>${link("tool", t("Open the workspace ↗", "Відкрити утиліту ↗"))}</div></div><aside class="sidebar">${eyebrow(t("IN THIS EDITION", "У ЦЬОМУ ВИПУСКУ"))}${stories()
    .slice(0, 3)
    .map((s, i) => `<a href="#daily-${i}" data-anchor="daily-${i}">0${i + 1} / ${s.title}</a>`)
    .join(
      "",
    )}<p class="spaced">${t("Prefer the bigger picture?", "Цікавить ширший погляд?")}</p>${link("weekly", t("The weekly edition ↗", "Тижневий випуск ↗"))}</aside></div><section class="section">${newsletter()}</section>`;
}
function weekly() {
  return `${intro("THE WEEKLY EDITION / DESIGN ISSUE 01", t("The shape of<br><em>what’s next.</em>", "Контури<br><em>майбутнього.</em>"), t("Three shifts. One connected view of where AI engineering is heading.", "Три зрушення. Цілісний погляд на напрям розвитку AI-інженерії."))}<img class="brand-art" src="assets/after-hours.png" width="1672" height="941" alt="${t("Brass and glass concept sculpture", "Концептуальна скульптура з латуні й скла")}"><p class="meta mt">${t("CONCEPT ART / SAMPLE EDITION", "КОНЦЕПТ-АРТ / ПРИКЛАД ВИПУСКУ")}</p><div class="article-layout spaced"><nav class="toc" aria-label="${t("Edition contents", "Зміст випуску")}">${eyebrow(t("THE SETLIST", "ЗМІСТ"))}${["Memory", "Context", "Judgment"].map((s, i) => `<a href="#shift-${i}" data-anchor="shift-${i}">0${i + 1} / ${t(s, ["Пам’ять", "Контекст", "Рішення"][i])}</a>`).join("")}<a href="#action-board" data-anchor="action-board">${t("Next week’s moves", "Кроки на наступний тиждень")}</a></nav><article class="reading"><div class="callout">${eyebrow(t("THE THROUGH-LINE", "СПІЛЬНА ДУМКА"))}<p>${t("The interesting shift is from asking what a model can do to designing the conditions in which it does useful work. This is illustrative editorial direction.", "Цікаве зрушення — від питання, що вміє модель, до проєктування умов, у яких вона робить корисну роботу. Це демонстрація редакційного напрямку.")}</p></div>${["Memory", "Context", "Judgment"].map((s, i) => `<section id="shift-${i}">${eyebrow("0" + (i + 1) + " / " + t(s, ["Пам’ять", "Контекст", "Рішення"][i]))}<h2>${stories()[i].title}</h2><p>${stories()[i].summary}</p><p>${t("The weekly format connects individual reports, then separates what changed from what is still uncertain. Each chapter ends with a practical implication and visible source references.", "Тижневий формат пов’язує окремі матеріали, розділяє зміни й невизначеність. Кожен розділ закінчується практичним наслідком і видимими посиланнями на джерела.")}</p>${link("article", t("Follow the original story ↗", "Відкрити окремий матеріал ↗"))}</section>`).join("")}<section id="action-board"><h2>${t("Next week’s moves.", "Кроки на наступний тиждень.")}</h2><div class="table-scroll"><table><thead><tr><th>${t("Try", "Спробуйте")}</th><th>${t("Watch", "Стежте")}</th><th>${t("Keep in mind", "Пам’ятайте")}</th></tr></thead><tbody><tr><td>${t("Audit one instruction", "Перевірити одну інструкцію")}</td><td>${t("Context quality", "Якість контексту")}</td><td>${t("Human review", "Людська перевірка")}</td></tr></tbody></table></div></section><details><summary>${t("Sources, corrections & edition notes", "Джерела, виправлення й примітки випуску")}</summary><p>${t("Illustrative content. Production editions use their own verified source list. Video and PDF controls appear only when a published asset exists.", "Демонстраційний контент. Реальні випуски мають перевірені джерела. Кнопки відео й PDF з’являються лише за наявності опублікованого файлу.")}</p></details>${btn("digests", t("Back to all editions", "До всіх випусків"), true)}</article><aside class="article-tools"><button class="button outline" data-copy-link>${t("Copy edition link", "Копіювати посилання")}</button></aside></div>${newsletter()}`;
}
const terms = () => [
  [
    "AI Agent",
    "concept",
    t(
      "A system that works toward a goal through a sequence of actions.",
      "Система, що працює над метою через послідовність дій.",
    ),
  ],
  [
    "Claude Code",
    "product",
    t(
      "Explore the command-line agent and its workflow vocabulary.",
      "Командний агент і поняття його робочого процесу.",
    ),
  ],
  [
    "Context Engineering",
    "concept",
    t(
      "Choosing the information a model sees at each step.",
      "Вибір інформації, яку модель бачить на кожному кроці.",
    ),
  ],
  [
    "Model Context Protocol",
    "concept",
    t(
      "A shared interface between AI applications and external tools.",
      "Спільний інтерфейс між AI-застосунками й зовнішніми інструментами.",
    ),
  ],
  [
    "OpenAI API",
    "library",
    t(
      "Reference context for applications built around model APIs.",
      "Довідковий контекст для застосунків на основі API моделей.",
    ),
  ],
  [
    "Prompt Caching",
    "concept",
    t(
      "Understand reusable context before optimizing the token bill.",
      "Зрозумійте повторне використання контексту до оптимізації витрат.",
    ),
  ],
  [
    "RAG",
    "concept",
    t(
      "Bring relevant source material into a generation workflow.",
      "Додавайте доречні першоджерела в процес генерації.",
    ),
  ],
];
function concepts() {
  return `${intro(t("THE REFERENCE SHELF", "ПОЛИЦЯ ЗНАНЬ"), t("Know the language.<br><em>See the connections.</em>", "Знати мову.<br><em>Бачити зв’язки.</em>"), t("Concepts, products and protocols, explained in plain language.", "Концепти, продукти й протоколи простою мовою."))}${filterBar("concepts")}<div>${terms()
    .filter((x) => activeFilter === "all" || x[1] === activeFilter)
    .map(
      ([name, type, desc]) =>
        `<div class="index-row"><span class="term-letter">${name[0]}</span><h2>${link("concept", name)}</h2><p>${desc}</p><span class="meta">${type.toUpperCase()} ↗</span></div>`,
    )
    .join(
      "",
    )}</div><section class="section">${sectionHead(t("Start with a question.", "Почніть із питання."))}<div class="grid3">${[t("How do agents use tools?", "Як агенти використовують інструменти?"), t("What belongs in context?", "Що належить до контексту?"), t("How do I compare workflows?", "Як порівнювати робочі процеси?")].map((s, i) => `<div class="card"><h3>${link(i === 2 ? "guide" : "concept", s + " ↗")}</h3></div>`).join("")}</div></section>`;
}
function concept() {
  return readShell(
    "Model Context<br><em>Protocol.</em>",
    t(
      "A common language between AI applications and the tools they use.",
      "Спільна мова між AI-застосунками та їхніми інструментами.",
    ),
    "CONCEPTS / PROTOCOL",
    `<div class="callout" id="overview">${eyebrow(t("THE DEFINITION", "ВИЗНАЧЕННЯ"))}<p>${t("Model Context Protocol (MCP) provides a standard way for AI applications to connect to external data and tools. This definition is used here to demonstrate the reference-page layout.", "Model Context Protocol (MCP) задає стандартний спосіб підключення AI-застосунків до зовнішніх даних та інструментів. Це визначення показує верстку довідкової сторінки.")}</p></div>${visual(1)}<h2 id="context">${t("Where it fits", "Де це використовується")}</h2><p>${t("The concept page leads with a direct answer, then expands into a small mental model, practical context and related terms.", "Сторінка концепту починається з прямої відповіді, далі пояснює модель роботи, практичний контекст і пов’язані терміни.")}</p><div class="table-scroll"><table><thead><tr><th>${t("Part", "Частина")}</th><th>${t("Role", "Роль")}</th></tr></thead><tbody><tr><td>Host</td><td>${t("The application used by the reader", "Застосунок, яким користується читач")}</td></tr><tr><td>Client</td><td>${t("The protocol connection", "Протокольне з’єднання")}</td></tr><tr><td>Server</td><td>${t("The external capabilities", "Зовнішні можливості")}</td></tr></tbody></table></div><h2 id="next">${t("Put it in context", "Додайте контекст")}</h2><p>${link("guide", t("Choose a coding-agent workflow ↗", "Оберіть процес роботи з агентом ↗"))}</p><p>${link("category", t("Read recent Agents & MCP coverage ↗", "Читайте матеріали Agents & MCP ↗"))}</p><details><summary>${t("Is a protocol the same as an agent?", "Чи протокол — це те саме, що агент?")}</summary><p>${t("No. A protocol describes communication; an agent describes a system that acts toward a goal.", "Ні. Протокол описує комунікацію; агент — систему, що діє для досягнення мети.")}</p></details><h2 id="sources">${t("Keep the reference current", "Підтримуйте актуальність")}</h2><p>${t("Production content retains its own verified date, primary documentation and change notes. The layout never presents a design-review date as a factual verification date.", "Реальний матеріал зберігає власну дату перевірки, першоджерела й історію змін. Дата перевірки дизайну не підміняє дату перевірки фактів.")}</p>${link("concepts", t("Back to the reference shelf ↗", "До полиці знань ↗"))}`,
  );
}
function guides() {
  return `${intro(t("THE PRACTICAL LIBRARY", "ПРАКТИЧНА БІБЛІОТЕКА"), t("Less guessing.<br><em>Better decisions.</em>", "Менше здогадок.<br><em>Кращі рішення.</em>"), t("Living guides for the way you actually build with AI.", "Живі гайди для реальної роботи з AI."))}<div class="week-block"><div class="week-cover">${eyebrow(t("START HERE / COMPARISON", "ПОЧНІТЬ ТУТ / ПОРІВНЯННЯ"))}<h3>Claude Code.<br>Cursor.<br>Codex.</h3></div><div class="week-copy">${eyebrow(t("CHOOSE YOUR WORKFLOW", "ОБЕРІТЬ РОБОЧИЙ ПРОЦЕС"))}<h2>${t("Which agent fits<br>the way you work?", "Який агент підходить<br>для вашої роботи?")}</h2><p>${t("A decision framework based on interface, autonomy and review.", "Підхід до вибору за інтерфейсом, автономністю та перевіркою.")}</p>${btn("guide", t("Read the comparison", "Читати порівняння"))}</div></div><section class="section">${sectionHead(t("The working library", "Робоча бібліотека"))}<div class="index-row"><span class="term-letter">02</span><h2>${link("guide", "ATB Orchestration Bench")}</h2><p>${t("How to read a reproducible evaluation and its underlying evidence.", "Як читати відтворюване оцінювання й докази, що стоять за ним.")}</p><span class="meta">REFERENCE ↗</span></div></section>${newsletter()}`;
}
function guide() {
  return readShell(
    t(
      "Choose the agent.<br><em>Keep your judgment.</em>",
      "Оберіть агента.<br><em>Збережіть власне судження.</em>",
    ),
    t(
      "Claude Code, Cursor and Codex: a practical decision framework.",
      "Claude Code, Cursor і Codex: практичний підхід до вибору.",
    ),
    "GUIDES / COMPARISON",
    `<div class="callout" id="overview">${eyebrow(t("START WITH YOUR WORK", "ПОЧНІТЬ ЗІ СВОЄЇ РОБОТИ"))}<p>${t("Choose for the tasks you repeat, the interface you prefer and the level of review you can provide. The table below demonstrates the comparison pattern; it is not a current product ranking.", "Обирайте за повторюваними завданнями, зручним інтерфейсом і доступним рівнем перевірки. Таблиця нижче показує патерн порівняння, а не поточний рейтинг продуктів.")}</p></div><h2 id="context">${t("Compare the right things.", "Порівнюйте потрібне.")}</h2><div class="table-scroll"><table><thead><tr><th>${t("Your question", "Ваше питання")}</th><th>${t("What to inspect", "Що перевірити")}</th><th>${t("Evidence to keep", "Які докази зберегти")}</th></tr></thead><tbody><tr><td>${t("Does it fit my workflow?", "Чи підходить процес?")}</td><td>${t("Editor, terminal, delegated tasks", "Редактор, термінал, делеговані завдання")}</td><td>${t("One completed task", "Одне завершене завдання")}</td></tr><tr><td>${t("Can I review its changes?", "Чи можу я перевірити зміни?")}</td><td>${t("Diff, tests, permissions", "Diff, тести, дозволи")}</td><td>${t("Review notes", "Примітки перевірки")}</td></tr><tr><td>${t("Is the result repeatable?", "Чи результат відтворюється?")}</td><td>${t("Same prompt and context", "Той самий запит і контекст")}</td><td>${t("Run conditions", "Умови запуску")}</td></tr></tbody></table></div><h2 id="next">${t("Try one small task.", "Спробуйте одне мале завдання.")}</h2>${[t("Define the result before starting.", "Визначте результат до початку."), t("Keep the inputs and constraints the same.", "Збережіть однакові вхідні дані й обмеження."), t("Review the actual diff and output.", "Перевірте фактичний diff і результат.")].map((s, i) => `<div class="step"><span class="avatar">${i + 1}</span><p>${s}</p></div>`).join("")}${link("tool", t("Prepare an instruction in Toolbox ↗", "Підготуйте інструкцію в Toolbox ↗"))}<h2 id="sources">${t("Verification & changelog", "Перевірка й історія змін")}</h2><p>${t("The production guide preserves its factual comparisons and verification date. New releases trigger a content review, independently of this redesign.", "Реальний гайд зберігає фактичні порівняння та дату перевірки. Нові релізи потребують перегляду контенту незалежно від редизайну.")}</p><details><summary>${t("How should I read the benchmark?", "Як читати бенчмарк?")}</summary><p>${t("Inspect the task, environment and run evidence before comparing a headline score.", "Перевірте завдання, середовище та докази запуску перед порівнянням підсумкових оцінок.")}</p></details>`,
  );
}
function toolsPage() {
  return `${intro(t("THE WORKBENCH", "МАЙСТЕРНЯ"), t("Small tools.<br><em>Considered craft.</em>", "Малі інструменти.<br><em>Продумана робота.</em>"), t("Free utilities for your AI workflow. Your inputs stay in your browser.", "Безкоштовні утиліти для AI-роботи. Вхідні дані залишаються у вашому браузері."))}<div class="grid3">${[
    [
      t("Prompt Optimizer", "Оптимізатор промптів"),
      t(
        "Give your prompt a clearer goal, context and output format.",
        "Додайте промпту чітку мету, контекст і формат результату.",
      ),
    ],
    [
      "settings.json Builder",
      t(
        "Make permissions and hooks understandable before exporting.",
        "Зрозумілі дозволи й hooks перед експортом.",
      ),
    ],
    [
      "CLAUDE.md / AGENTS.md",
      t(
        "Turn project constraints into explicit, reusable instructions.",
        "Перетворіть обмеження проєкту на чіткі багаторазові інструкції.",
      ),
    ],
  ]
    .map(
      ([title, desc], i) =>
        `<article class="tool-card"><div class="tool-number">0${i + 1}<span style="float:right;font:11px var(--mono)">↗</span></div>${eyebrow(t("LOCAL-FIRST / FREE", "ЛОКАЛЬНО / БЕЗКОШТОВНО"))}<h2>${title}</h2><p>${desc}</p>${link(["tool", "settings", "instructions"][i], t("Open workspace ↗", "Відкрити утиліту ↗"), "button outline")}</article>`,
    )
    .join(
      "",
    )}</div><section class="section"><div class="grid2"><div><h2>${t("Built to do a job.<br>Then get out of your way.", "Зробити справу.<br>І не заважати.")}</h2></div><p>${t("The prototype demonstrates one local interaction. The final workspaces retain the existing tool engines, validation and export formats. Each tool keeps its own verified date and supporting references.", "Прототип показує одну локальну взаємодію. Фінальні утиліти зберігають наявну логіку, валідацію й формати експорту. Кожна має власну дату перевірки та джерела.")}</p></div></section>`;
}
function tool() {
  return `${intro("TOOLBOX / PROMPT OPTIMIZER", t("Give your prompt<br><em>a little structure.</em>", "Додайте промпту<br><em>трохи структури.</em>"), t("A local interaction demo. No model call and no input leaves this page.", "Демонстрація локальної взаємодії. Без виклику моделі чи надсилання введених даних."))}<div class="workbench"><section><form id="tool-form">${eyebrow(t("01 / YOUR DRAFT", "01 / ВАША ЧЕРНЕТКА"))}<label for="prompt-input">${t("What should the agent do?", "Що агент має зробити?")}</label><textarea id="prompt-input" rows="8" required placeholder="${t("Review this pull request for correctness…", "Перевір цей pull request на коректність…")}"></textarea><label for="output-format">${t("Preferred result", "Формат результату")}</label><select id="output-format"><option value="checklist">${t("A concise checklist", "Короткий чекліст")}</option><option value="explanation">${t("An explanation with examples", "Пояснення з прикладами")}</option></select><div class="spaced"><button class="button">${t("Structure the draft", "Структурувати чернетку")} ↗</button></div></form></section><section aria-live="polite">${eyebrow(t("02 / STRUCTURED OUTPUT", "02 / СТРУКТУРОВАНИЙ РЕЗУЛЬТАТ"))}<pre id="tool-output" class="spaced">${t("Your structured draft will appear here.\n\n1. Goal\n2. Context\n3. Output\n4. Verification", "Тут з’явиться структурована чернетка.\n\n1. Мета\n2. Контекст\n3. Результат\n4. Перевірка")}</pre><button class="button outline spaced" id="copy-output" disabled>${t("Copy draft", "Копіювати чернетку")}</button><p class="form-note">${t("This demo adds a template; it does not assess or improve model performance.", "Демо додає шаблон; воно не оцінює й не покращує якість моделі.")}</p></section></div>`;
}
function categories() {
  const cats = [
    [
      "Agents & MCP",
      t("How agents connect, remember and act.", "Як агенти з’єднуються, пам’ятають і діють."),
    ],
    [
      t("Tools & releases", "Інструменти й релізи"),
      t("The tools changing the way you build.", "Інструменти, що змінюють вашу роботу."),
    ],
    [
      t("Models & research", "Моделі й дослідження"),
      t("Read the evidence behind the headline.", "Докази за заголовками."),
    ],
    [
      t("Token & cost optimization", "Оптимізація токенів і вартості"),
      t(
        "More useful work from your context budget.",
        "Більше користі з вашого контекстного бюджету.",
      ),
    ],
    [
      t("Vibe coding workflow", "Vibe coding процеси"),
      t("A closer look at agent-assisted development.", "Уважний погляд на розробку з агентами."),
    ],
    [
      t("Tutorials & guides", "Інструкції й гайди"),
      t(
        "Methods you can take into your own work.",
        "Методи, які можна застосувати у власній роботі.",
      ),
    ],
  ];
  return `${intro(t("EXPLORE BY TOPIC", "ДОСЛІДЖУЙТЕ ЗА ТЕМОЮ"), t("Follow your<br><em>curiosity.</em>", "Рухайтеся за<br><em>цікавістю.</em>"), t("Find the latest reporting, the useful context and your next practical step.", "Знайдіть останні матеріали, корисний контекст і наступний практичний крок."))}<div class="grid2">${cats.map(([h, p], i) => `<article class="card">${eyebrow("0" + (i + 1) + " / TOPIC")}<h2 class="mt">${link("category", h + " ↗")}</h2><p>${p}</p><div class="meta">${t("NEWS · CONCEPTS · GUIDES", "НОВИНИ · КОНЦЕПТИ · ГАЙДИ")}</div></article>`).join("")}</div>${newsletter()}`;
}
function about() {
  return `${intro(t("ABOUT THE PUBLICATION", "ПРО ВИДАННЯ"), t("Intelligence deserves<br><em>a human perspective.</em>", "Інтелект потребує<br><em>людського погляду.</em>"), t("AI Today Brief is a human-edited publication for people who build with AI.", "AI Today Brief — видання з людською редактурою для тих, хто створює з AI."))}<div class="grid2 section"><div>${art(false)}</div><div><h2>${t("A quieter place<br>to understand what’s next.", "Спокійніше місце,<br>щоб зрозуміти майбутнє.")}</h2><p class="spaced">${t("We want each visit to leave you with context you can use: what changed, why it matters and where to go deeper.", "Ми прагнемо, щоб кожен візит давав корисний контекст: що змінилося, чому це важливо й де дізнатися більше.")}</p><p class="spaced">${t("The editorial process uses AI assistance and human judgment. Sources stay visible; responsibility stays with the editor.", "Редакційний процес поєднує AI-допомогу й людське судження. Джерела залишаються видимими, відповідальність — за редактором.")}</p>${link("policy", t("Read the editorial policy ↗", "Прочитати редакційну політику ↗"), "button ghost spaced")}</div></div><section class="section">${sectionHead(t("How a story becomes a brief.", "Як матеріал стає брифом."))}<div class="grid3">${[t("Find the source.", "Знайти джерело."), t("Make sense of it.", "Зрозуміти зміст."), t("Make the editorial call.", "Ухвалити редакційне рішення.")].map((h, i) => `<div class="card">${eyebrow("0" + (i + 1))}<h3>${h}</h3><p>${[t("Start with primary reporting and documentation.", "Почати з першоджерел і документації."), t("Separate the change, the evidence and the uncertainty.", "Розділити зміни, докази й невизначеність."), t("Review the result before publication.", "Перевірити результат до публікації.")][i]}</p></div>`).join("")}</div></section><section class="section"><div class="grid2"><h2>${t("Meet the editor.", "Знайомтеся з редактором.")}</h2><div><div class="byline"><span class="avatar">OK</span><h3>${t("Oleksandr Kuzmenko", "Олександр Кузьменко")}</h3></div><p class="spaced">${t("Focus: AI agents & MCP, developer tools, MLOps and LLM APIs.", "Фокус: AI-агенти й MCP, інструменти розробника, MLOps і LLM API.")}</p><a class="button ghost spaced" href="https://aitodaybrief.com/en/about" target="_blank" rel="noopener">${t("Current editor profile & contacts ↗", "Поточний профіль і контакти редактора ↗")}</a></div></div></section>${newsletter()}`;
}
function subscribe() {
  return `<div class="center-page">${eyebrow(t("THE DAILY READING RITUAL", "ЩОДЕННИЙ РИТУАЛ ЧИТАННЯ"))}<h1>${t("A little perspective.<br><em>In your inbox.</em>", "Трохи перспективи.<br><em>У вашій пошті.</em>")}</h1><p>${t("A focused AI briefing for people who build. Read a sample, then decide if it belongs in your day.", "Сфокусований AI-бриф для тих, хто створює. Прочитайте приклад і вирішіть, чи пасує він до вашого дня.")}</p>${link("daily", t("Read a sample first ↗", "Спершу прочитати приклад ↗"))}<form data-subscribe class="spaced"><label for="subscribe-email" class="form-label">Email</label><input class="wide-input" id="subscribe-email" type="email" autocomplete="email" required placeholder="you@example.com"><label class="form-label" for="edition-language">${t("Edition language", "Мова випуску")}</label><select class="wide-input" id="edition-language"><option>English</option><option>Українська</option></select><label class="form-label"><input type="checkbox" required style="min-height:0"> ${t("I want to receive the brief by email.", "Хочу отримувати бриф на email.")}</label><button class="button spaced">${t("Get the brief", "Отримувати бриф")} ↗</button><p class="form-status" aria-live="polite"></p><p class="form-note">${t("Free. Unsubscribe at any time. Demo: no email is sent.", "Безкоштовно. Відписка будь-коли. Демо: email не надсилається.")} ${link("policy", t("Privacy", "Приватність"))}</p></form></div>`;
}
function searchPage() {
  return `${intro(t("SEARCH THE PUBLICATION", "ПОШУК У ВИДАННІ"), t("Find the <em>thread.</em>", "Знайдіть <em>зв’язок.</em>"), t("Search this prototype’s sample stories and reference entries.", "Пошук демонстраційних матеріалів і довідкових записів прототипу."))}<label class="sr-only" for="page-search">${t("Search", "Пошук")}</label><input class="wide-input" id="page-search" type="search" placeholder="Agents, MCP, caching…"><div id="page-results" class="section" aria-live="polite">${searchResults("")}</div>`;
}
function searchResults(q) {
  const items = [
    ...stories(),
    ...terms().map(([title, cat, summary]) => ({
      title,
      cat,
      summary,
      route: "concept",
      label: t("Reference", "Довідник"),
    })),
  ];
  const matches = items.filter((s) =>
    (s.title + " " + s.summary + " " + s.label).toLowerCase().includes(q.toLowerCase()),
  );
  return matches.length
    ? `<p class="meta">${matches.length} ${t("RESULTS IN DEMO", "РЕЗУЛЬТАТІВ У ДЕМО")}</p>${matches.map((s) => link(s.route, `${eyebrow(s.label)}<h3>${esc(s.title)}</h3>`, "search-result")).join("")}`
    : `<div class="empty"><h2>${t("No thread found.", "Зв’язку не знайдено.")}</h2><p>${t("Try “MCP”, “context” or a shorter phrase.", "Спробуйте «MCP», «контекст» або коротшу фразу.")}</p>${btn("concepts", t("Browse concepts", "Переглянути концепти"), true)}</div>`;
}
function savedPage() {
  return `${intro(t("YOUR READING LIST", "ВАШЕ ЗБЕРЕЖЕНЕ"), t("For a <em>quieter moment.</em>", "Для <em>спокійнішої миті.</em>"), t("Saved stories in this preview session. No account needed.", "Збережені матеріали в цій сесії перегляду. Без облікового запису."))}${saved ? feedRows([stories()[0]]) : `<div class="empty"><h2>${t("Your reading list starts here.", "Ваш список починається тут.")}</h2><p>${t("Open a story and choose Save to keep it in this preview.", "Відкрийте матеріал і натисніть «Зберегти», щоб залишити його в цьому перегляді.")}</p>${btn("news", t("Find a story", "Знайти матеріал"))}</div>`}`;
}
function advertise() {
  return `${intro(t("PARTNER WITH THE PUBLICATION", "СПІВПРАЦЯ З ВИДАННЯМ"), t("Reach people<br><em>who build.</em>", "Будьте поруч із тими,<br><em>хто створює.</em>"), t("Considered sponsorship, with a clear line between editorial and advertising.", "Продумане спонсорство з чітким розмежуванням редакційного й рекламного."))}<div class="grid2 section"><div class="spec-card">${eyebrow(t("SPONSORED / PREVIEW", "СПОНСОРСЬКИЙ БЛОК / ПРИКЛАД"))}<h3>${t("One relevant message.<br>In the right context.", "Одне доречне повідомлення.<br>У потрібному контексті.")}</h3><p>${t("Reserved example of an explicitly labeled placement. No invented audience figures, prices or testimonials.", "Приклад явно позначеного розміщення. Без вигаданих показників аудиторії, цін чи відгуків.")}</p></div><div><h2>${t("Start a conversation.", "Почніть розмову.")}</h2><p class="spaced">${t("The production page can present verified audience data, placement options and the existing inquiry channel.", "Реальна сторінка може показувати перевірені дані аудиторії, варіанти розміщення й наявний канал запитів.")}</p><a class="button outline spaced" href="https://aitodaybrief.com/en/advertise" target="_blank" rel="noopener">${t("Current sponsorship page ↗", "Поточна сторінка співпраці ↗")}</a></div></div>`;
}
function policy() {
  return `${intro(t("TRUST & TRANSPARENCY", "ДОВІРА Й ПРОЗОРІСТЬ"), t("The principles<br><em>behind the brief.</em>", "Принципи,<br><em>що стоять за брифом.</em>"), t("A shared layout for editorial policy, AI disclosure, privacy and terms.", "Спільний шаблон редакційної політики, AI disclosure, приватності й умов."))}<div class="legal-nav">${["editorial-policy", "ai-disclosure", "privacy", "terms"].map((s) => `<a href="https://aitodaybrief.com/${lang}/${s}" target="_blank" rel="noopener">${s} ↗</a>`).join("")}</div><div class="article-layout"><nav class="toc">${eyebrow(t("CONTENTS", "ЗМІСТ"))}<a href="#principles" data-anchor="principles">${t("Editorial principles", "Редакційні принципи")}</a><a href="#corrections" data-anchor="corrections">${t("Corrections", "Виправлення")}</a></nav><article class="reading"><div class="callout">${eyebrow(t("DESIGN NOTE", "ПРИМІТКА МАКЕТА"))}<p>${t("This page demonstrates document layout. Existing legal and policy text must be transferred verbatim during implementation and reviewed separately if changed.", "Ця сторінка демонструє верстку документа. Наявні юридичні тексти й політики переносяться дослівно; зміни проходять окрему перевірку.")}</p></div><h2 id="principles">${t("Visible sources. Clear responsibility.", "Видимі джерела. Чітка відповідальність.")}</h2><p>${t("Give readers a direct route from a claim to its evidence, and from a question to the responsible editor.", "Дайте читачам прямий шлях від твердження до доказу та від питання до відповідального редактора.")}</p><h2 id="corrections">${t("Leave a visible correction trail.", "Зберігайте видиму історію виправлень.")}</h2><p>${t("An updated date and a concise correction note belong next to the content they affect.", "Дата оновлення й коротка примітка про виправлення мають бути поруч із відповідним матеріалом.")}</p></article></div>`;
}
function notFound() {
  return `<div class="center-page">${eyebrow("404 / OFF THE RECORD")}<h1>${t("This track<br><em>is missing.</em>", "Цей трек<br><em>загубився.</em>")}</h1><p>${t("The page may have moved. Let’s get you back to the publication.", "Сторінка могла змінити адресу. Повернімося до видання.")}</p>${btn("home", t("Back to today", "До головної"))} ${btn("search", t("Search", "Пошук"), true)}</div>`;
}
function system() {
  const colors = [
    ["Ink", "#171918"],
    ["Walnut", "#202421"],
    ["Parchment", "#f0e9dc"],
    ["Brass", "#d4b483"],
    ["Celadon", "#b5d8cc"],
    ["Muted", "#b9b7ac"],
  ];
  return `${intro("AI TODAY BRIEF / DESIGN DIRECTION 01", "After <em>Hours.</em>", t("The warmth of a jazz club. The precision of tomorrow’s publication.", "Тепло джазового клубу. Точність видання про майбутнє."))}<img class="brand-art" src="assets/after-hours.png" alt="After Hours concept artwork" width="1672" height="941"><section class="section">${sectionHead(t("The whole publication.", "Усе видання."))}<p>${t("26 linked screens. Select a page, switch EN / UK or change the reading theme in the header.", "26 пов’язаних екранів. Оберіть сторінку, перемкніть EN / UK або тему читання в шапці.")}</p><div class="screen-map">${routes.map((r, i) => link(r, `<span><small>${String(i + 1).padStart(2, "0")} / </small>${labels()[r]}</span>↗`)).join("")}</div></section><section class="section">${sectionHead(t("A palette with a point of view.", "Палітра з власним поглядом."))}<div class="brand-grid">${colors.map(([name, hex], i) => `<div class="swatch" style="background:${hex};color:${i < 2 ? "#f0e9dc" : "#171918"}">${name}<br>${hex}</div>`).join("")}</div><p class="spaced">${t("Brass guides action. Celadon marks useful signals. Color supports meaning; it never replaces labels.", "Латунь спрямовує дію. Celadon позначає корисні сигнали. Колір підтримує зміст, але не заміняє підписи.")}</p></section><section class="section"><div class="grid2"><div>${eyebrow("TYPE / EDITORIAL")}<h2 class="manifesto">${t("Tomorrow,<br><em>in context.</em>", "Майбутнє.<br><em>З контекстом.</em>")}</h2><p>Fraunces / 400 · Georgia ${t("for Ukrainian display", "для українських заголовків")}</p></div><div>${eyebrow("TYPE / FUNCTIONAL")}<p style="font-size:26px;color:var(--text);margin:22px 0">${t("Clarity is a form of care.", "Ясність — це форма турботи.")}</p><p>Inter / 400, 500, 600 · Latin + Cyrillic</p><p class="meta spaced">CONSOLAS / TIME, SOURCE, EDITION</p><div class="spaced">${btn("news", t("Primary action", "Головна дія"))} ${btn("news", t("Secondary", "Другорядна"), true)}</div></div></div></section><section class="section">${sectionHead(t("A mark with rhythm.", "Знак із ритмом."))}<div class="grid2"><div class="spec-card"><img src="assets/mark.svg" width="130" height="130" alt="After Hours ATB monogram"><h3 class="spaced">AI Today Brief</h3><p>${t("Nested A strokes evoke a groove; a celadon point places a signal just off the beat. The publication name stays unchanged.", "Вкладені лінії A нагадують доріжку; celadon-крапка зміщує сигнал із такту. Назва видання залишається незмінною.")}</p></div><div class="spec-card"><h3>${t("An editorial tempo.", "Редакційний темп.")}</h3><p>${t("140 ms for a response. 240 ms for a transition. 440 ms for a quiet entrance. No looping hero animation, autoplay audio or scroll hijacking.", "140 мс для відгуку. 240 мс для переходу. 440 мс для спокійної появи. Без циклічної анімації hero, автоматичного звуку чи перехоплення скролу.")}</p><p>${t("Hover a button or story artwork. Navigate to watch the page enter. Reduced-motion disables the movement.", "Наведіть на кнопку чи ілюстрацію. Перейдіть між сторінками, щоб побачити появу. Reduced-motion вимикає рух.")}</p></div></div></section>${newsletter()}`;
}
function states() {
  return `${intro("COMPONENT LIBRARY / STATES", t("Care is in<br><em>the details.</em>", "Турбота —<br><em>у деталях.</em>"), t("Explicit loading, empty, error and successful states.", "Явні стани завантаження, порожніх даних, помилки й успіху."))}<div class="grid2 section"><section class="spec-card" aria-busy="true">${eyebrow(t("LOADING", "ЗАВАНТАЖЕННЯ"))}<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><p>${t("Reserved geometry prevents the layout from jumping.", "Зарезервовані розміри не дають верстці стрибати.")}</p></section><section class="spec-card">${eyebrow(t("RECOVERABLE ERROR", "ПОМИЛКА З ВІДНОВЛЕННЯМ"))}<h3 class="mt">${t("The feed could not be refreshed.", "Не вдалося оновити стрічку.")}</h3><p>${t("Keep the last readable content and offer a retry.", "Збережіть останній доступний контент і запропонуйте повторну спробу.")}</p><button class="button outline" data-retry>${t("Try again", "Спробувати ще")}</button><p data-retry-status role="status"></p></section><section class="spec-card">${eyebrow(t("EMPTY", "ПОРОЖНІ ДАНІ"))}<h3 class="mt">${t("Nothing saved. Yet.", "Ще нічого не збережено.")}</h3><p>${t("Explain the state and give one useful next step.", "Поясніть стан і запропонуйте один корисний крок.")}</p>${btn("news", t("Browse stories", "Переглянути новини"), true)}</section><section class="spec-card">${eyebrow(t("FORM VALIDATION", "ВАЛІДАЦІЯ ФОРМИ"))}<form data-subscribe><label class="form-label" for="state-email">Email</label><input class="wide-input" id="state-email" type="email" required placeholder="you@example.com"><button class="button spaced">${t("Preview confirmation", "Переглянути підтвердження")}</button><p class="form-status" aria-live="polite"></p></form><p>${t("Submit an invalid email to see browser validation. A valid value shows the demo success state.", "Надішліть некоректний email для перевірки валідації. Коректне значення покаже демонстраційний успішний стан.")}</p></section></div><div class="filters"><button class="button" disabled>${t("Disabled action", "Недоступна дія")}</button>${btn("404", t("Preview 404", "Переглянути 404"), true)}${btn("search", t("Try empty search", "Спробувати порожній пошук"), true)}</div>`;
}
const renderers = {
  home,
  news: () => news(),
  article,
  digests,
  daily,
  weekly,
  concepts,
  concept,
  guides,
  guide,
  tools: toolsPage,
  tool,
  categories,
  category: () => news(true),
  about,
  subscribe,
  search: searchPage,
  saved: savedPage,
  advertise,
  policy,
  404: notFound,
  system,
  states,
};
function currentRoute() {
  const r = location.hash.replace(/^#\//, "").split("?")[0];
  return routes.includes(r) ? r : r ? "404" : "home";
}
function render(reset = true) {
  const route = currentRoute();
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = theme;
  const routeTitle =
    route === "article"
      ? articleVariantCards().find((card) => card.id === currentArticleVariant())?.title
      : labels()[route];
  document.title = `${routeTitle || labels()[route]} — AI Today Brief / After Hours`;
  document.getElementById("app").innerHTML =
    `${header(route)}<main id="main" tabindex="-1" class="wrap page">${renderers[route]()}</main>${footer()}<div class="progress" aria-hidden="true"></div>`;
  if (reset) window.scrollTo(0, 0);
  bind();
}
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (toast.style.display = "none"), 2600);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify(t("Copied to clipboard", "Скопійовано"));
  } catch {
    notify(
      t(
        "Clipboard unavailable. Select and copy the visible text.",
        "Буфер недоступний. Виділіть і скопіюйте видимий текст.",
      ),
    );
  }
}
function openSearch() {
  const d = document.getElementById("search-dialog");
  d.querySelector("#search-title").textContent = t("Search the publication", "Пошук у виданні");
  d.querySelector(".close").setAttribute("aria-label", t("Close search", "Закрити пошук"));
  document.getElementById("global-search").value = "";
  document.getElementById("search-results").innerHTML = searchResults("");
  d.showModal();
  document.getElementById("global-search").focus();
}
function bind() {
  document.querySelector("[data-search]").onclick = openSearch;
  document.querySelector("[data-lang]").onclick = () => {
    lang = lang === "en" ? "uk" : "en";
    render(false);
  };
  document.querySelector("button[data-theme]").onclick = () => {
    theme = theme === "night" ? "day" : "night";
    document.documentElement.dataset.theme = theme;
    document.querySelector("button[data-theme]").textContent = theme === "night" ? "☼" : "◐";
  };
  document.querySelector("[data-menu]").onclick = (e) => {
    const nav = document.querySelector(".nav");
    const open = nav.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        activeFilter = b.dataset.filter;
        render(false);
        document.querySelector(`[data-filter="${activeFilter}"]`).focus();
      }),
  );
  document.querySelectorAll("[data-anchor]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        document
          .getElementById(a.dataset.anchor)
          ?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          });
      }),
  );
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        saved = !saved;
        b.textContent = saved ? t("Saved ✓", "Збережено ✓") : t("Save story +", "Зберегти +");
        b.setAttribute("aria-pressed", String(saved));
        notify(
          saved
            ? t("Added to this preview’s reading list", "Додано до збереженого в цьому перегляді")
            : t("Removed from reading list", "Видалено зі збереженого"),
        );
      }),
  );
  document
    .querySelectorAll("[data-copy-link]")
    .forEach((b) => (b.onclick = () => copy(location.href)));
  document.querySelectorAll("[data-subscribe]").forEach(
    (f) =>
      (f.onsubmit = (e) => {
        e.preventDefault();
        const status = f.querySelector(".form-status");
        status.textContent = t(
          "Demo: confirmation state. In production, check your inbox to confirm your subscription. No email has been sent.",
          "Демо: стан підтвердження. У реалізації перевірте пошту й підтвердьте підписку. Лист не надсилався.",
        );
      }),
  );
  const ps = document.getElementById("page-search");
  if (ps)
    ps.oninput = () =>
      (document.getElementById("page-results").innerHTML = searchResults(ps.value));
  const form = document.getElementById("tool-form");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      const value = document.getElementById("prompt-input").value.trim();
      if (!value) return;
      const format = document.getElementById("output-format").selectedOptions[0].textContent;
      document.getElementById("tool-output").textContent =
        t("GOAL\n", "МЕТА\n") +
        value +
        t(
          "\n\nCONTEXT\n[Add relevant files and constraints]\n\nOUTPUT\n",
          "\n\nКОНТЕКСТ\n[Додайте доречні файли й обмеження]\n\nРЕЗУЛЬТАТ\n",
        ) +
        format +
        t(
          "\n\nVERIFY\nState uncertainties and check the result against the goal.",
          "\n\nПЕРЕВІРКА\nПозначте невизначеність і звірте результат із метою.",
        );
      document.getElementById("copy-output").disabled = false;
    };
  const co = document.getElementById("copy-output");
  if (co) co.onclick = () => copy(document.getElementById("tool-output").textContent);
  const retry = document.querySelector("[data-retry]");
  if (retry)
    retry.onclick = () => {
      document.querySelector("[data-retry-status]").textContent = t(
        "Demo: the feed is available again.",
        "Демо: стрічка знову доступна.",
      );
      retry.disabled = true;
    };
}
document
  .getElementById("global-search")
  .addEventListener(
    "input",
    (e) => (document.getElementById("search-results").innerHTML = searchResults(e.target.value)),
  );
document.getElementById("search-results").addEventListener("click", (e) => {
  if (e.target.closest("a")) document.getElementById("search-dialog").close();
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    openSearch();
  }
});
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("main").focus();
  document.getElementById("main").scrollIntoView();
});
window.addEventListener("hashchange", () => {
  activeFilter = "all";
  document.getElementById("search-dialog").close();
  render();
  document.getElementById("main").focus({ preventScroll: true });
});
window.addEventListener(
  "scroll",
  () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = document.querySelector(".progress");
    if (bar) bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
  },
  { passive: true },
);
render();
