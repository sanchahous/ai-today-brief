# Open questions — відкриті питання й конфлікти

Summary: усе, що не має відповіді, суперечить саме собі або не перевірено. Кожен пункт має
власника рішення й критерій закриття. Порожній пункт видаляти не можна — тільки закривати
записом «закрито: …».
Sources: `docs/ANALYTICS.md`, `docs/audit/2026-07-01-seo-organic-audit.md`, `docs/MASTER-ROADMAP.md`,
`.env.example`, інвентаризація репозиторію (live check 2026-08-02)
Last updated: 2026-08-02

---

## 1. ⚠️ Conflict: яка GA4-property справжня

[ANALYTICS](../docs/ANALYTICS.md) документує property **540206735** (акаунт `396774992`),
а аудит 2026-07-01 показує активну **540467725** (акаунт `397017915`), яка отримує реальні
`page_view`. (source: `docs/ANALYTICS.md`, `docs/audit/2026-07-01-seo-organic-audit.md` §6)

**Наслідок:** жодна цифра конверсій/retention недостовірна, доки не звірено.
**Закривається:** пройдено чек-лист §6 аудиту (measurement ID у Vercel, GSC-link, key event
`newsletter_subscribe`, retention 14 міс, рівно один GA4-config тег у Tag Assistant) і оновлено
`analytics/ga4-gsc.md`. **Власник рішення:** власник продукту.

## 2. Реальні місячні витрати проєкту невідомі

У репозиторії є лише **параметри оцінки** вартості LLM (`WEEKLY_LLM_*`, `SOCIAL_LLM_*`) і hard cap
на X (≤ €10/міс), але не фактичний рахунок за місяць. (source: `.env.example`)

**Закривається:** зафіксовано фактичні витрати за місяць (Vercel + Supabase + Gemini/OpenRouter +
Cloudflare + X) у [overview](overview.md) §4. **Власник рішення:** власник продукту.

## 3. Reddit Data API — статус запиту

Джерело вимкнено до письмового схвалення; за нотатками сесій створення script-app падає, а запит
висить без відповіді. `(needs verification)` — у репозиторії підтвердження немає, лише env-гейт
`REDDIT_DATA_API_APPROVED`. (source: `.env.example`, `docs/REDDIT-COMPLIANCE.md`)

**Закривається:** або отримано схвалення, або зафіксовано «глухий кут» окремою сторінкою
`ops/reddit-compliance.md` з датою останньої спроби.

## 4. Weekly Content Studio v2 — коли `shadow → production`

Прапорець `WEEKLY_CONTENT_STUDIO_V2=off`; передбачений шлях — три історичні випуски у `shadow`.
Критерій переходу в `production` ніде не зафіксовано числом. (source: `.env.example`)

**Закривається:** записано поріг (вартість на випуск + якісний критерій) у `pipeline/weekly-digest.md`.

## 5. Порогові значення L1→L2 гейта не перевірені на живих даних

`MASTER-ROADMAP` вимагає ≥95% покриття `composite_score`, ≥2 знімки на multi-cycle історію і
joinable reward перед калібруванням ваг. Чи досягнуто — не перевірялося після червня.
(source: `docs/MASTER-ROADMAP.md` §L1)

**Закривається:** SQL-звірка проти прод-БД + запис результату в `pipeline/instrumentation-plan.md`.

## 6. Мертва cross-source вага (0.22) — лагодити чи перерозподілити

Сигнал mentions ≈ 1.008 → 22% ваги ранжування марнується. Рішення «полагодити кластеризацію»
vs «перерозподілити на velocity/authority» досі не ухвалене.
(source: `docs/MASTER-ROADMAP.md` §2 #8, §L2)

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
