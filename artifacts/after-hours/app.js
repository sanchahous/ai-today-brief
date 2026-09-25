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
  404: "404",
});
const href = (route) => `#/${route}`;
const link = (route, text, cls = "") => `<a class="${cls}" href="${href(route)}">${text}</a>`;
const btn = (route, text, outline = false) =>
  link(route, `${text}<span aria-hidden="true">↗</span>`, `button${outline ? " outline" : ""}`);
const eyebrow = (text) => `<p class="eyebrow">${text}</p>`;
const arrow = '<span aria-hidden="true">↗</span>';
const art = (caption = true) =>
  `<div class="lead-art"><img src="assets/after-hours.png" alt="${t("Abstract brass sculpture with a pale green glass edge", "Абстрактна латунна скульптура зі світло-зеленим скляним краєм")}" width="1672" height="941">${caption ? `<span class="art-caption">${t("CONCEPT ART · AFTER HOURS", "КОНЦЕПТ-АРТ · AFTER HOURS")}</span>` : ""}</div>`;
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
    route: "article",
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
    route: "article",
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
    route: "article",
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
    route: "article",
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
    route: "article",
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
function byline() {
  return `<div class="byline"><span class="avatar">OK</span><div>${t("Oleksandr Kuzmenko", "Олександр Кузьменко")}<br><span class="meta">${t("EDITOR · DEMONSTRATION LAYOUT", "РЕДАКТОР · ДЕМОНСТРАЦІЙНИЙ МАКЕТ")}</span></div><span class="meta">05.09.2026 · ${t("4 MIN READ", "4 ХВ ЧИТАННЯ")}</span></div>`;
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
function article() {
  return readShell(
    stories()[0].title,
    stories()[0].summary,
    "NEWS / AGENTS & MCP",
    `<div class="callout" id="overview">${eyebrow(t("WHY IT MATTERS", "ЧОМУ ЦЕ ВАЖЛИВО"))}<p>${t("A useful agent workflow needs a clear boundary between temporary context and durable memory. This sample demonstrates how a short editorial takeaway can sit above the detail.", "Корисному процесу з агентами потрібна чітка межа між тимчасовим контекстом і сталою пам’яттю. Цей приклад показує розміщення короткого редакційного висновку перед деталями.")}</p></div>${art()}<p class="meta">${t("Abstract concept artwork. Illustrative editorial copy, not a published report.", "Абстрактний концепт-арт. Демонстраційний текст, не опублікована новина.")}</p><h2 id="context">${t("What should an agent remember?", "Що агент має пам’ятати?")}</h2><p>${t("Start with a practical question: when a task ends, which decisions should survive? A project constraint may belong in durable instructions. A temporary experiment may not.", "Почніть із практичного питання: коли завдання завершується, які рішення мають залишитися? Обмеження проєкту можуть належати до сталих інструкцій. Тимчасовий експеримент — не завжди.")}</p><p>${t("The reading experience separates the event, its implications and the next action. Readers can follow a concept link without losing the thread of the story.", "Досвід читання розділяє подію, її наслідки та наступну дію. Читачі можуть відкрити пояснення концепту, не втрачаючи нитку матеріалу.")} ${link("concept", t("Explore Model Context Protocol.", "Дізнатися про Model Context Protocol."))}</p><blockquote>${t("More context is only useful when it is the right context.", "Більше контексту корисно лише тоді, коли це потрібний контекст.")}</blockquote><h2 id="next">${t("A useful next step", "Корисний наступний крок")}</h2><p>${t("Review one recurring workflow. Write down its goal, the information it needs and what must be checked by a person before the result is used.", "Перегляньте один повторюваний процес. Запишіть мету, потрібну інформацію і те, що людина має перевірити перед використанням результату.")}</p>${link("guide", t("Continue: choosing your coding workflow ↗", "Далі: вибір процесу роботи з кодом ↗"))}<h2 id="sources">${t("Sources & editorial notes", "Джерела й редакційні примітки")}</h2><p>${t("This is sample copy for the redesign. In production, this section contains the primary report, its publication date, corrections and the editor’s verification date.", "Це приклад тексту для редизайну. У реалізації тут будуть першоджерело, дата публікації, виправлення й дата редакторської перевірки.")}</p>${link("policy", t("How we edit ↗", "Як ми редагуємо ↗"))}<h2>${t("Keep the thread going.", "Продовжуйте тему.")}</h2>${link("concept", "Model Context Protocol ↗")}<p>${link("daily", t("Return to the daily brief ↗", "Повернутися до брифу дня ↗"))}</p>`,
  );
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
  return `${intro("AI TODAY BRIEF / DESIGN DIRECTION 01", "After <em>Hours.</em>", t("The warmth of a jazz club. The precision of tomorrow’s publication.", "Тепло джазового клубу. Точність видання про майбутнє."))}<img class="brand-art" src="assets/after-hours.png" alt="After Hours concept artwork" width="1672" height="941"><section class="section">${sectionHead(t("The whole publication.", "Усе видання."))}<p>${t("25 linked screens. Select a page, switch EN / UK or change the reading theme in the header.", "25 пов’язаних екранів. Оберіть сторінку, перемкніть EN / UK або тему читання в шапці.")}</p><div class="screen-map">${routes.map((r, i) => link(r, `<span><small>${String(i + 1).padStart(2, "0")} / </small>${labels()[r]}</span>↗`)).join("")}</div></section><section class="section">${sectionHead(t("A palette with a point of view.", "Палітра з власним поглядом."))}<div class="brand-grid">${colors.map(([name, hex], i) => `<div class="swatch" style="background:${hex};color:${i < 2 ? "#f0e9dc" : "#171918"}">${name}<br>${hex}</div>`).join("")}</div><p class="spaced">${t("Brass guides action. Celadon marks useful signals. Color supports meaning; it never replaces labels.", "Латунь спрямовує дію. Celadon позначає корисні сигнали. Колір підтримує зміст, але не заміняє підписи.")}</p></section><section class="section"><div class="grid2"><div>${eyebrow("TYPE / EDITORIAL")}<h2 class="manifesto">${t("Tomorrow,<br><em>in context.</em>", "Майбутнє.<br><em>З контекстом.</em>")}</h2><p>Fraunces / 400 · Georgia ${t("for Ukrainian display", "для українських заголовків")}</p></div><div>${eyebrow("TYPE / FUNCTIONAL")}<p style="font-size:26px;color:var(--text);margin:22px 0">${t("Clarity is a form of care.", "Ясність — це форма турботи.")}</p><p>Inter / 400, 500, 600 · Latin + Cyrillic</p><p class="meta spaced">CONSOLAS / TIME, SOURCE, EDITION</p><div class="spaced">${btn("news", t("Primary action", "Головна дія"))} ${btn("news", t("Secondary", "Другорядна"), true)}</div></div></div></section><section class="section">${sectionHead(t("A mark with rhythm.", "Знак із ритмом."))}<div class="grid2"><div class="spec-card"><img src="assets/mark.svg" width="130" height="130" alt="After Hours ATB monogram"><h3 class="spaced">AI Today Brief</h3><p>${t("Nested A strokes evoke a groove; a celadon point places a signal just off the beat. The publication name stays unchanged.", "Вкладені лінії A нагадують доріжку; celadon-крапка зміщує сигнал із такту. Назва видання залишається незмінною.")}</p></div><div class="spec-card"><h3>${t("An editorial tempo.", "Редакційний темп.")}</h3><p>${t("140 ms for a response. 240 ms for a transition. 440 ms for a quiet entrance. No looping hero animation, autoplay audio or scroll hijacking.", "140 мс для відгуку. 240 мс для переходу. 440 мс для спокійної появи. Без циклічної анімації hero, автоматичного звуку чи перехоплення скролу.")}</p><p>${t("Hover a button or story artwork. Navigate to watch the page enter. Reduced-motion disables the movement.", "Наведіть на кнопку чи ілюстрацію. Перейдіть між сторінками, щоб побачити появу. Reduced-motion вимикає рух.")}</p></div></div></section>${newsletter()}`;
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
  document.title = `${labels()[route]} — AI Today Brief / After Hours`;
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
