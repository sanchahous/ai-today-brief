# Open questions — відкриті питання й конфлікти

Summary: усе, що не має відповіді, суперечить саме собі або не перевірено. Кожен пункт має
власника рішення й критерій закриття. Порожній пункт видаляти не можна — тільки закривати
записом «закрито: …».
Sources: `wiki/analytics/ga4-gsc.md`, `wiki/analytics/2026-09-29-redesign-baseline.md`, `wiki/audits/2026-07-01-seo-organic.md`, `wiki/strategy/master-roadmap.md`,
`.env.example`, `wiki/pipeline/weekly-digest.md`, інвентаризація репозиторію (live check 2026-08-04),
`wiki/audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md`, `wiki/product/after-hours-redesign-epic.md` (live check коду 2026-09-29),
`wiki/analytics/2026-10-02-singapore-bot-traffic.md`, `wiki/ops/vercel-origin-transfer.md` (live check Vercel 2026-10-02)
Last updated: 2026-10-02

---

## 1. ⚠️ Конфлікт трьох GA4-property

**Рішення власника 2026-09-30:** канонічною лишається `540206735` в акаунті
`396774992` («Ai brief today») з `G-5R89X6Q5D4`. Акаунти `396975517`
(«Ai today brief», property `540437869`) і `397017915` («Ai brief today», property
`540467725`) переміщено в кошик; GA підтвердив переміщення другого. Повторний
HYPD `list_account_summaries` показує лише `396774992` / `540206735`. Тому
питання вибору property і звірка measurement ID потоків видалених акаунтів для G0
**закриті**. (source: повідомлення власника 2026-09-30; HYPD live check 2026-09-30)

**З'ясовано 2026-09-29:** production HTML завантажує `G-5R89X6Q5D4`, який історичний аудит
прив'язав до **540206735**. Завантажений Google tag має ще два destinations; GA4 Data API
підтвердив трафік того самого `aitodaybrief.com` у **540437869** і **540467725** за
2026-09-01…28. Отже попереднє формулювання «яка property справжня» приховувало потрійну
доставку; для baseline обрано **540206735**, а сума трьох звітів не є аудиторією сайту.
(source: [ga4-gsc](analytics/ga4-gsc.md); [redesign baseline](analytics/2026-09-29-redesign-baseline.md))

**GSC link підтверджено 2026-09-30:** скриншоти власника показують зв'язок домену
`aitodaybrief.com` з потоком `15002930155` і контекст property `540206735`.
**Закрито 2026-09-30:** скриншоти власника підтвердили `newsletter_subscribe`
як key event, retention event/user data по 14 місяців, канонічний тег і
`page_view` у Tag Assistant; Config consent analytics granted / ads denied.
Налаштування вже були такими, власник їх не змінював. Загальна невизначеність
property/Admin для baseline усунута. (source: повідомлення й чотири скриншоти
власника 2026-09-30; [ga4-gsc](analytics/ga4-gsc.md))

Tag Assistant показує звернення й на `G-0TEJ3H5V85` / `G-T7X6D6TL84`;
приймання подій property акаунтів у кошику не встановлено. Очищення destinations
потребує окремого рішення власника, не є умовою G0. Причина історичної різниці
Singapore/direct між property досі невідома; це окрема межа інтерпретації,
а не незакритий вибір property. (source: скриншоти Tag Assistant власника
2026-09-30; [redesign baseline](analytics/2026-09-29-redesign-baseline.md))

**З'ясовано 2026-10-02: природа Singapore/direct.** Це автоматизований трафік із Tencent
Cloud (AS132203), підтверджений даними Vercel Firewall і логів; Івано-Франківськ — власні
headless-перевірки редизайну (підтвердив власник). Причина *різниці між property* (369
проти 702 сингапурських `page_view` у третій property) лишається невідомою, але вона вже
не впливає на висновок про природу трафіку: акаунти двох інших property переміщено в кошик.
Оператор бота й механізм не встановлені; Bot Protection працює в режимі `Log`.
(source: [2026-10-02-singapore-bot-traffic](analytics/2026-10-02-singapore-bot-traffic.md))

## 2. Реальні місячні витрати проєкту невідомі

У репозиторії є **параметри оцінки** (`WEEKLY_LLM_*`, `SOCIAL_LLM_*`, `CLOUDFLARE_IMAGE_USD_*`,
`OPENROUTER_CACHE_HIT_RATE=0.182`, `OPENROUTER_FREE_QUALITY_FLOOR_DELTA`,
`OPENROUTER_PROVIDER_UPTIME_FLOOR`, `OPENROUTER_PROVIDER_MAX_LATENCY_S`,
`OPENROUTER_MAX_PRICE_PER_MILLION=1.5`)
і event-ledger `generation_cost_events` + UI `/admin/costs` (PR #169), але не зведений
фактичний рахунок провайдерів за місяць. (source: `.env.example`, PR #169)

**G (2026-08-15):** `/admin/costs` тепер показує кошики ілюстрацій з ledger (новини / weekly
API / промпти+QA). Це **не** закриває питання — інвойсів провайдерів усе ще немає, і weekly
master LLM у ці кошики навмисно не входить.
(source: [weekly-illustration-plan](pipeline/weekly-illustration-plan.md) G)

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
Окремо (не це питання): `WEEKLY_STORY_IMAGE_MODE=prompt_only` — weekly story/cover не рендерять
FLUX за замовчуванням; відкат = `render`. (source: `.env.example`, 2026-08-15)
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

## 8. ✅ Закрито частково 2026-08-13: числа V10 виявились артефактом вимірювання

**Закрито:** переоцінка виправленим харнесом виконана (Actions run
[`31739283280`](https://github.com/sanchahous/ai-today-brief/actions/runs/31739283280), $0.0149).
Ті самі пікселі, той самий суддя, змінені лише правила: **V10 hard integrity 3/3 → 0/3**,
blind preference **3-0 → 1-1 з однією нічиєю**, різниця зважених балів 33.1 → **0.5** пункта
(при виміряному шумі судді 15.5). V8 headline-grounded зріс 0/3 → 2/3, щойно його перестали
оцінювати за специфікацією конкурента. Обидві гілки провалюють hard integrity за однаковими
правилами. (source:
`experiments/visual-affordance-v10/targeted-v7-corrected-harness/README.md`)

**Лишається відкритим:** чи V10 кращий за **продакшн**. У targeted-серії V10 продакшн-гілку
прибрали (порівнювали v10 проти v8), n=3, історії підібрані за попередніми owner-відмовами,
позиційного свапу немає, суддя один.

> ⚠️ Коригує редакцію від 2026-08-13: тут було «`pipeline/card-image.ts` у порівнянні не брав
> участі жодного разу». Це неправда — у прогонах v6/v7 гілка `current` і є продакшн
> (`scripts/visual-compiler-v6-render-ab.ts:310` → `generateWeeklyReportageIllustrations`,
> підтверджено таймінгом 190 с/виклик). Помилка стосувалась лише пізніх V10-прогонів.
> Практичний наслідок: у W4 третю гілку треба **повернути**, а не будувати з нуля.

**Закривається:** W4 плану —
[audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md).
**Власник рішення:** власник продукту.

<details>
<summary>Початкове формулювання конфлікту (2026-08-13, до переоцінки)</summary>

### ⚠️ Conflict: які числа V10 справжні і чи є він кращим за продакшн

[now](now.md), V6 `evaluation-report.md` і `wiki/log.md` наводять «3/3 hard integrity, 3–0 blind
preference» для Visual Affordance V10. Пакет
`artifacts/visual-affordance-v10-owner-review-complete/evaluation-report.md` був насправді
прогоном **v3** з **1/3** integrity (підтверджено побайтовим порівнянням git blob); у W0 цю теку
видалено як стару копію — той самий звіт лишається в
`experiments/visual-affordance-v10/targeted-v3/results/`. Незалежно від
того, який файл актуальний, обидва числа отримані вимірюванням, у якому hard-блокер
`generated_text` вимкнено лише для кандидата, рубрика для обох гілок узята зі специфікації
кандидата, а описи гілок підставлені судді підписаними. Baseline при цьому — не продакшн, а
скачаний артефакт застарілого компілятора.
(source: [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md),
`scripts/visual-affordance-v10-targeted-evaluate.ts:374,406-412,483`)

**Наслідок:** жодна цифра з PR #229 не може бути підставою для production promotion, і
залишається без відповіді головне питання — чи V10 узагалі кращий за поточний
`pipeline/card-image.ts` (у targeted-серії V10 продакшн-гілки не було; у v6/v7 вона була —
див. коригування вище).

**Закривається:** виконано W0 і W4 плану (симетричний text-гейт, blind за сторонами, заморожена
рубрика, holdout ≥12 з історіями, де owner віддав перевагу baseline, третя гілка = продакшн із
`main`, judge↔owner kappa ≥0.6), числа перевипущені й записані сюди та в
[now](now.md). **Власник рішення:** власник продукту.

</details>

## 9. Weekly OpenRouter writer: cap=1 лишає лише `:free`

Живий каталог 2026-08-30 15:12 UTC: при `WEEKLY_MASTER_OPENROUTER_CANDIDATES=1` (дефолт)
`weekly.master_writer` бере **лише** `z-ai/glm-5.2:free` (AA 52.6). Моделі з вищою якістю
на social-mix (`meta/muse-spark-1.2` 56.8, `google/gemini-3.7-flash` 56.0) не проходять
weekly mix prompt 0.2 / completion 0.8 під стелю $1.5/M. Платний запас існує
(`openai/gpt-5.6-luna` 52.3 / $0.99/M), але при cap=1 до нього не дійдуть, якщо glm
відмовить (лімітер 20/хв, JSON, мережа) — тоді фолбек на наступний **провайдер**, не на
наступну платну модель OpenRouter.
(source: live `rankModelsForRole` 2026-08-30, `.env.example`,
[weekly-digest](pipeline/weekly-digest.md))

**Закривається:** власник лишає free-first **або** піднімає `WEEKLY_MASTER_OPENROUTER_CANDIDATES`
до 2 (glm + luna) і записує рішення сюди. **Власник рішення:** власник продукту.

## 10. ✅ Закрито 2026-09-29: чи закриті розриви дизайн-системи G01–G20

**Закрито: 2026-09-29, задача AH-0.1.** Звірку виконано за кодом і живою перевіркою production:
закрито **6 із 20** розривів (G01, G03, G04, G08, G10, G20), 10 закрито частково, 2 відкриті (G06,
G17), G18 — policy, G19 — знято рішенням власника. Твердження «закрито 20» з [now](now.md) від
2026-09-28 не підтверджене й виправлене там. Таблиця з доказами по кожному G —
[gap-plan §10](audits/2026-09-26-design-system-gap-plan.md#10-статус-на-2026-09-29-звірка-ah-01).
Власник підтверджує звірку мержем PR. Текст нижче — історія конфлікту, збережена без змін.

[now](now.md) (запис 2026-09-28, гілка `feat/design-system-gap-implementation`) каже «Закрито 20
розривів (G01–G20)». Live check коду 2026-09-29 (`main` @ `3debff1`) показує інше: `tokens.ts`
імпортує лише `scripts/check-design-tokens.ts`, а `src/app/globals.css` досі на legacy-палітрі
`#0f0f0f` / `#f0c040` (G10); фасету Topics / Tool немає в `src/lib/news-filters.ts` (G06); legacy
`src/components/pagination.tsx` досі використовує `post-feed.tsx` (G11); каталогу компонентів,
state matrix, ratchet-звіту на сирі значення й usability-даних немає (G13, G15, G19, G20).
[after-hours-redesign](product/after-hours-redesign.md) §1 теж фіксує, що токени 2.0 не перенесені
й результатів G19 немає. Повна таблиця статусів — [after-hours-redesign-epic](product/after-hours-redesign-epic.md) §14.
(source: grep `src/` 2026-09-29; `git show f920671 --stat`)

**Оновлення 2026-09-29 після PR #369 (`3f47256`):** частину розривів закрито — G10 (токени 2.0 в
`tokens.ts` і `globals.css`), G20 (каталог `/ds-catalog`), частково G09, G11, G13–G16; G19 знято
рішенням власника (сесії пропущено). Відкритими за кодом лишаються G05, G06, G17, частково G07, G09,
G11–G16. Оновлення gap-plan від #369 не згадує G05–G07 і міграцію споживачів на нові компоненти
(G16), а запис `now.md` від 2026-09-28 і далі стверджує, що закрито всі 20. (source: grep `src/`
після rebase на `3f47256`; [epic readiness](product/after-hours-epic-readiness.md))

**Наслідок:** хто читає лише `now.md`, вважатиме дизайн-систему завершеною і пропустить залишок
фаз 1–2 епіку. **Закривається:** задача AH-0.1 епіку — таблиця статусів із доказами в gap-plan і
виправлене формулювання в `now.md`. **Власник рішення:** агент готує звірку, власник підтверджує.

## 11. ⚠️ Consent Mode: opt-in на Preview vs production opt-out (2026-09-30)

> ⚠️ Conflict: [ga4-gsc](analytics/ga4-gsc.md) документує production Tag Assistant власника
> **2026-09-30** з `analytics_storage=granted` за замовчуванням (opt-out CMP). PR
> [#396](https://github.com/sanchahous/ai-today-brief/pull/396) / AH-3.6 змінює код на
> `analytics_storage: denied` (opt-in) у `consent-mode-snippet.ts` і `analytics-client.ts` —
> це AC епіку («до вибору — жодного GA collect»), але суперечить верифікованому production-стану.

**Закривається:** власник підтверджує на Vercel Preview Tag Assistant після push PR #396:
Config показує `analytics_storage=denied` до вибору, GA collect лише після «Accept all»;
«Essential only» лишає analytics denied. **Власник рішення:** власник продукту.
(source: [ga4-gsc](analytics/ga4-gsc.md); PR #396; `e2e/cookie-overlay.spec.ts` 2026-10-02)

## 12. Fast Origin Transfer над лімітом Hobby (12,97 / 10 ГБ за 30 днів)

Проєкт на Hobby, FOT за останні 30 днів 12,97 ГБ при ліміті 10 ГБ; листи Vercel 24.08
грозили авто-паузою, але минулий цикл перейшов ліміт без блокування. Поточний цикл
26.09–26.10 іде до ≈14–15 ГБ (оцінка). Причина — ISR-регенерації від широти обходу
краулерами й деплоїв, а не сінгапурський бот; TTL даних 1 год мовчки перекривав 24 год
сторінки статті, виправлено в PR цієї перевірки. Невідомо: що саме зробить Vercel після
10 ГБ, реальний розклад по маршрутах (Observability потребує Pro), чи справді рядки «Pro»
у білінг-експорті не списання. **Власник рішення:** власник — лишатися на Hobby чи
перейти на Pro. **Закривається:** FOT за цикл 26.09–26.10 виміряно після деплою PR і
порівняно з ≈490 МБ/добу; рішення про план зафіксовано.
(source: [vercel-origin-transfer](ops/vercel-origin-transfer.md) § Повторна перевірка 2026-10-02)

## Related pages

- [overview](overview.md)
- [now](now.md)
- [index](index.md)
- [log](log.md)
