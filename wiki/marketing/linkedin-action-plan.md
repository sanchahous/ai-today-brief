# LinkedIn: покроковий план виконання

Summary: Тактичний action-plan LinkedIn (пости, CTA, вимірювання).
Sources: none (analysis)
Last updated: 2026-07-20


**Версія:** 1.0<br>
**Дата:** 19 липня 2026<br>
**Базується на:** [`linkedin-strategy.md`](./linkedin-strategy.md) + мультиагентне ревью 18–19.07.2026 (верифікація ~40 тверджень: 0 спростовано; адверсарний скептик-пас критики)<br>
**Формат:** чек-лісти в порядку виконання. Робити зверху вниз. Якщо тиждень «просів» — деградувати за драбиною з розділу «Правила».

> Стратегія (позиціонування, формули постів, guardrails, вимоги до CMS) залишається в `linkedin-strategy.md`. Цей файл — тільки «що робити руками і в якому порядку», з поправками ревью:
> 1. **Job-triage showcase та ATB Orchestration Bench відсутні на публічному сайті** — їх треба опублікувати до того, як Featured/сід-пости на них посилатимуться.
> 2. З дня 14 — **earned-audience conversion loop** (engagers → contextual invites → warm DM), якого в стратегії не було до дня 61.
> 3. **PDF-шаблон** — deliverable тижня 1, бо PDF потрібен на всіх трьох поверхнях із перших тижнів, а CMS документи не генерує.
> 4. **Kill-критерії**: структура рішення дня 90 фіксується до дня 8; числові пороги — на день-30 ревью.
> 5. **Жодного CMS-коду 90 днів**, крім ре-верифікації URN після конверсії та чек-ліста handoff. Multi-identity redesign (§11 стратегії) — лише за operational pull + traction.

---

## Рішення дня 0 (30 хвилин, до будь-яких дій)

- [ ] **D1. Головна ціль 90 днів:** `hiring-first` (дефолт ревью: публічний Experience закінчується Nov 2025) або `consulting-first`. Від цього залежать headline-варіант (§5 стратегії), CTA і Open to Work vs Service Page. Записати вибір сюди: `→ ____`
- [ ] **D2. Canonical name:** профіль уже показує `Oleksandr Kuzmenko` — конфлікт лише в назві Company Page («Sasha Kuzmenko») і vanity URL. Рішення: name field скрізь `Oleksandr Kuzmenko`, `Sasha` — additional/preferred name + пояснення в About. Company Page лишається брендом `Sasha Kuzmenko` або перейменовується — вибрати: `→ ____`
- [ ] **D3. Число років досвіду:** НЕ використовувати в headline/About, доки не вирішено, що рахуємо (сайт каже 8, публічний timeline читається як 11+).

---

## Тиждень 1 (дні 0–7): фундамент

### Блок A — швидкі фікси (≈15 хв)

- [ ] A1. Portfolio Page: прибрати префікс `A)` з tagline.
- [ ] A2. Showcase: display name `aitodaybrief` → `AI Today Brief`.

### Блок B — знімки ДО змін (≈45 хв)

- [ ] B1. Експорт особистої аналітики (XLSX, максимальний період) + Page analytics обох сторінок.
- [ ] B2. Записати follower counts усіх трьох поверхонь (baseline для гейтів дня 30/60).
- [ ] B3. Бекап Showcase: опис, tagline, links, список ключових постів, logo, custom URL.
- [ ] B4. PDF-експорт власного профілю (звірка аудиту §2 стратегії з реальністю — аудит частково зі стороннього кешу).

### Блок C — конверсія Showcase → Company Page (≈30 хв + очікування Support)

- [ ] C1. Перевірити super admin access на обох Pages.
- [ ] C2. Подати Support-тікет на конверсію. У тікеті: попросити **письмове підтвердження** збереження followers/posts/custom URL; вказати зафіксований follower count. Parent affiliation — **не просити** (дефолт; просити лише якщо потрібна cross-discovery через Affiliated Pages).
- [ ] C3. ⚠️ З моменту подачі тікета до ре-верифікації URN: **ATB destination у CMS тримати в `manual`** — жодного API-delivery на старий Showcase URN. Після конверсії: OAuth lookup → звірити новий `urn:li:organization:*` → лише тоді відновлювати керовану доставку.
- [ ] C4. Нічого іншого від тікета не залежить — не чекати відповіді, рухатися далі.

### Блок D — верх профілю (ДО першого поста; ≈3–4 год)

Порядок важливий: перші пост-візити мають приземлятися на оновлений профіль.

- [ ] D1. Headline за вибором D1 (варіанти в §5 стратегії). Обовʼязково зберегти `Senior Frontend Engineer (React/TypeScript)` другим слотом.
- [ ] D2. About за каркасом §5. Перевірити attribution кожної метрики (командне → «we»).
- [ ] D3. Experience: додати `Creator & AI Product Engineer — AI Today Brief` (поки Showcase не конвертовано — через Project або привʼязку до portfolio practice; після конверсії — асоціювати напряму). airSlate переписати через scope/decisions/outcomes.
- [ ] D4. Featured — **тільки існуючі публічні активи**: (1) AI Today Brief live, (2) airSlate/USlegal outcomes, (3) найкращий build-in-public пост. Job-triage і AOB додати ПІСЛЯ кроку E1.
- [ ] D5. Skills: підняти AI Product Engineering, LLM Applications, AI Agents, Evaluation, TypeScript, React, Next.js…; 1C/Bitrix/jQuery — вниз, не видаляти.
- [ ] D6. `Open to Work: recruiters only` (якщо hiring-first). У списку ролей — AI-ролі **плюс 2–3 senior frontend тайтли** (Senior Frontend Engineer, Senior React/TypeScript Developer) — це чинний recruiter flow, його не ріжемо.

### Блок E — доказові активи й інструменти (≈4–6 год, можна розтягнути на дні 3–10)

- [ ] E1. **Опублікувати на sashakuzmenko.com два відсутні proof-активи:** сторінку job-triage showcase (670 findings / 124 dual verdicts / 51 labels / calibration lesson) і сторінку ATB Orchestration Bench (методологія + перший run, навіть якщо він позначений як preliminary). Без цього Featured-слоти 3–4 і сід-пости на них не мають куди вести.
- [ ] E2. Дрібні фікси сайту: Vite/React 18 → Next.js 16/React 19 у кейсі ATB; `80+ articles/day` → уточнити як «candidates scanned».
- [ ] E3. **PDF-шаблон** (Canva/Figma): один багатосторінковий шаблон LinkedIn Document. Робити його одразу на реальному матеріалі — airSlate seed PDF для Portfolio. Ціль: кожен наступний випуск ≤1 год.
- [ ] E4. Крос-промо CTA: follow-лінк на LinkedIn у футер сайту ATB і футер email-розсилки; рядок про щотижневий LinkedIn PDF у найближчому випуску розсилки.
- [ ] E5. Список 30 target-акаунтів (10 hiring/founders/CTO, 10 practitioners, 10 AI tools/media). Можна зсунути на дні 8–14.
- [ ] E6. Забанкувати по 2 сід-пости на Page (не 3–5; решта — з потоку). Portfolio seed №1 = airSlate PDF з E3.

**Гейт виходу з тижня 1:** A–D зроблені повністю; E1 і E3 — щонайпізніше до дня 10.

---

## Тиждень 2 (дні 8–14): старт публікацій

- [ ] Personal: **2 пости/тиж** за формулою §6 (hook → context → artifact → decision → trade-off → takeaway). Стартові теми №1–2 зі списку «Перші шість тем» (§6). Одна мова на пост; перші 30 днів UA ≤1–2 пости/міс.
- [ ] ATB: **3 пости/тиж** із чернеток CMS через нативний планувальник (⚠️ запланований пост не редагується — вставляти лише фінальний текст після вичитки; вікно планування 10 хв–3 міс).
- [ ] Portfolio: 1–2 сід-пости (airSlate PDF + ATB architecture).
- [ ] Коменти: 3–4 сесії × 15 хв по списку з E5. Комент = мікро-пост (досвід/контрприклад/framework).
- [ ] Час постингу: зафіксувати одне вікно 11:00–13:00 Київ. A/B вікон не ганяти до дня 45+.
- [ ] Завести один spreadsheet: URL, identity, pillar, format, мова, reach, saves+substantive comments, qualified outcomes (DM/call/interview — фіксувати одразу).

## Тижні 3–4 (дні 15–30): ритм + перший цикл конверсії

- [ ] Personal → 3/тиж, **лише якщо є артефакт**; без артефакту — свідомо пропустити слот.
- [ ] ATB: 3/тиж + перший weekly PDF «5 moves» із шаблону E3 (далі — щотижня; якщо випуск не вкладається в ~1 год — pre-authorized фолбек: text + multi-image).
- [ ] **Earned-audience loop (з дня 14, щотижня, 15 хв):** переглянути engagers/коментаторів/viewers → contextual connection requests **тільки людям із реальним touchpoint, cap ~5/тиж** (0 — нормально) → DM після 2+ взаємодій, завжди з посиланням на конкретний пост/артефакт. Без mass outreach, без шаблонних інвайтів.
- [ ] Портфоліо: досіяти до 3–4 pinned proof-постів → далі event-driven (~1/міс).
- [ ] Пʼятничний огляд 30 хв: spreadsheet + нотатка «що працює/що ні».
- [ ] До дня 8 зафіксувати письмово **структуру рішення дня 90** (три опції: повний каданс / звузити до двох поверхонь / maintenance mode) — вибір на день-90 ревью обовʼязковий.

### День-30 ревью (leading indicators, не outcome-пороги)

- [ ] ≥50% viewers персональних постів у цільових ролях (demographics)?
- [ ] Є saves/sends і ≥1 substantive взаємодія з людьми зі списку 30?
- [ ] Фолбек: якщо ні — ітерація піларів/форматів (НЕ повний перегляд).
- [ ] **Тут** виставити числові пороги дня 60/90 від baseline (B2) і фактичних медіан. Орієнтири: день 60 — ATB Page ≥150 followers (гейт newsletter); день 90 — ≥3 qualified opportunities, де LinkedIn — traceable touchpoint.

---

## Дні 31–60: авторитетні активи

- [ ] Завершити і опублікувати перший повний AOB run (reproducible artifacts) → пост на Personal (свій verdict) + повний кейс на Portfolio + метод на ATB (три кути, розведені на 24–48 год).
- [ ] **Pitch AOB-рану 2–3 більшим AI-ньюзлетерам/авторам** як citable data (одна цитата > місяць постів сторінки).
- [ ] Попросити 3 targeted recommendations (ownership / technical leadership / collaboration) — з контекстом, без готового тексту.
- [ ] ATB Page ≥150 followers → запустити weekly LinkedIn newsletter (дзеркало weekly digest).
- [ ] Flagship-кейс: Social CMS або job-triage calibration → Personal + Portfolio.
- [ ] Відкинути теми з vanity reach без цільової аудиторії.
- [ ] CMS: можна **спроєктувати** multi-identity schema (§11 стратегії) на папері. Код — лише якщо ручний ATB-оверхед >2–3 год/тиж або стався інцидент.

## Дні 61–90: масштабувати те, що конвертує

- [ ] Подвоїти два найсильніші персональні пілари/формати (за медіанами, не за одним viral-постом).
- [ ] Один flagship native document або deep case.
- [ ] 10–15 contextual conversations з людьми, які вже взаємодіяли з proof-контентом.
- [ ] ATB Page API — вмикати **лише** якщо: 30 днів shadow/approved на поточній CMS + ≥90% драфтів з ≤1 правкою + kill switch/reconciliation перевірені + URN ре-верифіковано після конверсії. **Portfolio API — поза скоупом 90 днів.**
- [ ] День-90 ревью: обрати одну з трьох зафіксованих опцій за порогами з день-30 ревью. Рахувати qualified opportunities з LinkedIn-touchpoint (не строгу атрибуцію).

---

## Тижневий ритм (цільовий, ~7–10 год)

| День | Дія | Час |
|---|---|---|
| Пн | ATB пост (CMS-чернетка → планувальник) + 15 хв коментів | ~45 хв |
| Вт | Personal build note + artifact; реплаї | ~1.5 год |
| Ср | ATB пост; 15 хв коментів; earned-audience loop (15 хв) | ~1 год |
| Чт | Personal framework/postmortem; 15 хв коментів | ~1.5 год |
| Пт | ATB weekly PDF (шаблон); 15 хв коментів; огляд 30 хв | ~1.5–2 год |
| — | Portfolio: event-driven (~1/міс) | амортизовано |

**Драбина деградації** (якщо тиждень просів): спочатку випадає portfolio-слот → третій personal-пост → 4-й ATB-пост → PDF замінюється text+multi-image. Коменти й earned-audience loop не випадають ніколи (найдешевша конверсія).

## Що НЕ робити (guardrails §15 стратегії — короткий витяг)

- Жодних auto-likes/comments/DMs/invites/pods; жодних browser-ботів чи cookie-based тулів (MCP на `li_at` — теж заборона).
- Не вигадувати firsthand experience; planned позначати як planned; факт ≠ verdict.
- Не публікувати два переклади одного поста поспіль; не ховати всі лінки в перший комент «за правилом».
- Жодного CMS-коду, який не потрібен для публікації постів цього тижня.
- Не оптимізуватися за одним viral-постом.

## Інструментальний шар (довідково)

1. **Зараз:** чернетки — Claude Code (skills `content-creator`, `marketing-demand-acquisition` вже в `.agents/skills/`); публікація — нативний планувальник; аналітика — ручний XLSX (API для особистих постів не існує: `r_member_social` закритий).
2. **ATB Page:** існуюча CMS (org URN + approval + kill switch) — після OAuth і ре-верифікації URN.
3. **Пізніше (за гейтом дня 60+):** власний міні-MCP на офіційному API (`w_member_social` — self-serve, 150 req/день) або self-hosted Postiz (увага: для refresh tokens LinkedIn-провайдера потрібна заявка на Marketing API). Официйний Posts API **не має scheduling** — планування завжди hold-and-fire на нашому боці.
