# Index — карта бази знань AI Today Brief

Summary: головний зміст усієї wiki. Кожен рядок — одна сторінка + один рядок опису. Точка входу
для будь-якого питання: спершу читаємо цей файл, потім релевантні сторінки.
Sources: інвентаризація репозиторію (live check 2026-08-04), follow-up critic-recovery fix
2026-08-10, story-image rollout deduplication і three-concept illustration jury 2026-08-11,
experimental Visual Affordance V10 owner review 2026-08-13, illustration B1-fix 2026-08-15
Last updated: 2026-08-15

**Статуси:** ✅ сторінка існує · 📋 заплановано (джерело вказане в колонці «Звідки») ·
🔒 лишається поза wiki (код або поведінка агента).

---

## Ядро

| Сторінка | Про що |
|---|---|
| ✅ [overview](overview.md) | Бізнес-контекст: продукт, ринок, бюджет, обмеження, що НЕ спрацювало |
| ✅ [now](now.md) | Поточний операційний стан — над чим працюємо прямо зараз |
| ✅ [log](log.md) | Append-only журнал усіх операцій над базою знань |
| ✅ [open-questions](open-questions.md) | Відкриті питання, конфлікти джерел, неперевірені твердження |
| ✅ [_meta/page-template](_meta/page-template.md) | Шаблон сторінки — копіювати при створенні нової |

## Strategy — куди рухаємось

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [strategy/startup-plan](strategy/startup-plan.md) | Перехід зі скрапера в комерційний продукт: ranking, дистрибуція, монетизація, нейминг | колишній `docs/STARTUP-PLAN.md` |
| ✅ [strategy/master-roadmap](strategy/master-roadmap.md) | **Єдине джерело правди про послідовність:** хребет L0→L4 із гейтами | колишній `docs/MASTER-ROADMAP.md` |
| ✅ [strategy/ai-trends-research](strategy/ai-trends-research.md) | Тренди + конкуренти + дворівневий відбір новин | колишній `docs/AI-TRENDS-RESEARCH-STRATEGY.md` |
| ✅ [strategy/site-updates-plan](strategy/site-updates-plan.md) | Workstreams A–E, трихвильовий план оновлень сайту | колишній `docs/SITE-UPDATES-IMPROVEMENT-PLAN.md` |

## Architecture — як побудовано

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [architecture/agentic-workflow](architecture/agentic-workflow.md) | Ця система: чотири зони, ролі агентів, MCP, ingest-контур | нове |
| 📋 `architecture/stack.md` | Next.js 16 / React 19 / TS strict / Tailwind v4 / Supabase — константи й заборони | `.cursor/rules/00-core.mdc` |
| ✅ [architecture/mvp-dev-handoff](architecture/mvp-dev-handoff.md) | MVP dev handoff — вихідна специфікація продукту | колишній `docs/07 — MVP Dev Handoff` |
| ✅ [architecture/prototype-to-production](architecture/prototype-to-production.md) | План переходу прототип → прод | колишній `docs/08 — Prototype to Production Plan` |
| 📋 `architecture/data-model.md` | Схема Supabase, RLS, ~77 міграцій, `database.types.ts` | `supabase/migrations/**` + live check |

## Pipeline — `fetch → rank → summarize → publish`

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [pipeline/guide](pipeline/guide.md) | Гайд власника: джерела, ваги скору, LLM-маршрутизація, Telegram-гейт | колишній `docs/PIPELINE-GUIDE.md` |
| 📋 `pipeline/rank.md` | Формула скору, ваги, authority-таблиця, anti-clickbait, мертва cross-source вага | `pipeline/guide.md` §3 + `pipeline/rank.ts` |
| ✅ [pipeline/dedup-autopublish](pipeline/dedup-autopublish.md) | Ретроактивний dedup-скан і нічний авто-паблиш | колишній `docs/DEDUP-AUTOPUBLISH-PLAN.md` |
| ✅ [pipeline/trend-engine](pipeline/trend-engine.md) | Критика «автономного мозку», вердикт «спершу інструментуй» | колишній `docs/TREND-ENGINE-ANALYSIS.md` |
| ✅ [pipeline/trend-engine-backtest](pipeline/trend-engine-backtest.md) | Результати бектесту trend-index | колишній `docs/TREND-ENGINE-BACKTEST-FINDINGS.md` |
| ✅ [pipeline/instrumentation-plan](pipeline/instrumentation-plan.md) | Пакет телеметрії PR-I1/I2/I3 (міграції 032/033/034) | колишній `docs/INSTRUMENTATION-PR-PLAN.md` |
| ✅ [pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md) | Редакційний відбір weekly-дайджесту й fail-closed quality boundary | колишній `docs/weekly-editorial-selection.md` + `content-studio.ts` |
| ✅ [pipeline/weekly-digest](pipeline/weekly-digest.md) | Weekly Content Studio v2, durable workers, semantic story images v5.1: three-lens concept jury, 2×3 parallel loop, spend ledger і admin UX | `.env.example` + PR #160–#177/#208/#209/#222 + `card-image.ts` + `generation-worker.ts` |
| ✅ [pipeline/editorial-voice](pipeline/editorial-voice.md) | Редакційний голос weekly-дайджесту: prompt-leak захист, contrast-pairs, мовні й banned-phrase гейти, `numeric_parity` EN↔UK | `editorial-voice.ts`, owner sessions 2026-08-06/09 |
| ✅ [pipeline/weekly-master-failures](pipeline/weekly-master-failures.md) | Розбір збоїв `editorial_master` 09.08: 7 причин (таймаут CLI, tool-use, reasoning-сліпий stall-детектор, зелений прогін на провалі, фолбек, JSON-преамбула, відсутня UK/revise-драбина) | Actions runs + live sandbox 2026-08-09 |
| ✅ [pipeline/weekly-master-engine](pipeline/weekly-master-engine.md) | Ітеративний рушій `editorial_master`: посегментний запис із чекпоїнтом на кожен сегмент, точковий ремонт поля замість перегенерації, якість більше не валить джобу | `master-engine.ts` / `master-segments.ts` / `master-repair.ts`, owner session 2026-08-09 |
| ✅ [pipeline/content-sim](pipeline/content-sim.md) | Симуляція/бектест: per-concept 2×3 parallel vision loop, structural gates, advisory semantic planning, escalation, release gate | `pipeline/card-image.ts`, `src/lib/content-sim`, 2026-08-12 |
| ✅ [pipeline/weekly-illustration-plan](pipeline/weekly-illustration-plan.md) | Виконавча специфікація ілюстрацій після рішення 2026-08-15. B1-fix … M3 зроблено 2026-08-15 | owner review живого випуску 2026-08-14 + рішення власника 2026-08-15 + `AI_Today_Brief_Visual_Algorithm_Plan.pdf` |
| ✅ [pipeline/video-boundary](pipeline/video-boundary.md) | Межа відео-pipeline | колишній `docs/VIDEO-PIPELINE-BOUNDARY.md` |
| ✅ [pipeline/llm-providers](pipeline/llm-providers.md) | Уніфікований реєстр LLM-провайдерів (у розробці): навіщо, ключові знахідки, статус фаз | owner session 2026-08-06 |

## SEO / AEO

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `seo/indexation.md` | 232 «Виявлено — не проіндексовано», IndexNow, Bing/AEO, off-site чек-лист | `audits/2026-07-01-seo-organic.md` |
| 📋 `seo/aeo-strategy.md` | Structure-for-extraction, JSON-LD, `llms.txt`, entity-graph | `.cursor/rules/00-core.mdc` §SEO/AEO + `strategy/master-roadmap.md` L3 |

## Analytics

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [analytics/ga4-gsc](analytics/ga4-gsc.md) | GA4 property, GTM, key events, retention, **пастка двох властивостей** | колишній `docs/ANALYTICS.md` |

## Marketing

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [marketing/linkedin-strategy](marketing/linkedin-strategy.md) | LinkedIn-стратегія 2026 | колишній `docs/marketing/LINKEDIN-STRATEGY-2026.md` |
| ✅ [marketing/linkedin-action-plan](marketing/linkedin-action-plan.md) | 90-денний покроковий план | колишній `docs/marketing/LINKEDIN-ACTION-PLAN.md` |
| ✅ [marketing/company-page-playbook](marketing/company-page-playbook.md) | Playbook company-page | колишній `docs/marketing/ATB-COMPANY-PAGE-PLAYBOOK.md` |
| ✅ [marketing/social-launch](marketing/social-launch.md) | Запуск соцканалів | колишній `docs/marketing/SOCIAL-LAUNCH.md` |
| ✅ [marketing/card-images](marketing/card-images.md) | Daily cards + weekly semantic illustration v5.1: three-lens concept jury, reviewable per-round render history, causal fallback, per-concept vision gate | `pipeline/card-image.ts`, owner review + smoke renders 2026-08-12 |
| ✅ [marketing/custom-social-delivery](marketing/custom-social-delivery.md) | Кастомна соц-доставка | колишній `docs/marketing/CUSTOM-SOCIAL-DELIVERY.md` |

## Product

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [product/useful-tools-concept](product/useful-tools-concept.md) | Концепт розділу AI Toolbox | колишній `docs/product/USEFUL-TOOLS-CONCEPT.md` |
| ✅ [product/toolbox-wave1-spec](product/toolbox-wave1-spec.md) | Epic-спека: settings.json Builder + CLAUDE.md Generator | колишній `docs/product/TOOLBOX-WAVE1-…` |
| ✅ [product/responsive-crossbrowser-audit](product/responsive-crossbrowser-audit.md) | Аудит адаптиву й крос-браузерності | колишній `docs/product/RESPONSIVE-…` |
| ✅ [product/responsive-crossbrowser-reference](product/responsive-crossbrowser-reference.md) | Повний референс responsive-аудиту | колишній `docs/product/…FULL-REFERENCE` |
| ✅ [product/benchmark-protocol](product/benchmark-protocol.md) | Протокол ATB-бенчмарку | колишній `docs/benchmark/PROTOCOL.md` |
| ✅ [product/benchmark-epic-spec](product/benchmark-epic-spec.md) | Epic-спека бенчмарк-інфри | колишній `docs/benchmark/epic-spec.md` |

## Ops

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [ops/mcp](ops/mcp.md) | MCP-сервери: chrome-devtools, apify, supabase, ahrefs, vercel | нове |
| ✅ [ops/vercel-image-quota](ops/vercel-image-quota.md) | Інцидент 402 на `/_next/image`, власний loader через Supabase transform | live check 2026-08-14, `next.config.ts`, `src/lib/image-loader.ts` |
| ✅ [ops/owner-checklist](ops/owner-checklist.md) | Env-матриця, launch-блокери, go-live послідовність | колишній `docs/OWNER-CHECKLIST.md` |
| ✅ [ops/social-cms-runbook](ops/social-cms-runbook.md) | Runbook соц-CMS | колишній `docs/SOCIAL-CMS-RUNBOOK.md` |
| ✅ [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) | Як вести weekly у `/admin/weekly`: вкладки, succeeded≠approved, stuck jobs, async images та idempotent retry | нове 2026-08-04, оновлено 2026-08-11 |
| ✅ [ops/weekly-sandbox](ops/weekly-sandbox.md) | `weekly:doctor` + `weekly:sandbox`: префлайт провайдерів і повний прогін master-флоу на прод-даних без записів у прод | нове 2026-08-09 |
| ✅ [ops/services-portability](ops/services-portability.md) | Портативність сервісів | колишній `docs/SERVICES-PORTABILITY.md` |
| ✅ [ops/reddit-compliance](ops/reddit-compliance.md) | Чому Reddit API вимкнено і що потрібно для вмикання | колишній `docs/REDDIT-COMPLIANCE.md` |

## Audits

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [audits/2026-06-10-portal](audits/2026-06-10-portal.md) | Повний аудит порталу | колишній `docs/audit/2026-06-10-portal-audit.md` |
| ✅ [audits/2026-06-12-analytics-gsc](audits/2026-06-12-analytics-gsc.md) | Аудит аналітики й GSC | колишній `docs/audit/2026-06-12-analytics-gsc-audit.md` |
| ✅ [audits/2026-07-01-seo-organic](audits/2026-07-01-seo-organic.md) | Чому немає органіки | колишній `docs/audit/2026-07-01-seo-organic-audit.md` |
| ✅ [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md) | Review PR #229 (Visual Affordance V10) + executor spec для Sonnet 5: не мерджити як є, v11 total-function + SceneSpec | PR #229, workflow `wf_40755980-8f7` |

## Decisions (ADR)

| Сторінка | Про що |
|---|---|
| ✅ [decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md) | Перехід на `raw/` · `wiki/` · `artifacts/` + покроковий план міграції (кроки 1–8 виконано) |

## Research

Порожньо. Сюди йдуть summary-сторінки, згенеровані з `raw/` за
[ingest-workflow](architecture/agentic-workflow.md#ingest).

---

## Що лишається поза wiki 🔒

| Що | Де | Чому |
|---|---|---|
| Продуктовий код | `src/`, `pipeline/`, `supabase/`, `e2e/`, `scripts/`, `public/` | Це продукт, не знання. Правила — `.cursor/rules/` |
| Правила поведінки агента | `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*.mdc` | Поведінка ≠ знання |
| Skills-пул | `.agents/skills/`, `.claude/skills/`, `.cursor/skills/` | Інструментарій |
| CI/CD | `.github/workflows/` | Інфраструктура |
| Дизайн-прототипи | `raw/reference/prototypes/` | Незмінна референс-база |
| Бренд-ассети (SVG/HTML) | `artifacts/brand-kit/` | Готові до віддачі деліверабли |
| MVP SQL-дамп | `raw/db/2025-07a-supabase-mvp-migration.sql` | Незмінний історичний дамп |

## Related pages

- [overview](overview.md)
- [now](now.md)
- [log](log.md)
- [architecture/agentic-workflow](architecture/agentic-workflow.md)
