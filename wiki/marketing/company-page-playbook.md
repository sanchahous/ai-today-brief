# AI Today Brief — Company Page playbook

Summary: Playbook Company Page ATB на LinkedIn (ассети, URN, CMS-гейт).
Sources: none (analysis)
Last updated: 2026-07-22


**Версія:** 1.0<br>
**Дата:** 21 липня 2026<br>
**Статус:** execution-ready. Публікація — вручну через нативний планувальник LinkedIn.<br>
**Базується на:** [`linkedin-strategy.md`](./linkedin-strategy.md) §8–9, 14 · [`linkedin-action-plan.md`](./linkedin-action-plan.md) · [`social-launch.md`](./social-launch.md) §6 · факти продукту з `src/lib/i18n.ts`, `src/app/llms.txt`.

> **Рішення власника (21.07.2026), зафіксовано:**
> 1. Сторінка ATB — вже **standalone Company Page** (конверсія завершена), але **нова, з нуля підписників**. Тому launch-пост A0 — це **знайомство з брендом** («ось хто ми»), а НЕ анонс переходу «now independent»: немає аудиторії, якій анонсувати зміну, і для нової компанії такий фрейм недоречний.
> 2. Позиціонування — **власний бренд/видання**: ATB має свою ідентичність і голос, окремий від профілю Sasha. Крос-промо в профіль лишається, але сторінка стоїть сама.
> 3. Публікація — **native scheduler батчем**. CMS-API — пізніше, за гейтом (runbook §5, wave 5): OAuth + AAL2 + ре-верифікація org-URN після конверсії.
>
> Цей файл — контент-стратегія + запуск + двигун росту **саме для Company Page ATB**. Загальна 3-identity стратегія лишається в `linkedin-strategy.md`; тут — усе, що робиться руками на цій одній сторінці.

---

## 1. Позиціонування в одному абзаці

AI Today Brief — **самостійне видання для builders**: щоденний AI-engineering сигнал про моделі, агентів, MCP, дев-тули та MLOps, що реально змінюють те, як інженери шипають. Не «друга стрічка людини» і не лінк-дамп — окремий бренд з власним голосом: **спочатку факти, вердикт редактора — окремо, п'ять хвилин, EN + UA, щодня.** Category-фраза, яку тримаємо скрізь дослівно: **`AI-engineering signal for builders`** (назва конкурує з кількома generic «AI brief» брендами — фраза розрізняє).

Зв'язок з особистим профілем Sasha: **однобічний крос-промо**, не злиття. Профіль репостить ~1 із 5 важливих постів сторінки з новим контекстом (профіль дає 5–8× reach сторінки — це головний важіль дискаверу). Голос, About і CTA сторінки — самодостатні й не залежать від профілю.

---

## 2. Оформлення сторінки (фінальні значення)

| Поле | Значення |
|---|---|
| **Display name** | `AI Today Brief` (не `aitodaybrief`) |
| **Tagline** (120 симв.) | `AI-engineering signal for builders: models, agents, MCP, dev tools and MLOps that matter — in 5 minutes.` |
| **Category phrase** | завжди повторювати `AI-engineering signal for builders` у постах/біо |
| **Industry** | Technology, Information and Media |
| **CTA-кнопка** | `Sign up` → `https://aitodaybrief.com/en/subscribe` |
| **Vanity URL** | звірити live-URL після конверсії (ймовірно `linkedin.com/company/aitodaybrief`); клейм не змінювати — ламає лінки |
| **Logo** | `artifacts/brand-kit/avatar.svg` @ 400×400 (⚠️ запечений темний фон, не прозорий — LinkedIn рендерить і на світлому) |
| **Cover** | `artifacts/brand-kit/banner-linkedin.svg` @ 4200×700 (текст у центрі — мобайл ріже боки) |

### About (готовий; перші ~150 симв. самодостатні, front-loaded)

```text
AI Today Brief is a daily, human-edited AI-engineering signal for builders — the
model releases, agents, MCP, developer tools and MLOps that actually change how you
ship, in five minutes.

We read 120+ sources so you don't have to, and publish only what changes how you
build — with a clear editor's verdict kept separate from the facts. English and
Ukrainian, every day.

What you'll find here:
• Daily brief — the few things that matter, why they matter, and for whom.
• Weekly "5 moves that changed how builders work" — a native PDF you can save.
• Practical tool comparisons with real criteria, not affiliate rankings.
• Reproducible experiments and our own benchmarks (AI Orchestration Bench).

No hype, no link-dumps, no "AI changes everything." Signal, not noise.

Read the full brief and subscribe → aitodaybrief.com
```

**Хештеги сторінки (3):** `#AIengineering` `#LLM` `#DeveloperTools`

---

## 3. Контент-піллари та формати

Піллари (з `linkedin-strategy.md` §8):

| Піллар | Що це | Формат |
|---|---|---|
| **One important change** | одна зміна: факт → чому важливо → для кого → source | короткий текст + 1 візуал/таблиця |
| **Weekly synthesis** | `5 moves that changed how builders work` | **native PDF/document** (якірний формат) |
| **Tool comparison** | практичне порівняння за критеріями, не affiliate-ранкінг | таблиця / multi-image |
| **Editor's verdict** | думка редактора, чітко відокремлена від факту | текст |
| **AOB benchmark** | run з protocol і reproducible artifacts | PDF + лінк на репорт |
| **Editorial transparency** | методологія, correction/transparency notes | текст (нечасто, будує довіру) |

**Пріоритет форматів** (Metricool 2026, як гіпотеза не закон): native documents/PDF і multi-image — найсильніші на сторінках; link-пости на Pages корелюють з вищими impressions (на відміну від профілю). **Висновок:** сторінка може давати прямий корисний лінк у пості — не ховати в перший коментар «за правилом».

---

## 4. Каданс і тижневий ритм

- **3–4 пости/тиждень**, один із них — **weekly PDF**. Це реалістичний solo-каданс; щоденні 5–6 постів не тримати.
- **English-first.** Окремий Ukrainian weekly digest — тестувати лише після накопичення аналітики (не в перші 30 днів).
- **Одна мова на пост.** Не публікувати дві перекладені версії одного поста поспіль.
- Вікно публікації: одне, **11:00–13:00 Київ**. A/B вікон (проти 16:00–18:00) — не раніше дня 45.

| День | Слот | Формат |
|---|---|---|
| Пн | One important change | текст + візуал |
| Ср | Tool comparison **або** editor's verdict | таблиця / текст |
| Пт | Weekly synthesis | **native PDF** |
| (Вт/Чт) | опційний 4-й пост, якщо є матеріал | будь-який |

**Драбина деградації** (тиждень просів): спершу випадає опційний 4-й пост → далі Ср-слот → **Пт weekly PDF замінюється text + multi-image** (але щотижневий слот не пропускати — це якір бренду).

---

## 5. Двигун росту підписників (залучення)

Ріст сторінки — це **не «постити й чекати»**. Джерела підписників у порядку сили:

1. **Особистий профіль Sasha (головний важіль).** Репост ~1 із 5 постів сторінки з власним контекстом (не порожній share). Плюс у профіль-хедлайні/Featured — згадка й лінк на сторінку. Профіль = 5–8× reach сторінки.
2. **Invite credits: 50/міс** (ліміт зрізали з 250 у 2026). Цілитись у тих, хто **точно прийме** (кредити повертаються за прийняті). Ре-спенд 1-го числа. Спершу — 3–5 сід-постів, лише потім інвайти.
3. **Крос-промо з власних поверхонь** (важливо, майже безкоштовно):
   - follow-лінк на LinkedIn-сторінку у **футер сайту** ATB і **футер email-розсилки**;
   - рядок «тепер ми в LinkedIn + щотижневий PDF» у найближчому випуску розсилки;
   - анонс сторінки в **Telegram / X / Bluesky / Threads** (де вже є аудиторія).
4. **Engagement під постами сторінки.** Відповідати на змістовні коментарі того ж дня (з профілю — Page-коментарі слабкі). Без штучного «підняття».
5. **Контент-формат.** Native PDF/document дає ~3× impressions картинки — тому weekly PDF = головний discovery-двигун.
6. **LinkedIn Newsletter — гейт 150 followers.** При ≥150 + історія регулярного контенту → запустити **один** newsletter (дзеркало weekly digest). При запуску всі followers дістають one-time notification — тому спершу наростити базу до 150, потім вмикати.

**Заборонено (guardrails §15 стратегії):** авто-likes/comments/follows/invites/DMs, browser-боти, cookie-тули, купівля підписників, RSS-дампи без коментаря. Ріст — тільки органіка + ручна взаємодія.

---

## 6. Публікація: механізм

**Зараз — нативний планувальник LinkedIn, батчем раз на тиждень** (планування 10 хв – 3 міс наперед):

1. Зайти на Company Page як адмін → **Start a post → постити «as AI Today Brief»** (не як особа).
2. Вставити **фінальний** текст (вичитаний), приклеїти візуал або завантажити PDF як **Document**.
3. Додати **alt text**.
4. Розклад: будній день, 11:00–13:00 Київ.
5. ⚠️ **Запланований пост не редагується** (лише reschedule/delete) — тому текст має бути фінальним до планування.
6. Після факту — занести в трекінг-таблицю (нижче) URL + метрики.

**CMS-API (пізніше, за гейтом).** `wiki/ops/social-cms-runbook.md` §5 wave 5: підключати ATB як destination лише після OAuth + AAL2-approval + **ре-верифікації нового `urn:li:organization:*`** (після конверсії старий Showcase-URN недійсний) + test post з перевіркою exact URN. До того ATB destination у CMS тримати в `manual`.

---

## 7. Вимірювання

**North star — не impressions, а:** newsletter subscribers + site visits (з UTM) + returning readers + citations/partnerships.

Трекінг-таблиця (один spreadsheet), колонки: `date · pillar · format · language · post_url · reach · saves · sends · reposts · link_clicks · followers_after · notes`.

**UTM для лінків сторінки:**
```text
utm_source=linkedin&utm_medium=organic_social&utm_campaign=atb_editorial&utm_content={pillar}.{format}.{lang}
```

**Пороги (орієнтир, звірити з baseline):**
- День 30: **≥150 followers** → відкривається newsletter-гейт.
- День 90: **300–500 followers**; ≥1 traceable partnership/citation; стабільний потік site-visits з LinkedIn UTM.
- Review-каданс: 48h (розподіл) · 7d (повний результат + site action) · 30d (медіани pillar/format) · 90d (business outcomes).

---

## 8. Guardrails (короткий витяг §15 стратегії)

1. Не вигадувати firsthand experience/outcomes; факт ≠ вердикт — розділяти явно.
2. Для AI-новини завжди зберігати першоджерело + event/publication date; freshness-check.
3. Planned work позначати як planned. Не заявляти команду/дохід, яких нема.
4. Публічно й швидко виправляти помилки; вести correction log.
5. Жодної автоматизації взаємодій; лише official OAuth/API або нативний планувальник. Пароль LinkedIn у CMS не віддавати.

---

## 9. Календар запуску (перші 4 тижні)

Готові тексти — у Додатку A. Порядок: спершу анонс, далі evergreen-сіди (не залежать від новини дня), потім ритм наповнюється з живого брифу.

| Тиждень | Пн | Ср | Пт (PDF) | +опційний |
|---|---|---|---|---|
| **W1 (запуск)** | 📣 **Launch / знайомство** (A0) | Editorial: «What makes the cut» (A1) | Weekly PDF #1 «5 moves» (шаблон T-PDF) | — |
| **W2** | One important change (шаблон T-CHANGE) | Value-prop «Signal, not noise» (A2) | Weekly PDF #2 | Bilingual-пост «EN + UA» (A3) |
| **W3** | One important change | Tool comparison (шаблон T-COMPARE) | Weekly PDF #3 | — |
| **W4** | One important change | Editor's verdict | Weekly PDF #4 | Аналітика 30d → подвоїти 2 найкращі формати; при ≥150 followers — запустити newsletter |

**Перед W1:** оформлення §2 доведене до кінця (name, tagline, About, CTA, logo, cover); 3–5 сід-постів забанковано в планувальник; крос-промо-лінки (§5.3) виставлені.

---

## Додаток A — готові до публікації драфти

> Постити «as AI Today Brief». Лінк у пості сторінки — ок (не ховати в коментар). Alt text обов'язковий. English-first: EN — на сторінку; UA-версії — для Telegram/UA-аудиторії або як окремий пізніший пост (не поспіль перекладом).

### A0 — Launch / знайомство (📣 W1 Пн) — EN

> Фрейм: **знайомство з брендом**, не анонс переходу. Сторінка нова, з нуля підписників — «now independent» тут недоречно (немає кому анонсувати зміну). Пост відповідає на «хто ви і навіщо на вас підписуватись».

```text
Meet AI Today Brief — a daily AI-engineering brief for people who build.

Every day the AI world ships more than anyone can read. We read 120+ sources and
publish only what changes how you build — model releases, agents, MCP, developer
tools, MLOps. Facts first, the editor's verdict kept clearly separate. Five minutes.
English and Ukrainian. Every day.

What you'll find on this page:
• A daily brief — the few things that matter, and why.
• A weekly "5 moves that changed how builders work" — a save-worthy PDF.
• Tool comparisons with real criteria and our own reproducible benchmarks — not vibes.

No hype, no link-dumps, no "AI changes everything." Signal, not noise.

If you build with AI, this page is for you. Follow along, and read the full brief at
aitodaybrief.com.
```

### A0 — Launch / знайомство — UA (для Telegram / UA-каналів)

```text
Знайомтесь — AI Today Brief. Щоденний AI-engineering бриф для тих, хто будує.

Щодня у світі AI виходить більше, ніж можна прочитати. Ми читаємо 120+ джерел і
публікуємо лише те, що змінює, як ти будуєш — релізи моделей, агенти, MCP, дев-тули,
MLOps. Спочатку факти, вердикт редактора — окремо. П'ять хвилин. Англійською та
українською. Щодня.

Що ти знайдеш на цій сторінці:
• Щоденний бриф — небагато речей, що справді важливі, і чому.
• Щотижневі «5 змін, що вплинули на те, як працюють builders» — PDF, який хочеться зберегти.
• Порівняння інструментів за реальними критеріями і власні відтворювані бенчмарки — без «на відчуттях».

Без хайпу, без звалища лінків, без «AI змінює все». Сигнал, не шум.

Якщо ти будуєш з AI — ця сторінка для тебе. Підписуйся, а повний бриф читай на aitodaybrief.com.
```

**Візуал A0:** launch-card у бренд-стилі (`#0f1115`, акцент `#f0c040`, Fraunces + Inter). **3-слайдовий PDF/Document** (LinkedIn дає документам ~3× impressions): (1) `Signal, not noise.` + категорія `AI-engineering signal for builders` + саблайн; (2) `What's inside` — 3 булети; (3) `Follow along · aitodaybrief.com`. Джерело: [`artifacts/brand-kit/launch-card-independent.html`](../../artifacts/brand-kit/launch-card-independent.html) → рендер `node scratchpad/render.mjs` → `atb-launch-card.pdf` + PNG. Single-image альтернатива — слайд 1. **Без «now independent»** — це знайомство, не анонс переходу. Alt text: «AI Today Brief — a daily AI-engineering brief for builders. Signal, not noise. Models, agents, MCP, dev tools, MLOps. EN + UA, every day.»

### A1 — «What makes the cut» (editorial transparency, W1 Ср) — EN

```text
How something makes it into AI Today Brief.

Every day we scan 120+ sources. Most of it doesn't make the brief. Our filter is one
question: does this change how you build?

A release makes the cut if it changes what you can ship, what it costs, or how you
architect. A benchmark makes it if the method is reproducible. A "breakthrough" that
only works in a demo does not.

Then we separate two things on purpose:
• The fact — what happened, with a link to the primary source and its date.
• The verdict — what we think it means, clearly labeled as opinion.

You should never have to guess which is which. That separation is the whole product.

Signal for builders — models, agents, MCP, dev tools, MLOps. Full brief: aitodaybrief.com
```

### A2 — «Signal, not noise» (value-prop, W2 Ср) — EN

```text
There is no shortage of AI news. There is a shortage of AI news that changes what you do
on Monday.

AI Today Brief is built around that gap:
• We read 120+ sources; you read five minutes.
• We drop the hype, the funding-round theater, and the "AI will replace X" takes.
• We keep tool releases, agents, research and practical guides — and say who each one
  is actually for.

Human-edited, English and Ukrainian, every day. If it doesn't change how you build,
it doesn't make the brief.

Follow for the daily signal. Full brief and newsletter: aitodaybrief.com
```

### A3 — «EN + UA, why bilingual» (W2 опційний) — EN

```text
AI Today Brief ships in two languages, every day: English primary, Ukrainian secondary.

Why: the people who build with AI are global, and a lot of strong engineering talent
reads and thinks in Ukrainian. The signal shouldn't be gated by language.

Same brief, same editorial bar, two feeds. Pick yours:
• English → aitodaybrief.com/en
• Ukrainian → aitodaybrief.com/uk

Follow here for the English edition.
```

---

## Додаток B — шаблони повторюваних форматів

Заповнювати з живого брифу. Не публікувати без реального source + date.

### T-CHANGE — «One important change» (щотижнева основа)

```text
{ONE-LINE HOOK: what changed, concretely}

What happened:
{2–3 sentences. Fact only. Name the thing, the version, what's new.}

Why it matters:
{Who this changes things for, and how — cost, capability, or architecture.}

Our verdict:
{One line, labeled as opinion. What we'd actually do / watch for.}

Source: {primary link} · {publication date}
```

### T-COMPARE — «Tool comparison»

```text
{TOOL A} vs {TOOL B} for {specific job} — no affiliate ranking, just criteria.

{Criterion 1}: {A} … / {B} …
{Criterion 2}: {A} … / {B} …
{Criterion 3}: {A} … / {B} …

Pick {A} if {condition}. Pick {B} if {condition}.
Neither if {honest caveat}.

Full breakdown: aitodaybrief.com
```

### T-PDF — «5 moves that changed how builders work» (weekly Document)

Структура слайдів (native PDF, 1080×1350 або 1200×1200, бренд-стиль):
```text
Slide 1 — Cover: "5 moves that changed how builders work" · {week range} · AI Today Brief
Slide 2–6 — one move per slide:
    {Move title} → {one-line what} → {one-line why it matters} → {source name}
Slide 7 — CTA: "Get this every week → aitodaybrief.com · Follow AI Today Brief"
```
Ціль часу на випуск: ≤1 год з шаблону. Якщо не вкладається — фолбек text + multi-image (той самий контент), слот не пропускати.
