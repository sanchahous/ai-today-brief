# 08 — SignalGist · Prototype → Production Plan (MVP launch)

> **Що це.** Виконавчий план переходу від поточної точки (повний клік-через **прототип** на mock-даті,
> PR #86) до **production-ready MVP**, готового до запуску на **signalgist.com**.
>
> **Хто виконавець.** Цей план написано для **оркестратора** (мульти-агентної системи), що доробить усе,
> включно з розробкою. Тому кожен епік розбито на задачі з **acceptance criteria, цільовими файлами,
> залежностями та кроками верифікації**. Людські гейти (G1–G5) позначені явно.
>
> **Джерела істини:** `startup-way/07 — MVP Dev Handoff` (EPICs A–I, DoD §8.1, БД §5, SEO §6, інтеграції §7),
> `startup-way/07a — Supabase MVP migration.sql`, прототип у `apps/ai-news-scrapper/prototypes/` (PR #86),
> `apps/ai-news-scrapper/docs/STARTUP-PLAN.md`.
>
> Дата: 2026-06-01 · Бренд: **SignalGist** · Домен: **signalgist.com**

---

## 1. Контекст: де ми і куди йдемо

**Маємо (готово):**
- Прототип `apps/ai-news-scrapper/prototypes/` — 15 екранів end-to-end, двомовність EN/UK, токени/компоненти,
  F1–F6, **SubscribeModal**, **CookieConsent (CMP, Consent Mode v2)**, **AiDisclosureNote**, legal-шаблони,
  live-status dashboard, per-page `usePageMeta` (canonical/OG/hreflang) + JSON-LD, hash-роутер. Усе на **mock-даті**.
- Реальний застосунок `src/` — власний роутер (`src/lib/router.ts`), Supabase-шар (`src/lib/supabase.ts`,
  `src/lib/pageMeta.ts`), сторінки (ItemPage/BriefPage/ConceptPage/NewsPage/…), але **рендер CSR** і **менше екранів**.
- Живий бекенд-пайплайн `fetch→rank→summarize→publish` (Supabase `mdiqfatpqczwqghwttpm`): 649 articles / 6 briefs / 60 brief_items.

**Ціль:** самодостатній distribution+portfolio-двигун із масовим ranking, email+Telegram-дистрибуцією,
правильним SEO/legal/security та першим монетизаційним сигналом — на власному домені.

**Розрив (що доробити):** реальні дані замість mock · prerender для SEO/свіжості · email e2e (Beehiiv) ·
Telegram-publish · editorial-approval · public-ranking pivot · SEO-інфра (sitemap/news/RSS/robots) ·
legal (юрист) · security (міграція 07a, RLS, advisors) · MoR-ready checkout · GA4 live · деплой.

---

## 2. Зафіксовані рішення (оркестратор НЕ перевизначає)

| # | Рішення | Деталь |
|---|---|---|
| D1 | **Бренд / домен** | SignalGist · `signalgist.com` (записати в `config.ts`, DNS Cloudflare, домен у Vercel) |
| D2 | **Стек рендера** | **Vite + React SPA + build-time prerender (`vite-react-ssg`)**. **НЕ Next.js.** |
| D3 | **Цільовий код** | Еволюція `src/` (зберігаємо `router.ts` + `supabase.ts`); **переносимо дизайн і нові екрани прототипу в `src/`**. `prototypes/` лишається дизайн-референсом. |
| D4 | **Ринок / право** | EN-global основна, UK вторинна. **GDPR + cookie-consent (CMP) + AI Act art. 50** (чинна 02.08.2026). |
| D5 | **Auth** | **Без user-auth у MVP** (анонім; bookmarks у `localStorage`). Захищаємо лише публічний subscribe + адмін-публікацію. |
| D6 | **Newsletter** | **Beehiiv** = власник списку (+ **Resend** транзакційні). Beehiiv — source of truth: **без дублювання PII у `subscribers`** (лише за потреби лічильник-mirror). |
| D7 | **Платежі** | **MoR: LemonSqueezy** (Stripe ⛔ UA). Checkout технічно готовий; premium **вимкнено** на старті (білінг не блокує decision-gate). |
| D8 | **Хостинг** | Vercel (Pro, SSR/ISR-rebuild) + Cloudflare (DNS/CDN) + Supabase Pro. |
| D9 | **Скоуп запуску** | **Повний P0 (DoD §8.1)**. P1/P2 (спонсорство, affiliate, premium, audio, data/API) — окремі пост-запуск фази. |
| D10 | **Decision gate** | 3–4 міс: open rate >40% + 2–5k engaged subs. 6 міс: <2k → pivot. Вшити в GA4 з дня 1. |

---

## 3. Цільова архітектура (стисло)

- **Рендер:** `vite-react-ssg` генерує статичні HTML для всіх **індексованих** маршрутів на білді;
  інтерактив (пошук, subscribe, saved, share) — клієнтська гідрація. CSR-фолбек для `/search`, `/saved`.
- **Потік даних:** `pipeline → Supabase (published) → build-time fetch slug-ів → статичні сторінки`.
  Публікація брифу → webhook → **Vercel Deploy Hook** (повний ребілд) або on-demand revalidate.
- **Маршрути:** канонічні `/:lang/...` через `src/lib/router.ts` (вже існує: `/:lang/:brief-slug`,
  `/:lang/:brief-slug/:item-slug`, `/concepts/:slug`, `/news`). Додати `/category/:slug`, `/subscribe`,
  `/about`, `/advertise`, `/privacy|/terms|/ai-disclosure`, `/status` (адмін/internal).
- **Дизайн-система:** перенести токени (`prototypes/prototype.css`, `config.ts`) і компоненти
  (`StoryBody`, `PostFeed`, `PageShell`, `features.*`, `PostCard`, icons) у `src/`.
- **Записи в БД** (subscribe/sponsor/social/sends) — лише через **Supabase Edge Functions** (`service_role`),
  ніколи з клієнта.

---

## 4. Модель виконання для оркестратора

**Лейни (можна паралелити):**
- **L-FE** Frontend / design-port (React, токени, екрани, гідрація).
- **L-BE** Backend / Edge Functions / БД / RLS.
- **L-SEO** Рендер (prerender), sitemap/RSS/robots, JSON-LD, CWV.
- **L-CNT** Контент / legal / редполітика (потребує людини-юриста на гейті).
- **L-OPS** DevOps / CI/CD / деплой / моніторинг / QA.

**Людські гейти (блокують далі):**
- **G1** Акаунти+домен+ключі готові (Phase 0) — *людина*.
- **G2** Рев'ю архітектури/типів після Phase 1 — *людина*.
- **G3** Legal sign-off (юрист) — *людина*, перед launch.
- **G4** `get_advisors(security|performance)` чисто — *авто+людина*.
- **G5** Launch go/no-go за DoD §8.1 — *людина*.

**Схема задачі (для парсингу):** кожна задача має `ID`, **Files** (цільові), **Do** (дія),
**Accept** (критерій приймання, перевірюваний), **Deps** (ID-залежності). Епік має **DoD** і **Verify**.

**Порядок фаз:** 0 → 1 → (2 ∥ 3 ∥ 4 ∥ 6) → 5 → 7 → 8 → 9. Фази 2/3/4/6 значною мірою паралельні після Phase 1.

---

## 5. Фази, епіки, задачі

### PHASE 0 — Foundation & Freeze  *(L-OPS, L-BE · гейт G1)*

**E0.1 · Бренд/домен/конфіг**
- `T0.1.1` **Files:** `apps/ai-news-scrapper/src/lib/*config*`, перенести `prototypes/config.ts` → `src/`.
  **Do:** виставити `SITE_URL=https://signalgist.com`, `SITE_NAME=SignalGist`, соцхендли, contact/advertise email.
  **Accept:** один конфіг-модуль; жодного захардкодженого старого домену в `src/`. **Deps:** —
- `T0.1.2` **Do:** придбати/підключити `signalgist.com` (реєстратор) → Cloudflare DNS → домен у Vercel-проєкті.
  **Accept:** домен резолвиться на Vercel, SSL активний. **Deps:** T0.1.1
- `T0.1.3` **Do:** соцхендли @signalgist (X/IG/Telegram/YouTube) зарезервувати. **Accept:** хендли зайнято нами.

**E0.2 · Акаунти та секрети**
- `T0.2.1` Завести: **Beehiiv** (publication), **Resend**, **LemonSqueezy** (MoR), **GA4** property,
  **Telegram bot** (+ channel), **Cloudflare**. **Accept:** усі акаунти активні.
- `T0.2.2` Зібрати env у Vercel + локально (`.env`): `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` *(тільки сервер)*, `GEMINI_API_KEY`, `DASHSCOPE_API_KEY`, `AWS_*`,
  `BEEHIIV_API_KEY`+`BEEHIIV_PUBLICATION_ID`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHANNEL_ID`,
  `LEMONSQUEEZY_API_KEY`+`LEMONSQUEEZY_WEBHOOK_SECRET`, `GA4_MEASUREMENT_ID`.
  **Accept:** `service_role` ніде в клієнтському бандлі (grep-перевірка). **Deps:** T0.2.1

**E0.3 · Security pre-work + міграція**
- `T0.3.1` Прогнати `get_advisors(security)` + `get_advisors(performance)` — зафіксувати baseline.
- `T0.3.2` **Застосувати `07a` міграцію** (нові таблиці `newsletter_sends`, `social_posts`, `sponsors`/`sponsor_placements`,
  P2-scaffold) + фікси advisors (search_path на `search_brief_items`/`search_facets`, `pipeline_runs` policy).
  **Accept:** міграція застосована, транзакція чиста. **Deps:** T0.3.1 · **rollback-нотатки обов'язкові.**
- `T0.3.3` Перенести `pg_trgm` у `extensions` (поза транзакцією, з перевіркою залежних індексів). **Accept:** індекси цілі.
- `T0.3.4` Ротація ключів Supabase. **Accept:** старі ключі відкликані.

**E0.4 · Freeze** — затвердити цей план як scope. **Гейт G1** (людина): акаунти+домен+ключі готові.

**DoD Phase 0:** конфіг із SignalGist; домен на Vercel; усі акаунти+env; 07a застосована; advisors baseline зафіксовано.
**Verify:** `get_advisors` без нових WARN; `npm run build` проходить; grep service_role у `dist/` → 0.

---

### PHASE 1 — Design system + data layer у `src/`  *(L-FE, L-BE · гейт G2)*  — **EPIC A/B**

**E1.1 · Перенесення дизайн-системи**
- `T1.1.1` **Files:** `src/` ← `prototypes/{prototype.css→index.css merge, icons, ui, features, PostCard, StoryBody, PostFeed, PageShell, hooks(useReveal/useJsonLd/usePageMeta), content, legalContent, dashboardData}`.
  **Do:** перенести токени й компоненти, прибрати mock-залежності. **Accept:** компоненти імпортуються в `src/` без `data.ts` mock. **Deps:** Phase 0
- `T1.1.2` Узгодити i18n: злити `prototypes/copy.ts` із `src/i18n/strings.ts` (єдине джерело). **Accept:** немає дубльованих ключів; обидві мови повні.

**E1.2 · Нові екрани в роутинг `src/`**
- `T1.2.1` **Files:** `src/lib/router.ts`, `src/pages/*`. **Do:** додати маршрути+сторінки `subscribe`, `about`,
  `advertise`, `privacy`, `terms`, `ai-disclosure`, `category/:slug`, `status` (internal). **Accept:** усі 15 типів сторінок резолвляться реальним роутером (не hash). **Deps:** T1.1.1
- `T1.2.2` Глобальний chrome: header (Categories-меню, About, Subscribe-CTA), повний footer (legal/RSS/cookie-settings/AI-нота), модалки (Subscribe, CMP), Saved-drawer — портувати з прототипу. **Accept:** chrome ідентичний прототипу, на реальних даних категорій.

**E1.3 · Реальні дані замість mock**  — **EPIC B**
- `T1.3.1` `generate_typescript_types` зі Supabase → `src/lib/database.types.ts`. **Accept:** типи свіжі.
- `T1.3.2` **Files:** `src/lib/supabase.ts`, сторінки. **Do:** замінити `data.ts` mock на запити: briefs, brief_items,
  categories, concepts; RPC `search_brief_items`/`search_facets`; **published-only** читання. **Accept:** усі екрани рендерять живі дані; `articles` не читаються анонімом. **Deps:** T1.3.1, T0.3.2
- `T1.3.3` BRIEFS/CONCEPTS/slug-логіку прототипу замінити реальними (`briefs.slug`, `brief_items.slug`, `concepts`). **Accept:** перманлінки `/:lang/news/:item-slug`, `/:lang/brief/:slug` ведуть на справжні записи.
- `T1.3.4` Стани loading/empty/error на кожній сторінці прив'язати до реального fetch (не таймер). **Accept:** error-стан показується при збої запиту.
- `T1.3.5` Mock `data.ts` лишити як **тест-фікстури** (не в проді). **Accept:** mock не в продакшн-бандлі.

**DoD Phase 1:** `src/` рендерить усі 15 екранів на живих даних Supabase; chrome+модалки портовані; типи згенеровані.
**Verify:** `npm run typecheck` + `eslint` чисто; візуальний прохід усіх екранів EN/UK; **Гейт G2** (людина) — рев'ю архітектури/типів.

---

### PHASE 2 — Рендер (prerender) + SEO-інфра  *(L-SEO, L-FE)*  — **EPIC A/F**

**E2.1 · Build-time prerender**
- `T2.1.1` Підключити **`vite-react-ssg`**. **Files:** `vite.config.js`, `src/main.tsx`, entry. **Do:** `getStaticPaths`
  тягне **published** slug-и (briefs, items, categories, concepts) із Supabase на білді. **Accept:** кожен індексований
  маршрут має готовий HTML у `dist/` (не порожній `#root`). **Deps:** Phase 1
- `T2.1.2` CSR-фолбек для `/search`, `/saved` (noindex). **Accept:** ці сторінки працюють без prerender.
- `T2.1.3` **On-publish rebuild:** pipeline `publish` → виклик **Vercel Deploy Hook** (або on-demand revalidate).
  **Files:** `pipeline/publish*`. **Accept:** публікація брифу тригерить деплой; нові сторінки зявляються. **Deps:** T2.1.1

**E2.2 · SEO-інфраструктура**
- `T2.2.1` `robots.txt` (allow + лінк на sitemap). **Accept:** доступний на `/robots.txt`.
- `T2.2.2` `sitemap.xml` (індекс) + **Google News sitemap** (статті <48 год, `news:publication`, мова) + per-lang.
  **Files:** `scripts/generate-sitemap.ts` (вже є — розширити). **Accept:** валідний news-sitemap; свіжі items присутні.
- `T2.2.3` **RSS/Atom** — сайт + per-category. **Accept:** валідні фіди, feed-discovery `<link>` у `<head>`.
- `T2.2.4` Per-page JSON-LD на реальних даних (порт із прототипу + `src/lib/pageMeta.ts`): `NewsArticle`(+citation/VideoObject),
  `CollectionPage+ItemList`, `Organization+WebSite+SearchAction`, `FAQPage`, `BreadcrumbList`. **Accept:** Rich Results Test зелений.
- `T2.2.5` `hreflang` en/uk/x-default + canonical на кожній сторінці; динамічні OG-зображення. **Accept:** hreflang-пари коректні.

**E2.3 · Performance**
- `T2.3.1` CWV-бюджети (LCP≤2.0/INP≤200/CLS≤0.05/FCP≤1.5/TTFB≤0.8) + Lighthouse CI на деплої
  (Perf≥90/A11y≥95/BP≥95/SEO 100). **Accept:** CI падає при регресії бюджету.

**DoD Phase 2:** індексовані сторінки віддають готовий HTML; sitemap/news/RSS/robots живі; JSON-LD валідний; CWV у бюджеті.
**Verify:** `curl` сторінки → непорожній HTML; Rich Results + Lighthouse зелені; Search Console приймає news-sitemap.

---

### PHASE 3 — Newsletter e2e  *(L-BE, L-FE)*  — **EPIC C**

- `T3.1` **Edge Function `subscribe`** (`service_role`): валідація email → Beehiiv API (create subscriber) →
  **double opt-in** (Resend transactional confirm). **Files:** `supabase/functions/subscribe/*`. **Accept:** реальна підписка створює запис у Beehiiv зі статусом pending→confirmed. **Deps:** Phase 0
- `T3.2` **Захист публічного endpoint:** rate-limit (per-IP), honeypot (є в прототипі), опц. captcha, `ip_country` мінімум (GDPR).
  **Accept:** бот-флуд відсікається; навантажувальний тест не створює сміттєвих підписок.
- `T3.3` Source-of-truth = Beehiiv. **Без таблиці `subscribers` (PII).** Опц. лічильник-mirror для social-proof. **Accept:** немає дублювання consent/PII у Supabase.
- `T3.4` `EmailCapture`/`SubscribeModal`/`SubscribePage` → реальний виклик Edge Function; success=«перевірте пошту».
  GA4 `newsletter_subscribe` (placement). **Accept:** усі точки підписки працюють e2e.
- `T3.5` **`newsletter_sends`** аналітика (brief_id, segment, recipients, opens, clicks) із Beehiiv → live open-rate для **decision-gate**. **Accept:** open-rate доступний у дашборді/GA4.
- `T3.6` Welcome-лист + сегменти (all/dev/ua). **Accept:** новий підписник отримує welcome.

**DoD Phase 3:** підписка end-to-end (форма → Edge → Beehiiv → double opt-in → welcome); endpoint захищений; open-rate тече.
**Verify:** тестова підписка реальним email проходить повний цикл; rate-limit спрацьовує; GA4 подія є.

---

### PHASE 4 — Дистрибуція  *(L-BE)*  — **EPIC D**

- `T4.1` **`publish-telegram`**: денний бриф → Telegram Bot API (персональний пайплайн із `05`); запис у **`social_posts`**.
  **Files:** `pipeline/publish-telegram*`, Edge/cron. **Accept:** опублікований бриф зявляється в Telegram-каналі; рядок у `social_posts`. **Deps:** Phase 0
- `T4.2` Share-меню (X/LinkedIn/copy) на item — реальні URL перманлінків. **Accept:** share відкриває коректний intent-URL.
- `T4.3` *(P1)* content-engine helper «1 бриф → X-тред + LinkedIn + dev.to + Telegram»; referral-петля Beehiiv. **Позначено P1.**

**DoD Phase 4:** Telegram автопостить денний бриф; share працює; `social_posts` ведеться.
**Verify:** end-to-end публікація в реальний тестовий канал; запис у БД.

---

### PHASE 5 — Editorial approval + ranking pivot  *(L-BE, L-FE)*  — **EPIC G/§4.2**

- `T5.1` **Editorial-approval UI:** проста адмін-в'юха `briefs.status: draft→published` (human-in-the-loop = curation moat +
  вимога AI Act людський нагляд). Оскільки **немає public-auth** — захистити адмін окремим маршрутом + Supabase Auth
  **лише для адміна** (1 акаунт) АБО signed-token. **Files:** `src/pages/admin/*` (guarded), Edge. **Accept:** лише авторизований адмін публікує; анонім не бачить адмін. **Deps:** Phase 1
- `T5.2` **Public-ranking pivot:** `rank.ts` → масова формула (`engagement_velocity 0.30 · cross_source 0.22 ·
  authority 0.18 · recency 0.15 · inbrief 0.10 · breadth 0.05`); прибрати персональні keyword-и. **Files:** `pipeline/rank.ts`.
  **Accept:** ранжування відтворюване, без audience-of-one зсуву; тест на фікстурах зелений.
- `T5.3` Контент-дисципліна: обробляти 80+ усередині, публікувати вибране (захист від Google scaled-content-abuse). **Accept:** денний вихід = куровані items, не десятки тонких сторінок.

**DoD Phase 5:** бриф проходить людський `draft→published`; ranking масовий.
**Verify:** публікація лише через адмін; rank.ts unit-тести проходять.

---

### PHASE 6 — Legal & trust  *(L-CNT · гейт G3)*  — **EPIC G**

- `T6.1` Privacy (GDPR) / Terms / **AI-disclosure (AI Act art. 50, machine-readable)** — узяти шаблони з
  `prototypes/legalContent.ts`, **заповнити плейсхолдери** `[...]`, **передати юристу**. **Accept:** placeholder-ів немає; **юрист підписав (G3)**.
- `T6.2` About/методологія на реальних даних; E-E-A-T байлайн (автор/freshness/sources cited). **Accept:** About індексується, байлайн на даних.
- `T6.3` AI-disclosure: спокійна нотатка + видиме людське редагування + `<meta>`/JSON-LD машинна позначка; C2PA для згенерованих медіа (пост-MVP-нюанс). **Accept:** disclosure присутній, не лякливий банер.
- **Гейт G3:** legal sign-off юристом — блокує launch.

**DoD Phase 6:** legal-сторінки фінальні (юрист), AI-disclosure машинозчитуваний, About на даних.
**Verify:** немає `[placeholder]`; юридичне підтвердження зафіксовано.

---

### PHASE 7 — Security hardening  *(L-BE · гейт G4)*  — **EPIC H**

- `T7.1` Підтвердити нові таблиці (07a) + RLS: `social_posts` (public read posted), `sponsor_placements` (read live),
  `newsletter_sends`/`sponsors` (service_role only). **Accept:** політики відповідають 07a.
- `T7.2` **RLS published-only аудит:** `brief_items` лише де `briefs.status='published'`; `briefs` published; `articles`
  **не для anon**; `categories`/`concepts` public read. **Accept:** anon-ключем не читається жоден чернетковий/сирий запис (тест 303-endpoints-урок).
- `T7.3` Усі записи (subscribe/sponsor/social/sends) — лише через Edge Functions (`service_role`). **Accept:** клієнт не має write-доступу.
- `T7.4` Повторно `get_advisors(security|performance)` — **чисто, без WARN**. **Гейт G4.**

**DoD Phase 7:** RLS published-only; advisors чисті; service_role лише сервер; ключі зротовані.
**Verify:** автоматичний RLS-тест (anon намагається читати articles/draft → 0 рядків); advisors=clean.

---

### PHASE 8 — Analytics + payments-ready  *(L-FE, L-BE)*  — **EPIC I/§7**

- `T8.1` **GA4 live:** `VITE_GA_MEASUREMENT_ID`; **Consent Mode v2 під'єднати до CMP** (наш `CookieConsent`→`updateConsent`).
  North-Star (weekly engaged), key events (`newsletter_subscribe`, `post_expand`, `select_search_result`, `sponsor_click`, `save_toggle`),
  **decision-gate події**, guardrails (`search_no_results`, web-vitals poor). **Accept:** події йдуть у GA4; consent керує storage. **Deps:** Phase 2,3
- `T8.2` **MoR checkout (LemonSqueezy):** скелет checkout + webhook (**підпис + idempotency**); **premium вимкнено** на старті.
  **Accept:** webhook верифікує підпис; білінг не блокує gate. **Deps:** Phase 0
- `T8.3` *(P1)* A/B (`hero_cta`, `newsletter_placement`) через `experiments.ts`. **Позначено P1.**

**DoD Phase 8:** GA4 live з Consent Mode; decision-gate метрики; MoR-webhook готовий (premium off).
**Verify:** реальна подія в GA4 DebugView; тестовий LemonSqueezy webhook верифікується.

---

### PHASE 9 — QA, perf, launch  *(L-OPS, всі · гейт G5)*

- `T9.1` QA-матриця: усі екрани × EN/UK × dark/light × loading/empty/error × `prefers-reduced-motion`;
  A11y (landmarks/focus/aria/keyboard). **Accept:** нуль критичних дефектів; axe-чисто.
- `T9.2` Lighthouse (mobile) цілі досягнуто; CWV у полі (web-vitals RUM). **Accept:** цілі §6.8 виконано.
- `T9.3` **Launch-checklist (DoD §8.1)** — пройдено всі P0. **Гейт G5** (людина) go/no-go.
- `T9.4` Деплой на Vercel prod → `signalgist.com` (Cloudflare DNS/CDN); моніторинг/uptime; **live-status dashboard**
  під'єднати до реальних джерел (PageSpeed/CrUX, Supabase pg_stat, uptime monitor, `pipeline_runs`, Beehiiv). **Accept:** домен живий, дашборд показує реальні метрики.
- `T9.5` **Go-live:** 3 канали одночасно (сайт + email + Telegram) + старт build-in-public. **Accept:** перший публічний бриф вийшов усіма каналами.

**DoD Phase 9 (= MVP LAUNCH):** усі P0 з §8.1 закриті; домен живий; 3 канали активні.
**Verify:** чек-лист §8.1 повністю відмічено; зовнішній аудит сторінки (curl/Lighthouse/Rich Results) зелений.

---

## 6. Definition of Done — MVP «готово до запуску» (DoD §8.1, P0)

- [ ] Prerender; денний бриф та items — індексовані перманлінки.
- [ ] Дані з Supabase замінили mock; типи згенеровані.
- [ ] Підписка e2e: форма → Edge → double opt-in → Beehiiv → welcome; GA4 `newsletter_subscribe`.
- [ ] Telegram автопостить бриф; `social_posts`.
- [ ] Editorial-approval (`draft→published` людиною).
- [ ] Public ranking — масова формула.
- [ ] SEO-інфра: robots, sitemap+news-sitemap, RSS, per-page JSON-LD (вкл. NewsArticle), hreflang.
- [ ] Legal: Privacy, ToS, AI-disclosure (machine-readable, AI Act art. 50), About — **юрист підписав**.
- [ ] Security: 07a застосована, RLS published-only, advisors без WARN, ключі зротовані, service_role лише сервер.
- [ ] MoR-checkout технічно готовий (premium можна не вмикати).
- [ ] GA4 live (Consent Mode v2), web-vitals у нормі, Lighthouse цілі.
- [ ] Домен `signalgist.com` живий; 3 канали активні.

---

## 7. Decision gate (вшити в GA4 з дня 1)

| Точка | Поріг | Дія |
|---|---|---|
| ~3–4 міс | open rate >40% + 2–5k engaged subs | продовжувати; sponsorship-pilot (P1) |
| 6 міс | ≥2k subs | → premium/community → data/API (P2) |
| 6 міс | <2k subs | → pivot у lean side-asset або закриття |
| будь-коли | premium-конверсія <1% | лишатись на sponsorship+affiliate |
| будь-коли | UK росте швидше за EN | подвоїти UA-вертикаль |

---

## 8. Пост-запуск (поза MVP-launch)

**P1 (одразу після запуску / монетизація):** `sponsors`/`sponsor_placements` рендер+трекінг (impressions/CTR) + `/advertise` media-kit live ·
affiliate з `tools_mentioned` + `/tools` directory · category/concept повністю на даних · **referral-петля Beehiiv** ·
content-engine helper «1→5» · A/B-тести.

**P2 (після decision-gate / диференціація):** premium/paywall (MoR, після 10k+ engaged) · **audio brief (Respeecher)** ·
data/API B2B · **pgvector** рекомендації+дедуп · comments (модерація) · saved-persistence + auth · тижневе відео.

---

## 9. Реєстр ризиків

| Ризик | Вплив | Мітигація |
|---|---|---|
| Prerender + динаміка (search/saved) | SEO/UX | чіткий поділ: prerender індексованого, CSR для noindex |
| On-publish rebuild лаг | свіжість новин | Vercel Deploy Hook одразу на publish; news-sitemap |
| Email-список = головний актив, бот-флуд | вб'є open-rate (decision-gate) | rate-limit + honeypot + double opt-in + captcha-фолбек |
| RLS-дірки (урок CVE 303 endpoints) | витік даних | published-only аудит + advisors-гейт G4 + усі writes через Edge |
| Legal (AI Act art. 50, GDPR) | штрафи/довіра | юрист-гейт G3; machine-readable disclosure; CMP |
| Stripe ⛔ UA | блок платежів | MoR LemonSqueezy; premium off на старті |
| Google scaled-content-abuse | SEO-демоція | публікувати вибране + людська редактура (E5.3) |
| Соло-виконавець | bottleneck | оркестратор + винести контент/комунікації на фрілансера (інв. 3) |

---

## 10. Env / секрети (чек-ліст)

`SITE_URL=https://signalgist.com` · `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` *(server-only)* ·
`GEMINI_API_KEY` · `DASHSCOPE_API_KEY` · `AWS_*` · `BEEHIIV_API_KEY` · `BEEHIIV_PUBLICATION_ID` · `RESEND_API_KEY` ·
`TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHANNEL_ID` · `LEMONSQUEEZY_API_KEY` · `LEMONSQUEEZY_WEBHOOK_SECRET` · `GA4_MEASUREMENT_ID` ·
`VERCEL_DEPLOY_HOOK_URL`.

**Бюджет OPEX:** ~$35–139/міс (Supabase $25 + Vercel $20 + домен + LLM $5–65 + Beehiiv free→$43). Break-even premium ($5) ≈ 17–31 платних.

---

> **Старт для оркестратора:** Phase 0 → гейт G1 → Phase 1 → гейт G2 → паралельні лейни (2/3/4/6) → 5 → 7 (G4) → 8 → 9 (G5 → launch).
> Кожна задача має Accept-критерій — використовуй його як тест приймання агента. Людські гейти G1–G5 не пропускати.
