/* After Hours prototype v3 — per-route SEO contract.
   The prototype itself stays noindex (index.html). This module demonstrates, per layout, the exact
   head and JSON-LD the production route must emit: title, description, canonical/hreflang on the
   real /en|/uk paths, Open Graph and a schema.org graph that matches src/app/[lang]/** today. */

const SITE_URL = "https://aitodaybrief.com";
const ORG_ID = `${SITE_URL}/#org`;
const PERSON_ID = `${SITE_URL}/#editor`;
const slugify = (text) => String(text).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* Production path for the current prototype route (without the /{lang} prefix). */
function productionPath(route) {
  const p = parseHash().params;
  const story = NEWS_STORIES.find((s) => s.id === p.get("id"));
  const variantPath = { analysis: "/news/agents-and-mcp/the-agent-era-needs-a-better-memory", technical: "/news/token-and-cost-optimization/prompt-caching-beyond-the-price-tag", evidence: "/news/models-and-research/a-benchmark-is-a-starting-point" };
  const issue = WEEKLY_ISSUES[0];
  const edition = DAILY_EDITIONS.find((e) => e.iso === p.get("date")) || DAILY_EDITIONS[0];
  const map = {
    home: "",
    news: "/news",
    article: story ? `/news/${story.cat}/${story.id}` : variantPath[p.get("variant")] || variantPath.analysis,
    digests: "/digests",
    daily: `/${slugify(L(edition.title))}-${edition.iso}`,
    weekly: `/weekly/${slugify(issue.title.en)}-${issue.end}`,
    concepts: "/concepts",
    concept: `/concepts/${p.get("slug") || "mcp"}`,
    guides: "/guides",
    guide: `/guides/${p.get("slug") || GUIDES[0].slug}`,
    tools: "/tools",
    tool: "/tools/prompt-optimizer",
    settings: "/tools/settings-builder",
    instructions: "/tools/claude-md-generator",
    categories: "/categories",
    category: `/category/${p.get("c") || CATEGORIES[0].id}`,
    about: "/about",
    author: "/author",
    subscribe: "/subscribe",
    search: `/news/search${p.get("q") ? `?q=${encodeURIComponent(p.get("q"))}` : ""}`,
    saved: "/saved",
    advertise: "/advertise",
    policy: { editorial: "/editorial-policy", ai: "/ai-disclosure", privacy: "/privacy", terms: "/terms" }[p.get("doc")] || "/editorial-policy",
  };
  return map[route] ?? null;
}

const orgNode = () => ({ "@type": "Organization", "@id": ORG_ID, name: "AI Today Brief", url: `${SITE_URL}/${lang}`, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 }, sameAs: ["https://www.linkedin.com/company/ai-today-brief", "https://t.me/aitodaybrief", "https://x.com/aitodaybrief"] });
const personNode = () => ({ "@type": "Person", "@id": PERSON_ID, name: L(EDITOR.name), jobTitle: L(EDITOR.role), url: `${SITE_URL}/${lang}/author`, worksFor: { "@id": ORG_ID } });
const crumbsNode = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, ...(path != null ? { item: `${SITE_URL}/${lang}${path}` } : {}) })) });
const itemList = (items) => ({ "@type": "ItemList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, url: `${SITE_URL}/${lang}${path}` })) });
const faqNode = (pairs) => ({ "@type": "FAQPage", mainEntity: pairs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
const storyPath = (s) => `/news/${s.cat}/${s.id}`;

function seoFor(route) {
  const path = productionPath(route);
  const url = path == null ? null : `${SITE_URL}/${lang}${path}`;
  const home = [t("Home", "Головна"), ""];
  const p = parseHash().params;
  const base = { title: `${labels()[route]} · AI Today Brief`, description: t("Daily AI-engineering brief for developers, founders and tech leads.", "Щоденний бриф з AI-інженерії для розробників, фаундерів і техлідів."), type: "website", graph: [] };
  const story = NEWS_STORIES.find((s) => s.id === p.get("id"));
  const concept = CONCEPTS.find((c) => c.slug === (p.get("slug") || "mcp"));
  const guide = GUIDES.find((g) => g.slug === p.get("slug")) || GUIDES[0];
  const cat = catById(p.get("c") || CATEGORIES[0].id);
  const issue = WEEKLY_ISSUES[0];
  const edition = DAILY_EDITIONS.find((e) => e.iso === p.get("date")) || DAILY_EDITIONS[0];
  const tool = TOOLS.find((x) => x.route === route);
  const specific = {
    home: () => ({
      title: t("AI Today Brief — AI news for developers in 5 minutes a day", "AI Today Brief — AI-новини для розробників за 5 хвилин на день"),
      description: t("Daily AI-engineering brief for developers, founders and tech leads. We read 120+ sources and publish only what matters, in English and Ukrainian.", "Щоденний бриф з AI-інженерії для розробників, фаундерів і техлідів. Читаємо 120+ джерел і публікуємо лише важливе — англійською та українською."),
      graph: [orgNode(), personNode(), { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "AI Today Brief", url: `${SITE_URL}/${lang}`, inLanguage: ["en", "uk"], publisher: { "@id": ORG_ID }, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/${lang}/news/search?q={search_term_string}` }, "query-input": "required name=search_term_string" } }, itemList(NEWS_STORIES.slice(0, 5).map((s) => [L(s.title), storyPath(s)])), faqNode(HOME_FAQ.map((f) => [L(f.q), L(f.a)]))],
    }),
    news: () => ({
      title: t("AI news for developers — filter, search and sort · AI Today Brief", "AI-новини для розробників — фільтри, пошук, сортування · AI Today Brief"),
      description: t("Every AI-engineering story with sources and a “why it matters” note: filter by category, period and topic.", "Усі новини AI-інженерії з джерелами й поясненням «чому це важливо»: фільтри за категорією, періодом і темою."),
      graph: [{ "@type": "CollectionPage", name: t("All news", "Усі новини"), url, inLanguage: lang, isPartOf: { "@id": `${SITE_URL}/#website` } }, itemList(NEWS_STORIES.slice(0, 10).map((s) => [L(s.title), storyPath(s)])), crumbsNode([home, [t("News", "Новини"), null]])],
    }),
    article: () => {
      const s = story || NEWS_STORIES[0];
      const headline = story ? L(s.title) : articleVariantCards().find((c) => c.id === currentArticleVariant()).title;
      return {
        type: "article",
        title: `${headline} · AI Today Brief`,
        description: story ? L(s.summary) : articleVariantCards().find((c) => c.id === currentArticleVariant()).description,
        graph: [{ "@type": "NewsArticle", headline, description: story ? L(s.summary) : undefined, image: [`${SITE_URL}/${lang}${path}/opengraph-image`], datePublished: `${s.date}T${s.time}:00+03:00`, dateModified: `${s.date}T${s.time}:00+03:00`, inLanguage: lang, isAccessibleForFree: true, url, mainEntityOfPage: url, author: { "@id": PERSON_ID }, publisher: { "@id": ORG_ID }, articleSection: L(catById(s.cat).name), keywords: s.tags.join(", "), citation: [{ "@type": "CreativeWork", name: s.source, url: "https://example.com/" }] }, personNode(), orgNode(), crumbsNode([home, [t("News", "Новини"), "/news"], [L(catById(s.cat).name), `/category/${s.cat}`], [headline, null]])],
      };
    },
    digests: () => ({
      title: t("AI digests archive — daily briefs and weekly editions · AI Today Brief", "Архів AI-дайджестів — щоденні брифи й тижневі випуски · AI Today Brief"),
      description: t("Every daily brief and weekly AI-engineering edition in one archive. Five-minute dailies, long-read weeklies with PDF and video.", "Усі щоденні брифи й тижневі випуски в одному архіві. П’ятихвилинні daily і тижневі long read із PDF та відео."),
      graph: [{ "@type": "CollectionPage", name: t("Digests", "Дайджести"), url, inLanguage: lang }, itemList([...WEEKLY_ISSUES.slice(0, 2).map((w) => [L(w.title), `/weekly/${slugify(w.title.en)}-${w.end}`]), ...DAILY_EDITIONS.slice(0, 5).map((e) => [L(e.title), `/${slugify(L(e.title))}-${e.iso}`])]), crumbsNode([home, [t("Digests", "Дайджести"), null]])],
    }),
    daily: () => ({
      title: `${L(edition.title)} — ${t("AI brief", "AI-бриф")} ${fmtDate(edition.iso)} · AI Today Brief`,
      description: t(`The AI-engineering brief for ${fmtDate(edition.iso)}: ${edition.items} stories, why each matters and one thing to try.`, `AI-бриф за ${fmtDate(edition.iso)}: ${edition.items} історій, чому кожна важлива, і одна річ для практики.`),
      type: "article",
      graph: [{ "@type": "CollectionPage", name: L(edition.title), url, datePublished: `${edition.iso}T07:00:00+03:00`, inLanguage: lang, isPartOf: { "@id": `${SITE_URL}/#website` }, mainEntity: itemList(NEWS_STORIES.slice(0, 6).map((s) => [L(s.title), storyPath(s)])) }, crumbsNode([home, [t("Digests", "Дайджести"), "/digests"], [fmtDate(edition.iso), null]])],
    }),
    weekly: () => ({
      type: "article",
      title: `${L(issue.title)} — ${t("Weekly AI digest", "Тижневий AI-дайджест")} ${numero()}${issue.no} · AI Today Brief`,
      description: L(issue.dek),
      graph: [{ "@type": "NewsArticle", headline: L(issue.title), description: L(issue.dek), datePublished: `${issue.published}T16:00:00+03:00`, dateModified: `${issue.published}T16:00:00+03:00`, url, mainEntityOfPage: url, inLanguage: lang, author: { "@id": PERSON_ID }, publisher: { "@id": ORG_ID }, image: [`${SITE_URL}/${lang}${path}/opengraph-image`], associatedMedia: { "@type": "MediaObject", name: "PDF", encodingFormat: "application/pdf", contentUrl: `${SITE_URL}/${lang}${path}/download` } }, faqNode([[t("What changed for coding agents this week?", "Що змінилося для кодинг-агентів цього тижня?"), t("Delegation and memory boundaries moved into mainstream tools.", "Делегування й межі пам’яті з’явилися в основних інструментах.")], [t("Is prompt caching worth it for small teams?", "Чи варте prompt caching малим командам?"), t("If one workflow repeats daily, yes.", "Якщо один процес повторюється щодня — так.")]]), { "@type": "VideoObject", name: t("This week in AI — video briefing", "Цей тиждень в AI — відеобрифінг"), description: L(issue.dek), uploadDate: `${issue.published}T16:00:00+03:00`, duration: "PT4M12S", thumbnailUrl: `${SITE_URL}/${lang}${path}/opengraph-image`, embedUrl: "https://www.youtube-nocookie.com/embed/VIDEO_ID" }, crumbsNode([home, [t("Digests", "Дайджести"), "/digests"], [`${numero()} ${issue.no}`, null]])],
    }),
    concepts: () => ({
      title: t("AI engineering concepts, explained · AI Today Brief", "Концепти AI-інженерії простою мовою · AI Today Brief"),
      description: t(`${CONCEPTS.length} plain-language explainers — agents, MCP, prompt caching, RAG and more — each verified against official documentation.`, `${CONCEPTS.length} пояснень простою мовою — агенти, MCP, prompt caching, RAG та інше — звірені з офіційною документацією.`),
      graph: [{ "@type": "CollectionPage", name: t("Concepts", "Концепти"), url, inLanguage: lang }, { "@type": "DefinedTermSet", "@id": `${url}#terms`, name: t("AI engineering glossary", "Глосарій AI-інженерії"), hasDefinedTerm: CONCEPTS.slice(0, 12).map((c) => ({ "@type": "DefinedTerm", name: c.name, description: L(c.def), url: `${SITE_URL}/${lang}/concepts/${c.slug}` })) }, crumbsNode([home, [t("Concepts", "Концепти"), null]])],
    }),
    concept: () => ({
      type: "article",
      title: `${concept.name}: ${t("what it is and how it works", "що це і як працює")} · AI Today Brief`,
      description: `${concept.name} — ${L(concept.def)}`.slice(0, 158),
      graph: [{ "@type": "TechArticle", headline: concept.name, description: L(concept.def), dateModified: concept.verifiedAt, url, inLanguage: lang, author: { "@id": PERSON_ID }, publisher: { "@id": ORG_ID }, about: { "@type": "DefinedTerm", name: concept.name, description: L(concept.def), inDefinedTermSet: `${SITE_URL}/${lang}/concepts#terms` } }, faqNode([[t(`What is ${concept.name}?`, `Що таке ${concept.name}?`), L(concept.def)]]), crumbsNode([home, [t("Concepts", "Концепти"), "/concepts"], [concept.name, null]])],
    }),
    guides: () => ({
      title: t("Guides: living AI-engineering references · AI Today Brief", "Гайди: живі довідники AI-інженерії · AI Today Brief"),
      description: t("Comparisons and a reproducible agent benchmark, re-verified on a schedule. The date on every guide is the trust signal.", "Порівняння й відтворюваний бенчмарк агентів, що регулярно перевіряються. Дата на кожному гайді — сигнал довіри."),
      graph: [{ "@type": "CollectionPage", name: t("Guides", "Гайди"), url, inLanguage: lang, publisher: { "@id": ORG_ID } }, itemList(GUIDES.map((g) => [L(g.title), `/guides/${g.slug}`])), crumbsNode([home, [t("Guides", "Гайди"), null]])],
    }),
    guide: () => ({
      type: "article",
      title: `${L(guide.title)} · AI Today Brief`,
      description: L(guide.description).slice(0, 158),
      graph: [{ "@type": "TechArticle", headline: L(guide.title), description: L(guide.description), dateModified: guide.lastVerified, datePublished: "2026-06-11", url, inLanguage: lang, author: { "@id": PERSON_ID }, publisher: { "@id": ORG_ID } }, crumbsNode([home, [t("Guides", "Гайди"), "/guides"], [L(guide.title), null]])],
    }),
    tools: () => ({
      title: t("AI Toolbox: free local-first utilities · AI Today Brief", "AI Toolbox: безкоштовні local-first утиліти · AI Today Brief"),
      description: t("A prompt optimizer, a Claude Code settings.json builder and a CLAUDE.md / AGENTS.md generator. Everything runs in your browser.", "Оптимізатор промптів, білдер settings.json для Claude Code і генератор CLAUDE.md / AGENTS.md. Усе працює у браузері."),
      graph: [{ "@type": "CollectionPage", name: "Toolbox", url, inLanguage: lang, publisher: { "@id": ORG_ID } }, itemList(TOOLS.map((x) => [L(x.full), productionPathFor(x.route)])), crumbsNode([home, ["Toolbox", null]])],
    }),
    categories: () => ({
      title: t("Explore AI news by topic · AI Today Brief", "AI-новини за темами · AI Today Brief"),
      description: t("Nine editorial categories — agents & MCP, tools, models & research, cost optimization and more — sized by recent coverage.", "Дев’ять редакційних рубрик — агенти й MCP, інструменти, моделі, оптимізація витрат та інше — за обсягом покриття."),
      graph: [{ "@type": "CollectionPage", name: t("Categories", "Категорії"), url, inLanguage: lang }, itemList(CATEGORIES.map((c) => [L(c.name), `/category/${c.id}`])), crumbsNode([home, [t("Categories", "Категорії"), null]])],
    }),
    category: () => ({
      title: `${L(cat.name)} — ${t("AI news and explainers", "AI-новини та пояснення")} · AI Today Brief`,
      description: L(cat.desc),
      graph: [{ "@type": "CollectionPage", name: L(cat.name), description: L(cat.desc), url, inLanguage: lang, isPartOf: { "@id": `${SITE_URL}/#website` } }, itemList(NEWS_STORIES.filter((s) => s.cat === cat.id).map((s) => [L(s.title), storyPath(s)])), crumbsNode([home, [t("Categories", "Категорії"), "/categories"], [L(cat.name), null]])],
    }),
    about: () => ({ title: t("About AI Today Brief", "Про AI Today Brief"), description: t("A human-edited AI-engineering publication. How stories are selected, who edits them and how AI is used.", "Видання з людською редактурою. Як відбираються матеріали, хто редагує і як використовується AI."), graph: [{ "@type": "AboutPage", name: t("About", "Про нас"), url, inLanguage: lang, mainEntity: { "@id": ORG_ID } }, orgNode(), personNode(), crumbsNode([home, [t("About", "Про нас"), null]])] }),
    author: () => ({ title: `${L(EDITOR.name)} — ${t("Editor", "Редактор")} · AI Today Brief`, description: t("Editor of AI Today Brief: coverage focus, editorial standards and recent stories.", "Редактор AI Today Brief: фокус висвітлення, стандарти й останні матеріали."), graph: [{ "@type": "ProfilePage", url, inLanguage: lang, mainEntity: { "@id": PERSON_ID } }, personNode(), crumbsNode([home, [t("About", "Про нас"), "/about"], [L(EDITOR.name), null]])] }),
    subscribe: () => ({ title: t("Subscribe to the daily AI brief · AI Today Brief", "Підписка на щоденний AI-бриф · AI Today Brief"), description: t("One focused email a day: the AI-engineering stories that matter, why they matter, one thing to try. Free; unsubscribe anytime.", "Один лист на день: важливі новини AI-інженерії, чому вони важливі, одна річ для практики. Безкоштовно."), graph: [{ "@type": "WebPage", name: t("Subscribe", "Підписка"), url, inLanguage: lang, isPartOf: { "@id": `${SITE_URL}/#website` } }] }),
    search: () => ({ title: `${p.get("q") ? `“${p.get("q")}” — ` : ""}${t("Search", "Пошук")} · AI Today Brief`, description: t("Search AI Today Brief stories, concepts, guides and tools.", "Пошук матеріалів, концептів, гайдів і утиліт AI Today Brief."), robots: "noindex,follow", graph: [] }),
    saved: () => ({ title: `${t("Reading list", "Збережене")} · AI Today Brief`, robots: "noindex,nofollow", graph: [] }),
    advertise: () => ({ title: t("Advertise with AI Today Brief", "Реклама в AI Today Brief"), description: t("Native, clearly disclosed placements for products developers use. One sponsor per issue.", "Нативні, чітко позначені розміщення для продуктів розробників. Один спонсор на випуск."), graph: [{ "@type": "WebPage", name: t("Advertise", "Реклама"), url, inLanguage: lang }] }),
    policy: () => ({ title: `${t("Editorial & legal", "Політики")} · AI Today Brief`, description: t("Editorial policy, AI disclosure, privacy and terms of AI Today Brief.", "Редакційна політика, використання AI, приватність і умови AI Today Brief."), graph: [{ "@type": "WebPage", url, inLanguage: lang }, crumbsNode([home, [t("Policies", "Політики"), null]])] }),
  };
  const extra = specific[route] ? specific[route]() : { robots: "noindex,nofollow", title: `${labels()[route] || "404"} · After Hours prototype` };
  const toolExtra = tool
    ? { title: `${L(tool.full)} · AI Today Brief`, description: L(tool.desc), graph: [{ "@type": "WebApplication", name: L(tool.full), description: L(tool.desc), url, applicationCategory: "DeveloperApplication", operatingSystem: "Any (web browser)", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, dateModified: tool.lastVerified, publisher: { "@id": ORG_ID } }, crumbsNode([home, ["Toolbox", "/tools"], [L(tool.title), null]])] }
    : {};
  return { ...base, robots: "index,follow", url, ...extra, ...toolExtra, path };
}
const productionPathFor = (route) => ({ tool: "/tools/prompt-optimizer", settings: "/tools/settings-builder", instructions: "/tools/claude-md-generator" })[route];

function setMeta(selector, create, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(create);
    document.head.append(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function applySeo(route) {
  const seo = seoFor(route);
  applySeo.current = seo;
  document.title = seo.title;
  setMeta('meta[name="description"]', "meta", { name: "description", content: seo.description || "" });
  setMeta('meta[property="og:title"]', "meta", { property: "og:title", content: seo.title });
  setMeta('meta[property="og:description"]', "meta", { property: "og:description", content: seo.description || "" });
  setMeta('meta[property="og:type"]', "meta", { property: "og:type", content: seo.type });
  setMeta('meta[property="og:locale"]', "meta", { property: "og:locale", content: lang === "uk" ? "uk_UA" : "en_US" });
  setMeta('meta[name="twitter:card"]', "meta", { name: "twitter:card", content: "summary_large_image" });
  if (seo.url) {
    setMeta('link[rel="canonical"]', "link", { rel: "canonical", href: seo.url });
    setMeta('meta[property="og:url"]', "meta", { property: "og:url", content: seo.url });
    ["en", "uk", "x-default"].forEach((code) => setMeta(`link[rel="alternate"][hreflang="${code}"]`, "link", { rel: "alternate", hreflang: code, href: `${SITE_URL}/${code === "x-default" ? "en" : code}${seo.path}` }));
  } else {
    document.head.querySelectorAll('link[rel="canonical"],link[rel="alternate"][hreflang],meta[property="og:url"]').forEach((el) => el.remove());
  }
  const graph = seo.graph.filter(Boolean);
  let script = document.getElementById("route-jsonld");
  // noindex and artifact-only routes emit no structured data at all (not an empty "{}" block).
  if (!graph.length) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "route-jsonld";
    document.head.append(script);
  }
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

/* Review surface: what production must emit for this layout. */
function openSeoInspector() {
  const seo = applySeo.current || seoFor(currentRoute());
  const h1 = document.querySelectorAll("#main h1").length;
  const types = (seo.graph || []).map((n) => n && n["@type"]).filter(Boolean);
  const checks = [
    [t("Title 30–65 characters", "Title 30–65 символів"), seo.title.length >= 30 && seo.title.length <= 65, `${seo.title.length}`],
    [t("Description 70–160 characters", "Description 70–160 символів"), (seo.description || "").length >= 70 && (seo.description || "").length <= 160, `${(seo.description || "").length}`],
    [t("Exactly one H1", "Рівно один H1"), h1 === 1, `${h1}`],
    [t("Canonical + hreflang en/uk/x-default", "Canonical + hreflang en/uk/x-default"), Boolean(seo.url), seo.url ? "3" : "—"],
    [t("Structured data", "Структуровані дані"), types.length > 0 || seo.robots.startsWith("noindex"), types.join(", ") || "—"],
  ];
  let dialog = document.getElementById("seo-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "seo-dialog";
    dialog.className = "sheet sheet-right seo-dialog";
    dialog.setAttribute("aria-labelledby", "seo-title");
    document.body.append(dialog);
  }
  dialog.innerHTML = `<div class="sheet-head"><h2 id="seo-title">${t("SEO & schema contract", "Контракт SEO і schema")}</h2><button type="button" class="icon-btn" data-action="close-dialog" aria-label="${t("Close", "Закрити")}">${icon("close")}</button></div><div class="sheet-body">
    <p class="notice">${icon("info", 18)}${t("The prototype is noindex. Below is what the production route must emit.", "Прототип має noindex. Нижче — що має віддавати production-маршрут.")}</p>
    <dl class="seo-list"><div><dt>Title</dt><dd>${esc(seo.title)}</dd></div><div><dt>Description</dt><dd>${esc(seo.description || "—")}</dd></div><div><dt>Canonical</dt><dd><code>${esc(seo.url || "— (prototype only)")}</code></dd></div><div><dt>Robots</dt><dd><code>${seo.robots}</code></dd></div><div><dt>Open Graph</dt><dd><code>og:type=${seo.type}</code></dd></div></dl>
    <ul class="seo-checks">${checks.map(([label, ok, value]) => `<li class="${ok ? "ok" : "warn"}">${icon(ok ? "check" : "alert", 16)}<span>${label}</span><code>${esc(value)}</code></li>`).join("")}</ul>
    <p class="rail-title">JSON-LD</p><pre class="output-code" tabindex="0">${esc(JSON.stringify({ "@context": "https://schema.org", "@graph": seo.graph }, null, 2))}</pre></div>`;
  dialog.returnFocus = document.activeElement;
  dialog.showModal();
}
