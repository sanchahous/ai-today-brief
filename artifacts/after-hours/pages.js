/* After Hours prototype v3 — trust, growth and system pages. */

/* ── About ─────────────────────────────────────────────────────────────── */
function about() {
  return `<header class="page-intro">${eyebrow(t("About the publication", "Про видання"))}<h1>${t("Intelligence deserves<br><em>a human perspective.</em>", "Інтелект потребує<br><em>людського погляду.</em>")}</h1><p class="lede">${t("AI Today Brief is a human-edited publication for people who build with AI: developers, founders and tech leads.", "AI Today Brief — видання з людською редактурою для тих, хто будує з AI: розробників, фаундерів і техлідів.")}</p></header>
  <section class="about-split">
    <figure class="about-art">${heroPicture({ sizes: "(max-width: 760px) 100vw, 560px", alt: t("After Hours concept art: a brass sculpture with a glass edge", "Концепт-арт After Hours: латунна скульптура зі скляним краєм") })}<figcaption>${t("Concept art · After Hours", "Концепт-арт · After Hours")}</figcaption></figure>
    <div class="about-copy"><h2>${t("A quieter place to understand what’s next.", "Спокійніше місце, щоб зрозуміти, що далі.")}</h2><p>${t("Each visit should leave you with context you can use: what changed, why it matters and where to go deeper. We read 120+ sources a day so you can read five minutes.", "Кожен візит має давати корисний контекст: що змінилось, чому це важливо й де заглибитись. Ми читаємо 120+ джерел щодня, щоб ви читали п’ять хвилин.")}</p><p>${t("AI assists with research and drafts. Selection, wording and responsibility stay with a named editor. Sources are always visible.", "AI допомагає з пошуком і чернетками. Відбір, формулювання й відповідальність — за названим редактором. Джерела завжди видимі.")}</p><a class="button outline" href="#/policy?doc=editorial">${t("Read the editorial policy", "Редакційна політика")}${icon("arrowRight", 18)}</a></div>
  </section>
  <section class="section" aria-labelledby="process-title">${sectionHead(t("How a story becomes a brief.", "Як матеріал стає брифом."), null, "", "process-title")}<ol class="process">${[
    [t("Find the source", "Знайти джерело"), t("Primary reporting and documentation first. Aggregators only as leads.", "Спершу першоджерела й документація. Агрегатори — лише як підказки.")],
    [t("Separate the signal", "Відділити сигнал"), t("What changed, what the evidence shows, what is still uncertain.", "Що змінилось, що показують докази, що невідомо.")],
    [t("Make the editorial call", "Ухвалити рішення"), t("A named editor approves, edits or drops every story.", "Названий редактор схвалює, редагує або відкидає кожен матеріал.")],
    [t("Correct in public", "Виправляти публічно"), t("Corrections stay visible next to the text they change.", "Виправлення лишаються видимими поруч зі зміненим текстом.")],
  ]
    .map(([h, p], i) => `<li><span class="process-no">0${i + 1}</span><strong>${h}</strong><p>${p}</p></li>`)
    .join("")}</ol></section>
  <section class="section editor-card-section" aria-labelledby="editor-title">${sectionHead(t("Meet the editor.", "Знайомтеся з редактором."), "author", t("Full profile", "Повний профіль"), "editor-title")}<div class="editor-card"><span class="avatar avatar-lg" aria-hidden="true">${EDITOR.initials}</span><div><h3>${esc(L(EDITOR.name))}</h3><p>${t("Editor · AI product engineer. Focus: agents & MCP, developer tools, MLOps and LLM APIs.", "Редактор · AI product engineer. Фокус: агенти й MCP, інструменти розробника, MLOps і LLM API.")}</p><ul class="social inline"><li><a href="https://www.linkedin.com/" target="_blank" rel="noopener">${icon("linkedin", 18)}LinkedIn</a></li><li><a href="mailto:editor@aitodaybrief.com">${icon("mail", 18)}editor@aitodaybrief.com</a></li></ul></div></div></section>
  ${newsletter("band")}`;
}

/* ── Author profile (production /author, ProfilePage) ─────────────────── */
function author() {
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("About", "Про нас"), "about"], [esc(L(EDITOR.name))]])}
  <header class="profile-head"><span class="avatar avatar-xl" aria-hidden="true">${EDITOR.initials}</span><div>${eyebrow(t("Editor profile", "Профіль редактора"))}<h1>${esc(L(EDITOR.name))}</h1><p class="lede">${t("Editor of AI Today Brief. AI product engineer writing about agents, developer tooling and the economics of LLM APIs.", "Редактор AI Today Brief. AI product engineer, пише про агентів, інструменти розробника й економіку LLM API.")}</p><ul class="social inline"><li><a href="https://www.linkedin.com/" target="_blank" rel="noopener">${icon("linkedin", 18)}LinkedIn</a></li><li><a href="https://x.com/" target="_blank" rel="noopener">${icon("x", 18)}X</a></li><li><a href="mailto:editor@aitodaybrief.com">${icon("mail", 18)}${t("Email", "Email")}</a></li></ul></div></header>
  <div class="profile-grid">
    <section aria-labelledby="focus-title"><h2 id="focus-title">${t("Coverage focus", "Фокус висвітлення")}</h2><ul class="tool-chips">${["agents-and-mcp", "tools-and-releases", "token-and-cost-optimization", "models-and-research"].map((id) => `<li>${catLink(catById(id), "tag")}</li>`).join("")}</ul></section>
    <section aria-labelledby="standards-title"><h2 id="standards-title">${t("Standards", "Стандарти")}</h2><ul class="check-list-plain"><li>${icon("check", 16)}${t("Every story links its primary source", "Кожен матеріал посилається на першоджерело")}</li><li>${icon("check", 16)}${t("AI assistance disclosed on every page", "Використання AI позначене на кожній сторінці")}</li><li>${icon("check", 16)}${t("Corrections are public and dated", "Виправлення публічні й датовані")}</li></ul></section>
  </div>
  <section class="section" aria-labelledby="recent-title">${sectionHead(t("Recent stories", "Останні матеріали"), "news", t("All news", "Усі новини"), "recent-title")}<div class="story-list">${NEWS_STORIES.slice(0, 3).map(newsCard).join("")}</div></section>`;
}

/* ── Subscribe ─────────────────────────────────────────────────────────── */
function subscribe() {
  const sample = NEWS_STORIES.slice(0, 4);
  return `<div class="subscribe-layout">
    <section class="subscribe-main" aria-labelledby="sub-title">
      ${eyebrow(t("The morning brief", "Ранковий бриф"))}
      <h1 id="sub-title">${t("The best of AI.<br><em>In five minutes.</em>", "Найкраще з AI.<br><em>За п’ять хвилин.</em>")}</h1>
      <p class="lede">${t("One focused email a day: the stories that matter, why they matter, one thing to try. No spam; one-click unsubscribe.", "Один сфокусований лист на день: важливі історії, чому вони важливі, одна річ для практики. Без спаму; відписка в один клік.")}</p>
      <form class="subscribe-form" data-form="subscribe-full" novalidate>
        <div class="field"><label for="sub-email">${t("Email address", "Email-адреса")}</label><input id="sub-email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" aria-describedby="sub-email-error"><p class="field-error" id="sub-email-error" hidden>${t("Enter a valid email address, for example you@example.com.", "Введіть коректну адресу, наприклад you@example.com.")}</p></div>
        <fieldset class="field"><legend>${t("Edition language", "Мова випуску")}</legend><div class="segmented"><label><input type="radio" name="edition" value="en"${lang === "en" ? " checked" : ""}><span>English</span></label><label><input type="radio" name="edition" value="uk"${lang === "uk" ? " checked" : ""}><span>Українська</span></label></div></fieldset>
        <label class="check-row plain consent-check"><input type="checkbox" name="consent" required aria-describedby="sub-consent-error"><span class="check-label">${t("I want to receive the brief by email and agree to the", "Хочу отримувати бриф email і погоджуюся з")} <a href="#/policy?doc=privacy">${t("privacy policy", "політикою приватності")}</a>.</span></label>
        <p class="field-error" id="sub-consent-error" hidden>${t("Please confirm you want to receive the email.", "Підтвердіть, що хочете отримувати лист.")}</p>
        <button class="button button-lg">${t("Get the brief", "Отримувати бриф")}${icon("arrowRight", 18)}</button>
        <div class="form-status" role="status" aria-live="polite"></div>
      </form>
      <ul class="proof">${[t("Double opt-in", "Подвійне підтвердження"), t("No tracking pixels in email", "Без трекінг-пікселів у листах"), t("Unsubscribe in one click", "Відписка в один клік")].map((x) => `<li>${icon("check", 16)}${x}</li>`).join("")}</ul>
    </section>
    <aside class="sample-issue" aria-labelledby="sample-title"><p class="sample-kicker">${t("A sample issue", "Приклад випуску")}</p><h2 id="sample-title">${esc(L(DAILY_EDITIONS[0].title))}</h2><ol>${sample.map((s, i) => `<li><span>0${i + 1}</span><div>${catBadge(s.cat, "cat-badge-plain")}<p>${esc(L(s.title))}</p></div></li>`).join("")}</ol><a class="text-link" href="#/daily">${t("Read it on the web", "Читати на сайті")}${icon("arrowRight", 16)}</a></aside>
  </div>
  <section class="section" aria-labelledby="benefits-title">${sectionHead(t("What you get.", "Що ви отримуєте."), null, "", "benefits-title")}<ul class="benefit-grid">${[
    ["clock", t("Five minutes", "П’ять хвилин"), t("A finite read that ends — no infinite feed.", "Скінченне читання — без нескінченної стрічки.")],
    ["doc", t("Sources on every story", "Джерела в кожній історії"), t("Primary links, not screenshots of screenshots.", "Першоджерела, а не скриншоти скриншотів.")],
    ["bolt", t("One thing to try", "Одна річ для практики"), t("A practical step you can take the same day.", "Практичний крок того ж дня.")],
    ["layers", t("Weekly perspective", "Тижнева перспектива"), t("Mondays: the week connected, with an action board.", "Щопонеділка: тиждень у зв’язку, з action board.")],
  ]
    .map(([ic, h, p]) => `<li><span class="benefit-icon">${icon(ic, 24)}</span><strong>${h}</strong><span>${p}</span></li>`)
    .join("")}</ul></section>
  <section class="section faq" aria-labelledby="sub-faq-title">${sectionHead(t("Before you subscribe.", "Перед підпискою."), null, "", "sub-faq-title")}<div class="faq-list">${[
    [t("How often will I hear from you?", "Як часто ви пишете?"), t("One daily email Monday–Saturday and the weekly edition on Mondays. You can pause either.", "Один лист щодня з понеділка по суботу і тижневик щопонеділка. Будь-який можна призупинити.")],
    [t("Is it really free?", "Це справді безкоштовно?"), t("Yes. Sponsored placements keep it free and are always labelled.", "Так. Спонсорські розміщення тримають його безкоштовним і завжди позначені.")],
    [t("What if I subscribe twice?", "Що, як я підпишусь двічі?"), t("Nothing breaks — we will just remind you that you are already on the list, without revealing anything to anyone else.", "Нічого не зламається — ми лише нагадаємо, що ви вже в списку, нічого не розкриваючи іншим.")],
  ]
    .map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`)
    .join("")}</div></section>`;
}
FORMS["subscribe-full"] = (form) => {
  const email = form.email;
  const consent = form.consent;
  const emailOk = email.value.trim() && email.checkValidity();
  document.getElementById("sub-email-error").hidden = emailOk;
  email.setAttribute("aria-invalid", String(!emailOk));
  document.getElementById("sub-consent-error").hidden = consent.checked;
  consent.setAttribute("aria-invalid", String(!consent.checked));
  const status = form.querySelector(".form-status");
  if (!emailOk) return email.focus();
  if (!consent.checked) return consent.focus();
  const button = form.querySelector("button");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  status.dataset.state = "pending";
  status.textContent = t("Sending…", "Надсилаємо…");
  setTimeout(() => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    status.dataset.state = "success";
    status.innerHTML = `${icon("mail", 18)}<span>${t("Almost done — check your inbox to confirm. (Demo: nothing was sent.)", "Майже готово — перевірте пошту й підтвердьте. (Демо: нічого не надіслано.)")}</span>`;
  }, 700);
};

/* ── Advertise ─────────────────────────────────────────────────────────── */
function advertise() {
  return `<header class="page-intro">${eyebrow(t("For sponsors", "Для спонсорів"))}<h1>${t("Reach people<br><em>who build.</em>", "Будьте поруч із тими,<br><em>хто створює.</em>")}</h1><p class="lede">${t("Native, clearly disclosed placements next to — never inside — the editorial. One sponsor per issue.", "Нативні, чітко позначені розміщення поруч із редакційним, ніколи всередині. Один спонсор на випуск.")}</p></header>
  <section class="section ad-grid" aria-label="${t("Placement inventory", "Інвентар розміщень")}">${[
    [t("Daily brief slot", "Слот у щоденному брифі"), t("One labelled card after the third story, web and email.", "Одна позначена картка після третьої історії, сайт і email.")],
    [t("Weekly edition partner", "Партнер тижневика"), t("A line on the cover and a card before the action board.", "Рядок на обкладинці й картка перед action board.")],
    [t("Toolbox sponsor", "Спонсор Toolbox"), t("A quiet mention on one tool page for a month.", "Тиха згадка на сторінці утиліти протягом місяця.")],
  ]
    .map(([h, p], i) => `<article class="ad-card"><span class="ad-no">0${i + 1}</span><h2>${h}</h2><p>${p}</p><span class="sponsor-label">${t("Sponsored · example", "Спонсорське · приклад")}</span></article>`)
    .join("")}</section>
  <section class="section ad-contact"><div><h2>${t("Start a conversation.", "Почнімо розмову.")}</h2><p>${t("Email us and we will send the media kit with verified audience data, rates and available dates.", "Напишіть нам — надішлемо media kit із перевіреними даними аудиторії, цінами й датами.")}</p></div><a class="button button-lg" href="mailto:ads@aitodaybrief.com?subject=Media%20kit">${icon("mail", 18)}${t("Request the media kit", "Запросити media kit")}</a></section>`;
}

/* ── Policies: one readable shell, four documents ─────────────────────── */
function policy() {
  const docs = {
    editorial: [t("Editorial policy", "Редакційна політика"), t("Visible sources. Clear responsibility.", "Видимі джерела. Чітка відповідальність.")],
    ai: [t("AI disclosure", "Використання AI"), t("Where AI helps, and where it never decides.", "Де AI допомагає і де ніколи не вирішує.")],
    privacy: [t("Privacy policy", "Політика приватності"), t("What we collect, and what we never do.", "Що ми збираємо і чого ніколи не робимо.")],
    terms: [t("Terms of use", "Умови використання"), t("The rules for reading and reusing the brief.", "Правила читання й повторного використання брифу.")],
  };
  const doc = docs[routeParam("doc")] ? routeParam("doc") : "editorial";
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [docs[doc][0]]])}
  <header class="page-intro page-intro-compact">${eyebrow(t("Trust & transparency", "Довіра й прозорість"))}<h1>${docs[doc][0]}</h1><p class="lede">${docs[doc][1]}</p><p class="meta">${t("Effective", "Чинна з")} <time datetime="2026-09-01">${fmtDate("2026-09-01")}</time> · ${t("Last updated", "Оновлено")} <time datetime="2026-09-20">${fmtDate("2026-09-20")}</time></p></header>
  <nav class="tabs doc-tabs" aria-label="${t("Policies", "Політики")}"><ul>${Object.entries(docs).map(([id, [label]]) => `<li><a href="#/policy?doc=${id}"${id === doc ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul></nav>
  <div class="article-layout">
    <nav class="toc" aria-label="${t("Contents", "Зміст")}"><p class="toc-title">${t("Contents", "Зміст")}</p><ol><li><a href="#p-1" data-anchor="p-1">${t("Principles", "Принципи")}</a></li><li><a href="#p-2" data-anchor="p-2">${t("In practice", "На практиці")}</a></li><li><a href="#p-3" data-anchor="p-3">${t("Corrections & contact", "Виправлення й контакт")}</a></li></ol></nav>
    <div class="reading legal">
      <p class="notice">${icon("info", 18)}${t("Design note: production transfers the existing legal and policy text verbatim; this page demonstrates the reading shell only.", "Примітка дизайну: у production наявні юридичні тексти переносяться дослівно; сторінка показує лише оболонку.")}</p>
      <h2 id="p-1">${t("Principles", "Принципи")}</h2><p>${t("Give readers a direct route from a claim to its evidence, and from a question to the responsible editor.", "Дайте читачам прямий шлях від твердження до доказу та від питання до відповідального редактора.")}</p>
      <h2 id="p-2">${t("In practice", "На практиці")}</h2><ol><li>${t("Every story links a primary source.", "Кожен матеріал посилається на першоджерело.")}</li><li>${t("AI assistance is labelled on each page.", "Допомога AI позначена на кожній сторінці.")}</li><li>${t("Sponsored content is marked and separated.", "Спонсорський контент позначений і відокремлений.")}</li></ol>
      <h2 id="p-3">${t("Corrections & contact", "Виправлення й контакт")}</h2><p>${t("An updated date and a concise correction note sit next to the content they affect. Write to", "Дата оновлення й коротка примітка про виправлення — поруч зі зміненим текстом. Пишіть на")} <a href="mailto:editor@aitodaybrief.com">editor@aitodaybrief.com</a>.</p>
    </div>
  </div>`;
}

/* ── 404 ───────────────────────────────────────────────────────────────── */
function notFound() {
  return `<section class="not-found" aria-labelledby="nf-title">
    <p class="nf-code" aria-hidden="true">4<span>0</span>4</p>
    ${eyebrow(t("Off the record", "Поза ефіром"))}
    <h1 id="nf-title">${t("This URL didn’t make<br><em>the brief.</em>", "Ця адреса не потрапила<br><em>до брифу.</em>")}</h1>
    <p class="lede">${t("The page may have moved or never existed. Search the archive or pick up where the newsroom is.", "Сторінка могла переїхати або ніколи не існувати. Пошукайте в архіві або поверніться до стрічки.")}</p>
    <form class="search-field search-field-lg" role="search" data-form="page-search"><label class="sr-only" for="nf-q">${t("Search news", "Пошук новин")}</label>${icon("search", 20)}<input id="nf-q" name="q" type="search" placeholder="${t("Search news…", "Пошук новин…")}"><button class="button">${t("Search", "Шукати")}</button></form>
    <nav aria-label="${t("Suggested pages", "Рекомендовані сторінки")}" class="nf-links"><a href="#/home">${t("Home", "Головна")}</a><a href="#/news">${t("News", "Новини")}</a><a href="#/digests">${t("Digests", "Дайджести")}</a><a href="#/subscribe">${t("Subscribe", "Підписка")}</a></nav>
  </section>`;
}

/* ── Design system showroom ────────────────────────────────────────────── */
function swatches(themeName) {
  const rows = themeName === "night"
    ? [["Ink / bg", "#171918", "bg"], ["Walnut / surface", "#1f2321", "surface"], ["Raised", "#282d29", "raised"], ["Parchment / text", "#f0e9dc", "text"], ["Muted", "#b9b7ac", "muted"], ["Brass / accent", "#d4b483", "accent"], ["Celadon / signal", "#b5d8cc", "signal"], ["Velvet", "#431a24", "velvet"], ["Claret", "#e3919d", "claret"]]
    : [["Paper / bg", "#efe8da", "bg"], ["Linen / surface", "#f7f2e8", "surface"], ["Raised", "#fdfaf4", "raised"], ["Press ink / text", "#1d211d", "text"], ["Muted", "#4d5148", "muted"], ["Brass / accent", "#72562e", "accent"], ["Celadon / signal", "#2d6559", "signal"], ["Velvet", "#f3e1dc", "velvet"], ["Claret", "#8e2a3f", "claret"]];
  const light = (hex) => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 > 140; };
  return `<ul class="swatch-grid">${rows.map(([name, hex, role]) => `<li class="swatch" style="background:${hex};color:${light(hex) ? "#1d211d" : "#f0e9dc"}"><strong>${name}</strong><code>${hex}</code><span>--${role}</span></li>`).join("")}</ul>`;
}
function system() {
  const scale = [["--text-5xl", t("Masthead / cover", "Масthead / обкладинка"), "42–72"], ["--text-4xl", t("Page H1", "H1 сторінки"), "36–58"], ["--text-3xl", "H2", "28–40"], ["--text-2xl", "H3", "22–28"], ["--text-xl", t("Card title", "Заголовок картки"), "19–22"], ["--text-lg", t("Reading body · lead", "Текст читання · лід"), "18"], ["--text-md", t("UI body · inputs", "UI-текст · поля"), "16"], ["--text-sm", t("Secondary · controls", "Другорядний · контроли"), "14"], ["--text-xs", t("Badges · captions", "Бейджі · підписи"), "13"], ["--text-2xs", t("Mono meta (floor)", "Mono meta (мінімум)"), "12"]];
  return `<header class="page-intro">${eyebrow("AI Today Brief · After Hours v3")}<h1>After <em>Hours.</em></h1><p class="lede">${t("The warmth of a jazz club after closing — brass, green-glass lamps, red velvet — and the precision of tomorrow’s publication.", "Тепло джаз-клубу після закриття — латунь, зелене скло ламп, червоний оксамит — і точність видання про майбутнє.")}</p></header>
  <section class="section" aria-labelledby="palette-title">${sectionHead(t("Three lights, one room.", "Три світла, одна кімната."), null, "", "palette-title")}<p class="section-lede">${t("Brass leads action. Celadon marks the signal. Velvet and claret are the new counterpoint: live, new and the weekly issue — never more than a few percent of a screen. Every text and UI pair passes WCAG AA in both themes (160 checked pairs, 0 failures).", "Латунь веде дії. Celadon позначає сигнал. Оксамит і кларет — новий контрапункт: наживо, нове, тижневик — не більше кількох відсотків екрана. Кожна пара тексту й UI проходить WCAG AA в обох темах (160 пар, 0 порушень).")}</p><div class="grid2 palette-pair"><div>${eyebrow(t("Night · After Hours", "Ніч · After Hours"))}${swatches("night")}</div><div>${eyebrow(t("Day · Morning paper", "День · Ранкова газета"))}${swatches("day")}</div></div><div class="ratio-bar" aria-label="${t("Colour proportion guide", "Пропорції кольору")}"><span style="--w:74%">${t("Base 74%", "Основа 74%")}</span><span style="--w:18%">${t("Text 18%", "Текст 18%")}</span><span style="--w:5%">5%</span><span style="--w:2%"></span><span style="--w:1%"></span></div></section>
  <section class="section" aria-labelledby="cats-title">${sectionHead(t("Category hues", "Кольори категорій"), null, "", "cats-title")}<p class="section-lede">${t("Muted jewel tones tuned to brass replace the old neon set. Each category has a text-safe tone per theme and a fixed art hue for banners.", "Приглушені «коштовні» тони під латунь замінили неоновий набір. Кожна категорія має безпечний для тексту тон у кожній темі й сталий відтінок для банерів.")}</p><ul class="cat-swatches">${CATEGORIES.map((c) => `<li style="--cat:var(--cat-${c.key});--art:var(--art-${c.key})"><span class="cat-swatch-art">${glyph(c.key, 22)}</span><span>${catBadge(c.id)}</span><code>--cat-${c.key}</code></li>`).join("")}</ul></section>
  <section class="section" aria-labelledby="type-title">${sectionHead(t("Type that respects the reader.", "Шрифт, що поважає читача."), null, "", "type-title")}<p class="section-lede">${t("All sizes are rem-based and follow the browser’s font setting. Nothing is smaller than 12px; body copy is 16–18px; display sizes are fluid and capped.", "Усі розміри в rem і враховують налаштування браузера. Нічого менше 12px; основний текст 16–18px; дисплейні розміри плавні й обмежені.")}</p><div class="type-scale">${scale.map(([token, role, px]) => `<div class="type-row"><code>${token}</code><span class="type-sample" style="font-size:var(${token})${token.match(/[345]xl/) ? ";font-family:var(--display)" : ""}">${token.match(/[2345]xl/) ? t("Tomorrow, in context", "Майбутнє з контекстом") : t("Clarity is a form of care.", "Ясність — форма турботи.")}</span><span class="type-meta">${role} · ${px}px</span></div>`).join("")}</div><div class="grid2 type-pair"><div>${eyebrow("Display")}<p class="specimen-display">Fraunces · Georgia (UA)</p></div><div>${eyebrow("Text · Mono")}<p class="specimen-text">Inter 400/500/600 · ui-monospace</p></div></div></section>
  <section class="section" aria-labelledby="mark-title">${sectionHead(t("A mark with rhythm.", "Знак із ритмом."), null, "", "mark-title")}<div class="grid2"><div class="spec-card mark-card">${markSvg(132, "mark-lg")}<h3>AI Today Brief</h3><p>${t("Nested A strokes evoke the grooves of a record; the celadon point lands just off the beat. Hover the header mark: the strokes strum.", "Вкладені лінії A нагадують доріжки платівки; celadon-крапка — трохи поза тактом. Наведіть на знак у шапці — лінії «звучать».")}</p></div><div class="spec-card"><h3>${t("The Resolve.", "The Resolve.")}</h3><p>${t("Brand motion in four acts: scattered signals, the edit, the strum and the resolved signal. 3.4 s, once, finite; reduced motion shows the final mark.", "Брендовий рух у чотирьох актах: розсіяні сигнали, редагування, «акорд» і розв’язаний сигнал. 3,4 с, один раз; reduced motion показує фінальний знак.")}</p><div data-brand-example class="mini-stage"></div><a class="button outline" href="#/motion">${t("Open the motion atlas", "Відкрити атлас руху")}${icon("arrowRight", 18)}</a></div></div></section>
  <section class="section" aria-labelledby="elev-title">${sectionHead(t("Depth & material", "Глибина й матеріал"), null, "", "elev-title")}<ul class="elevation-grid"><li class="elev elev-0"><strong>${t("Surface", "Поверхня")}</strong><code>--surface</code></li><li class="elev elev-1"><strong>${t("Card", "Картка")}</strong><code>--shadow-1</code></li><li class="elev elev-2"><strong>${t("Hover / sticky", "Hover / sticky")}</strong><code>--shadow-2</code></li><li class="elev elev-pop"><strong>${t("Menu / dialog", "Меню / діалог")}</strong><code>--shadow-pop</code></li><li class="elev elev-stage grain"><strong>${t("Stage + grain", "Сцена + зерно")}</strong><code>.grain</code></li></ul></section>
  <section class="section" aria-labelledby="controls-title">${sectionHead(t("Controls", "Контроли"), null, "", "controls-title")}<div class="control-grid">
    <div class="spec-card"><h3>${t("Actions", "Дії")}</h3><div class="button-row"><button class="button">${t("Primary", "Основна")}</button><button class="button outline">${t("Secondary", "Другорядна")}</button><button class="button ghost">${t("Ghost", "Тиха")}</button><button class="button" disabled>${t("Disabled", "Недоступна")}</button></div><div class="button-row"><button class="pill">${icon("bookmark", 16)}${t("Save", "Зберегти")}</button><button class="pill" aria-pressed="true">${icon("check", 16)}${t("Selected", "Вибрано")}</button><button class="chip" aria-pressed="false">#MCP</button><button class="chip" aria-pressed="true">#Evals</button></div></div>
    <div class="spec-card"><h3>${t("Fields", "Поля")}</h3><div class="field"><label for="demo-field">${t("Label", "Мітка")}</label><input id="demo-field" placeholder="${t("Placeholder", "Підказка")}"></div><div class="field"><label for="demo-invalid">${t("Invalid", "Помилка")}</label><input id="demo-invalid" aria-invalid="true" value="not-an-email" aria-describedby="demo-err"><p class="field-error" id="demo-err">${t("Enter a valid email address.", "Введіть коректну адресу.")}</p></div><label class="sort-field" for="demo-select"><span>${t("Sort", "Сортування")}</span><select id="demo-select"><option>${t("Newest", "Найновіші")}</option><option>${t("Oldest", "Найдавніші")}</option></select></label></div>
    <div class="spec-card"><h3>${t("Choices", "Вибір")}</h3><ul class="check-list"><li><label class="check-row" style="--cat:var(--cat-agents)"><input type="checkbox" checked><span class="check-glyph">${glyph("agents", 16)}</span><span class="check-label">Agents & MCP</span><span class="count">4</span></label></li><li><label class="check-row" style="--cat:var(--cat-tools)"><input type="checkbox"><span class="check-glyph">${glyph("tools", 16)}</span><span class="check-label">Tools & releases</span><span class="count">2</span></label></li></ul><div class="segmented"><label><input type="radio" name="demo-seg" checked><span>${t("Today", "Сьогодні")}</span></label><label><input type="radio" name="demo-seg"><span>7 ${t("days", "днів")}</span></label><label><input type="radio" name="demo-seg"><span>${t("All", "Усе")}</span></label></div></div>
    <div class="spec-card"><h3>${t("Touch floor", "Мінімум дотику")}</h3><p>${t("Every interactive target is at least 44 × 44 px on touch screens, including chips and pagination.", "Кожна інтерактивна ціль має щонайменше 44 × 44 px на сенсорних екранах, включно з чіпами й пагінацією.")}</p><div class="touch-demo"><span class="touch-outline">44 px</span><button class="icon-btn" aria-label="${t("Example icon button", "Приклад кнопки-іконки")}">${icon("bookmark")}</button></div></div>
  </div></section>`;
}

/* ── UI states ─────────────────────────────────────────────────────────── */
function states() {
  return `<header class="page-intro">${eyebrow(t("Component library · states", "Бібліотека компонентів · стани"))}<h1>${t("Care is in <em>the details.</em>", "Турбота — <em>у деталях.</em>")}</h1><p class="lede">${t("Every data pattern has loading, partial, ready, empty and error states; every control has hover, focus, selected, disabled and pending.", "Кожен патерн даних має стани завантаження, часткових даних, готовності, порожнечі й помилки; кожен контрол — hover, focus, вибір, недоступність і очікування.")}</p></header>
  <div class="state-grid">
    <section class="spec-card" aria-busy="true" aria-labelledby="st-loading"><h2 id="st-loading" class="eyebrow">${t("Loading · skeleton", "Завантаження · скелетон")}</h2><div class="skeleton-card" aria-hidden="true"><span class="sk sk-media"></span><span class="sk sk-line w40"></span><span class="sk sk-title"></span><span class="sk sk-line"></span><span class="sk sk-line w60"></span></div><p>${t("Reserved dimensions: no layout shift when data arrives.", "Зарезервовані розміри: без стрибків, коли дані надходять.")}</p></section>
    <section class="spec-card" aria-labelledby="st-empty"><h2 id="st-empty" class="eyebrow">${t("Empty · filters", "Порожньо · фільтри")}</h2><div class="empty compact"><span class="empty-mark" aria-hidden="true">${icon("compass", 26)}</span><h3>${t("No stories match these filters.", "Жоден матеріал не відповідає фільтрам.")}</h3><a class="button outline" href="#/news">${t("Clear all filters", "Скинути фільтри")}</a></div></section>
    <section class="spec-card" aria-labelledby="st-error"><h2 id="st-error" class="eyebrow">${t("Recoverable error", "Помилка з відновленням")}</h2><div class="notice notice-error" role="alert">${icon("alert", 18)}<div><strong>${t("The feed could not be refreshed.", "Не вдалося оновити стрічку.")}</strong><p>${t("You are reading the last loaded version.", "Ви читаєте останню завантажену версію.")}</p></div></div><button type="button" class="button outline" data-action="retry">${icon("refresh", 18)}${t("Try again", "Спробувати ще")}</button><p class="form-status" data-retry-status role="status" aria-live="polite"></p></section>
    <section class="spec-card" aria-labelledby="st-stale"><h2 id="st-stale" class="eyebrow">${t("Stale · partial data", "Застарілі · часткові дані")}</h2><p class="notice notice-warning">${icon("clock", 18)}${t("Updated 3 hours ago. New stories may be missing.", "Оновлено 3 години тому. Нових матеріалів може бракувати.")}</p><p class="notice">${icon("info", 18)}${t("Showing the latest 100 stories. Older coverage: use search.", "Показано останні 100 матеріалів. Давніші — через пошук.")}</p></section>
    <section class="spec-card" aria-labelledby="st-offline"><h2 id="st-offline" class="eyebrow">${t("Offline · storage", "Офлайн · сховище")}</h2><p class="notice notice-warning">${icon("alert", 18)}${t("You are offline. Saved stories stay readable; search will resume when you reconnect.", "Ви офлайн. Збережене доступне; пошук відновиться після підключення.")}</p><p class="notice">${icon("bookmark", 18)}${t("Storage blocked: your reading list will clear when the tab closes.", "Сховище заблоковане: список збереженого очиститься після закриття вкладки.")}</p></section>
    <section class="spec-card" aria-labelledby="st-form"><h2 id="st-form" class="eyebrow">${t("Form · pending → success", "Форма · очікування → успіх")}</h2><form data-form="subscribe" novalidate class="newsletter-form"><label for="st-email">Email</label><div class="field-row"><input id="st-email" name="email" type="email" required placeholder="you@example.com"><button class="button">${t("Preview", "Перевірити")}</button></div><p class="form-status" role="status" aria-live="polite"></p></form></section>
    <section class="spec-card" aria-labelledby="st-copied"><h2 id="st-copied" class="eyebrow">${t("Copied · saved · toast", "Скопійовано · збережено · toast")}</h2><div class="button-row"><button type="button" class="pill" data-action="copy-link">${icon("link", 16)}${t("Copy link", "Копіювати посилання")}</button>${saveButton("states-demo")}</div><p>${t("Confirmation appears in a polite live region; no motion is required to understand it.", "Підтвердження — у ввічливій live-області; рух не потрібен для розуміння.")}</p></section>
    <section class="spec-card" aria-labelledby="st-consent"><h2 id="st-consent" class="eyebrow">${t("Consent · overlay", "Згода · оверлей")}</h2><p>${t("Non-blocking card with equal-weight Accept and Essential-only actions; Manage expands switches.", "Неблокувальна картка з рівноцінними «Прийняти» і «Лише необхідні»; «Налаштувати» відкриває перемикачі.")}</p><button type="button" class="button outline" data-action="consent-open">${t("Show the consent card", "Показати картку згоди")}</button></section>
  </div>
  <div class="button-row states-links"><a class="button outline" href="#/404">${t("Preview 404", "Переглянути 404")}</a><a class="button outline" href="#/search?q=zzz">${t("Empty search", "Порожній пошук")}</a><a class="button outline" href="#/saved">${t("Empty reading list", "Порожнє збережене")}</a></div>`;
}
ACTIONS.retry = (el) => {
  el.disabled = true;
  el.setAttribute("aria-busy", "true");
  const status = document.querySelector("[data-retry-status]");
  status.textContent = t("Retrying…", "Повторюємо…");
  setTimeout(() => {
    el.removeAttribute("aria-busy");
    status.textContent = t("Demo: the feed is available again.", "Демо: стрічка знову доступна.");
  }, 800);
};

/* ── Production coverage matrix ───────────────────────────────────────── */
function coverage() {
  const stateLabel = { covered: t("Covered", "Покрито"), improved: t("Redesigned", "Перероблено"), new: t("New in v3", "Нове у v3"), out: t("Out of scope", "Поза межами") };
  const counts = COVERAGE.reduce((acc, row) => ({ ...acc, [row[4]]: (acc[row[4]] || 0) + 1 }), {});
  return `<header class="page-intro">${eyebrow(t("Design review", "Перегляд дизайну"))}<h1>${t("Nothing in production <em>left behind.</em>", "Нічого з продукту <em>не загублено.</em>")}</h1><p class="lede">${t("Every public surface of aitodaybrief.com mapped to the layout that carries it in After Hours v3. The admin CMS is intentionally out of scope for the public redesign.", "Кожна публічна поверхня aitodaybrief.com зіставлена з макетом After Hours v3. Адмін-CMS свідомо поза межами публічного редизайну.")}</p><ul class="coverage-summary">${Object.entries(stateLabel).map(([id, label]) => `<li class="cov-${id}"><strong>${counts[id] || 0}</strong>${label}</li>`).join("")}</ul></header>
  <div class="table-scroll" role="region" aria-label="${t("Coverage matrix", "Матриця покриття")}" tabindex="0"><table class="coverage-table"><thead><tr><th scope="col">${t("Area", "Зона")}</th><th scope="col">${t("Production capability", "Можливість у продукті")}</th><th scope="col">${t("Production source", "Джерело в коді")}</th><th scope="col">${t("Prototype layout", "Макет прототипу")}</th><th scope="col">${t("Status", "Статус")}</th></tr></thead><tbody>${COVERAGE.map(([area, capability, source, layout, state]) => `<tr><td>${area}</td><td>${capability}</td><td><code>${source}</code></td><td>${layout}</td><td><span class="cov-chip cov-${state}">${stateLabel[state]}</span></td></tr>`).join("")}</tbody></table></div>`;
}

Object.assign(renderers, { about, author, subscribe, advertise, policy, 404: notFound, system, states, coverage });
