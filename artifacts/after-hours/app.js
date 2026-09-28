/* After Hours prototype v3 — core: state, helpers, chrome, router.
   Standalone design prototype. Illustrative editorial content; no production API calls.
   Script order (index.html): tension → app → data → home → articles → editions → knowledge
   → toolbox → pages → seo → boot. Page modules register into `renderers`. */

/* ── Preferences: URL (?lang=&theme=) > saved > system ──────────────────────── */
const PREFS_KEY = "atb-after-hours-prefs";
const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Private mode or blocked storage: preferences simply do not persist. */
    }
  },
};
const initialQuery = new URLSearchParams(location.search);
const savedPrefs = store.get(PREFS_KEY) || {};
const pick = (value, allowed) => (allowed.includes(value) ? value : null);
/* Mirrors src/lib/preferred-lang.ts: explicit link → saved choice → browser language → EN. */
const browserLang = (navigator.languages || [navigator.language || ""]).map((l) => l.toLowerCase().split("-")[0]).find((l) => l === "uk" || l === "en");
let lang = pick(initialQuery.get("lang"), ["en", "uk"]) || pick(savedPrefs.lang, ["en", "uk"]) || browserLang || "en";
/* Theme: explicit link → saved choice → operating-system preference. */
let theme = pick(initialQuery.get("theme"), ["night", "day"]) || pick(savedPrefs.theme, ["night", "day"]) || (matchMedia("(prefers-color-scheme: light)").matches ? "day" : "night");
let activeFilter = "all";
const savedStories = new Set(store.get("atb-after-hours-saved") || []);
const readItems = new Set();

function persistPrefs() {
  store.set(PREFS_KEY, { lang, theme });
  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  url.searchParams.set("theme", theme);
  history.replaceState(history.state, "", url);
}
function persistSaved() {
  store.set("atb-after-hours-saved", [...savedStories]);
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const t = (en, uk) => (lang === "uk" ? uk : en);
const L = (value) => (value && typeof value === "object" && !Array.isArray(value) ? (value[lang] ?? value.en) : value);
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const locale = () => (lang === "uk" ? "uk-UA" : "en-GB");
const fmtDate = (iso, opts = { day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat(locale(), opts).format(new Date(`${iso}T00:00:00`));
const fmtShort = (iso) => fmtDate(iso, { day: "numeric", month: "short" });
const href = (route) => `#/${route}`;
const link = (route, text, cls = "", attrs = "") => `<a class="${cls}" href="${href(route)}"${attrs}>${text}</a>`;
const eyebrow = (text, cls = "") => `<p class="eyebrow ${cls}">${text}</p>`;
const plural = (n, en, uk) => {
  if (lang !== "uk") return `${n} ${n === 1 ? en[0] : en[1]}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const form = mod10 === 1 && mod100 !== 11 ? 0 : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 1 : 2;
  return `${n} ${uk[form]}`;
};
/* Numero: "No." in English (the № glyph is missing from several monospace fonts), "№" in Ukrainian. */
const numero = () => t("No.", "№");
const hashSeed = (text) => [...String(text)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);

/* Inline SVG icon set — consistent across platforms, unlike emoji or unicode glyphs. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20.2 14.6A8.5 8.5 0 1 1 9.4 3.8a7 7 0 0 0 10.8 10.8z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h11"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrowUpRight: '<path d="M7 17 17 7M9 7h8v8"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  bookmark: '<path d="M18 21l-6-4.5L6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 13.3 7.6 4M15.8 6.7 8.2 10.7"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  rss: '<path d="M5 19h.01M5 12a7 7 0 0 1 7 7M5 5a14 14 0 0 1 14 14"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 10.5v6M8 7.6h.01M12 16.5V13a2 2 0 0 1 4 0v3.5M12 10.5v6"/>',
  telegram: '<path d="M21 4 3 11l6.2 2.4M21 4l-3.8 16-8-6.6M21 4 9.2 13.4V19l3.1-2.9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  bolt: '<path d="M13 2.5 4.5 14h7l-1 7.5 8.5-11.5h-7z"/>',
  quote: '<path d="M9 7H5v6h4v-2c0 2-1 3.5-3 4M19 7h-4v6h4v-2c0 2-1 3.5-3 4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z"/>',
  x: '<path d="M4 4.5h4.4l11.6 15H15.6zM19.5 4.5l-6.3 6.8M10.8 12.7 4.5 19.5"/>',
};
const icon = (name, size = 20, cls = "") =>
  `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;

/* Category glyphs — the same thin stroke language as the brand mark. */
const GLYPHS = {
  tools: '<path d="M14.6 6.4a3.9 3.9 0 0 0-5.3 5l-5.1 5.2V20h3.3l5.2-5.2a3.9 3.9 0 0 0 5-5.3l-2.4 2.4-2.2-.4-.4-2.1z"/>',
  tutorials: '<path d="M3 5.6c2.6-1 5.6-1 9 1 3.4-2 6.4-2 9-1v13c-2.6-1-5.6-1-9 1-3.4-2-6.4-2-9-1z"/><path d="M12 6.6v13"/>',
  cost: '<path d="M13 2.5 4.5 14h7l-1 7.5 8.5-11.5h-7z"/>',
  agents: '<circle cx="12" cy="5.5" r="2.3"/><circle cx="5.5" cy="18" r="2.3"/><circle cx="18.5" cy="18" r="2.3"/><path d="M11 7.6 6.6 15.9M13 7.6l4.4 8.3M7.8 18h8.4"/>',
  vibe: '<path d="M12 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z"/><path d="M19 15.5v4M17 17.5h4"/>',
  creative: '<path d="M4 20c1-3 2.4-4.6 5-5l7.6-9.6a2.1 2.1 0 0 1 3 3L10 16c-.5 2.6-2 4-6 4z"/>',
  local: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18"/>',
  models: '<ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.1"/>',
};
const glyph = (key, size = 20) =>
  `<svg class="icon glyph" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GLYPHS[key] || GLYPHS.agents}</svg>`;

/* The After Hours mark: nested A strokes + the celadon signal. Colours follow the current theme. */
const markSvg = (size = 38, cls = "") =>
  `<svg class="brand-mark ${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect class="mark-plate" width="64" height="64" rx="6"/><g class="mark-strokes" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="mark-stroke" d="M12 49 31 13l20 36"/><path class="mark-stroke" d="M18 49l13-25 14 25"/><path class="mark-stroke" d="M25 40h15"/></g><circle class="mark-dot" cx="49" cy="15" r="4"/></svg>`;

const catName = (c) => L(c.name);
const catBadge = (id, cls = "") => {
  const c = catById(id);
  return `<span class="cat-badge ${cls}" style="--cat:var(--cat-${c.key})">${glyph(c.key, 14)}<span>${esc(catName(c))}</span></span>`;
};
const catLink = (c, cls = "") =>
  `<a class="${cls}" href="${href(`category?c=${c.id}`)}" style="--cat:var(--cat-${c.key})">${glyph(c.key, 16)}<span>${esc(catName(c))}</span></a>`;

/* No-image fallback banner (production CategoryBanner): category hue + nested brass grooves. */
function banner(story, opts = {}) {
  const c = catById(story.cat);
  const seed = hashSeed(story.id);
  const tilt = (seed % 24) - 12;
  const shift = seed % 60;
  const grooves = Array.from({ length: 9 }, (_, i) => {
    const inset = i * 11;
    return `<path d="M${40 + inset + shift} 214 L${150 + shift} ${34 + inset * 1.6} L${260 - inset + shift} 214" />`;
  }).join("");
  return `<div class="cat-banner ${opts.cls || ""}" style="--art:var(--art-${c.key})" aria-hidden="true"><svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" focusable="false"><g class="cat-banner-grooves" transform="rotate(${tilt} 160 110)">${grooves}</g><circle class="cat-banner-dot" cx="${230 + (seed % 50)}" cy="${40 + (seed % 30)}" r="5"/></svg><span class="cat-banner-glyph">${glyph(c.key, opts.glyph || 30)}</span>${story.video ? `<span class="cat-banner-badge">${icon("play", 12)}${t("Video", "Відео")}</span>` : ""}</div>`;
}

/* ── Routes ───────────────────────────────────────────────────────────────── */
const routes = [
  "home", "news", "article", "digests", "daily", "weekly", "concepts", "concept", "guides", "guide", "tools", "tool",
  "settings", "instructions", "categories", "category", "about", "author", "subscribe", "search", "saved", "advertise",
  "policy", "404", "system", "states", "coverage",
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
  tool: "Prompt Optimizer",
  settings: "settings.json Builder",
  instructions: "CLAUDE.md / AGENTS.md",
  categories: t("Categories", "Категорії"),
  category: t("Category hub", "Хаб категорії"),
  about: t("About", "Про нас"),
  author: t("Editor profile", "Профіль редактора"),
  subscribe: t("Subscribe", "Підписка"),
  search: t("Search", "Пошук"),
  saved: t("Reading list", "Збережене"),
  advertise: t("Advertise", "Співпраця"),
  policy: t("Editorial & legal", "Політики"),
  404: "404",
  system: t("Design system", "Дизайн-система"),
  states: t("UI states", "Стани UI"),
  coverage: t("Prod coverage", "Покриття продукту"),
  motion: t("Motion atlas", "Атлас руху"),
});
const NAV = ["news", "digests", "concepts", "guides", "tools"];
const SECTION_OF = { article: "news", search: "news", daily: "digests", weekly: "digests", concept: "concepts", guide: "guides", tool: "tools", settings: "tools", instructions: "tools", category: "categories", author: "about" };

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  return { route: path, params: new URLSearchParams(query) };
}
function currentRoute() {
  const r = parseHash().route;
  return routes.includes(r) ? r : r ? "404" : "home";
}
const routeParam = (key) => parseHash().params.get(key);

/* ── Chrome ───────────────────────────────────────────────────────────────── */
function previewStrip() {
  return `<div class="preview" role="note"><span>${t("Design concept · After Hours v3 · Illustrative content", "Концепція дизайну · After Hours v3 · Демонстраційний контент")}</span><nav aria-label="${t("Design review", "Перегляд дизайну")}"><a href="#/system">${t("System", "Система")}</a><a href="#/motion">${t("Motion", "Рух")}</a><a href="#/coverage">${t("Coverage", "Покриття")}</a><button type="button" class="preview-schema" data-action="inspect-seo">${t("SEO & schema", "SEO і schema")}</button></nav></div>`;
}

function header(route) {
  const l = labels();
  const section = SECTION_OF[route] || route;
  const navLink = (r) => `<a href="${href(r)}" class="nav-link${section === r ? " active" : ""}"${section === r ? ' aria-current="page"' : ""}>${l[r]}</a>`;
  const cats = CATEGORIES.map((c) => `<li><a href="${href(`category?c=${c.id}`)}" style="--cat:var(--cat-${c.key})">${glyph(c.key, 18)}<span>${esc(catName(c))}</span><small>${c.count}</small></a></li>`).join("");
  const themeLabel = theme === "night" ? t("Switch to day theme", "Увімкнути денну тему") : t("Switch to night theme", "Увімкнути нічну тему");
  return `<header class="site-header" id="site-header">
    <div class="wrap header-top">
      <a class="wordmark" href="#/home" aria-label="AI Today Brief — ${t("home", "головна")}">${markSvg(40)}<span class="wordmark-text">AI Today Brief<small>${t("The Intelligence Edit", "Редакція AI-новин")}</small></span></a>
      <p class="header-edition"><span class="live-dot" aria-hidden="true"></span>${esc(fmtDate(TODAY.iso, { weekday: "long", day: "numeric", month: "long" }))} · ${t("Daily edition", "Щоденний випуск")} ${new Date(`${TODAY.iso}T00:00:00`).getDate()}</p>
      <div class="header-actions">
        <button type="button" class="icon-btn only-compact" data-action="search" aria-label="${t("Search", "Пошук")}">${icon("search")}</button>
        <button type="button" class="lang-btn" data-action="lang" lang="${lang === "en" ? "uk" : "en"}" aria-label="${t("Читати українською", "Read in English")}">${lang === "en" ? "UA" : "EN"}</button>
        <button type="button" class="icon-btn" data-action="theme" aria-label="${themeLabel}" title="${themeLabel}">${icon(theme === "night" ? "sun" : "moon")}</button>
        <a class="button button-sm header-subscribe" href="#/subscribe">${t("Get the brief", "Отримувати бриф")}</a>
        <button type="button" class="icon-btn menu-btn" data-action="menu" aria-haspopup="dialog" aria-controls="menu-dialog" aria-label="${t("Open menu", "Відкрити меню")}">${icon("menu")}</button>
      </div>
    </div>
    <div class="nav-row">
      <div class="wrap nav-inner">
        <a class="nav-mark" href="#/home" aria-label="AI Today Brief" tabindex="-1">${markSvg(28)}</a>
        <nav class="nav" aria-label="${t("Main", "Головна навігація")}">
          ${NAV.map(navLink).join("")}
          <div class="nav-cats">
            <button type="button" class="nav-link${section === "categories" ? " active" : ""}" data-action="cats" aria-expanded="false" aria-controls="cats-menu">${l.categories}${icon("chevronDown", 16)}</button>
            <div class="cats-menu" id="cats-menu" hidden><ul>${cats}</ul><a class="cats-all" href="#/categories">${t("All categories", "Усі категорії")} ${icon("arrowRight", 16)}</a></div>
          </div>
          ${navLink("about")}
        </nav>
        <button type="button" class="nav-search" data-action="search">${icon("search", 18)}<span>${t("Search stories, concepts, tools", "Пошук новин, концептів, утиліт")}</span><kbd>Ctrl K</kbd></button>
        <a class="button button-sm nav-subscribe" href="#/subscribe" tabindex="-1">${t("Subscribe", "Підписатися")}</a>
      </div>
    </div>
    ${menuDialog(route)}
  </header>`;
}

function menuDialog(route) {
  const l = labels();
  const section = SECTION_OF[route] || route;
  const items = ["home", ...NAV, "categories", "about", "subscribe"];
  return `<dialog id="menu-dialog" class="sheet" aria-labelledby="menu-title">
    <div class="sheet-head"><h2 id="menu-title">${t("Menu", "Меню")}</h2><button type="button" class="icon-btn" data-action="close-dialog" aria-label="${t("Close menu", "Закрити меню")}">${icon("close")}</button></div>
    <button type="button" class="sheet-search" data-action="search">${icon("search", 18)}<span>${t("Search stories, concepts, tools", "Пошук новин, концептів, утиліт")}</span></button>
    <nav aria-label="${t("Mobile", "Мобільна навігація")}"><ul class="sheet-links">${items.map((r) => `<li><a href="${href(r)}"${section === r ? ' aria-current="page"' : ""}>${l[r]}${icon("arrowRight", 18)}</a></li>`).join("")}</ul></nav>
    <details class="sheet-cats"><summary>${t("Categories", "Категорії")}</summary><ul>${CATEGORIES.map((c) => `<li>${catLink(c)}</li>`).join("")}</ul></details>
    <div class="sheet-foot">
      <button type="button" class="lang-btn" data-action="lang" aria-label="${t("Читати українською", "Read in English")}">${lang === "en" ? "Українська" : "English"}</button>
      <button type="button" class="icon-btn" data-action="theme" aria-label="${theme === "night" ? t("Switch to day theme", "Увімкнути денну тему") : t("Switch to night theme", "Увімкнути нічну тему")}">${icon(theme === "night" ? "sun" : "moon")}</button>
      <a class="button" href="#/subscribe">${t("Get the brief", "Отримувати бриф")} ${icon("arrowRight", 18)}</a>
    </div>
  </dialog>`;
}

function footer() {
  const l = labels();
  const col = (title, items) => `<div class="footer-col"><h2>${title}</h2><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`;
  const social = [
    ["linkedin", "LinkedIn", "https://www.linkedin.com/"],
    ["x", "X", "https://x.com/"],
    ["telegram", "Telegram", "https://t.me/"],
    ["rss", "RSS", "https://aitodaybrief.com/rss.xml"],
  ];
  return `<footer class="footer">
    <div class="wrap footer-grid">
      <div class="footer-brand">
        <a class="wordmark" href="#/home">${markSvg(34)}<span class="wordmark-text">AI Today Brief</span></a>
        <p>${t("The daily AI-engineering brief. Human-edited, source-first. EN · UA.", "Щоденний бриф з AI-інженерії. Людська редактура, джерела на першому місці. EN · UA.")}</p>
        <ul class="social">${social.map(([key, name, url]) => `<li><a href="${url}" target="_blank" rel="noopener" aria-label="${name} (${t("opens in a new tab", "відкриється в новій вкладці")})">${icon(key, 18)}</a></li>`).join("")}</ul>
      </div>
      ${col(t("Explore", "Огляд"), ["news", "digests", "concepts", "guides", "tools", "categories"].map((r) => link(r, l[r])))}
      ${col(t("Company", "Видання"), [link("about", l.about), link("author", l.author), link("subscribe", l.subscribe), link("advertise", l.advertise)])}
      ${col(t("Legal", "Правила"), [link("policy?doc=editorial", t("Editorial policy", "Редакційна політика")), link("policy?doc=ai", t("AI disclosure", "Використання AI")), link("policy?doc=privacy", t("Privacy", "Приватність")), link("policy?doc=terms", t("Terms", "Умови")), `<button type="button" class="link-btn" data-action="consent-open">${t("Cookie settings", "Налаштування cookie")}</button>`])}
    </div>
    <div class="wrap footer-bottom">
      <p>© 2026 AI Today Brief · ${t("All rights reserved.", "Усі права захищено.")}</p>
      <p class="footer-review">${link("saved", l.saved)} · ${link("system", l.system)} · ${link("states", l.states)} · ${link("coverage", l.coverage)} · <a href="#/motion">${l.motion}</a></p>
    </div>
  </footer>`;
}

function newsletter(variant = "band") {
  const proof = [t("One email, 5 minutes", "Один лист, 5 хвилин"), t("Sources on every story", "Джерела в кожному матеріалі"), t("Unsubscribe in one click", "Відписка в один клік")];
  return `<section class="newsletter newsletter-${variant}" aria-labelledby="nl-title-${variant}">
    <div class="newsletter-copy">
      ${eyebrow(t("The morning brief", "Ранковий бриф"))}
      <h2 id="nl-title-${variant}">${t("Make room for <em>perspective.</em>", "Знайдіть час для <em>перспективи.</em>")}</h2>
      <p>${t("A considered AI-engineering briefing in your inbox each morning — what changed, why it matters, one thing to try.", "Вдумливий бриф з AI-інженерії щоранку — що змінилось, чому це важливо, одна річ для практики.")}</p>
      <ul class="proof">${proof.map((p) => `<li>${icon("check", 16)}${p}</li>`).join("")}</ul>
    </div>
    <form class="newsletter-form" data-form="subscribe" novalidate>
      <label for="nl-email-${variant}">${t("Email address", "Email-адреса")}</label>
      <div class="field-row"><input id="nl-email-${variant}" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" aria-describedby="nl-note-${variant} nl-status-${variant}"><button class="button">${t("Get the brief", "Отримувати бриф")}</button></div>
      <p class="field-note" id="nl-note-${variant}">${t("Free. Double opt-in. Read our", "Безкоштовно. Подвійне підтвердження. Див.")} ${link("policy?doc=privacy", t("privacy policy", "політику приватності"))}.</p>
      <p class="form-status" id="nl-status-${variant}" role="status" aria-live="polite"></p>
    </form>
  </section>`;
}

function consentCard() {
  return `<section class="consent" id="consent" aria-labelledby="consent-title" hidden>
    <div class="consent-main">
      <h2 id="consent-title">${icon("shield", 20)}${t("We respect your privacy", "Ми поважаємо вашу приватність")}</h2>
      <p>${t("Essential cookies keep the site working. With your permission we also measure anonymous visits. Marketing measurement stays off unless you enable it.", "Необхідні cookie забезпечують роботу сайту. З вашого дозволу ми також рахуємо анонімні відвідування. Маркетингові вимірювання вимкнені, доки ви їх не ввімкнете.")}</p>
      <div class="consent-actions"><button type="button" class="button" data-action="consent-accept">${t("Accept all", "Прийняти всі")}</button><button type="button" class="button outline" data-action="consent-essential">${t("Essential only", "Лише необхідні")}</button><button type="button" class="button ghost" data-action="consent-manage" aria-expanded="false" aria-controls="consent-panel">${t("Manage", "Налаштувати")}</button></div>
    </div>
    <form class="consent-panel" id="consent-panel" hidden data-form="consent">
      <label class="switch-row"><span><strong>${t("Essential", "Необхідні")}</strong><small>${t("Required for the site to work. Always on.", "Потрібні для роботи сайту. Завжди увімкнені.")}</small></span><input type="checkbox" checked disabled role="switch"></label>
      <label class="switch-row"><span><strong>${t("Analytics", "Аналітика")}</strong><small>${t("Anonymous visit statistics.", "Анонімна статистика відвідувань.")}</small></span><input type="checkbox" name="analytics" role="switch"></label>
      <label class="switch-row"><span><strong>${t("Marketing", "Маркетинг")}</strong><small>${t("Promo performance. Off by default.", "Ефективність промо. Вимкнено за замовчуванням.")}</small></span><input type="checkbox" name="ads" role="switch"></label>
      <p class="field-note">${t("Consent region: EU · UA rules applied.", "Регіон згоди: застосовано правила EU · UA.")} ${link("policy?doc=privacy", t("Privacy policy", "Політика приватності"))}</p>
      <button class="button">${t("Save choices", "Зберегти вибір")}</button>
    </form>
  </section>`;
}

/* ── Router & render ──────────────────────────────────────────────────────── */
const renderers = {};
const onRender = [];
let lastRoute = null;

function render(reset = true) {
  const route = currentRoute();
  const root = document.documentElement;
  root.lang = lang;
  root.dataset.theme = theme;
  root.dataset.route = route;
  const body = (renderers[route] || renderers["404"])();
  document.getElementById("app").innerHTML = `${previewStrip()}${header(route)}<main id="main" tabindex="-1" class="wrap page page-${route}">${body}</main>${footer()}${consentCard()}<div class="progress" aria-hidden="true"></div>`;
  if (reset) window.scrollTo(0, 0);
  if (typeof applySeo === "function") applySeo(route);
  syncConsent();
  onRender.forEach((fn) => fn(route));
  lastRoute = route;
}

/* Route changes cross-fade with the View Transitions API where supported (progressive). */
function navigate() {
  const change = () => {
    activeFilter = "all";
    closeDialogs();
    render();
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.tensionMotion === "off";
  if (document.startViewTransition && !reduce && lastRoute !== null) document.startViewTransition(change);
  else change();
}

function closeDialogs() {
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
}

/* ── Feedback ─────────────────────────────────────────────────────────────── */
function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.dataset.visible = "true";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (toast.dataset.visible = "false"), 2800);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify(t("Copied to clipboard", "Скопійовано"));
    return true;
  } catch {
    notify(t("Clipboard unavailable — select and copy the text.", "Буфер недоступний — виділіть і скопіюйте текст."));
    return false;
  }
}

/* ── Search dialog: grouped results, arrow-key navigation, see-all link ───── */
function searchIndex() {
  return [
    ...NEWS_STORIES.map((s) => ({ type: t("Story", "Новина"), title: L(s.title), text: `${L(s.summary)} ${s.tags.join(" ")}`, route: `article?id=${s.id}`, cat: s.cat })),
    ...CONCEPTS.map((c) => ({ type: t("Concept", "Концепт"), title: c.name, text: L(c.def), route: `concept?slug=${c.slug}` })),
    ...GUIDES.map((g) => ({ type: t("Guide", "Гайд"), title: L(g.title), text: L(g.description), route: `guide?slug=${g.slug}` })),
    ...TOOLS.map((tool) => ({ type: "Toolbox", title: L(tool.title), text: L(tool.desc), route: tool.route })),
  ];
}
function searchMatches(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  return searchIndex()
    .map((item) => ({ item, score: item.title.toLowerCase().includes(query) ? 2 : item.text.toLowerCase().includes(query) ? 1 : 0 }))
    .filter((x) => x.score)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
function searchResultsMarkup(q, limit = 8) {
  const suggestions = ["MCP", "Claude Code", "Prompt caching", "Evals", "Ollama"];
  if (!q.trim())
    return `<div class="search-idle"><p class="eyebrow">${t("Popular", "Популярне")}</p><div class="chip-row">${suggestions.map((s) => `<button type="button" class="chip" data-action="search-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
  const matches = searchMatches(q);
  if (!matches.length)
    return `<div class="empty compact"><h3>${t("No thread found.", "Зв’язку не знайдено.")}</h3><p>${t("Try “MCP”, “context” or a shorter phrase.", "Спробуйте «MCP», «контекст» або коротшу фразу.")}</p></div>`;
  return `<p class="meta" id="search-count">${plural(matches.length, ["result", "results"], ["результат", "результати", "результатів"])}</p><ul class="search-list" role="list">${matches
    .slice(0, limit)
    .map((m) => `<li><a class="search-result" href="${href(m.route)}"><span class="search-type">${m.type}</span><span class="search-title">${esc(m.title)}</span><span class="search-text">${esc(m.text.slice(0, 110))}…</span></a></li>`)
    .join("")}</ul>${matches.length > limit ? `<a class="button outline search-all" href="${href(`search?q=${encodeURIComponent(q)}`)}">${t("See all", "Усі")} ${matches.length} ${icon("arrowRight", 16)}</a>` : ""}`;
}
function openSearch(trigger) {
  const dialog = document.getElementById("search-dialog");
  document.getElementById("search-title").textContent = t("Search the publication", "Пошук у виданні");
  dialog.querySelector("[data-action=close-dialog]").setAttribute("aria-label", t("Close search", "Закрити пошук"));
  const input = document.getElementById("global-search");
  input.placeholder = t("Agents, MCP, caching…", "Агенти, MCP, кешування…");
  input.value = "";
  document.getElementById("search-results").innerHTML = searchResultsMarkup("");
  dialog.returnFocus = trigger || document.activeElement;
  document.getElementById("menu-dialog")?.close();
  dialog.showModal();
  input.focus();
}

/* ── Consent ──────────────────────────────────────────────────────────────── */
function syncConsent() {
  const card = document.getElementById("consent");
  if (!card) return;
  const choice = store.get("atb-after-hours-consent");
  card.hidden = Boolean(choice) || document.documentElement.dataset.qa === "true";
}
function saveConsent(choice, message) {
  store.set("atb-after-hours-consent", { ...choice, at: new Date().toISOString() });
  document.getElementById("consent").hidden = true;
  notify(message);
}

/* ── Actions (event delegation; survives every re-render) ─────────────────── */
const ACTIONS = {
  search: (el) => openSearch(el),
  "search-suggest": (el) => {
    const input = document.getElementById("global-search") ;
    input.value = el.dataset.q;
    input.dispatchEvent(new Event("input"));
    input.focus();
  },
  lang: () => {
    lang = lang === "en" ? "uk" : "en";
    persistPrefs();
    closeDialogs();
    render(false);
  },
  theme: () => {
    theme = theme === "night" ? "day" : "night";
    persistPrefs();
    document.documentElement.dataset.theme = theme;
    const label = theme === "night" ? t("Switch to day theme", "Увімкнути денну тему") : t("Switch to night theme", "Увімкнути нічну тему");
    document.querySelectorAll('[data-action="theme"]').forEach((b) => {
      b.innerHTML = icon(theme === "night" ? "sun" : "moon");
      b.setAttribute("aria-label", label);
      b.title = label;
    });
    notify(theme === "night" ? t("Night reading theme", "Нічна тема читання") : t("Day reading theme", "Денна тема читання"));
  },
  menu: (el) => {
    const dialog = document.getElementById("menu-dialog");
    dialog.returnFocus = el;
    dialog.showModal();
  },
  "close-dialog": (el) => el.closest("dialog")?.close(),
  cats: (el) => {
    const menu = document.getElementById("cats-menu");
    const open = el.getAttribute("aria-expanded") !== "true";
    el.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
    if (open) menu.querySelector("a")?.focus();
  },
  "consent-open": () => {
    const card = document.getElementById("consent");
    card.hidden = false;
    card.querySelector("button")?.focus();
  },
  "consent-accept": () => saveConsent({ analytics: true, ads: true }, t("All cookies accepted", "Усі cookie прийнято")),
  "consent-essential": () => saveConsent({ analytics: false, ads: false }, t("Only essential cookies", "Лише необхідні cookie")),
  "consent-manage": (el) => {
    const panel = document.getElementById("consent-panel");
    panel.hidden = !panel.hidden;
    el.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) panel.querySelector("input:not([disabled])")?.focus();
  },
  "copy-link": () => copy(location.href),
  "copy-text": (el) => copy(document.getElementById(el.dataset.target)?.textContent || ""),
  "inspect-seo": () => typeof openSeoInspector === "function" && openSeoInspector(),
};
const FORMS = {
  subscribe: (form) => {
    const input = form.querySelector('input[type="email"]');
    const status = form.querySelector(".form-status");
    const valid = input.value.trim() && input.checkValidity();
    input.setAttribute("aria-invalid", String(!valid));
    form.dataset.state = valid ? "success" : "error";
    status.textContent = valid
      ? t("Demo: check your inbox to confirm. No email was sent from this prototype.", "Демо: перевірте пошту й підтвердьте. Прототип не надсилає листів.")
      : t("Enter a valid email address, for example you@example.com.", "Введіть коректну адресу, наприклад you@example.com.");
    if (!valid) input.focus();
  },
  consent: (form) => saveConsent({ analytics: form.analytics.checked, ads: form.ads.checked }, t("Cookie choices saved", "Вибір cookie збережено")),
};

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (el && ACTIONS[el.dataset.action] && !el.disabled && el.getAttribute("aria-disabled") !== "true") {
    ACTIONS[el.dataset.action](el, event);
  }
  const cats = document.querySelector('[data-action="cats"][aria-expanded="true"]');
  if (cats && !event.target.closest(".nav-cats")) ACTIONS.cats(cats);
  if (event.target.closest("#search-results a, #menu-dialog a")) closeDialogs();
});
document.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (form && FORMS[form.dataset.form]) {
    event.preventDefault();
    FORMS[form.dataset.form](form, event);
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape") {
    const cats = document.querySelector('[data-action="cats"][aria-expanded="true"]');
    if (cats) {
      ACTIONS.cats(cats);
      cats.focus();
    }
  }
  const list = document.querySelectorAll("#search-results .search-result");
  if (document.getElementById("search-dialog").open && list.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const items = [...list];
    const index = items.indexOf(document.activeElement);
    const next = event.key === "ArrowDown" ? items[Math.min(items.length - 1, index + 1)] : index <= 0 ? document.getElementById("global-search") : items[index - 1];
    next.focus();
  }
});
document.addEventListener("close", (event) => {
  if (event.target.matches?.("dialog") && event.target.returnFocus?.isConnected) event.target.returnFocus.focus();
}, true);
document.getElementById("global-search").addEventListener("input", (e) => {
  document.getElementById("search-results").innerHTML = searchResultsMarkup(e.target.value);
});
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("main").focus();
  document.getElementById("main").scrollIntoView();
});
/* Close a dialog by clicking its backdrop. */
document.addEventListener("mousedown", (event) => {
  if (event.target.matches?.("dialog[open]")) {
    const box = event.target.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) event.target.close();
  }
});
window.addEventListener("hashchange", navigate);
window.addEventListener(
  "scroll",
  () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const bar = document.querySelector(".progress");
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  },
  { passive: true },
);
/* Sticky nav: reveal the compact mark once the masthead row (≈120px) has scrolled away. */
(() => {
  const sentinel = document.createElement("div");
  sentinel.className = "header-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  document.body.prepend(sentinel);
  new IntersectionObserver(([entry]) => document.documentElement.toggleAttribute("data-scrolled", !entry.isIntersecting && entry.boundingClientRect.top < 0)).observe(sentinel);
})();

/* QA hook: deterministic theme/lang without touching storage or showing the consent card. */
window.__qaSet = ({ theme: nextTheme, lang: nextLang }) => {
  document.documentElement.dataset.qa = "true";
  if (nextTheme) theme = nextTheme;
  if (nextLang) lang = nextLang;
  render(false);
};
