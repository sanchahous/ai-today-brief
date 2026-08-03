# Index — карта бази знань AI Today Brief

Summary: головний зміст усієї wiki. Кожен рядок — одна сторінка + один рядок опису. Точка входу
для будь-якого питання: спершу читаємо цей файл, потім релевантні сторінки.
Sources: інвентаризація репозиторію (live check 2026-08-02)
Last updated: 2026-08-02

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
| 📋 `strategy/startup-plan.md` | Перехід зі скрапера в комерційний продукт: ranking, дистрибуція, монетизація, нейминг | `docs/STARTUP-PLAN.md` |
| 📋 `strategy/master-roadmap.md` | **Єдине джерело правди про послідовність:** хребет L0→L4 із гейтами | `docs/MASTER-ROADMAP.md` |
| 📋 `strategy/ai-trends-research.md` | Тренди + конкуренти + дворівневий відбір новин | `docs/AI-TRENDS-RESEARCH-STRATEGY.md` |
| 📋 `strategy/site-updates-plan.md` | Workstreams A–E, трихвильовий план оновлень сайту | `docs/SITE-UPDATES-IMPROVEMENT-PLAN.md` |

## Architecture — як побудовано

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [architecture/agentic-workflow](architecture/agentic-workflow.md) | Ця система: чотири зони, ролі агентів, MCP, ingest-контур | нове |
| 📋 `architecture/stack.md` | Next.js 16 / React 19 / TS strict / Tailwind v4 / Supabase — константи й заборони | `.cursor/rules/00-core.mdc` |
| 📋 `architecture/mvp-dev-handoff.md` | MVP dev handoff — вихідна специфікація продукту | `docs/07 — MVP Dev Handoff (AI Brief).md` |
| 📋 `architecture/prototype-to-production.md` | План переходу прототип → прод | `docs/08 — Prototype to Production Plan.md` |
| 📋 `architecture/data-model.md` | Схема Supabase, RLS, 59 міграцій, `database.types.ts` | `supabase/migrations/**` + live check |

## Pipeline — `fetch → rank → summarize → publish`

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `pipeline/guide.md` | Гайд власника: джерела, ваги скору, LLM-маршрутизація, Telegram-гейт | `docs/PIPELINE-GUIDE.md` |
| 📋 `pipeline/rank.md` | Формула скору, ваги, authority-таблиця, anti-clickbait, мертва cross-source вага | `docs/PIPELINE-GUIDE.md` §3 + `pipeline/rank.ts` |
| 📋 `pipeline/dedup-autopublish.md` | Ретроактивний dedup-скан і нічний авто-паблиш | `docs/DEDUP-AUTOPUBLISH-PLAN.md` |
| 📋 `pipeline/trend-engine.md` | Критика «автономного мозку», вердикт «спершу інструментуй» | `docs/TREND-ENGINE-ANALYSIS.md` |
| 📋 `pipeline/trend-engine-backtest.md` | Результати бектесту trend-index | `docs/TREND-ENGINE-BACKTEST-FINDINGS.md` |
| 📋 `pipeline/instrumentation-plan.md` | Пакет телеметрії PR-I1/I2/I3 (міграції 032/033/034) | `docs/INSTRUMENTATION-PR-PLAN.md` |
| 📋 `pipeline/weekly-digest.md` | Weekly Content Studio v2, редакційний відбір, вартісні гейти | `docs/weekly-editorial-selection.md` + PR #160–#163 |
| 📋 `pipeline/video-boundary.md` | Межа відео-pipeline | `docs/VIDEO-PIPELINE-BOUNDARY.md` |

## SEO / AEO

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `seo/indexation.md` | 232 «Виявлено — не проіндексовано», IndexNow, Bing/AEO, off-site чек-лист | `docs/audit/2026-07-01-seo-organic-audit.md` |
| 📋 `seo/aeo-strategy.md` | Structure-for-extraction, JSON-LD, `llms.txt`, entity-graph | `.cursor/rules/00-core.mdc` §SEO/AEO + `docs/MASTER-ROADMAP.md` L3 |

## Analytics

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `analytics/ga4-gsc.md` | GA4 property, GTM, key events, retention, **пастка двох властивостей** | `docs/ANALYTICS.md` |

## Marketing

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `marketing/linkedin-strategy.md` | LinkedIn-стратегія 2026 | `docs/marketing/LINKEDIN-STRATEGY-2026.md` |
| 📋 `marketing/linkedin-action-plan.md` | 90-денний покроковий план | `docs/marketing/LINKEDIN-ACTION-PLAN.md` |
| 📋 `marketing/company-page-playbook.md` | Playbook company-page | `docs/marketing/ATB-COMPANY-PAGE-PLAYBOOK.md` |
| 📋 `marketing/social-launch.md` | Запуск соцканалів | `docs/marketing/SOCIAL-LAUNCH.md` |
| 📋 `marketing/card-images.md` | Генерація банерів карток | `docs/marketing/CARD-IMAGES.md` |
| 📋 `marketing/custom-social-delivery.md` | Кастомна соц-доставка | `docs/marketing/CUSTOM-SOCIAL-DELIVERY.md` |

## Product

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `product/useful-tools-concept.md` | Концепт розділу AI Toolbox | `docs/product/USEFUL-TOOLS-CONCEPT.md` |
| 📋 `product/toolbox-wave1-spec.md` | Epic-спека: settings.json Builder + CLAUDE.md Generator | `docs/product/TOOLBOX-WAVE1-SETTINGS-AND-CLAUDEMD-SPEC.md` |
| 📋 `product/responsive-crossbrowser-audit.md` | Аудит адаптиву й крос-браузерності | `docs/product/RESPONSIVE-CROSSBROWSER-AUDIT.md` (+ FULL-REFERENCE) |
| 📋 `product/benchmark-protocol.md` | Протокол ATB-бенчмарку + epic-спека | `docs/benchmark/PROTOCOL.md`, `docs/benchmark/epic-spec.md` |

## Ops

| Сторінка | Про що | Звідки |
|---|---|---|
| ✅ [ops/mcp](ops/mcp.md) | MCP-сервери: chrome-devtools, apify, supabase, ahrefs, vercel | нове |
| 📋 `ops/owner-checklist.md` | Env-матриця, launch-блокери, go-live послідовність | `docs/OWNER-CHECKLIST.md` |
| 📋 `ops/social-cms-runbook.md` | Runbook соц-CMS | `docs/SOCIAL-CMS-RUNBOOK.md` |
| 📋 `ops/services-portability.md` | Портативність сервісів | `docs/SERVICES-PORTABILITY.md` |
| 📋 `ops/reddit-compliance.md` | Чому Reddit API вимкнено і що потрібно для вмикання | `docs/REDDIT-COMPLIANCE.md` |

## Audits

| Сторінка | Про що | Звідки |
|---|---|---|
| 📋 `audits/2026-06-10-portal.md` | Повний аудит порталу | `docs/audit/2026-06-10-portal-audit.md` |
| 📋 `audits/2026-06-12-analytics-gsc.md` | Аудит аналітики й GSC | `docs/audit/2026-06-12-analytics-gsc-audit.md` |
| 📋 `audits/2026-07-01-seo-organic.md` | Чому немає органіки | `docs/audit/2026-07-01-seo-organic-audit.md` |

## Decisions (ADR)

| Сторінка | Про що |
|---|---|
| ✅ [decisions/2026-08-02-knowledge-base-restructure](decisions/2026-08-02-knowledge-base-restructure.md) | Перехід на `raw/` · `wiki/` · `artifacts/` + покроковий план міграції |

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
| CI/CD | `.github/workflows/` (15 воркфлоу) | Інфраструктура |
| Дизайн-прототипи | → `raw/reference/prototypes/` | Незмінна референс-база (`docs/reference/prototypes/`) |
| Бренд-ассети (SVG/HTML) | → `artifacts/brand-kit/` | Готові до віддачі деліверабли (`docs/marketing/brand-kit/`) |
| MVP SQL-дамп | → `raw/db/` | Незмінний історичний дамп (`docs/07a — Supabase MVP migration.sql`) |

## Related pages

- [overview](overview.md)
- [now](now.md)
- [log](log.md)
- [architecture/agentic-workflow](architecture/agentic-workflow.md)
