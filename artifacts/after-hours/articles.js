/* After Hours prototype v3 — story templates.
   `#/article?id=<story>` renders the production story template (src/components/story-body.tsx parity).
   `#/article?variant=analysis|technical|evidence` renders three long-form formats for design review. */

const EDITOR = { name: { en: "Oleksandr Kuzmenko", uk: "Олександр Кузьменко" }, role: { en: "Editor", uk: "Редактор" }, initials: "OK" };

/* Responsive concept art: AVIF → WebP → JPEG, intrinsic size reserved (no layout shift). */
function heroPicture({ eager = false, sizes = "(max-width: 760px) 100vw, 760px", alt } = {}) {
  const altText = alt ?? t("Abstract brass sculpture with a pale green glass edge", "Абстрактна латунна скульптура зі світло-зеленим скляним краєм");
  return `<picture class="hero-picture"><source type="image/avif" srcset="assets/after-hours-800.avif 800w, assets/after-hours-1600.avif 1600w" sizes="${sizes}"><source type="image/webp" srcset="assets/after-hours-800.webp 800w, assets/after-hours-1600.webp 1600w" sizes="${sizes}"><img src="assets/after-hours-1600.jpg" alt="${esc(altText)}" width="1600" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="${t("Breadcrumb", "Навігаційний ланцюжок")}"><ol>${items
    .map(([label, route], i) => (i === items.length - 1 ? `<li><span aria-current="page">${label}</span></li>` : `<li><a href="${href(route)}">${label}</a></li>`))
    .join("")}</ol></nav>`;
}

function byline({ updated = TODAY.iso, read } = {}) {
  return `<div class="byline"><a class="avatar" href="#/author" aria-label="${esc(L(EDITOR.name))} — ${t("editor profile", "профіль редактора")}">${EDITOR.initials}</a><div class="byline-who"><a href="#/author">${esc(L(EDITOR.name))}</a><span>${L(EDITOR.role)} · ${t("Updated", "Оновлено")} <time datetime="${updated}">${fmtDate(updated)}</time>${read ? ` · ${read} ${t("min read", "хв читання")}` : ""}</span></div><p class="ai-note">${icon("spark", 16)}<span>${t("AI-assisted · editor-reviewed", "З AI-допомогою · перевірено редактором")}</span> ${link("policy?doc=ai", t("How we use AI", "Як ми використовуємо AI"))}</p></div>`;
}

function shareBar(title) {
  const url = encodeURIComponent(`https://aitodaybrief.com/${lang}/news/…`);
  const text = encodeURIComponent(title);
  return `<div class="share-bar" role="group" aria-label="${t("Share this story", "Поділитися матеріалом")}"><span class="share-label">${icon("share", 16)}${t("Share", "Поділитися")}</span><a class="pill" href="https://twitter.com/intent/tweet?url=${url}&text=${text}" target="_blank" rel="noopener">${icon("x", 16)}${t("Share on X", "Поділитися в X")}</a><a class="pill" href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" target="_blank" rel="noopener">${icon("linkedin", 16)}LinkedIn</a><button type="button" class="pill" data-action="copy-link">${icon("link", 16)}${t("Copy link", "Копіювати посилання")}</button></div>`;
}

function storyNav(index) {
  const prev = NEWS_STORIES[index - 1];
  const next = NEWS_STORIES[index + 1];
  const card = (story, dir) =>
    story
      ? `<a class="story-nav-card ${dir}" href="${href(`article?id=${story.id}`)}" rel="${dir}"><span>${dir === "prev" ? `${icon("arrowLeft", 16)}${t("Previous story", "Попередній матеріал")}` : `${t("Next story", "Наступний матеріал")}${icon("arrowRight", 16)}`}</span><strong>${esc(L(story.title))}</strong></a>`
      : `<span class="story-nav-card empty" aria-hidden="true"></span>`;
  return `<nav class="story-nav" aria-label="${t("Previous and next story", "Попередній і наступний матеріал")}">${card(prev, "prev")}${card(next, "next")}</nav>`;
}

function relatedList(story) {
  const pool = NEWS_STORIES.filter((s) => s.id !== story.id);
  const same = pool.filter((s) => s.cat === story.cat);
  const items = [...same, ...pool.filter((s) => s.cat !== story.cat)].slice(0, 3);
  return `<section class="related" aria-labelledby="related-title"><h2 id="related-title">${t("Related stories", "Пов’язані матеріали")}</h2><ul>${items
    .map((s) => `<li><a href="${href(`article?id=${s.id}`)}">${catBadge(s.cat)}<span class="related-title">${esc(L(s.title))}</span>${icon("arrowRight", 18)}</a></li>`)
    .join("")}</ul></section>`;
}

function articleTakeaways(items, label = t("In brief / three signals", "Коротко / три сигнали")) {
  return `<section class="article-takeaways" aria-labelledby="takeaways-title">${eyebrow(label)}<h2 id="takeaways-title" class="sr-only">${t("Key takeaways", "Ключові висновки")}</h2><ol>${items
    .map((item, index) => `<li><span aria-hidden="true">0${index + 1}</span><p>${item}</p></li>`)
    .join("")}</ol></section>`;
}

function articleSourceLedger(items) {
  return `<ol class="source-ledger">${items
    .map(([label, note], index) => `<li><span class="ledger-no" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div><strong>${label}</strong><p>${note}</p></div></li>`)
    .join("")}</ol>`;
}

function communityVoices(items) {
  return `<section class="voices" aria-labelledby="voices-title"><h3 id="voices-title">${t("What the community says", "Що каже спільнота")}</h3><ul>${items
    .map(([quote, author]) => `<li><blockquote><p>${quote}</p></blockquote><p class="voice-cite">— <a href="https://news.ycombinator.com/" target="_blank" rel="noopener">${esc(author)} ${t("on Hacker News", "на Hacker News")}</a></p></li>`)
    .join("")}</ul></section>`;
}

function toolChips(tags) {
  return `<ul class="tool-chips" aria-label="${t("Tools and concepts mentioned", "Згадані інструменти й концепти")}">${tags
    .map((tag) => {
      const concept = CONCEPTS.find((c) => c.name.toLowerCase() === tag.toLowerCase() || c.slug === tag.toLowerCase().replace(/\s+/g, "-"));
      return `<li>${concept ? `<a class="tag" href="${href(`concept?slug=${concept.slug}`)}">#${esc(tag)}</a>` : `<span class="tag">#${esc(tag)}</span>`}</li>`;
    })
    .join("")}</ul>`;
}

function codeBlock(id, code, label) {
  return `<figure class="code-figure"><figcaption><span>${label}</span><button type="button" class="pill pill-sm" data-action="copy-text" data-target="${id}">${icon("copy", 14)}${t("Copy code", "Копіювати код")}</button></figcaption><pre class="article-code" tabindex="0"><code id="${id}">${code}</code></pre></figure>`;
}

function videoFacade(title) {
  return `<figure class="video-facade"><button type="button" class="video-play" data-action="video" aria-label="${t("Play video briefing", "Відтворити відеобрифінг")}: ${esc(title)}"><span class="video-art" aria-hidden="true"></span><span class="video-cta">${icon("play", 22)}<span>${t("Watch the briefing", "Дивитися брифінг")} · 2:38</span></span></button><figcaption>${t("Lite embed: the YouTube player (youtube-nocookie) loads only after you press play. English audio, EN/UK captions.", "Lite-вбудовування: плеєр YouTube (youtube-nocookie) завантажується лише після натискання. Англійська озвучка, субтитри EN/UK.")}</figcaption></figure>`;
}

function saveButton(id) {
  const on = savedStories.has(id);
  return `<button type="button" class="button outline save-toggle" data-action="save-story" data-id="${id}" aria-pressed="${on}">${icon("bookmark", 18)}<span>${on ? t("Saved", "Збережено") : t("Save story", "Зберегти")}</span></button>`;
}

/* ── Production story template ─────────────────────────────────────────── */
function storyArticle(story) {
  const index = NEWS_STORIES.indexOf(story);
  const c = catById(story.cat);
  const title = L(story.title);
  const impact = { high: t("High impact", "Високий вплив"), medium: t("Medium impact", "Середній вплив"), low: t("Low impact", "Низький вплив") }[story.impact];
  const technical = ["token-and-cost-optimization", "tutorials-and-guides", "agents-and-mcp", "tools-and-releases"].includes(story.cat);
  const facts = [
    [t("Primary source", "Першоджерело"), esc(story.source)],
    [t("Published", "Опубліковано"), `<time datetime="${story.date}">${fmtDate(story.date)}</time>`],
    [t("Category", "Категорія"), esc(catName(c))],
    [t("Reading time", "Час читання"), `${story.read} ${t("min", "хв")}`],
  ];
  const body = `
    <div class="why-callout" style="--cat:var(--cat-${c.key})"><p class="eyebrow">${t("Why it matters", "Чому це важливо")}</p><p>${esc(L(story.why))}</p></div>
    ${articleTakeaways(L(story.takeaways).map(esc), "TL;DR")}
    <section class="facts" aria-labelledby="facts-title"><h2 id="facts-title" class="facts-title">${t("Key facts", "Ключові факти")}</h2><dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></section>
    <div class="prose" id="story-body">
      <p>${esc(L(story.summary))}</p>
      <p>${t("The editor’s summary above is followed in production by the full markdown body: context, quotes from the primary source and what changed compared with the previous release. This prototype keeps the copy short and illustrative.", "У production після редакторського підсумку йде повний markdown-текст: контекст, цитати з першоджерела і що змінилося порівняно з попереднім релізом. У прототипі текст короткий і демонстраційний.")}</p>
      <h2 id="context">${t("What changed", "Що змінилося")}</h2>
      <p>${esc(L(story.why))}</p>
    </div>
    ${technical ? codeBlock(`code-${story.id}`, `# ${t("Try it in two minutes", "Спробуйте за дві хвилини")}\nnpx atb-demo check --story ${story.id}\n# ${t("expected: a short report with the changed behaviour", "очікування: короткий звіт зі зміненою поведінкою")}`, t("Try it in 2 minutes · shell", "Спробуйте за 2 хвилини · shell")) : ""}
    <div class="when-grid"><section class="when-card yes"><h3>${icon("check", 18)}${t("When to use", "Коли використовувати")}</h3><ul><li>${t("The workflow repeats and can be measured.", "Процес повторюється й піддається вимірюванню.")}</li><li>${t("You can review the output before it ships.", "Ви можете перевірити результат до релізу.")}</li></ul></section><section class="when-card no"><h3>${icon("close", 18)}${t("When not to use", "Коли не варто")}</h3><ul><li>${t("There is no owner for the result.", "У результату немає відповідального.")}</li><li>${t("A failure would be silent.", "Збій пройшов би непомітно.")}</li></ul></section></div>
    <section class="action-items" aria-labelledby="actions-title"><h3 id="actions-title">${t("What to do today", "Що зробити сьогодні")}</h3><ol><li>${t("Read the primary source’s changelog section.", "Прочитайте розділ changelog у першоджерелі.")}</li><li>${t("Try it on one low-risk task.", "Спробуйте на одній низькоризиковій задачі.")}</li><li>${t("Write down one measurable before/after signal.", "Запишіть один вимірюваний сигнал «до/після».")}</li></ol></section>
    <aside class="editor-note" aria-label="${t("Editor’s take", "Погляд редактора")}">${eyebrow(t("Editor’s take", "Погляд редактора"))}<p>${t("Useful, but only as a bounded experiment. The strongest signal will come from teams that publish their failure cases, not their demos.", "Корисно, але лише як обмежений експеримент. Найсильніший сигнал дадуть команди, що публікують випадки збоїв, а не демо.")}</p></aside>
    ${index % 2 === 0 ? communityVoices([[t("We tried this on a mid-size monorepo: the win was fewer retries, not fewer tokens.", "Спробували на середньому монорепо: виграш — менше повторів, а не менше токенів."), "mkrause"], [t("Worth it once you pin the harness version. Before that, numbers move for no reason.", "Варто, коли зафіксуєте версію харнесу. До того цифри скачуть без причини."), "delta_q"]]) : ""}
    ${toolChips(story.tags)}
    <section class="sources" aria-labelledby="sources-title"><h2 id="sources-title">${t("Sources", "Джерела")}</h2><ol><li><a href="https://example.com/" target="_blank" rel="noopener">${esc(story.source)} — ${t("announcement", "анонс")}</a></li><li><a href="https://example.com/" target="_blank" rel="noopener">${t("Documentation / changelog", "Документація / changelog")}</a></li></ol></section>`;
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("News", "Новини"), "news"], [esc(catName(c)), `category?c=${c.id}`], [esc(title)]])}
  <article class="story" aria-labelledby="story-title">
    <header class="story-head">
      <div class="story-labels">${catBadge(story.cat)}<span class="impact impact-${story.impact}">${impact}</span></div>
      <h1 id="story-title">${esc(title)}</h1>
      <p class="dek">${esc(L(story.summary))}</p>
      <p class="story-meta"><span>${esc(story.source)}</span><span aria-hidden="true">·</span><time datetime="${story.date}T${story.time}">${fmtDate(story.date)}</time><span aria-hidden="true">·</span><span>${icon("clock", 16)}${story.read} ${t("min read", "хв читання")}</span>${story.video ? `<span aria-hidden="true">·</span><span class="has-video">${icon("play", 16)}${t("Video review", "Відеоогляд")}</span>` : ""}</p>
      ${byline({ updated: story.date })}
    </header>
    <figure class="story-figure">${banner(story, { cls: "banner-hero", glyph: 44 })}<figcaption>${t("No-image fallback: category banner. With a published illustration the figure shows the image with a source and generation caption.", "Запасний варіант без зображення: банер категорії. Коли є ілюстрація, тут показується зображення з підписом джерела й генерації.")}</figcaption></figure>
    ${story.video ? videoFacade(title) : ""}
    <div class="story-body">${body}</div>
    <footer class="story-foot">
      <a class="button outline" href="https://example.com/" target="_blank" rel="noopener">${t("Primary source", "Першоджерело")}: <strong>${esc(story.source)}</strong>${icon("external", 16)}</a>
      ${saveButton(story.id)}
      ${shareBar(title)}
    </footer>
    ${storyNav(index)}
  </article>
  ${relatedList(story)}
  ${newsletter("inline")}`;
}

/* ── Long-form formats (design review) ─────────────────────────────────── */
const articleVariantIds = ["analysis", "technical", "evidence"];
function currentArticleVariant() {
  const value = routeParam("variant");
  return articleVariantIds.includes(value) ? value : "analysis";
}
function articleVariantCards() {
  return [
    { id: "analysis", number: "01", format: t("Editorial analysis", "Редакційний розбір"), title: t("The agent era needs a better memory", "Епосі агентів потрібна краща пам’ять"), description: t("Narrative analysis: thesis, architecture map, implications and uncertainty.", "Наративний аналіз: теза, карта архітектури, наслідки й невизначеність.") },
    { id: "technical", number: "02", format: t("Technical field guide", "Технічний розбір"), title: t("Prompt caching, beyond the price tag", "Prompt caching: більше, ніж економія"), description: t("For developers: request anatomy, code, measurements and a rollout checklist.", "Для розробників: анатомія запиту, код, вимірювання й чекліст запуску.") },
    { id: "evidence", number: "03", format: t("Evidence note", "Доказова нотатка"), title: t("A benchmark is a starting point", "Бенчмарк — лише початок"), description: t("Research read: claim ledger, confidence levels and transfer limits.", "Дослідницький розбір: реєстр тверджень, рівні впевненості й межі перенесення.") },
  ];
}
function articleVariantPicker(active) {
  return `<nav class="format-switch" aria-label="${t("Article formats (design review)", "Формати статей (перегляд дизайну)")}"><span class="format-switch-label">${icon("layers", 16)}${t("Review: three article formats", "Перегляд: три формати статей")}</span><ul>${articleVariantCards()
    .map((card) => `<li><a href="#/article?variant=${card.id}"${card.id === active ? ' aria-current="page"' : ""}><span class="format-no">${card.number}</span>${card.format}</a></li>`)
    .join("")}</ul></nav>`;
}

function articleShell(data) {
  const others = articleVariantCards().filter((card) => card.id !== data.id);
  const story = NEWS_STORIES[0];
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("News", "Новини"), "news"], [data.format]])}${articleVariantPicker(data.id)}
  <article class="longform" aria-labelledby="longform-title">
    <header class="story-head story-head-rich">
      <div class="story-labels">${catBadge(data.cat)}<span class="format-chip">${data.format}</span></div>
      <h1 id="longform-title">${data.title}</h1>
      <p class="dek">${data.dek}</p>
      ${byline({ read: data.readTime })}
      <ul class="trust-row"><li>${icon("check", 14)}${t("Human-edited", "Відредаговано людиною")}</li><li>${icon("doc", 14)}${data.sourceCount} ${t("source slots", "позицій джерел")}</li><li>${icon("info", 14)}${t("Illustrative concept copy", "Демонстраційний текст")}</li></ul>
    </header>
    <div class="article-layout">
      <nav class="toc" aria-label="${t("On this page", "На цій сторінці")}"><p class="toc-title">${t("In this story", "У матеріалі")}</p><ol>${data.toc.map(([id, label]) => `<li><a href="#${id}" data-anchor="${id}">${label}</a></li>`).join("")}</ol></nav>
      <div class="reading">${data.content}</div>
      <aside class="article-tools" aria-label="${t("Story tools", "Дії з матеріалом")}"><div class="format-note">${eyebrow(data.format)}<p>${data.readTime} ${t("min", "хв")} · ${data.sourceCount} ${t("source slots", "позицій джерел")}</p></div>${saveButton(`variant-${data.id}`)}<button type="button" class="button outline" data-action="copy-link">${icon("link", 18)}${t("Copy link", "Копіювати")}</button></aside>
    </div>
    <footer class="story-foot">${shareBar(data.title.replace(/<[^>]+>/g, ""))}</footer>
    ${storyNav(0)}
  </article>
  <section class="section other-formats" aria-labelledby="other-formats-title"><div class="section-head"><h2 id="other-formats-title">${t("Two other ways to tell the story.", "Ще два способи розповісти історію.")}</h2></div><div class="grid2">${others
    .map((card) => `<a class="format-card" href="#/article?variant=${card.id}"><span class="format-card-meta"><span class="format-no">${card.number}</span>${card.format}</span><strong>${card.title}</strong><span>${card.description}</span>${icon("arrowUpRight", 20)}</a>`)
    .join("")}</div></section>
  ${relatedList(story)}
  ${newsletter("inline")}`;
}

function analysisArticle() {
  const content = `<div class="article-disclosure">${t(
    "This is a complete layout sample, not a published report. Named systems and evidence slots demonstrate the editorial structure without presenting demo claims as news.",
    "Це повний приклад верстки, а не опублікований матеріал. Назви систем і місця для доказів демонструють редакційну структуру, не видаючи демо-твердження за новини.",
  )}</div><div class="callout" id="overview">${eyebrow(t("WHY IT MATTERS", "ЧОМУ ЦЕ ВАЖЛИВО"))}<p>${t(
    "Agent memory is becoming an architecture decision rather than a convenience feature. The useful question is not how much a system can retain, but which decisions should survive, for how long, and under whose authority.",
    "Пам’ять агента стає архітектурним рішенням, а не зручною додатковою функцією. Важливе питання не в тому, скільки система може зберегти, а які рішення мають пережити сесію, як довго і під чиїм контролем.",
  )}</p></div><figure class="article-hero article-hero-editorial">${heroPicture({ eager: true })}<figcaption>${t(
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
  )}</p><div class="table-scroll" role="region" aria-labelledby="decisions" tabindex="0"><table class="decision-table"><thead><tr><th scope="col">${t("If the agent remembers…", "Якщо агент пам’ятає…")}</th><th scope="col">${t("Require…", "Потрібно…")}</th><th scope="col">${t("Watch for…", "Стежте за…")}</th></tr></thead><tbody><tr><td>${t("A user preference", "Уподобання користувача")}</td><td>${t("Visibility and a delete control", "Видимість і можливість видалення")}</td><td>${t("Inference presented as consent", "Припущенням, виданим за згоду")}</td></tr><tr><td>${t("A project constraint", "Обмеження проєкту")}</td><td>${t("Owner, source and review date", "Власник, джерело й дата review")}</td><td>${t("A temporary workaround becoming permanent", "Перетворенням тимчасового workaround на правило")}</td></tr><tr><td>${t("A publishing decision", "Рішення про публікацію")}</td><td>${t("Human approval and an audit event", "Людське схвалення й audit event")}</td><td>${t("A summary replacing primary evidence", "Підміною першоджерела підсумком")}</td></tr></tbody></table></div><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "The strongest memory feature may be a clear way to forget. Expiry, supersession and visible correction reduce the authority of stale context without forcing every session to begin from zero.",
    "Найсильнішою функцією пам’яті може бути зрозумілий спосіб забувати. Строк дії, заміна новішим рішенням і видиме виправлення зменшують авторитет застарілого контексту, не змушуючи кожну сесію починати з нуля.",
  )}</p></div><h2 id="uncertainty">${t("What remains uncertain.", "Що лишається невизначеним.")}</h2><div class="uncertainty-grid"><section><strong>${t("Product evidence", "Продуктові докази")}</strong><p>${t("Teams still need longitudinal evidence that remembered context improves completed work rather than only reducing repeated prompts.", "Командам ще потрібні довгострокові докази, що збережений контекст покращує завершену роботу, а не лише скорочує повторні запити.")}</p></section><section><strong>${t("User control", "Контроль користувача")}</strong><p>${t("A technically correct memory can still surprise a person if it appears in the wrong place or cannot be inspected and corrected.", "Навіть технічно коректна пам’ять може здивувати людину, якщо з’являється не там або її неможливо переглянути й виправити.")}</p></section></div><h2 id="sources">${t("Sources & verification notes.", "Джерела й примітки перевірки.")}</h2><p>${t(
    "A production story would link every factual claim to the primary report and mark the editor’s verification date. This concept shows the full source treatment while keeping the copy explicitly illustrative.",
    "Production-матеріал пов’язує кожне фактичне твердження з першоджерелом і позначає дату редакторської перевірки. Концепт показує повне оформлення джерел, лишаючи текст явно демонстраційним.",
  )}</p>${articleSourceLedger([
    [t("Primary announcement / documentation", "Первинний анонс / документація"), t("Canonical source, publication date, version and the exact claim it supports.", "Канонічне джерело, дата публікації, версія й точне твердження, яке воно підтверджує.")],
    [t("Independent technical analysis", "Незалежний технічний аналіз"), t("Used to test the vendor framing and identify limitations or missing context.", "Потрібен, щоб перевірити framing вендора й знайти обмеження або відсутній контекст.")],
    [t("Editor verification log", "Журнал редакторської перевірки"), t("Names the checked facts, unresolved questions, corrections and final review date.", "Називає перевірені факти, відкриті питання, виправлення й дату фінального review.")],
  ])}${communityVoices([[t("The expiry rule is the part we skipped. Six weeks later the agent was obeying a workaround nobody remembered writing.", "Правило терміну дії ми пропустили. За шість тижнів агент виконував workaround, який ніхто не пам’ятав."), "nadia_ops"], [t("Treat memory like a database migration: reviewed, versioned, reversible.", "Ставтеся до пам’яті як до міграції БД: review, версія, можливість відкату."), "kpetrov"]])}${toolChips(["MCP", "Claude Code", "Sub-agents", "Context engineering"])}<div class="article-topic-links">${link("concept?slug=mcp", `Model Context Protocol ${icon("arrowUpRight", 16)}`)}${link("guide", `${t("Choosing an agent workflow", "Вибір агентного процесу")} ${icon("arrowUpRight", 16)}`)}${link("policy?doc=editorial", `${t("How we edit", "Як ми редагуємо")} ${icon("arrowUpRight", 16)}`)}</div>`;
  return {
    id: "analysis",
    cat: "agents-and-mcp",
    format: t("Editorial analysis", "Редакційний розбір"),
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
  )}</p><div class="request-layers"><section><span class="meta">STABLE / VERSIONED</span><h3>${t("Role and non-negotiables", "Роль і незмінні правила")}</h3><p>${t("Safety limits, output contract, durable project instructions and tool descriptions that truly belong in every run.", "Безпекові межі, контракт результату, сталі інструкції проєкту й описи інструментів, які справді потрібні в кожному запуску.")}</p></section><section><span class="meta">SEMI-STABLE / SELECTIVE</span><h3>${t("Workflow context", "Контекст процесу")}</h3><p>${t("Repository map, active decision records and the smallest reference set needed for this family of tasks.", "Карта репозиторію, активні decision records і найменший набір довідок, потрібний для цього типу завдань.")}</p></section><section><span class="meta">VOLATILE / PER RUN</span><h3>${t("Task and evidence", "Завдання й докази")}</h3><p>${t("User intent, changed files, tool output, current measurements and anything expected to differ on the next call.", "Намір користувача, змінені файли, відповіді інструментів, поточні вимірювання й усе, що має відрізнятися в наступному виклику.")}</p></section></div><h3>${t("A minimal request builder", "Мінімальний конструктор запиту")}</h3>${codeBlock("code-request-builder", `<span class="code-comment">// stable-context@2026-09-05</span>&#10;const stablePrefix = await loadProjectContract();&#10;const taskEvidence = await collectCurrentEvidence(task);&#10;&#10;const request = {&#10;  system: stablePrefix,&#10;  input: { task, evidence: taskEvidence },&#10;  verify: ["goal", "diff", "tests", "uncertainty"],&#10;};&#10;&#10;const result = await runAgent(request);&#10;await reviewBeforePublish(result);`, t("Request builder · JavaScript", "Конструктор запиту · JavaScript"))}<p class="article-caption">${t(
    "The example keeps the review step outside the generated result. A cache hit never grants permission to publish or apply a risky change.",
    "Приклад залишає review-крок поза згенерованим результатом. Cache hit ніколи не дає дозволу на публікацію чи ризиковану зміну.",
  )}</p><h2 id="measurement">${t("Measure the workflow, not the invoice alone.", "Вимірюйте процес, а не лише рахунок.")}</h2><p>${t(
    "A lower token bill can coincide with a worse workflow if stale context increases retries or if a larger prefix delays the first useful output. Establish a small baseline before changing the request, then compare the same task family under the same review standard.",
    "Нижчий рахунок за токени може співіснувати з гіршим процесом, якщо застарілий контекст збільшує кількість повторів або великий префікс затримує перший корисний результат. Зафіксуйте малу baseline до зміни запиту, а потім порівнюйте той самий тип завдань за однаковим стандартом review.",
  )}</p><div class="metric-grid"><section><span>${t("HIT RATE", "ЧАСТКА HIT")}</span><strong>72%</strong><p>${t("Illustrative target for a repeated workflow, not a universal threshold.", "Демонстраційна ціль для повторюваного процесу, не універсальний поріг.")}</p></section><section><span>${t("FIRST TOKEN", "ПЕРШИЙ ТОКЕН")}</span><strong>−18%</strong><p>${t("Example comparison after keeping the stable prefix warm.", "Приклад порівняння після прогрівання сталого префікса.")}</p></section><section><span>${t("RETRY RATE", "ЧАСТКА RETRY")}</span><strong>0↔</strong><p>${t("Quality guard: savings do not count if retries increase.", "Quality guard: економія не рахується, якщо retry зростають.")}</p></section><section><span>${t("MISS REASONS", "ПРИЧИНИ MISS")}</span><strong>4</strong><p>${t("Version change, ordering, TTL and provider routing—name each one.", "Зміна версії, порядок, TTL і provider routing — назвіть кожну.")}</p></section></div><div class="table-scroll" role="region" aria-labelledby="measurement" tabindex="0"><table><thead><tr><th scope="col">${t("Measure", "Метрика")}</th><th scope="col">${t("Why it matters", "Навіщо")}</th><th scope="col">${t("Failure signal", "Сигнал проблеми")}</th></tr></thead><tbody><tr><td>Cache hit rate</td><td>${t("Shows whether the boundary is stable in real traffic", "Показує, чи стабільна межа в реальному трафіку")}</td><td>${t("High variance between equivalent tasks", "Висока різниця між еквівалентними задачами")}</td></tr><tr><td>Time to first token</td><td>${t("Captures perceived responsiveness", "Відображає відчутну швидкість відповіді")}</td><td>${t("A larger prefix erases the benefit", "Більший префікс з’їдає виграш")}</td></tr><tr><td>Accepted-result rate</td><td>${t("Keeps quality attached to cost", "Пов’язує якість із вартістю")}</td><td>${t("More manual repair after a hit", "Більше ручного ремонту після hit")}</td></tr><tr><td>Miss reason</td><td>${t("Turns cache behaviour into a debuggable system", "Робить поведінку кешу придатною для налагодження")}</td><td>${t("Unknown misses become normal", "Невідомі промахи стають нормою")}</td></tr></tbody></table></div><h2 id="rollout">${t("A safe rollout in one afternoon.", "Безпечний запуск за один робочий цикл.")}</h2><div class="use-grid"><section class="use-card positive">${eyebrow(t("USE IT WHEN", "ВИКОРИСТОВУЙТЕ, КОЛИ"))}<ul><li>${t("The same instruction prefix serves a repeated task family.", "Той самий префікс інструкцій обслуговує повторюваний тип завдань.")}</li><li>${t("You can version the stable context independently of task data.", "Сталий контекст можна версіонувати окремо від даних завдання.")}</li><li>${t("Latency, quality and cost can be observed together.", "Затримку, якість і вартість можна спостерігати разом.")}</li></ul></section><section class="use-card caution">${eyebrow(t("WAIT WHEN", "ЗАЧЕКАЙТЕ, КОЛИ"))}<ul><li>${t("Every request assembles a different tool or evidence set.", "Кожен запит збирає інший набір інструментів або доказів.")}</li><li>${t("The prompt contract changes several times a day.", "Контракт промпту змінюється кілька разів на день.")}</li><li>${t("The team cannot explain why a miss occurred.", "Команда не може пояснити причину промаху.")}</li></ul></section></div><ol class="rollout-list"><li><span>01</span><div><strong>${t("Choose one repeated workflow.", "Оберіть один повторюваний процес.")}</strong><p>${t("Use a task with enough volume to observe, but low enough risk to review manually.", "Візьміть завдання з достатнім обсягом для спостереження, але низьким ризиком для ручного review.")}</p></div></li><li><span>02</span><div><strong>${t("Freeze and name the prefix.", "Зафіксуйте й назвіть префікс.")}</strong><p>${t("Record content hash, version, owner and the reason a future change should invalidate it.", "Запишіть content hash, версію, власника й причину, з якої майбутня зміна має його інвалідувати.")}</p></div></li><li><span>03</span><div><strong>${t("Run a paired comparison.", "Проведіть парне порівняння.")}</strong><p>${t("Compare equivalent tasks with the same model, provider route, output contract and reviewer.", "Порівнюйте еквівалентні задачі з тією самою моделлю, provider route, контрактом результату й reviewer.")}</p></div></li><li><span>04</span><div><strong>${t("Add a miss ledger before scaling.", "Додайте реєстр miss до масштабування.")}</strong><p>${t("Every miss needs a reason. Unknown is useful temporarily, not as a permanent category.", "Кожен miss потребує причини. Unknown корисний тимчасово, але не як постійна категорія.")}</p></div></li></ol><div class="editor-note">${eyebrow(t("EDITOR’S TAKE", "ПОГЛЯД РЕДАКТОРА"))}<p>${t(
    "Prompt caching exposes whether a team actually knows what is stable in its own workflow. The cost graph is useful, but the sharper benefit is a better-separated request contract.",
    "Prompt caching показує, чи команда справді розуміє, що є сталим у її процесі. Графік вартості корисний, але сильніший результат — краще розділений контракт запиту.",
  )}</p></div><h2 id="sources">${t("Implementation notes & source slots.", "Примітки реалізації й позиції джерел.")}</h2>${articleSourceLedger([
    [t("Provider caching documentation", "Документація провайдера про кешування"), t("Exact eligibility rules, TTL, billing semantics and invalidation behaviour for the selected route.", "Точні правила придатності, TTL, billing semantics і поведінка інвалідації для обраного маршруту.")],
    [t("Application telemetry", "Телеметрія застосунку"), t("Request version, hit or miss, reason, latency and accepted-result signal—without storing private prompt text.", "Версія запиту, hit або miss, причина, затримка й accepted-result signal — без збереження приватного тексту промпту.")],
    [t("Controlled comparison", "Контрольоване порівняння"), t("Same workflow, model route, reviewer and quality bar before and after the change.", "Той самий процес, маршрут моделі, reviewer і quality bar до та після зміни.")],
    [t("Change log", "Журнал змін"), t("Every prefix version states what changed, who approved it and when results should be rechecked.", "Кожна версія префікса пояснює зміну, того, хто її схвалив, і момент повторної перевірки результатів.")],
  ])}<section class="action-items" aria-labelledby="tech-actions"><h3 id="tech-actions">${t("What to do today", "Що зробити сьогодні")}</h3><ol><li>${t("Print one real request in model order and mark the boundary.", "Роздрукуйте один реальний запит у порядку моделі й позначте межу.")}</li><li>${t("Add a hit/miss reason field to your request log.", "Додайте поле причини hit/miss у лог запитів.")}</li><li>${t("Pick the single workflow you will measure first.", "Оберіть один процес, який виміряєте першим.")}</li></ol></section>${toolChips(["Prompt caching", "Token budget", "Evals"])}<div class="article-topic-links">${link("concept?slug=prompt-caching", `${t("Prompt caching concept", "Концепт prompt caching")} ${icon("arrowUpRight", 16)}`)}${link("tool", `${t("Structure a prompt", "Структурувати промпт")} ${icon("arrowUpRight", 16)}`)}${link("guide", `${t("Choose a coding workflow", "Обрати процес роботи з кодом")} ${icon("arrowUpRight", 16)}`)}</div>`;
  return {
    id: "technical",
    cat: "token-and-cost-optimization",
    format: t("Technical field guide", "Технічний розбір"),
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
  )}</p><div class="table-scroll" role="region" aria-labelledby="evidence" tabindex="0"><table class="benchmark-table"><thead><tr><th scope="col">${t("Illustrative system", "Демонстраційна система")}</th><th scope="col">${t("Accepted tasks", "Прийняті задачі")}</th><th scope="col">${t("Median attempts", "Медіана спроб")}</th><th scope="col">${t("Human repair", "Ручний ремонт")}</th><th scope="col">${t("Evidence grade", "Рівень доказу")}</th></tr></thead><tbody><tr><td>Baseline / A</td><td>18 / 30</td><td>1.8</td><td>7</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>Treatment / B</td><td>21 / 30</td><td>2.4</td><td>9</td><td><span class="confidence medium">B / ${t("partial", "частково")}</span></td></tr><tr><td>${t("Local transfer", "Локальне перенесення")}</td><td>4 / 8</td><td>2.0</td><td>3</td><td><span class="confidence low">C / ${t("small n", "мала n")}</span></td></tr></tbody></table></div><aside class="method-note"><strong>${t("How to read the demo", "Як читати демо")}</strong><p>${t(
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
  ])}<h3>${t("The briefing on video", "Брифінг у відео")}</h3>${videoFacade(t("A benchmark is a starting point", "Бенчмарк — лише початок"))}${toolChips(["Evals", "Benchmarks", "Reasoning models"])}<div class="article-topic-links">${link("guide?slug=atb-orchestration-bench", `${t("Read the evaluation guide", "Читати гайд з оцінювання")} ${icon("arrowUpRight", 16)}`)}${link("concept?slug=evals", `${t("Explore evals", "Дослідити evals")} ${icon("arrowUpRight", 16)}`)}${link("policy?doc=editorial", `${t("Corrections policy", "Політика виправлень")} ${icon("arrowUpRight", 16)}`)}</div>`;
  return {
    id: "evidence",
    cat: "models-and-research",
    format: t("Evidence note", "Доказова нотатка"),
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

renderers.article = () => {
  const story = NEWS_STORIES.find((s) => s.id === routeParam("id"));
  return story ? storyArticle(story) : articleShell(articleVariant());
};

ACTIONS["save-story"] = (el) => {
  const id = el.dataset.id;
  if (savedStories.has(id)) savedStories.delete(id);
  else savedStories.add(id);
  persistSaved();
  const on = savedStories.has(id);
  document.querySelectorAll(`[data-action="save-story"][data-id="${id}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(on));
    const label = button.querySelector("span");
    if (label) label.textContent = button.classList.contains("save-toggle") ? (on ? t("Saved", "Збережено") : t("Save story", "Зберегти")) : on ? t("Saved", "Збережено") : t("Save", "Зберегти");
  });
  notify(on ? t("Added to your reading list", "Додано до збереженого") : t("Removed from your reading list", "Видалено зі збереженого"));
};

/* The prototype never loads third-party players; production swaps the facade for youtube-nocookie. */
ACTIONS.video = (el) => {
  const figure = el.closest(".video-facade");
  figure.classList.add("is-playing");
  el.outerHTML = `<div class="video-placeholder" role="status" tabindex="-1">${icon("play", 22)}<p>${t("Demo: in production the youtube-nocookie player loads here, with captions on.", "Демо: у production тут завантажується плеєр youtube-nocookie з увімкненими субтитрами.")}</p></div>`;
  figure.querySelector(".video-placeholder")?.focus();
};

/* Smooth in-page anchors for tables of contents (respects reduced motion). */
document.addEventListener("click", (event) => {
  const anchor = event.target.closest("[data-anchor]");
  if (!anchor) return;
  const target = document.getElementById(anchor.dataset.anchor);
  if (!target) return;
  event.preventDefault();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
});
