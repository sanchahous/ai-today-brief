# Index — карта бази знань AI Today Brief

Summary: головний зміст усієї wiki. Кожен рядок — одна сторінка + один рядок опису. Точка входу
для будь-якого питання: спершу читаємо цей файл, потім релевантні сторінки.
Sources: інвентаризація репозиторію (live check 2026-08-04)
Last updated: 2026-08-04

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
| 📋 `architecture/data-model.md` | Схема Supabase, RLS, ~69 міграцій, `database.types.ts` | `supabase/migrations/**` + live check |

## Pipeline — `fetch → rank → summarize → publish`

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [pipeline/guide](pipeline/guide.md) | Гайд власника: джерела, ваги скору, LLM-маршрутизація, Telegram-гейт | колишній `docs/PIPELINE-GUIDE.md` |
| 📋 `pipeline/rank.md` | Формула скору, ваги, authority-таблиця, anti-clickbait, мертва cross-source вага | `pipeline/guide.md` §3 + `pipeline/rank.ts` |
| ✅ [pipeline/dedup-autopublish](pipeline/dedup-autopublish.md) | Ретроактивний dedup-скан і нічний авто-паблиш | колишній `docs/DEDUP-AUTOPUBLISH-PLAN.md` |
| ✅ [pipeline/trend-engine](pipeline/trend-engine.md) | Критика «автономного мозку», вердикт «спершу інструментуй» | колишній `docs/TREND-ENGINE-ANALYSIS.md` |
| ✅ [pipeline/trend-engine-backtest](pipeline/trend-engine-backtest.md) | Результати бектесту trend-index | колишній `docs/TREND-ENGINE-BACKTEST-FINDINGS.md` |
| ✅ [pipeline/instrumentation-plan](pipeline/instrumentation-plan.md) | Пакет телеметрії PR-I1/I2/I3 (міграції 032/033/034) | колишній `docs/INSTRUMENTATION-PR-PLAN.md` |
| ✅ [pipeline/weekly-editorial-selection](pipeline/weekly-editorial-selection.md) | Редакційний відбір weekly-дайджесту | колишній `docs/weekly-editorial-selection.md` |
| ✅ [pipeline/weekly-digest](pipeline/weekly-digest.md) | Weekly Content Studio v2, ревізії, spend-cap, admin UX, статус розкатки | `.env.example` + PR #160–#177 |
| ✅ [pipeline/editorial-voice](pipeline/editorial-voice.md) | Редакційний голос weekly-дайджесту: exemplars, contrast-pairs, banned-phrase гейт | `editorial-voice.ts`, owner session 2026-08-06 |
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
| ✅ [marketing/card-images](marketing/card-images.md) | Генерація банерів карток | колишній `docs/marketing/CARD-IMAGES.md` |
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
| ✅ [ops/owner-checklist](ops/owner-checklist.md) | Env-матриця, launch-блокери, go-live послідовність | колишній `docs/OWNER-CHECKLIST.md` |
| ✅ [ops/social-cms-runbook](ops/social-cms-runbook.md) | Runbook соц-CMS | колишній `docs/SOCIAL-CMS-RUNBOOK.md` |
| ✅ [ops/weekly-admin-runbook](ops/weekly-admin-runbook.md) | Як вести weekly у `/admin/weekly`: вкладки, succeeded≠approved, stuck jobs | нове 2026-08-04 |
| ✅ [ops/services-portability](ops/services-portability.md) | Портативність сервісів | колишній `docs/SERVICES-PORTABILITY.md` |
| ✅ [ops/reddit-compliance](ops/reddit-compliance.md) | Чому Reddit API вимкнено і що потрібно для вмикання | колишній `docs/REDDIT-COMPLIANCE.md` |

## Audits

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [audits/2026-06-10-portal](audits/2026-06-10-portal.md) | Повний аудит порталу | колишній `docs/audit/2026-06-10-portal-audit.md` |
| ✅ [audits/2026-06-12-analytics-gsc](audits/2026-06-12-analytics-gsc.md) | Аудит аналітики й GSC | колишній `docs/audit/2026-06-12-analytics-gsc-audit.md` |
| ✅ [audits/2026-07-01-seo-organic](audits/2026-07-01-seo-organic.md) | Чому немає органіки | колишній `docs/audit/2026-07-01-seo-organic-audit.md` |

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
