# Overview — бізнес-контекст AI Today Brief

Summary: продукт, ринок, економіка, жорсткі обмеження і те, що **не спрацювало**. Єдине місце,
де живуть бізнес-факти проєкту; `CLAUDE.md` — це поведінка, ця сторінка — знання.
Sources: `docs/STARTUP-PLAN.md`, `docs/MASTER-ROADMAP.md`, `docs/audit/2026-07-01-seo-organic-audit.md`,
`docs/audit/2026-06-12-analytics-gsc-audit.md`, `docs/ANALYTICS.md`, `docs/PIPELINE-GUIDE.md`,
`docs/OWNER-CHECKLIST.md`, `.cursor/rules/00-core.mdc`, `.env.example`, `package.json`
Last updated: 2026-08-02

> ⚠️ Шляхи `docs/…` у цитатах — **поточні**. Після виконання міграції
> ([2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md))
> вони стануть `wiki/…`; переписування посилань — крок 4 плану.

---

## 1. Що це за продукт

**AI Today Brief** (`aitodaybrief.com`) — щоденний курований AI/engineering-бриф плюс evergreen
концепт-хаби. EN — основна мова, UK — вторинна (низькоконкурентний клин).
(source: `.cursor/rules/00-core.mdc`)

Стратегія — **brief-led product, authority-built architecture**: щоденний бриф — гачок, але кожна
сторінка одночасно будує **topical authority** + **AEO** (цитованість AI-движками) у захищеній
dev-ніші. (source: `.cursor/rules/00-core.mdc`)

**Definition of Done проєкту:** конкурентний прибутковий продукт AI-новин із власною аудиторією,
повторюваним трафіком і ≥2 потоками доходу. (source: `docs/STARTUP-PLAN.md`)

Деталі архітектури — `.cursor/rules/00-core.mdc` і
[PIPELINE-GUIDE](../docs/PIPELINE-GUIDE.md) (майбутні `wiki/architecture/stack.md` та
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

(source: `docs/STARTUP-PLAN.md` §4.1)

**Диференціатор:** єдиний, хто поєднує (a) широкий топ-дайджест, (b) глибоку dev/vibe-coding
вертикаль як moat, (c) білінгву EN/UK (недообслужений UA/CEE-ринок), (d) мультиформат
(сайт + email + Telegram + соц + автошортси). (source: `docs/STARTUP-PLAN.md` §4.1)

**Ринковий фон 2026** (обґрунтовує людський publish-gate): березневий core-update за scaled content
abuse дав масовим AI-сайтам 60–80% падіння; AI Overviews зрізали CTR на 61%; 68% пошуків —
zero-click. (source: `docs/MASTER-ROADMAP.md` §6, §2 #12)

## 3. Монетизація і KPI

Порядок запуску потоків доходу: **1)** newsletter-спонсорство → **2)** premium $5–9/міс →
**3)** affiliate (AI Tools Directory) → **4)** data/API B2B → **5)** B2B-інтелідженс.
Перша монетизація зафіксована як спонсорство — нижчий поріг, не потребує paywall-інфри.
(source: `docs/STARTUP-PLAN.md` §4.3, §5)

Воронка KPI: `Impressions (соц/SEO) → Site sessions → Email subs → DAU/retention →
Sponsorship CPM → Premium MRR`. (source: `docs/STARTUP-PLAN.md` §4.5)

**Дохід станом на 2026-08-02 — $0.** Жоден потік ще не запущено. (source: `docs/OWNER-CHECKLIST.md` —
LemonSqueezy відкладено, спонсорство «через email спочатку»)

## 4. Бюджет і вартісні обмеження

Проєкт свідомо будується на **free tier + жорстких cap-ах** — це обмеження дизайну, не тимчасовість.

| Стаття | Стан | Джерело |
|---|---|---|
| LLM для pipeline | Gemini Flash (AI Studio free 250/день) → OpenRouter fallback → Ollama локально | `docs/PIPELINE-GUIDE.md` §4, `.env.example` |
| Картинки карток | Cloudflare Workers AI FLUX (free); без ключа — брендований duotone-fallback | `.env.example` |
| X (Twitter) постинг | hard cap **≤ €10/міс** у БД; резервація `X_POST_ESTIMATED_COST_EUR=0.40` на пост | `.env.example` |
| Weekly master LLM | оцінка $3/M input, $15/M output; є kill-switch `WEEKLY_CONTENT_STUDIO_V2=off` | `.env.example`, commit `c4abe06` |
| Social writer/critic LLM | оцінка $0.3/M input, $1/M output | `.env.example` |
| Хостинг/БД | Vercel + Supabase | `.cursor/rules/00-core.mdc` |

> ⚠️ Конкретні місячні витрати в доларах у репозиторії **не зафіксовані** — лише параметри оцінки.
> Реальний рахунок за місяць — `(needs verification)`, див. [open-questions](open-questions.md).

## 5. Жорсткі обмеження (не обговорюються без явного рішення)

1. **Людина твердить publish.** `briefs.status: draft → published` — тільки людина. Це
   E-E-A-T-moat і вимога AI Act щодо human oversight, а не вузьке місце.
   (source: `.cursor/rules/00-core.mdc`, `docs/MASTER-ROADMAP.md` §7 #4)
2. **Ніякого автопаблишу обсягом.** Дюжини тонких сторінок на день = scaled content abuse.
   (source: `docs/MASTER-ROADMAP.md` §6)
3. **Stripe заблокований в UA** → платежі лише через **LemonSqueezy** (Merchant of Record).
   (source: `.cursor/rules/00-core.mdc`, `.env.example`)
4. **Reddit Data API вимкнено** до письмового схвалення бізнес-кейсу; OAuth-креденшли самі по собі
   джерело не вмикають, публічний `*.json` скрапінг заборонений.
   (source: `.env.example`, `docs/REDDIT-COMPLIANCE.md`)
5. **`service_role` ключ живе тільки в pipeline** — ніколи `NEXT_PUBLIC_`, ніколи не імпортується
   під `src/`. (source: `.cursor/rules/00-core.mdc`)
6. **Ніколи не пушити в `main`**; перед пушем — `npm run pr:check`.
   (source: `.cursor/rules/pr-gate.mdc`, `package.json`)
7. **Next.js 16 — docs-first.** Читати `node_modules/next/dist/docs/` перед новим route.
   (source: `AGENTS.md`)
8. **Телеметрія — write-only, PII-free**, consent-gated, з bot-фільтром (`session_hash`, не сирий
   ip/ua). (source: `docs/MASTER-ROADMAP.md` §6)

## 6. Поточне вузьке місце

**Не якість відбору новин, а дистрибуція й індексація.** Станом на 2026-07-01: домену ~4 тижні,
**232 сторінки «Виявлено — не проіндексовано»**, Organic Search ≈ **13 користувачів/міс**,
201 із 229 нових користувачів — Direct (переважно свої, UA).
Технічний SEO-фундамент перевірено — **чистий**; причина = молодий домен + 0 беклінків +
відсутність дистрибуції. Лікується діями поза сайтом, не кодом.
(source: `docs/audit/2026-07-01-seo-organic-audit.md` §1, §2)

Детально — [2026-07-01-seo-organic-audit](../docs/audit/2026-07-01-seo-organic-audit.md).

## 7. Що НЕ спрацювало (найдорожчий розділ — читати перед плануванням)

| # | Що пробували | Результат | Джерело |
|---|---|---|---|
| 1 | Модалка підписки на розсилку | показана 41 → форму почали 8 → **підписка 1** | `docs/audit/2026-07-01-seo-organic-audit.md` §5 |
| 2 | Ставка на пасивне SEO | Week-1 retention ≈ **0**; без утримання зростання протікає | там само |
| 3 | Notion як прод-сторедж контенту | відкинуто: ~3 req/s rate limit, немає SQL/FTS/векторів, дорого на seats. Лишається лише як внутрішній editorial-інструмент | `docs/STARTUP-PLAN.md` §2.2 |
| 4 | ConvertKit / Mailchimp / самохост розсилки | відкинуто: дорожче й слабша монетизація / забагато делайверабіліті-ризику | `docs/STARTUP-PLAN.md` §7 |
| 5 | The Verge як джерело | 33 зібрано / **0 опубліковано** → authority демоутнуто до 0.55 | `docs/PIPELINE-GUIDE.md` §3 |
| 6 | cross-source вага 0.22 у rank | сигнал мертвий: середнє mentions ≈ 1.008, лише 5 рядків > 1 → **22% ваги марнується** | `docs/MASTER-ROADMAP.md` §2 #8 |
| 7 | «Автономний мозок», що публікує без людини | відхилено на всіх чотирьох планувальних артефактах: немає сигналу для навчання, немає часового ряду, немає reward | `docs/MASTER-ROADMAP.md` §1 |
| 8 | Побудова нових авто-поверхонь (`/models`, `/prompts`, `/deals`) до розблокування індексації | заблоковано: нові URL успадкують долю 232 неіндексованих | `docs/MASTER-ROADMAP.md` §1 |
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
IndexNow (Bing/Yandex). Повний перелік env — `.env.example`; портативність — `docs/SERVICES-PORTABILITY.md`.

> ⚠️ Conflict: [ANALYTICS](../docs/ANALYTICS.md) документує GA4-property **540206735**,
> а аудит 2026-07-01 показує активну **540467725**. Не довіряти жодній цифрі GA, доки не пройдено
> чек-лист звірки. Див. [open-questions](open-questions.md).

## Related pages

- [index](index.md) — карта всієї бази знань
- [now](now.md) — поточний операційний стан
- [open-questions](open-questions.md) — відкриті питання й конфлікти
- [MASTER-ROADMAP](../docs/MASTER-ROADMAP.md) — послідовність L0→L4 *(→ `wiki/strategy/`)*
- [PIPELINE-GUIDE](../docs/PIPELINE-GUIDE.md) — `fetch → rank → summarize → publish` *(→ `wiki/pipeline/`)*
- [decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md)
