/* After Hours prototype v3 — editions: Digests archive, Daily brief, Weekly edition.
   Daily = a finite morning edit with a sense of completion. Weekly = a long-play issue with a cover,
   an action board and chapters. Digests = the record shelf that makes the two formats legible. */

const weekdayShort = (iso) => fmtDate(iso, { weekday: "short" });
const dayNum = (iso) => new Date(`${iso}T00:00:00`).getDate();

/* Record-sleeve cover art: concentric grooves + the celadon signal. Pure SVG, theme-independent. */
function sleeveArt(no, cls = "") {
  const rings = Array.from({ length: 11 }, (_, i) => `<circle cx="200" cy="200" r="${58 + i * 13}" />`).join("");
  return `<svg class="sleeve-art ${cls}" viewBox="0 0 400 400" aria-hidden="true" focusable="false"><defs><linearGradient id="sleeve-brass-${no}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6f5c3d"/><stop offset=".3" stop-color="#ecd7a9"/><stop offset=".55" stop-color="#9a7f52"/><stop offset=".8" stop-color="#e8c995"/><stop offset="1" stop-color="#746247"/></linearGradient></defs><g class="sleeve-grooves" fill="none" stroke="url(#sleeve-brass-${no})">${rings}</g><circle class="sleeve-label" cx="200" cy="200" r="46"/><text class="sleeve-no" x="200" y="214" text-anchor="middle">${no}</text><circle class="sleeve-signal" cx="318" cy="92" r="9"/></svg>`;
}

/* ── 04 / Digests ──────────────────────────────────────────────────────── */
function digestsCalendar() {
  const monthStart = new Date("2026-09-01T00:00:00");
  const lead = (monthStart.getDay() + 6) % 7; // Monday-first grid
  const cells = [...Array(lead).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const issueFor = (week) => {
    const last = week.filter(Boolean).pop();
    const iso = `2026-09-${String(last).padStart(2, "0")}`;
    return WEEKLY_ISSUES.find((w) => w.end === iso || (w.start <= iso && w.end >= iso));
  };
  const days = Array.from({ length: 7 }, (_, i) => fmtDate(`2026-09-${String(7 + i).padStart(2, "0")}`, { weekday: "short" }));
  const todayNum = dayNum(TODAY.iso);
  return `<table class="calendar"><caption>${fmtDate("2026-09-01", { month: "long", year: "numeric" })}</caption><thead><tr>${days.map((d) => `<th scope="col">${d}</th>`).join("")}<th scope="col" class="cal-issue-col">${t("Weekly", "Тижневик")}</th></tr></thead><tbody>${weeks
    .map((week) => {
      const issue = issueFor(week);
      const future = week.filter(Boolean)[0] > todayNum;
      return `<tr>${week
        .map((day) => {
          if (!day) return `<td class="cal-empty"></td>`;
          const edition = DAILY_EDITIONS.find((e) => e.day === day);
          const iso = `2026-09-${String(day).padStart(2, "0")}`;
          if (edition) return `<td><a class="cal-day${day === todayNum ? " is-today" : ""}" href="#/daily?date=${iso}" aria-label="${t("Daily brief", "Щоденний бриф")} ${fmtDate(iso)}: ${esc(L(edition.title))}"${day === todayNum ? ' aria-current="date"' : ""}><span>${day}</span><i aria-hidden="true"></i></a></td>`;
          return `<td><span class="cal-day ${day > todayNum ? "is-future" : "is-off"}" aria-label="${fmtDate(iso)}: ${day > todayNum ? t("upcoming", "ще попереду") : t("no daily edition", "без щоденного випуску")}"><span>${day}</span></span></td>`;
        })
        .join("")}<td class="cal-issue">${issue ? `<a href="#/weekly"><span>${numero()} ${issue.no}</span></a>` : future ? `<span class="cal-issue-soon">${t("soon", "скоро")}</span>` : `<span class="cal-issue-soon is-progress" title="${t("In progress", "Готується")}">${numero()} 39<span class="sr-only"> · ${t("in progress", "готується")}</span></span>`}</td></tr>`;
    })
    .join("")}</tbody></table><p class="calendar-legend"><span><i class="lg-daily"></i>${t("Daily edition", "Щоденний випуск")}</span><span><i class="lg-today"></i>${t("Today", "Сьогодні")}</span><span><i class="lg-off"></i>${t("Sunday: no daily — the weekly ships Monday", "Неділя: без щоденного — тижневик виходить у понеділок")}</span></p>`;
}

function digests() {
  const type = routeParam("type") || "all";
  const today = DAILY_EDITIONS[0];
  const issue = WEEKLY_ISSUES[0];
  const leadStory = NEWS_STORIES.find((s) => s.id === today.lead);
  const entries = [
    ...DAILY_EDITIONS.map((e) => ({ kind: "daily", iso: e.iso, e })),
    ...WEEKLY_ISSUES.map((w) => ({ kind: "weekly", iso: w.published, e: w })),
  ]
    .filter((x) => type === "all" || x.kind === type)
    .sort((a, b) => b.iso.localeCompare(a.iso));
  const groups = entries.reduce((acc, entry) => {
    const key = entry.iso.slice(0, 7);
    (acc[key] ||= []).push(entry);
    return acc;
  }, {});
  const showAll = routeParam("more") === "1";
  const groupKeys = Object.keys(groups);
  const visibleKeys = showAll ? groupKeys : groupKeys.slice(0, 1);
  const tab = (id, label, n) => `<li><a href="#/digests${id === "all" ? "" : `?type=${id}`}"${type === id ? ' aria-current="page"' : ""}>${label}<span class="count">${n}</span></a></li>`;
  const row = ({ kind, e }) =>
    kind === "daily"
      ? `<li class="archive-row archive-daily"><a href="#/daily?date=${e.iso}"><span class="archive-date"><strong>${e.day}</strong><span>${weekdayShort(e.iso)}</span></span><span class="archive-main"><span class="archive-kind">${t("Daily", "Щоденний")}</span><span class="archive-title">${esc(L(e.title))}</span><span class="archive-lead">${esc(L(NEWS_STORIES.find((s) => s.id === e.lead).title))}</span></span><span class="archive-stats">${plural(e.items, ["story", "stories"], ["історія", "історії", "історій"])} · ${e.read} ${t("min", "хв")}</span></a></li>`
      : `<li class="archive-row archive-weekly"><a href="#/weekly"><span class="archive-cover">${sleeveArt(e.no, "mini")}</span><span class="archive-main"><span class="archive-kind is-weekly">${t("Weekly", "Тижневик")} · ${numero()} ${e.no} · ${fmtShort(e.start)}–${fmtShort(e.end)}</span><span class="archive-title">${esc(L(e.title))}</span><span class="archive-lead">${esc(L(e.dek))}</span></span><span class="archive-stats">${plural(e.stories, ["story", "stories"], ["історія", "історії", "історій"])} · ${e.read} ${t("min", "хв")}${e.pdf ? ` · PDF` : ""}${e.video ? ` · ${t("Video", "Відео")}` : ""}</span></a></li>`;
  return `
  <header class="editions-hero">
    <div class="editions-copy">
      ${eyebrow(t("The editions", "Випуски"))}
      <h1>${t("Daily context.<br><em>Weekly perspective.</em>", "Контекст щодня.<br><em>Перспектива щотижня.</em>")}</h1>
      <p class="lede">${t("Two formats, one editorial standard: a five-minute daily edit, and a weekly long play that connects the dots.", "Два формати, один редакційний стандарт: п’ятихвилинний щоденний випуск і тижневий long play, що поєднує крапки.")}</p>
    </div>
    <div class="now-playing" aria-label="${t("Latest editions", "Останні випуски")}">
      <a class="ticket" href="#/daily">
        <span class="ticket-kicker">${t("Today’s daily", "Сьогоднішній daily")}</span>
        <span class="ticket-date"><strong>${today.day}</strong><span>${fmtDate(today.iso, { weekday: "long" })}<br>${fmtDate(today.iso, { month: "long", year: "numeric" })}</span></span>
        <span class="ticket-title">${esc(L(today.title))}</span>
        <span class="ticket-meta">${plural(today.items, ["story", "stories"], ["історія", "історії", "історій"])} · ${today.read} ${t("min read", "хв читання")}</span><span class="ticket-top">${NEWS_STORIES.slice(0, 3).map((s, i) => `<span><b>0${i + 1}</b>${esc(L(s.title))}</span>`).join("")}</span>
        <span class="ticket-go">${t("Read the brief", "Читати бриф")}${icon("arrowRight", 18)}</span>
      </a>
      <a class="sleeve grain" href="#/weekly">
        ${sleeveArt(issue.no)}
        <span class="sleeve-copy"><span class="sleeve-kicker">${t("Latest weekly", "Останній тижневик")} · ${numero()} ${issue.no}</span><span class="sleeve-title">${esc(L(issue.title))}</span><span class="sleeve-meta">${fmtShort(issue.start)} – ${fmtShort(issue.end)} · ${issue.stories} ${t("stories", "історій")} · ${issue.read} ${t("min", "хв")}</span></span>
      </a>
    </div>
  </header>

  <section class="section format-compare" aria-labelledby="formats-title">
    ${sectionHead(t("Which edition fits your week?", "Який формат пасує вашому тижню?"), null, "", "formats-title")}
    <div class="table-scroll formats-table" role="region" aria-labelledby="formats-title" tabindex="0"><table class="compare-table" role="table">
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span class="sr-only">${t("Attribute", "Параметр")}</span></th><th scope="col" role="columnheader"><span class="compare-head daily-head">${icon("calendar", 20)}${t("Daily brief", "Щоденний бриф")}</span></th><th scope="col" role="columnheader"><span class="compare-head weekly-head">${icon("layers", 20)}${t("Weekly edition", "Тижневий випуск")}</span></th></tr></thead>
      <tbody role="rowgroup">
        ${[
          [t("Cadence", "Частота"), t("Every morning, Monday–Saturday", "Щоранку, понеділок–субота"), t("Mondays — covers the previous week", "Щопонеділка — про минулий тиждень")],
          [t("Reading time", "Час читання"), `<strong>4–7 ${t("min", "хв")}</strong>`, `<strong>15–20 ${t("min", "хв")}</strong>`],
          [t("What’s inside", "Що всередині"), t("5–8 stories, why each matters, one thing to try", "5–8 історій, чому кожна важлива, одна річ для практики"), t("The through-line, an action board, chapters, numbers of the week, FAQ", "Спільна думка, action board, розділи, цифри тижня, FAQ")],
          [t("Formats", "Формати"), t("Web · email", "Сайт · email"), t("Web · PDF · video briefing", "Сайт · PDF · відеобрифінг")],
          [t("Best for", "Найкраще для"), t("Staying current before stand-up", "Бути в курсі до stand-up"), t("Deciding what to try next week", "Вирішити, що спробувати наступного тижня")],
        ]
          .map(([row, d, w]) => `<tr role="row"><th scope="row" role="rowheader">${row}</th><td role="cell" data-label="${t("Daily brief", "Щоденний бриф")}">${d}</td><td role="cell" data-label="${t("Weekly edition", "Тижневий випуск")}">${w}</td></tr>`)
          .join("")}
      </tbody>
    </table></div>
  </section>

  <section class="section archive" aria-labelledby="archive-title">
    <div class="archive-head"><h2 id="archive-title">${t("The archive", "Архів")}</h2><nav class="tabs tabs-wrap" aria-label="${t("Edition type", "Тип випуску")}"><ul>${tab("all", t("All", "Усі"), DAILY_EDITIONS.length + WEEKLY_ISSUES.length)}${tab("daily", t("Daily", "Щоденні"), DAILY_EDITIONS.length)}${tab("weekly", t("Weekly", "Тижневі"), WEEKLY_ISSUES.length)}</ul></nav></div>
    <div class="archive-grid">
      <div class="archive-calendar">${digestsCalendar()}</div>
      <div class="archive-timeline">${visibleKeys
        .map((key) => `<section class="archive-month" aria-labelledby="m-${key}"><h3 id="m-${key}" class="archive-month-title">${fmtDate(`${key}-01`, { month: "long", year: "numeric" })}</h3><ol class="archive-list">${(showAll ? groups[key] : groups[key].slice(0, 10)).map(row).join("")}</ol></section>`)
        .join("")}${!showAll && (groupKeys.length > 1 || groups[groupKeys[0]].length > 10) ? `<a class="button outline archive-more" href="#/digests?${type === "all" ? "" : `type=${type}&`}more=1">${t("Show earlier editions", "Показати ранніші випуски")}${icon("arrowDown", 18)}</a>` : ""}</div>
    </div>
  </section>
  ${newsletter("band")}`;
}

/* ── 05 / Daily brief ──────────────────────────────────────────────────── */
function daily() {
  const requested = routeParam("date");
  const edition = DAILY_EDITIONS.find((e) => e.iso === requested) || DAILY_EDITIONS[0];
  const index = DAILY_EDITIONS.indexOf(edition);
  const older = DAILY_EDITIONS[index + 1];
  const newer = DAILY_EDITIONS[index - 1];
  const pool = [...NEWS_STORIES.slice(index % 4), ...NEWS_STORIES].slice(0, 6);
  const packs = [
    { title: t("Morning edit", "Ранковий випуск"), time: "07:00", items: pool.slice(0, 4) },
    { title: t("Update", "Оновлення"), time: "14:00", items: pool.slice(4, 6) },
  ];
  const total = pool.length;
  const read = pool.filter((s) => readItems.has(`${edition.iso}:${s.id}`)).length;
  const concepts = ["mcp", "sub-agents", "prompt-caching", "evals", "quantization"].map((slug) => CONCEPTS.find((c) => c.slug === slug));
  let counter = 0;
  const item = (story) => {
    counter += 1;
    const key = `${edition.iso}:${story.id}`;
    const done = readItems.has(key);
    return `<li class="daily-item${done ? " is-read" : ""}" id="item-${counter}">
      <span class="daily-no" aria-hidden="true">${String(counter).padStart(2, "0")}</span>
      <article aria-labelledby="di-${story.id}">
        <div class="daily-item-top">${catBadge(story.cat)}<span class="card-meta">${story.read} ${t("min", "хв")} · ${esc(story.source)}</span></div>
        <h3 id="di-${story.id}"><a href="${href(`article?id=${story.id}`)}">${esc(L(story.title))}</a></h3>
        <p>${esc(L(story.summary))}</p>
        <p class="daily-why"><strong>${t("Why it matters", "Чому це важливо")}.</strong> ${esc(L(story.why))}</p>
        <div class="daily-item-actions"><a class="text-link" href="${href(`article?id=${story.id}`)}">${t("Full context", "Повний контекст")}${icon("arrowRight", 16)}</a><button type="button" class="pill" data-action="mark-read" data-key="${key}" aria-pressed="${done}">${icon("check", 16)}<span>${done ? t("Read", "Прочитано") : t("Mark as read", "Позначити прочитаним")}</span></button></div>
      </article>
    </li>`;
  };
  const itemsMarkup = packs.map((pack) => `<section class="daily-pack" aria-labelledby="pack-${pack.time.replace(":", "")}"><h2 class="pack-title" id="pack-${pack.time.replace(":", "")}"><span>${pack.title}</span><time>${pack.time}</time></h2><ol class="daily-list" start="${counter + 1}">${pack.items.map(item).join("")}</ol></section>`).join("");
  counter = 0;
  const tocMarkup = pool.map((story, i) => `<li><a href="#item-${i + 1}" data-anchor="item-${i + 1}" class="${readItems.has(`${edition.iso}:${story.id}`) ? "is-read" : ""}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(L(story.title))}</a></li>`).join("");
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("Digests", "Дайджести"), "digests"], [`${t("Daily", "Щоденний")} · ${fmtShort(edition.iso)}`]])}
  <header class="daily-masthead">
    <p class="daily-date" aria-hidden="true"><span class="daily-day">${edition.day}</span><span class="daily-month">${fmtDate(edition.iso, { month: "short" })}<br>${fmtDate(edition.iso, { weekday: "long" })}</span></p>
    <div class="daily-head-copy">
      ${eyebrow(`${t("Daily brief", "Щоденний бриф")} · <time datetime="${edition.iso}">${fmtDate(edition.iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</time>`)}
      <h1>${esc(L(edition.title))}.</h1>
      <details class="daily-intro"><summary><span class="intro-lead">${t("Six stories and one thing to try. Agent tooling is learning to forget on purpose, caching becomes a contract, and local inference gets practical.", "Шість історій і одна річ для практики. Агентні інструменти вчаться свідомо забувати, кешування стає контрактом, а локальний інференс — практичним.")}</span><span class="intro-more">${t("Show more", "Показати більше")}</span><span class="intro-less">${t("Show less", "Згорнути")}</span></summary><p>${t("The through-line today: the most useful releases are not about bigger models but about clearer boundaries — what an agent keeps, what a cache may reuse, and what runs on your own machine.", "Спільна думка дня: найкорисніші релізи — не про більші моделі, а про чіткі межі: що агент зберігає, що кеш може повторно використати і що працює на вашій машині.")}</p></details>
      <div class="daily-meta"><span>${icon("clock", 16)}${edition.read} ${t("min read", "хв читання")}</span><span>${icon("list", 16)}${plural(total, ["story", "stories"], ["історія", "історії", "історій"])}</span><span class="ai-note">${icon("spark", 16)}${t("AI-assisted · editor-reviewed", "З AI-допомогою · перевірено редактором")}</span></div>
    </div>
    <div class="read-progress" role="group" aria-label="${t("Reading progress", "Прогрес читання")}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-bg" cx="22" cy="22" r="19"/><circle class="ring-fg" cx="22" cy="22" r="19" style="--p:${read / total}"/></svg><p><span class="rp-count"><strong data-read-count>${read}</strong> / ${total}</span><span class="rp-label">${t("read", "прочитано")}</span></p></div>
  </header>
  <figure class="daily-visual">${edition.visual ? heroPicture({ eager: true, sizes: "(max-width: 1100px) 100vw, 1100px", alt: t("Daily visual: brass and glass sculpture standing for today’s theme", "Візуал дня: скульптура з латуні й скла, що ілюструє тему дня") }) : banner(pool[0], { cls: "banner-hero", glyph: 48 })}<figcaption>${t("Daily visual · generated illustration, approved by the editor. Without one, the lead story’s category banner is used.", "Візуал дня · згенерована ілюстрація, затверджена редактором. Без неї використовується банер категорії головної історії.")}</figcaption></figure>
  <section class="thirty" aria-labelledby="thirty-title"><h2 id="thirty-title">${t("The brief in 30 seconds", "Бриф за 30 секунд")}</h2><ul>${pool.slice(0, 3).map((s) => `<li>${catBadge(s.cat, "cat-badge-dot")}<span>${esc(L(s.takeaways)[0])}.</span></li>`).join("")}</ul></section>
  <div class="daily-layout">
    <div class="daily-main">${itemsMarkup}
      <section class="try-card" aria-labelledby="try-title"><span class="try-icon" aria-hidden="true">${icon("terminal", 26)}</span><div>${eyebrow(t("One thing to try", "Одна річ для практики"))}<h2 id="try-title">${t("Audit one agent instruction today.", "Перевірте одну інструкцію агента сьогодні.")}</h2><p>${t("Separate the goal, the context and the check. Paste it into the Prompt Optimizer — it runs locally and flags the gaps.", "Розділіть мету, контекст і перевірку. Вставте в Prompt Optimizer — він працює локально й підсвічує прогалини.")}</p><a class="button" href="#/tool">${t("Open the optimizer", "Відкрити оптимізатор")}${icon("arrowRight", 18)}</a></div></section>
      <section class="daily-done" aria-live="polite" data-daily-done${read === total ? "" : " hidden"}><span class="done-mark" aria-hidden="true">${icon("check", 30)}</span><h2>${t("That’s the brief. You’re up to date.", "Це весь бриф. Ви в курсі.")}</h2><p>${t("The next edition lands tomorrow at 07:00 Kyiv time.", "Наступний випуск — завтра о 07:00 за Києвом.")}</p></section>
    </div>
    <aside class="daily-rail" aria-label="${t("In this issue", "У цьому випуску")}">
      <nav class="rail-card toc-card" aria-label="${t("In this issue", "У цьому випуску")}"><p class="rail-title">${t("In this issue", "У цьому випуску")} · ${total}</p><ol>${tocMarkup}</ol></nav>
      <div class="rail-card"><p class="rail-title">${t("Concepts in this brief", "Концепти в цьому брифі")}</p><ul class="tool-chips">${concepts.map((c) => `<li><a class="tag" href="${href(`concept?slug=${c.slug}`)}">${esc(c.name)}</a></li>`).join("")}</ul></div>
      <div class="rail-card rail-numbers"><p class="rail-title">${t("Numbers of the day", "Цифри дня")}</p><dl><div><dt>${t("sources scanned", "джерел переглянуто")}</dt><dd>124</dd></div><div><dt>${t("stories kept", "історій відібрано")}</dt><dd>${total}</dd></div><div><dt>${t("primary sources", "першоджерел")}</dt><dd>${total + 5}</dd></div></dl></div>
    </aside>
  </div>
  <nav class="edition-nav" aria-label="${t("Other editions", "Інші випуски")}">${older ? `<a class="edition-link prev" href="#/daily?date=${older.iso}" rel="prev"><span>${icon("arrowLeft", 16)}${fmtDate(older.iso, { weekday: "long", day: "numeric", month: "short" })}</span><strong>${esc(L(older.title))}</strong></a>` : "<span></span>"}<a class="edition-link all" href="#/digests"><span>${icon("grid", 16)}${t("All editions", "Усі випуски")}</span></a>${newer ? `<a class="edition-link next" href="#/daily?date=${newer.iso}" rel="next"><span>${fmtDate(newer.iso, { weekday: "long", day: "numeric", month: "short" })}${icon("arrowRight", 16)}</span><strong>${esc(L(newer.title))}</strong></a>` : `<span class="edition-link next is-disabled" aria-disabled="true"><span>${t("Next edition", "Наступний випуск")}</span><strong>${t("Tomorrow, 07:00", "Завтра, 07:00")}</strong></span>`}</nav>
  ${newsletter("inline")}`;
}

ACTIONS["mark-read"] = (el) => {
  const key = el.dataset.key;
  if (readItems.has(key)) readItems.delete(key);
  else readItems.add(key);
  const done = readItems.has(key);
  el.setAttribute("aria-pressed", String(done));
  el.querySelector("span").textContent = done ? t("Read", "Прочитано") : t("Mark as read", "Позначити прочитаним");
  el.closest(".daily-item")?.classList.toggle("is-read", done);
  const edition = key.split(":")[0];
  const buttons = [...document.querySelectorAll('[data-action="mark-read"]')];
  const count = buttons.filter((b) => readItems.has(b.dataset.key)).length;
  document.querySelector("[data-read-count]").textContent = String(count);
  document.querySelector(".ring-fg")?.style.setProperty("--p", String(count / buttons.length));
  const index = buttons.indexOf(el);
  document.querySelectorAll(".toc-card a")[index]?.classList.toggle("is-read", done);
  const finale = document.querySelector("[data-daily-done]");
  if (finale) {
    const complete = count === buttons.length;
    finale.hidden = !complete;
    if (complete) finale.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }
  void edition;
};

/* ── 06 / Weekly edition ───────────────────────────────────────────────── */
function weekly() {
  const issue = WEEKLY_ISSUES[0];
  const prev = WEEKLY_ISSUES[1];
  const chapters = [NEWS_STORIES[0], NEWS_STORIES[1], NEWS_STORIES[4], NEWS_STORIES[6], NEWS_STORIES[2], NEWS_STORIES[3], NEWS_STORIES[8]];
  const actions = [
    [t("Claude Code sub-agents", "Субагенти Claude Code"), t("Move your longest refactor into a delegated sub-task and compare the hand-off report.", "Перенесіть найдовший рефакторинг у делеговану підзадачу й порівняйте звіт."), t("≈ 1 hour · free tier", "≈ 1 год · безкоштовно"), 1],
    [t("Prompt caching", "Prompt caching"), t("Freeze and name the stable prefix of one repeated workflow; log hit/miss reasons.", "Зафіксуйте й назвіть сталий префікс одного процесу; логуйте причини hit/miss."), t("≈ 2 hours · saves spend", "≈ 2 год · економить витрати"), 2],
    [t("Grounded review bot", "Рев’ю-бот на фактах"), t("Gate one repository’s PRs with an AST-aware reviewer that must pass the tests.", "Поставте на один репозиторій рев’юера з AST, що мусить проходити тести."), t("≈ half a day", "≈ пів дня"), 4],
  ];
  const chapter = (story, i) => {
    const c = catById(story.cat);
    const detailed = i < 4;
    return `<section class="chapter${detailed ? "" : " is-compact"}" id="story-${i + 1}" aria-labelledby="ch-${i + 1}">
      <header class="chapter-head"><span class="chapter-no" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div>${catBadge(story.cat)}<h2 id="ch-${i + 1}"><a href="${href(`article?id=${story.id}`)}">${esc(L(story.title))}</a></h2></div></header>
      ${detailed ? `<figure class="chapter-figure">${banner(story, { glyph: 40 })}<figcaption>${t("Story image · category banner fallback", "Зображення історії · запасний банер категорії")}</figcaption></figure>` : ""}
      <p class="chapter-summary">${esc(L(story.summary))}</p>
      ${detailed ? `<div class="insight-grid"><section><h3>${t("Why it matters", "Чому це важливо")}</h3><p>${esc(L(story.why))}</p></section><section><h3>${t("Practical example", "Практичний приклад")}</h3><p>${esc(L(story.takeaways)[0])}. ${t("Try it on one repository before rolling out.", "Спробуйте на одному репозиторії перед розгортанням.")}</p></section><section><h3>${t("The takeaway", "Головний висновок")}</h3><p>${esc(L(story.takeaways)[1])}.</p></section><section class="is-limit"><h3>${t("Limitation", "Обмеження")}</h3><p>${t("Evidence so far comes from early adopters; long-term effects are not yet measured.", "Поки що докази — від ранніх користувачів; довгострокові ефекти ще не виміряні.")}</p></section></div>
      <aside class="editors-view"><p class="eyebrow">${t("Editor’s view", "Погляд редакції")}</p><p>${t("Worth a bounded trial this week — the boundary design matters more than the headline feature.", "Варто обмеженого тесту цього тижня: дизайн меж важливіший за головну функцію.")}</p><p class="editors-note">${t("Our read — not established by the sources above.", "Наша думка — не підтверджена джерелами вище.")}</p></aside>` : ""}
      <p class="chapter-sources">${t("Primary source", "Першоджерело")}: <a href="https://example.com/" target="_blank" rel="noopener">${esc(story.source)}${icon("external", 14)}</a></p>
    </section>`;
  };
  return `${breadcrumbs([[t("Home", "Головна"), "home"], [t("Digests", "Дайджести"), "digests"], [`${t("Weekly", "Тижневик")} ${numero()} ${issue.no}`]])}
  <header class="weekly-cover grain" aria-labelledby="weekly-title">
    <div class="weekly-cover-copy">
      ${eyebrow(`${t("The weekly edition", "Тижневий випуск")} · ${t("Week", "Тиждень")} ${issue.no}`)}
      <p class="weekly-issue-no" aria-hidden="true">${numero()} ${issue.no}</p>
      <h1 id="weekly-title">${esc(L(issue.title))}.</h1>
      <p class="weekly-period"><time datetime="${issue.start}">${fmtDate(issue.start, { day: "numeric", month: "long" })}</time> – <time datetime="${issue.end}">${fmtDate(issue.end)}</time> · ${t("published", "вийшов")} <time datetime="${issue.published}">${fmtShort(issue.published)}</time></p>
      <p class="weekly-dek">${esc(L(issue.dek))}</p>
      <ul class="weekly-facts"><li><strong>${issue.stories}</strong>${t("stories", "історій")}</li><li><strong>${issue.read}</strong>${t("min read", "хв читання")}</li><li><strong>${issue.sources}</strong>${t("sources", "джерел")}</li></ul>
      <div class="button-row"><a class="button" href="#contents" data-anchor="contents">${t("Start reading", "Почати читати")}${icon("arrowDown", 18)}</a>${issue.pdf ? `<a class="button outline on-stage" href="#/weekly" data-action="demo-download">${icon("download", 18)}${t("Download PDF", "Завантажити PDF")}</a>` : ""}${issue.video ? `<a class="button ghost on-stage" href="#video" data-anchor="video">${icon("play", 18)}${t("Watch · 4:12", "Дивитися · 4:12")}</a>` : ""}</div>
    </div>
    <div class="weekly-cover-art">${sleeveArt(issue.no, "cover")}</div>
  </header>
  <div class="weekly-layout" id="contents">
    <nav class="weekly-toc" aria-label="${t("In this issue", "У цьому випуску")}"><p class="rail-title">${t("In this issue", "У цьому випуску")}</p><ol><li><a href="#actions" data-anchor="actions">${t("Start here: what to put to work", "Почніть звідси: що взяти в роботу")}</a></li>${chapters.map((s, i) => `<li><a href="#story-${i + 1}" data-anchor="story-${i + 1}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(L(s.title))}</a></li>`).join("")}<li><a href="#numbers" data-anchor="numbers">${t("Numbers this week", "Цифри тижня")}</a></li><li><a href="#faq" data-anchor="faq">${t("Questions this issue answers", "Питання випуску")}</a></li></ol></nav>
    <div class="weekly-body">
      <section class="editor-letter" aria-labelledby="letter-title"><h2 id="letter-title" class="eyebrow">${t("Editor’s note", "Слово редактора")}</h2><p class="letter-lead">${t("The interesting shift this week is not a new capability. It is the conditions around it: what an agent may remember, which context a cache may reuse, which review a change must pass.", "Цікаве зрушення тижня — не нова можливість, а умови довкола неї: що агент може пам’ятати, який контекст кеш може повторно використати, яке рев’ю має пройти зміна.")}</p><p>${t("Seven stories, three concrete moves, and the limits we could not verify. Read the action board first if you only have five minutes.", "Сім історій, три конкретні кроки й межі, які ми не змогли перевірити. Якщо маєте лише п’ять хвилин — почніть з action board.")}</p><p class="signature">— ${esc(L(EDITOR.name))}</p></section>
      <section class="action-board" id="actions" aria-labelledby="board-title"><p class="eyebrow">${t("Start here", "Почніть звідси")}</p><h2 id="board-title">${t("What to put to work this week.", "Що взяти в роботу цього тижня.")}</h2><p class="board-note">${t("Concrete moves from this issue — the tool, the step and what it costs you.", "Конкретні кроки з випуску — інструмент, дія і чого вона вартує.")}</p><ol class="board-list">${actions.map(([tool, step, cost, n], i) => `<li><span class="board-no">${i + 1}</span><div class="board-tool">${esc(tool)}</div><p class="board-step">${esc(step)}</p><p class="board-cost">${icon("clock", 16)}${esc(cost)}</p><a class="text-link" href="#story-${n}" data-anchor="story-${n}">${t("Read the story", "Читати історію")}${icon("arrowDown", 16)}</a></li>`).join("")}</ol></section>
      <section class="remember" aria-labelledby="remember-title"><h2 id="remember-title">${t("What to remember this week", "Що варто запам’ятати цього тижня")}</h2><ol>${[t("Memory needs an expiry rule, not just more storage.", "Пам’яті потрібне правило терміну дії, а не лише більше місця."), t("A cache boundary is a content contract — version it.", "Межа кешу — це контракт контенту; версіонуйте її."), t("Review bots earn trust by passing your tests, not by commenting more.", "Рев’ю-боти заслуговують довіру, проходячи тести, а не коментуючи більше.")].map((x, i) => `<li><span aria-hidden="true">0${i + 1}</span><p>${x}</p></li>`).join("")}</ol></section>
      ${chapters.map(chapter).join("")}
      <section class="metrics-band" id="numbers" aria-labelledby="numbers-title"><h2 id="numbers-title">${t("Numbers this week", "Цифри тижня")}</h2><div class="table-scroll" role="region" aria-labelledby="numbers-title" tabindex="0"><table class="metrics-table"><thead><tr><th scope="col">${t("Figure", "Показник")}</th><th scope="col">${t("What it measures", "Що вимірює")}</th><th scope="col">${t("Source", "Джерело")}</th></tr></thead><tbody><tr><td><strong>~7%</strong></td><td>${t("Token cost cut after one harness-trimming round", "Зниження витрат на токени після одного раунду скорочення харнесу")}</td><td>Cursor</td></tr><tr><td><strong>72%</strong></td><td>${t("Illustrative cache-hit target for a repeated workflow", "Демонстраційна ціль hit rate для повторюваного процесу")}</td><td>${t("Field guide", "Технічний гайд")}</td></tr><tr><td><strong>4 GPUs</strong></td><td>${t("Consumer cards used for a 600B-class MoE run", "Споживчі карти для запуску MoE класу 600B")}</td><td>${t("Community report", "Звіт спільноти")}</td></tr><tr><td><strong>3</strong></td><td>${t("Actions on this week’s board", "Кроки на action board тижня")}</td><td>${t("This issue", "Цей випуск")}</td></tr></tbody></table></div></section>
      <section class="video-section" id="video" aria-labelledby="video-title"><h2 id="video-title">${t("This week in AI — video briefing", "Цей тиждень в AI — відеобрифінг")}</h2><p>${t("One concise briefing with English audio and English or Ukrainian captions.", "Один стислий брифінг з англійською озвучкою та англійськими або українськими субтитрами.")}</p>${videoFacade(L(issue.title))}</section>
      <section class="discuss" aria-labelledby="discuss-title"><h2 id="discuss-title">${t("Worth discussing", "Варто подискутувати")}</h2><ul><li>${t("Should agent memory be opt-in per project or per decision?", "Пам’ять агента — opt-in на проєкт чи на рішення?")}</li><li>${t("Is a 7% token saving worth a harness change your team must maintain?", "Чи варта економія 7% токенів зміни харнесу, яку треба підтримувати?")}</li></ul></section>
      <section class="weekly-faq" id="faq" aria-labelledby="faq-w-title"><h2 id="faq-w-title">${t("Questions this issue answers", "Питання, на які відповідає випуск")}</h2>${[[t("What changed for coding agents this week?", "Що змінилося для кодинг-агентів цього тижня?"), t("Delegation and memory boundaries moved into mainstream tools; see chapters 01 and 03.", "Делегування й межі пам’яті з’явилися в основних інструментах; див. розділи 01 і 03.")], [t("Is prompt caching worth it for small teams?", "Чи варте prompt caching малим командам?"), t("If one workflow repeats daily, yes — start with the action board’s second step.", "Якщо один процес повторюється щодня — так; почніть із другого кроку action board.")], [t("Can I run large models locally now?", "Чи можна вже запускати великі моделі локально?"), t("With quantization and expert offloading, a four-GPU workstation is enough for experiments.", "З квантуванням і розвантаженням експертів для експериментів достатньо станції з чотирма GPU.")]].map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`).join("")}</section>
      <details class="edition-notes"><summary>${t("Sources, corrections & edition notes", "Джерела, виправлення й примітки випуску")}</summary><p>${t("24 sources were checked for this issue. No corrections so far. Video and PDF appear only when a published asset exists; this issue has both.", "Для випуску перевірено 24 джерела. Виправлень поки немає. Відео й PDF з’являються лише за наявності опублікованого файлу; у цьому випуску є обидва.")}</p></details>
    </div>
  </div>
  <nav class="issue-nav" aria-label="${t("Other issues", "Інші випуски")}"><a class="issue-link" href="#/weekly" rel="prev">${sleeveArt(prev.no, "mini")}<span><span class="issue-kicker">${icon("arrowLeft", 16)}${t("Previous issue", "Попередній випуск")} · ${numero()} ${prev.no}</span><strong>${esc(L(prev.title))}</strong></span></a><a class="issue-link is-all" href="#/digests?type=weekly"><span><span class="issue-kicker">${icon("grid", 16)}${t("All weekly issues", "Усі тижневики")}</span><strong>${WEEKLY_ISSUES.length} ${t("issues", "випусків")}</strong></span></a><span class="issue-link is-disabled" aria-disabled="true"><span><span class="issue-kicker">${t("Next issue", "Наступний випуск")} · ${numero()} ${issue.no + 1}</span><strong>${t("Monday, 28 September", "Понеділок, 28 вересня")}</strong></span></span></nav>
  ${newsletter("inline")}`;
}

ACTIONS["demo-download"] = (el, event) => {
  event.preventDefault();
  notify(t("Demo: production serves the published PDF from /weekly/[slug]/download.", "Демо: у production PDF віддається з /weekly/[slug]/download."));
};

Object.assign(renderers, { digests, daily, weekly });
