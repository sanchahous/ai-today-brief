# AI Today Brief — повний аудит проекту і план виходу на рівень професійного порталу

**Дата:** 2026-06-10 · **Статус:** завершений аудит (pipeline + БД + фронтенд + конкуренти)
**Дані:** код у репозиторії, прод-база Supabase (`ai-news-scrapper`), дослідження ринку.

---

## 0. Executive summary

Поточний рівень: **солідний MVP (~45–55% від «професійного порталу»)**. Архітектурний фундамент сильний — кращий, ніж здається власнику: схема БД глибока (двомовність, embeddings, editorial workflow через Telegram, монетизаційний каркас), SEO-база на місці (sitemap, news-sitemap, JSON-LD, hreflang, RSS), pipeline має retry/ідемпотентність/дедуплікацію.

**Три кореневі проблеми, які тримають продукт на рівні «ще один AI-дайджест»:**

1. **Контент генерується із ЗАГОЛОВКІВ, а не з тексту джерел.** LLM ніколи не бачить оригінальну статтю — тільки title + URL. Звідси «суха» внутрішня сторінка: generic-текст без цифр, цін, прикладів коду, без того, «що взяти і застосувати». Це і ризик галюцинацій, і нульова додана цінність по Google scaled-content-abuse.
2. **Нуль візуального контенту.** Жодного зображення в статтях (немає навіть колонки `image_url`), немає код-блоків, таблиць, діаграм, OG-карток. Стаття = стіна тексту.
3. **Немає Experience/E-E-A-T-шару.** Немає «ми протестували», немає авторського вердикту, немає фірмового бенчмарку, сторінки автора. Це те, що відрізняє Simon Willison від MarkTechPost.

**Вердикт:** не треба переписувати проект. Треба (а) добудувати pipeline до «top-tier» — повнотекстовий fetch + структурований rich-контент + зображення, (б) перезібрати шаблон статті, (в) додати людський 15-хвилинний шар на топ-новину дня. План нижче, у 4 фази.

---

## 1. Аудит pipeline (поточний стан)

### 1.1 Архітектура (як є)

```
fetch (InBrief RPC + HN Algolia ×11 запитів + Reddit ×7 + RSS fallback ×11)
  → дедуп по URL, вікно 24h
rank (кластеризація Jaro/Jaccard + скоринг: velocity .30 / cross-source .22 /
      authority .18 / recency .15 / inbrief .10 / breadth .05; анти-клікбейт)
select (поріг score, кап 2/тему, пул ~16)
semantic dedup (gemini-embedding-001, 768d, проти опублікованих, cosine ≤ 0.20)
summarize (Gemini flash → pro → OpenRouter fallback; JSON-схема:
           title/summary/why/deep_dive/takeaways/action_items/social_hook ×2 мови)
publish (upsert articles → briefs draft → brief_items → embeddings
         → Telegram review-картки ✅/❌ → людина тисне Publish → revalidate)
```

Запуск: GitHub Actions, 6 прогонів/день кожні 4 год, 6 retry-слотів по 30 хв.

### 1.2 Що зроблено добре
- Чистий потік даних, typed-структури між етапами, ідемпотентність по даті.
- Retry + exponential backoff скрізь; черга моделей Gemini + OpenRouter fallback.
- Семантична дедуплікація між днями через pgvector.
- Editorial gate ІСНУЄ: Telegram-картки (approve/reject/publish + revalidate шляхів) — це вже краще, ніж у більшості малих AI-сайтів.
- `item_reviews` — датасет рішень редактора (золото для майбутнього fine-tuning ранкера).

### 1.3 Критичні слабкості (топ-10, за пріоритетом)

| # | Проблема | Де | Чому критично |
|---|---|---|---|
| 1 | **LLM пише з заголовків, без тексту джерела** | `pipeline/summarize.ts` (промпт отримує тільки title+URL) | Генерик-контент, галюцинації, нуль доданої цінності. Підтверджено в БД: deep_dive по Nemotron — vendor-fluff без жодної цифри |
| 2 | **Velocity=0 для first-party джерел** | `rank.ts` | Офіційний пост Anthropic (authority 1.0) програє шумному HN-треду. Релізи можна пропустити, якщо їх не розігнали соцмережі |
| 3 | **Немає зображень/медіа взагалі** | весь pipeline + схема | Немає навіть og:image fetch. Стаття і соц-шеринг «голі» |
| 4 | **Внутрішньоденна дедуплікація відсутня** | `run-daily.ts` (dedup тільки проти published) | 6 прогонів/день можуть повторити той самий сюжет у різних брифах |
| 5 | **Silent source failure** | `fetch.ts` (THIN_PRIMARY_THRESHOLD=10) | InBrief впав → пул тихо наповнюється RSS-шумом, ніхто не дізнається |
| 6 | **Немає fact-check проходу** | summarize | Жодної перевірки фактів проти джерела перед публікацією |
| 7 | **UK-переклад без валідації мови** | `summarize.ts` (fallback `_uk = _en`) | Може опублікуватись англійська під виглядом української |
| 8 | **Кластеризація under-merge** | `rank.ts`/`text.ts` («outage» vs «is down» = різні кластери) | Дублікати в пулі, LLM мусить розгрібати |
| 9 | **Немає cost-tracking LLM-викликів** | logging | Невідома собівартість прогону |
| 10 | **Безлад у назвах джерел** | БД: `Hacker News`/`HackerNews`, `x.com`/`X.com`, `NVIDIA Blog`/`Nvidia Blog` | Ламає authority-скоринг (lookup по назві!) і фільтри на сайті |

### 1.4 Цільовий «top-tier» pipeline (архітектура)

```
fetch (як є + нові first-party джерела: Anthropic/OpenAI/Google changelog-и,
       GitHub releases API для Claude Code/Cursor/MCP-екосистеми)
  → source health tracking (per-run метрика доступності + Telegram alert)
rank (як є + сигнал official-source: authority ≥0.9 → velocity-бонус)
select → semantic dedup (+ дедуп проти ВСІХ items дня, не лише published)
★ ENRICH (НОВИЙ ЕТАП): для топ-8 кандидатів fetch повного тексту
   (HTML → readability-екстракція; GitHub README; HN-коментарі топ-5)
   + og:image джерела → завантаження в Supabase Storage
summarize v2 (вхід: ПОВНИЙ ТЕКСТ + реакції спільноти; вихід: rich-структура —
   markdown body з підзаголовками, code_snippet, числа/ціни таблицею,
   when_to_use / when_not_to_use, citations[])
★ VERIFY (НОВИЙ ЕТАП): другий LLM-прохід «кожне твердження є в джерелі?»
   → items з провалом → review_comment для редактора
publish (як є + OG-image генерація через next/og + intra-day dedup)
telegram review (як є + кнопка «✍️ Edit» → редактор додає свій вердикт/тест)
```

Оцінка вартості ENRICH: +5–8 повнотекстових fetch на прогін — копійки; +1 LLM-виклик більшого контексту — приблизно ×2–3 поточної вартості summarize. Це найдешевший важіль якості з усіх можливих.

---

## 2. Аудит контенту в БД (прод, 2026-06-10)

### 2.1 Цифри
- `articles`: **1 763** зібрано → `brief_items`: **112** (конверсія 6,4% — нормальна селективність)
- `briefs`: 18 (17 published, 1 draft) за 16 днів — **темп ~1 бриф/день, ~7 items/день**
- Review: 109 approved / 2 rejected / 1 pending — **редактор майже все апрувить** (gate працює формально, але не фільтрує)
- `deep_dive_en`: у середньому **1 771 знак (~280 слів)** — тонко для «глибокого розбору»
- **101/109 items без action_items** (LLM повертає `[]`, бо з заголовка нема з чого писати кроки)
- **0/109 з youtube_url**, 7/109 без social_hook
- UK-переклад: справжній і якісний (вибірково перевірено; 0 випадків `title_uk == title_en`)

### 2.2 Якісна оцінка (вибірка)
- **Хороший приклад:** OpenRouter free-tier item — конкретні цифри (50→1000 запитів, $10, endpoint `/api/v1/key`). Так виглядає цінний контент.
- **Поганий приклад:** Nemotron-3 8B — «represents a significant step forward», «state-of-the-art performance in its size class» — переказ пресрелізу без жодного бенчмарку, ціни чи команди запуску. Це той самий AI-slop, який Google навчився знецінювати.
- Розподіл категорій здоровий (agents-and-mcp 24, tools 19, vibe-coding 18…), але `tutorials-and-guides` всього 3 — а саме туторіали найкраще шеряться.
- Джерела: HN 35 + GitHub 26 домінують; first-party блоги (Anthropic/OpenAI/NVIDIA/DeepMind) — разом ~4 items. Підтверджує проблему №2 з pipeline.

### 2.3 Висновок по контенту
Контент **консистентний, двомовний, структурований** — це вже вище середнього. Але він **інформує, а не озброює**: читач дізнається «що сталося», та не отримує «що мені з цим робити сьогодні» (ціни, код, when-to-use, підводні камені). Це прямий наслідок headline-only pipeline, а не промпта.

---

## 3. Внутрішня сторінка новини (головний фронт робіт)

### 3.1 Як є (`src/app/[lang]/[brief]/[item]/page.tsx` + `story-body.tsx`)
Breadcrumbs → CategoryBadge → H1 → meta-рядок → Byline → AI-disclosure → **декоративний** CategoryBanner → lead → impact → «why it matters» (border-left) → deep_dive як plain-параграфи → action items → takeaways (нумеровані) → tools-чіпи → source link → share → related (4) → newsletter.

Кістяк правильний. Але: **нуль зображень, нуль код-блоків, нуль таблиць, нуль підзаголовків** у тілі; відео-поле є в БД — не рендериться; немає prev/next, TOC, pull quotes, зовнішніх лінків у тексті, реакцій спільноти.

### 3.2 Цільовий шаблон статті (за анатомією Willison/The Decoder/Rundown)

```
HERO: справжнє зображення (og:image джерела / скріншот / генерована картка)
TL;DR: 3–5 буллетів (вже є takeaways — підняти вгору, перейменувати)
FACTS BOX: таблиця цифр — ціна $/1M токенів, context window, ліміти, дата, доступність
BODY (markdown!): підзаголовки h3, bold, inline-code, цитати
TRY IT: код-блок «спробувати за 2 хвилини» (curl / npm / конфіг Cursor·Claude Code)
WHEN TO USE / WHEN NOT: 3+3 буллети (чесне «не беріть для X» = довіра)
EDITOR'S TAKE: 2–4 речення людського вердикту (іменний, з фото) ← НЕ генерується
COMMUNITY: 2–3 цитати з HN/Reddit з лінками
SOURCES: первинні джерела блоком (пост, model card, GitHub, docs)
RELATED: як є + prev/next навігація
```

Кожен блок — опціональний (рендер тільки якщо поле заповнене), щоб новини різного калібру не виглядали розтягнутими. Для цього в `brief_items` потрібні нові поля: `body_md` (markdown замість plain deep_dive), `facts` (jsonb), `code_snippet` (jsonb: lang+code+caption), `when_to_use`/`when_not_to_use` (jsonb), `community_reactions` (jsonb), `editor_take` (text), `image_url`, `citations` (jsonb).

### 3.3 Список новин + головна (коротко)
**Працює:** сайдбар фільтрів (sort/category/date/trending), facet-каунти, мобільний drawer, пагінація, скелетони, GA4-події.
**Додати:** (P1) превʼю-зображення на картках замість 92×92 категорійної іконки; інтеграція header-search у /news із live-dropdown; (P2) infinite scroll, drawer збережених, read-progress bar, prev/next.
**Головна:** структура хороша (hero → categories → top of week → trending → newsletter → FAQ), але без жодного справжнього зображення виглядає як landing, а не медіа. Featured-новина з великим фото + «Editors' picks» з коментарем редактора змінять сприйняття за один день роботи.

### 3.4 SEO/AEO прогалини (фронтенд)
- ❌ **OG-image generation відсутня** (`next/og`) — найбільша SEO-діра: кожен шер у соцмережах без картинки.
- ❌ NewsArticle schema без `image` і з тонким `articleBody`.
- ❌ Немає сторінки автора (`Person` schema, sameAs на GitHub/X) — ключ до Google News/Discover.
- ❌ RSS без зображень; немає `max-image-preview:large`.
- ✅ Решта бази на місці: sitemap+news-sitemap, hreflang, FAQPage, BreadcrumbList, robots із дозволом AI-ботів.

---

## 4. Конкуренти: що переймати

| Конкурент | Що взяти |
|---|---|
| **Simon Willison** | Власний відтворюваний міні-тест кожного релізу («pelican on a bicycle»); ціни поруч із порівнянням; чесні висновки. Модель довіри №1 у ніші |
| **The Decoder** | Доказ, що малий ньюзрум живе з Google News/Discover: жорсткий однаковий шаблон статті, послідовна schema, швидкість |
| **The Rundown** | Стандартний блок «why it matters» (вже є!) + 1 головна історія дня з картинкою |
| **TLDR** | Стислість + newsletter як retention-ядро; сайт ловить пошук — лист утримує |
| **smol.ai** | Реакції спільноти (HN/Reddit/X) як унікальний шар, якого нема в пресрелізах |
| **Ben's Bites** | Іменний редактор з голосом і гумором як бренд |

**Ключовий інсайт:** ніхто не виграє одночасно у швидкості, глибині й довірі. Ніша ATB (Claude Code/Cursor/MCP/агенти для практиків) вужча за всіх — на запит «claude code 2.x release» малий сайт може обігнати TechCrunch. Вузькість = перевага, не розпорошуватись.

**Анти-патерни (не робити):** конвеєрний переказ пресрелізів; фейкові автори; >5–7 постів/день одним редактором; клікбейт; передрук вендорських бенчмарків без «self-reported»; машинний переклад без вичитки; блокування AI-краулерів; розпорошення на всі AI-теми.

---

## 5. МАЙСТЕР-ПЛАН (4 фази)

### Фаза 0 — Гігієна ✅ (виконано 2026-06-11)
- [x] Нормалізувати назви джерел (`pipeline/source-names.ts` + міграція 025; canonical labels у feeds.ts).
- [x] Source health tracking + Telegram-алерт (per-source + per-RSS-feed health, тротлінг раз на прогін); RSS став постійним 4-м джерелом замість fallback (THIN_PRIMARY_THRESHOLD видалено) + кап на «холодні» сінглтони в пулі (`MAX_COLD_SINGLETONS`).
- [x] Velocity-floor 0.5 для official-source (trust = 1, включно з NVIDIA) у `rank.ts`.
- [x] Внутрішньоденна дедуплікація (RPC `match_relevant_item`, міграція 026) + неруйнівний syncBriefItems (рев'ю-стан переживає прогони; виправлено баг, де `/custom` стирав денний draft) + кнопка 🔁 Переробити в Telegram (видаляє pending-item для переролу перекладу без вбивства сюжету).
- [x] Language-detect валідація `_uk`-полів (`pipeline/lang-check.ts` → `review_comment`).
- [x] Cost-логування LLM-викликів (Gemini usageMetadata / OpenRouter estimate) у `pipeline_runs.meta`.

### Фаза 1 — Rich-контент pipeline (2–3 тижні) ← НАЙВИЩИЙ ROI
- [ ] **ENRICH-етап:** повнотекстовий fetch (readability) топ-8 кандидатів + топ-5 HN-коментарів + og:image → Supabase Storage.
- [ ] Міграція схеми: `body_md`, `facts`, `code_snippet`, `when_to_use/when_not_to_use`, `community_reactions`, `citations`, `image_url`, `editor_take` на `brief_items`.
- [ ] **Summarize v2:** промпт на повному тексті; markdown-body з підзаголовками; обовʼязкові конкретні цифри/ціни/команди; citations.
- [ ] **VERIFY-прохід:** LLM-перевірка тверджень проти джерела; провали → у review_comment.
- [ ] Telegram: кнопка «✍️ Edit» / поле editor_take (15-хвилинний людський шар на топ-новину).

### Фаза 2 — Шаблон статті + візуальний шар (2–3 тижні)
- [ ] Перезібрати `story-body.tsx` за шаблоном §3.2: markdown-рендер (підзаголовки/bold/code з підсвіткою), facts-таблиця, try-it блок, when-to-use, editor's take, community, sources.
- [ ] Hero-зображення на статті + превʼю на картках /news і головної.
- [ ] OG-image generation (`next/og`): брендована картка з заголовком + категорією.
- [ ] Сторінка автора-редактора (фото, біо, GitHub/X, `Person` schema) + byline-лінк звідусіль.
- [ ] NewsArticle schema: `image`, повний `articleBody`, `dateModified`; `max-image-preview:large`; зображення в RSS.
- [ ] YouTube-embed для `youtube_url`; prev/next навігація.

### Фаза 3 — Авторитет і дистрибуція (постійно, старт з тижня 5–6)
- [ ] **Фірмовий бенчмарк:** одна реальна dev-задача, що проганяється через кожен новий реліз моделі/інструмента → унікальний відтворюваний контент + мемність.
- [ ] 3–5 living pages: «Ціни всіх LLM API» (оновлюється щотижня), «Claude Code vs Cursor vs Codex», «Каталог MCP-серверів» → GEO-магніти + хаби internal linking.
- [ ] Google Publisher Center; сторінки Corrections Policy + Contact.
- [ ] Тижневий «Best of» дайджест (нд/пн) → newsletter + LinkedIn; авто-репост топ-статті у X/Telegram (інфраструктура `social_posts` вже є).
- [ ] Newsletter-активація (Beehiiv-каркас вже в схемі).
- [ ] Відео-випуски — ТІЛЬКИ після стабілізації перших трьох фаз (для одного редактора YouTube зазвичай не окупається; `video_script_*` поля вже генеруються — почати з Shorts по топ-новині, якщо лишається ресурс).

### Фаза 4 — Engagement/монетизація (після трафіку)
- [ ] View-tracking per item (`view_count`) + блок «Trending now» на даних.
- [ ] Saved-items drawer, коментарі (схема готова), infinite scroll.
- [ ] Перший спонсор newsletter (каркас `sponsor_placements` готовий); LemonSqueezy premium — після 1–2k підписників.

### Метрики успіху
- Фаза 1–2: кожна стаття має ≥1 елемент, якого нема в джерелі (таблиця/код/тест/цитати) — критерій Google added value.
- 4–8 тижнів після Фази 2: поява в Top Stories по вузьких запитах («claude code release», «mcp server»), >0 цитат у Perplexity/ChatGPT (перевіряти вручну), CTR у GSC.
- Newsletter: 100 → 500 → 2000 підписників як головна retention-метрика.

---

## 6. Що ти, можливо, пропустив (за твоїм проханням)

1. **Editorial gate у тебе вже є і непоганий** (Telegram-картки + publish + revalidate) — але статистика 109/2 approve/reject каже, що він не фільтрує. Жорсткіший відбір (5 сильних items > 8 середніх) важливіший за будь-який код.
2. **OG-картки** — кожен теперішній шер у соцмережі йде без зображення. Дешево виправити, великий ефект.
3. **`item_reviews` — прихований актив:** датасет твоїх рішень approve/reject можна використати для тюнінгу ранкера (few-shot у промпт «редактор зазвичай відхиляє такі-то»).
4. **Сторінка автора відсутня** — без неї шлях у Google News/Discover закритий незалежно від якості контенту.
5. **First-party джерела майже не потрапляють у брифи** (4/109) — найцінніші новини зараз заходять через HN-обговорення, на 6–24 год пізніше і з чужим фреймінгом.
6. **Fraunces не застосовується до українських заголовків** (fallback на Inter) — UK-версія виглядає біднішою за EN.
7. **Безлад source_name** ламає не лише фільтри, а й ранкер (SOURCE_TRUST шукає по назві).
8. **Dry-run не репрезентує прод** (пропускає semantic dedup) — тестування pipeline локально дає інший результат, ніж у CI.
