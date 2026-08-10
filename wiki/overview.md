# Overview — бізнес-контекст AI Today Brief

Summary: продукт, ринок, економіка, жорсткі обмеження і те, що **не спрацювало**. Єдине місце,
де живуть бізнес-факти проєкту; `CLAUDE.md` — це поведінка, ця сторінка — знання.
Sources: `wiki/strategy/startup-plan.md`, `wiki/strategy/master-roadmap.md`, `wiki/audits/2026-07-01-seo-organic.md`,
`wiki/audits/2026-06-12-analytics-gsc.md`, `wiki/analytics/ga4-gsc.md`, `wiki/pipeline/guide.md`,
`wiki/ops/owner-checklist.md`, `.cursor/rules/00-core.mdc`, `.env.example`, `package.json`,
live check git/PR 2026-08-04, editorial quality overhaul PR5 (гілка `feat/weekly-editorial-voice`, 2026-08-06)
Last updated: 2026-08-06

---

## 1. Що це за продукт

**AI Today Brief** (`aitodaybrief.com`) — щоденний курований AI/engineering-бриф плюс evergreen
концепт-хаби. EN — основна мова, UK — вторинна (низькоконкурентний клин).
(source: `.cursor/rules/00-core.mdc`)

Стратегія — **brief-led product, authority-built architecture**: щоденний бриф — гачок, але кожна
сторінка одночасно будує **topical authority** + **AEO** (цитованість AI-движками) у захищеній
dev-ніші. (source: `.cursor/rules/00-core.mdc`)

**Definition of Done проєкту:** конкурентний прибутковий продукт AI-новин із власною аудиторією,
повторюваним трафіком і ≥2 потоками доходу. (source: `wiki/strategy/startup-plan.md`)

Деталі архітектури — `.cursor/rules/00-core.mdc` і
[PIPELINE-GUIDE](pipeline/guide.md) (майбутні `wiki/architecture/stack.md` та
`wiki/pipeline/guide.md` — див. [index](index.md)).

## 2. Ринок і конкуренти

| Конкурент | Формат | Монетизація | Їхня слабкість = наш шанс |
|---|---|---|---|
| TLDR AI | email-дайджест | спонсорство | лише email, слабкий сайт/SEO/архів |
| The Rundown AI | email + курси | спонсорство + AI University | мало dev-глибини |
| Ben's Bites | email + community | спонсорство + Pro | контент тонкий |
| Smol AI (AINews) | email | спонсорство | UX/дизайн слабкий |
| Superhuman AI | email | спонсорство | немає вертикалі |
| InBrief.info | сайт + архів | — | вже інтегровано як **джерело**, не конкурент |
| Futurepedia / TAAFT | каталог тулів | affiliate + listing | не новини |

(source: `wiki/strategy/startup-plan.md` §4.1)

**Диференціатор:** єдиний, хто поєднує (a) широкий топ-дайджест, (b) глибоку dev/vibe-coding
вертикаль як moat, (c) білінгву EN/UK (недообслужений UA/CEE-ринок), (d) мультиформат
(сайт + email + Telegram + соц + автошортси). (source: `wiki/strategy/startup-plan.md` §4.1)

**Ринковий фон 2026** (обґрунтовує людський publish-gate): березневий core-update за scaled content
abuse дав масовим AI-сайтам 60–80% падіння; AI Overviews зрізали CTR на 61%; 68% пошуків —
zero-click. (source: `wiki/strategy/master-roadmap.md` §6, §2 #12)

## 3. Монетизація і KPI

Порядок запуску потоків доходу: **1)** newsletter-спонсорство → **2)** premium $5–9/міс →
**3)** affiliate (AI Tools Directory) → **4)** data/API B2B → **5)** B2B-інтелідженс.
Перша монетизація зафіксована як спонсорство — нижчий поріг, не потребує paywall-інфри.
(source: `wiki/strategy/startup-plan.md` §4.3, §5)

Воронка KPI: `Impressions (соц/SEO) → Site sessions → Email subs → DAU/retention →
Sponsorship CPM → Premium MRR`. (source: `wiki/strategy/startup-plan.md` §4.5)

**Дохід станом на 2026-08-02 — $0.** Жоден потік ще не запущено. (source: `wiki/ops/owner-checklist.md` —
LemonSqueezy відкладено, спонсорство «через email спочатку»)

## 4. Бюджет і вартісні обмеження

Проєкт свідомо будується на **free tier + жорстких cap-ах** — це обмеження дизайну, не тимчасовість.

| Стаття | Стан | Джерело |
|---|---|---|
| LLM для pipeline | Gemini Flash (AI Studio free 250/день) → OpenRouter fallback → Ollama локально | `wiki/pipeline/guide.md` §4, `.env.example` |
| Картинки карток / weekly story | Cloudflare Workers AI **FLUX.2 klein** (`@cf/black-forest-labs/flux-2-klein-9b`); без ключа — брендований duotone-fallback. Weekly story-ілюстрації від PR5 (2026-08-06) — окрема репортажна house-style (policy `weekly-reportage-v2` з 2026-08-10: structured scene JSON + validator + subject-first BFL SASC prompt); 3 варіанти на історію. Сцен-бриф (текстовий крок перед зображенням) від LLM provider registry Phase 2 (2026-08-06) іде через `generateWithRegistry` — той самий уніфікований реєстр провайдерів, що й для решти LLM-викликів проєкту | `.env.example`, PR #169–#171, editorial quality overhaul PR5, [card-images](marketing/card-images.md), [llm-providers](pipeline/llm-providers.md) |
| X (Twitter) постинг | hard cap **≤ €10/міс** у БД; резервація `X_POST_ESTIMATED_COST_EUR=0.40` на пост | `.env.example` |
| Weekly master LLM | оцінка $3/M input, $15/M output; kill-switch `WEEKLY_CONTENT_STUDIO_V2=off`; hard cap `WEEKLY_MASTER_MAX_SPEND_USD` (default $4) | `.env.example`, PR #163, `generation-worker.ts` |
| Social writer/critic LLM | оцінка $0.3/M input, $1/M output | `.env.example` |
| Cost ledger | таблиця `generation_cost_events` + UI `/admin/costs` (оцінки/reported, не рахунок провайдера) | PR #169 |
| Хостинг/БД | Vercel + Supabase | `.cursor/rules/00-core.mdc` |

> ⚠️ Є ledger оцінок у БД, але **фактичний місячний рахунок** провайдерів у wiki ще не зведений.
> Див. [open-questions](open-questions.md) #2.

## 5. Жорсткі обмеження (не обговорюються без явного рішення)

1. **Людина твердить publish.** `briefs.status: draft → published` — тільки людина. Це
   E-E-A-T-moat і вимога AI Act щодо human oversight, а не вузьке місце.
   (source: `.cursor/rules/00-core.mdc`, `wiki/strategy/master-roadmap.md` §7 #4)
2. **Ніякого автопаблишу обсягом.** Дюжини тонких сторінок на день = scaled content abuse.
   (source: `wiki/strategy/master-roadmap.md` §6)
3. **Stripe заблокований в UA** → платежі лише через **LemonSqueezy** (Merchant of Record).
   (source: `.cursor/rules/00-core.mdc`, `.env.example`)
4. **Reddit Data API вимкнено** до письмового схвалення бізнес-кейсу; OAuth-креденшли самі по собі
   джерело не вмикають, публічний `*.json` скрапінг заборонений.
   (source: `.env.example`, `wiki/ops/reddit-compliance.md`)
5. **`service_role` ключ живе тільки в pipeline** — ніколи `NEXT_PUBLIC_`, ніколи не імпортується
   під `src/`. (source: `.cursor/rules/00-core.mdc`)
6. **Ніколи не пушити в `main`**; перед пушем — `npm run pr:check`.
   (source: `.cursor/rules/pr-gate.mdc`, `package.json`)
7. **Next.js 16 — docs-first.** Читати `node_modules/next/dist/docs/` перед новим route.
   (source: `AGENTS.md`)
8. **Телеметрія — write-only, PII-free**, consent-gated, з bot-фільтром (`session_hash`, не сирий
   ip/ua). (source: `wiki/strategy/master-roadmap.md` §6)

## 6. Поточне вузьке місце

**Не якість відбору новин, а дистрибуція й індексація.** Станом на 2026-07-01: домену ~4 тижні,
**232 сторінки «Виявлено — не проіндексовано»**, Organic Search ≈ **13 користувачів/міс**,
201 із 229 нових користувачів — Direct (переважно свої, UA).
Технічний SEO-фундамент перевірено — **чистий**; причина = молодий домен + 0 беклінків +
відсутність дистрибуції. Лікується діями поза сайтом, не кодом.
(source: `wiki/audits/2026-07-01-seo-organic.md` §1, §2)

Детально — [2026-07-01-seo-organic-audit](audits/2026-07-01-seo-organic.md).

## 7. Що НЕ спрацювало (найдорожчий розділ — читати перед плануванням)

| # | Що пробували | Результат | Джерело |
|---|---|---|---|
| 1 | Модалка підписки на розсилку | показана 41 → форму почали 8 → **підписка 1** | `wiki/audits/2026-07-01-seo-organic.md` §5 |
| 2 | Ставка на пасивне SEO | Week-1 retention ≈ **0**; без утримання зростання протікає | там само |
| 3 | Notion як прод-сторедж контенту | відкинуто: ~3 req/s rate limit, немає SQL/FTS/векторів, дорого на seats. Лишається лише як внутрішній editorial-інструмент | `wiki/strategy/startup-plan.md` §2.2 |
| 4 | ConvertKit / Mailchimp / самохост розсилки | відкинуто: дорожче й слабша монетизація / забагато делайверабіліті-ризику | `wiki/strategy/startup-plan.md` §7 |
| 5 | The Verge як джерело | 33 зібрано / **0 опубліковано** → authority демоутнуто до 0.55 | `wiki/pipeline/guide.md` §3 |
| 6 | cross-source вага 0.22 у rank | сигнал мертвий: середнє mentions ≈ 1.008, лише 5 рядків > 1 → **22% ваги марнується** | `wiki/strategy/master-roadmap.md` §2 #8 |
| 7 | «Автономний мозок», що публікує без людини | відхилено на всіх чотирьох планувальних артефактах: немає сигналу для навчання, немає часового ряду, немає reward | `wiki/strategy/master-roadmap.md` §1 |
| 8 | Побудова нових авто-поверхонь (`/models`, `/prompts`, `/deals`) до розблокування індексації | заблоковано: нові URL успадкують долю 232 неіндексованих | `wiki/strategy/master-roadmap.md` §1 |
| 9 | Reddit script-app самообслуговуванням | створення падає, потрібне pre-approval; запит без відповіді | `(source: owner session notes 2026-06, needs verification)` |
| 10 | Уніфіковані «глоу-мізки» банери карток | однакові банери не під контекст → переписано sceneBrief + провайдерну сходинку | `(source: owner session notes 2026-06-29, needs verification)` |

## 8. Технічні константи

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (CSS-first `@theme`, без
`tailwind.config.js`) · Supabase (`@supabase/supabase-js`, RLS = джерело правди) · Vercel · npm
(`package-lock.json` авторитетний) · Vitest ≥70% на logic-модулях · Playwright для UI-регресій.
Заборонено без окремого обговорення: інші фреймворки/роутери, state-бібліотеки, важкі ORM,
CSS-in-JS, `clsx`/`tailwind-merge`, окремий бекенд.
(source: `.cursor/rules/00-core.mdc`, `package.json`)

Повний перелік і заборони — `.cursor/rules/00-core.mdc`.

## 9. Сервіси та ключі

Supabase (app + pipeline, один проєкт) · Beehiiv (розсилка) + Resend (транзакційні) · Telegram
(редакційний review + канал) · X / LinkedIn / Meta / Threads (соц-CMS) · Gemini + OpenRouter +
Ollama (LLM) · Cloudflare Workers AI (картинки) · GA4 + GTM + GSC · LemonSqueezy (відкладено) ·
IndexNow (Bing/Yandex). Повний перелік env — `.env.example`; портативність — `wiki/ops/services-portability.md`.

> ⚠️ Conflict: [ANALYTICS](analytics/ga4-gsc.md) документує GA4-property **540206735**,
> а аудит 2026-07-01 показує активну **540467725**. Не довіряти жодній цифрі GA, доки не пройдено
> чек-лист звірки. Див. [open-questions](open-questions.md).

## Related pages

- [index](index.md) — карта всієї бази знань
- [now](now.md) — поточний операційний стан
- [open-questions](open-questions.md) — відкриті питання й конфлікти
- [MASTER-ROADMAP](strategy/master-roadmap.md) — послідовність L0→L4 *(→ `wiki/strategy/`)*
- [PIPELINE-GUIDE](pipeline/guide.md) — `fetch → rank → summarize → publish` *(→ `wiki/pipeline/`)*
- [decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md)
