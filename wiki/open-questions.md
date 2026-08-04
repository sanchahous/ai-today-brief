# Open questions — відкриті питання й конфлікти

Summary: усе, що не має відповіді, суперечить саме собі або не перевірено. Кожен пункт має
власника рішення й критерій закриття. Порожній пункт видаляти не можна — тільки закривати
записом «закрито: …».
Sources: `wiki/analytics/ga4-gsc.md`, `wiki/audits/2026-07-01-seo-organic.md`, `wiki/strategy/master-roadmap.md`,
`.env.example`, `wiki/pipeline/weekly-digest.md`, інвентаризація репозиторію (live check 2026-08-04)
Last updated: 2026-08-04

---

## 1. ⚠️ Conflict: яка GA4-property справжня

[ANALYTICS](analytics/ga4-gsc.md) документує property **540206735** (акаунт `396774992`),
а аудит 2026-07-01 показує активну **540467725** (акаунт `397017915`), яка отримує реальні
`page_view`. (source: `wiki/analytics/ga4-gsc.md`, `wiki/audits/2026-07-01-seo-organic.md` §6)

**Наслідок:** жодна цифра конверсій/retention недостовірна, доки не звірено.
**Закривається:** пройдено чек-лист §6 аудиту (measurement ID у Vercel, GSC-link, key event
`newsletter_subscribe`, retention 14 міс, рівно один GA4-config тег у Tag Assistant) і оновлено
`analytics/ga4-gsc.md`. **Власник рішення:** власник продукту.

## 2. Реальні місячні витрати проєкту невідомі

У репозиторії є **параметри оцінки** (`WEEKLY_LLM_*`, `SOCIAL_LLM_*`, `CLOUDFLARE_IMAGE_USD_*`)
і event-ledger `generation_cost_events` + UI `/admin/costs` (PR #169), але не зведений
фактичний рахунок провайдерів за місяць. (source: `.env.example`, PR #169)

**Закривається:** зафіксовано фактичні витрати за місяць (Vercel + Supabase + Gemini/OpenRouter +
Cloudflare + X) у [overview](overview.md) §4 поруч із ledger. **Власник рішення:** власник продукту.

## 3. Reddit Data API — статус запиту

Джерело вимкнено до письмового схвалення; за нотатками сесій створення script-app падає, а запит
висить без відповіді. `(needs verification)` — у репозиторії підтвердження немає, лише env-гейт
`REDDIT_DATA_API_APPROVED`. (source: `.env.example`, `wiki/ops/reddit-compliance.md`)

**Закривається:** або отримано схвалення, або зафіксовано «глухий кут» окремою сторінкою
`ops/reddit-compliance.md` з датою останньої спроби.

## 4. Weekly Content Studio v2 — коли `shadow → production`

Прапорець `WEEKLY_CONTENT_STUDIO_V2=off`; передбачений шлях — три історичні випуски у `shadow`.
Сторінка [pipeline/weekly-digest](pipeline/weekly-digest.md) описує режим і spend-cap, але
**числовий критерій** переходу в `production` (макс. $ / випуск + якісний чек-лист) ще не
затверджений. (source: `.env.example`, `wiki/pipeline/weekly-digest.md`)

**Закривається:** власник записує поріг у [weekly-digest](pipeline/weekly-digest.md) і
підтверджує три shadow-прогони з `/admin/costs`.

## 5. Порогові значення L1→L2 гейта не перевірені на живих даних

`MASTER-ROADMAP` вимагає ≥95% покриття `composite_score`, ≥2 знімки на multi-cycle історію і
joinable reward перед калібруванням ваг. Чи досягнуто — не перевірялося після червня.
(source: `wiki/strategy/master-roadmap.md` §L1)

**Закривається:** SQL-звірка проти прод-БД + запис результату в `pipeline/instrumentation-plan.md`.

## 6. Мертва cross-source вага (0.22) — лагодити чи перерозподілити

Сигнал mentions ≈ 1.008 → 22% ваги ранжування марнується. Рішення «полагодити кластеризацію»
vs «перерозподілити на velocity/authority» досі не ухвалене.
(source: `wiki/strategy/master-roadmap.md` §2 #8, §L2)

**Закривається:** ADR у `decisions/` + bump `SCORE_VERSION`.

## 7. Куди кладемо вихідний PDF воркшопу

`WorkShop 23-25_07 Prompts. Personal.pdf` лежить у `Downloads` власника, а не в `raw/research/`.
Файл особистий, репозиторій має публічний remote — копіювання не виконано навмисно.

**Закривається:** власник каже «копіюй у `raw/research/`» або «лишаємо поза репо» (тоді цитата
залишається у форматі `(source: WorkShop 23-25_07 Prompts. Personal.pdf, поза репо)`).

## Related pages

- [overview](overview.md)
- [now](now.md)
- [index](index.md)
- [log](log.md)
