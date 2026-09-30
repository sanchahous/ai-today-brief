# After Hours — продуктовий baseline перед редизайном

Summary: AH-0.6 фіксує історичний GA4 baseline за 28 повних днів; зараз активна лише property 540206735, два зайві акаунти в кошику; Admin-чекліст і field CWV відкриті.
Sources: повідомлення власника 2026-09-30; HYPD `list_account_summaries` 2026-09-30; GA4 Data API через HYPD (read-only запити 2026-09-29); live HTML `https://aitodaybrief.com/en` і Google tag `https://www.googletagmanager.com/gtag/js?id=G-5R89X6Q5D4` (2026-09-29 і 2026-09-30); [аудит налаштування GA4](../audits/2026-06-12-analytics-gsc.md); `artifacts/_local/before/manifest.json` (AH-0.3); [CrUX API](https://developer.chrome.com/docs/crux/api); `src/components/analytics/home-click-trackers.tsx`, `src/components/home/newsletter-form.tsx`, `src/app/api/subscribe/route.ts`, `src/lib/web-vitals.ts`.
Last updated: 2026-09-30

---

## Актуальний стан після рішення власника 2026-09-30

Активний акаунт — `396774992` («Ai brief today»), property `540206735` з потоком
«The daily AI news» і production ID `G-5R89X6Q5D4`. Власник перемістив у кошик
`396975517` («Ai today brief», property `540437869`) і `397017915` («Ai brief today»,
property `540467725`); GA підтвердив переміщення другого. Повторний HYPD
`list_account_summaries` повернув лише активні `396774992` / `540206735`. За
повідомленням власника, кошик дозволяє відновлення протягом 35 днів. Історичні
цифри нижче залишаються знімком **до** переміщення акаунтів у кошик. (source:
повідомлення власника 2026-09-30; HYPD `list_account_summaries` 2026-09-30)

Код не містить ID двох зайвих акаунтів/property чи їхніх додаткових measurement ID;
Google tag, який завантажується для `G-5R89X6Q5D4`, досі містить три destinations.
Факт наявності ID у tag не встановлює, чи доставляються події до акаунтів у кошику.
Tag Assistant залишається необхідним. (source: пошук `rg` у коді 2026-09-30;
HTTP GET Google tag 2026-09-30)

## Межі вимірювання

Період: **2026-09-01…2026-09-28 включно**, часовий пояс усіх трьох property — `Europe/Kiev`; дата зняття — **2026-09-29**. Для продуктових таблиць нижче застосовано `hostName = aitodaybrief.com` і property **`540206735`**, якщо явно не зазначено інше. `screenPageViews` рахує перегляди, `activeUsers` — користувачів, `sessions` — сеанси; числа з різних property не додаються. (source: GA4 Data API `properties/540206735:runReport`, dimensions `hostName`, `eventName` / `pagePath`, metrics `sessions`, `activeUsers`, `eventCount`, `screenPageViews`, дата запиту 2026-09-29)

**Статус усіх GA4-чисел у цій сторінці: `(needs verification)`.** Канонічну property власник визначив як `540206735`, але її GSC link, key event, retention і фактичну доставку через Tag Assistant ще треба звірити. Зв'язок двох додаткових ID із потоками більше не є умовою G0. Цей baseline придатний для порівняння за тією самою property й сегментом, але історичні звіти трьох property не слід підсумовувати. (source: повідомлення власника 2026-09-30; [ga4-gsc](ga4-gsc.md))

## Чому три property отримували трафік у період baseline

Production HTML містить один `gtag` ID — **`G-5R89X6Q5D4`** — і не містить `GTM-*`. Історичний аудит прив'язав цей measurement ID до потоку `The daily AI news` у **`540206735`**. Натомість конфігурація завантаженого Google tag `GT-KVJZSX7K` містить три `vtp_instanceDestinationId`: `G-5R89X6Q5D4`, `G-0TEJ3H5V85` і `G-T7X6D6TL84`. [Google описує](https://support.google.com/tagmanager/answer/11994839?hl=en), що один Google tag може надсилати події кільком destination. Це пояснює три історичні звіти при одному тегу в коді. Прив'язку **двох додаткових** `G-*` до конкретних property не було перевірено; після переміщення зайвих акаунтів у кошик вона не є умовою G0. (source: live HTML / Google tag 2026-09-29; повідомлення власника 2026-09-30; [аудит 12.06](../audits/2026-06-12-analytics-gsc.md) §6)

| Property / акаунт | Потік GA4 | Production sessions | Production events | Production active users |
|---|---|---:|---:|---:|
| `540206735` / `396774992` | `15002930155` · The daily AI news | 1 069 | 8 204 | 1 034 |
| `540437869` / `396975517` | `15017434008` · aitodaybrief | 1 063 | 7 933 | 1 029 |
| `540467725` / `397017915` | `15017406308` · aitodaybrief | 738 | 5 917 | 708 |

Джерело таблиці: GA4 Data API, кожна з `properties/540206735`, `properties/540437869`, `properties/540467725`, dimensions `streamId`, `streamName`, `hostName`, metrics `sessions`, `eventCount`, `activeUsers`, `hostName = aitodaybrief.com`, період 2026-09-01…28, запит 2026-09-29. У кожній property окремо є також один `localhost`-сеанс і 39 подій, які виключено з таблиці. Усі числа `(needs verification)`.

За Admin API property `540206735` створено 2026-06-04 06:42 UTC, а `540437869` і
`540467725` — 2026-06-06 18:13 та 18:16 UTC відповідно. Дві додаткові property могли бути
додані під час повторного налаштування 06.06, але журналу зміни Google tag у доступному
підключенні немає, тому це **гіпотеза**, а не доведена причина дії людини. Нинішній механізм
потрійної доставки підтверджено конфігурацією tag. (source: GA4 Admin API `getProperty`,
live Google tag, запити 2026-09-29)

**Робоча property для AH-0.6 — `540206735`.** Це єдиний потік, чий measurement ID незалежно підтверджено встановленим production-тегом. `540437869` повторює його `page_view` (1 171 проти 1 171 на всіх host), а `540467725` має 822. Різниця останньої виникає головно 25–28.09: у `540206735` є 702 `page_view` із Сінгапуру, з них 701 — `(direct) / (none)`; у `540467725` сингапурських переглядів 369. Причина неповної доставки до третьої property та якість цього трафіку не встановлені — автоматичним бот-трафіком його не оголошуємо. (source: GA4 Data API, `eventName = page_view`, dimensions `date`, `country`, `sessionSourceMedium`, періоди 2026-09-01…28 і 2026-09-25…28, запит 2026-09-29)

## Продуктові метрики

### Обсяг і маршрути

За 2026-09-01…28 production-хост має **1 069 sessions**, **1 034 active users**, **1 159 `page_view`**. GA4 `newVsReturning` окремо показує **9 returning active users / 31 sessions**; це категорія користувачів за весь період, а не 7-денний retention. (source: GA4 Data API `540206735`, `hostName = aitodaybrief.com`, dimensions `eventName`, `newVsReturning`, metrics `eventCount`, `activeUsers`, `sessions`, запит 2026-09-29; усі числа `(needs verification)`)

| Тип маршруту | `screenPageViews` | Метод групування |
|---|---:|---|
| Home | 68 | `/en`, `/uk` |
| News index | 21 | `/en/news`, `/uk/news` |
| News article | 919 | `/en/news/*`, `/uk/news/*`, крім `/news/search` |
| Daily brief | 10 | п'ять production-шляхів `/{lang}/{brief}` за `src/app/[lang]/[brief]/page.tsx` |
| Weekly | 18 | `/{lang}/weekly/*` |
| Concepts | 8 | `/{lang}/concepts*` |
| Guides | 10 | `/{lang}/guides*` |
| Tools | 4 | `/{lang}/tools*` |

Джерело таблиці: GA4 Data API `540206735`, dimensions `pagePath`, `hostName`, metric `screenPageViews`, фільтр `hostName = aitodaybrief.com`, повні 535 рядків за 2026-09-01…28, запит 2026-09-29. Маршрути `search`, `admin`, `digests` та інші не включено в наведені вісім груп; сума рядків не має дорівнювати всім `page_view`. Усі числа `(needs verification)`.

### Запитані воронки

| Воронка | Baseline за 2026-09-01…28 | Інтерпретація |
|---|---|---|
| Home lead → article | 68 home views; `weekly_top_click` — 0; `hero_cta_click` — 1 | `1 / 68 = 1,5%` є лише **кліками hero на перегляд home**, не CTR lead → article: показ конкретного lead і його подальший article view не зв'язані у звіті. |
| Home → daily | 68 home views; 10 daily views | Це окремі перегляди, не послідовна воронка: події переходу home → daily у таксономії немає. |
| Weekly completion | `digest_view` **11** → `scroll_50` **1** → `story_open` **1** active users | GA4 `runFunnelReport`: до другого кроку дійшло `1 / 11 = 9,1%`; мала вибірка. Послідовність подій не доводить, що scroll і story open були на тій самій weekly-сторінці, отже це proxy, не підтверджене завершення читання. Усі три події є на production-хості; funnel API не підтримав у цьому конекторі додатковий host-фільтр. |
| Concept → guide → tool | 8 concept, 10 guide, 4 tool views | Це окремі page views; послідовне проходження не підтверджене й конверсія не обчислюється. |
| Newsletter | `newsletter_impression` **284** active users / **336** events → `newsletter_form_start` **0** → `newsletter_subscribe` **0** | Production-хост. GA4 funnel без host-фільтра показує 285 на першому кроці, зокрема 1 localhost-користувача. Подія `newsletter_subscribe` спрацьовує після успішної відповіді API Beehiiv, а не після окремого підтвердження листом; крок `confirmed` у GA4 відсутній. |

Джерело таблиці: GA4 Data API `540206735`, `eventName` / `pagePath`, `eventCount`, `activeUsers`, `screenPageViews`, production host-фільтр; для weekly і newsletter — `runFunnelReport` із послідовними eventName-кроками, 2026-09-01…28, запит 2026-09-29. Семантика кліків і підписки: `src/components/analytics/home-click-trackers.tsx`, `src/components/home/newsletter-form.tsx`, `src/app/api/subscribe/route.ts`, [event-taxonomy](event-taxonomy.md). Усі числа `(needs verification)`.

### Повернення через 7 днів

Серед **192 нових користувачів** із датою першої сесії 2026-09-01…21 і production host-фільтром GA4 не повернув жодного рядка активності на пізнішу дату того самого вересневого cohort; спостережуване повернення до 7-го дня — **0/192**. Це **нижня межа за наявними ідентифікаторами**, а не достовірний продуктовий retention: `firstSessionDate = (not set)` присутній у 24 днях і дає сумарно 135 денних user-count (не 135 унікальних людей). Пізніші когорти виключено, бо їхні 7 днів ще не завершились. (source: GA4 Data API `540206735`, dimensions `firstSessionDate`, `date`, `hostName`, metrics `activeUsers`, `newUsers`, `hostName = aitodaybrief.com`, 2026-09-01…28, запит 2026-09-29; `(needs verification)`)

### Аномалія в останні дні

З **808** усіх `page_view` 25–28.09 у `540206735` **702** припадають на Singapore, із них **701** — `(direct) / (none)`. Це **86,9%** переглядів за чотири дні. Після релізу порівнювати ті самі дні тижня, країни й джерела трафіку; окремо показувати загальний і Singapore/direct сегменти. Не вилучати цей трафік із baseline без доказу його природи. (source: GA4 Data API `540206735`, dimensions `date`, `country`, `sessionSourceMedium`, filter `eventName = page_view`, 2026-09-25…28, запит 2026-09-29; `(needs verification)`)

## CWV: mobile і desktop

| Тип | Mobile LCP / INP / CLS | Desktop LCP / INP / CLS |
|---|---|---|
| Home | н/д | н/д |
| News index | н/д | н/д |
| News article | н/д | н/д |
| Daily brief | н/д | н/д |
| Weekly | н/д | н/д |

На 2026-09-29 перевірених **field**-значень для цих типів сторінок не отримано: офіційний PageSpeed Insights API двічі повернув HTTP 429 навіть для одного mobile URL, браузерна перевірка була зупинена перевіркою дозволів, а доступний Vercel-конектор не надає Speed Insights metrics. У репозиторії немає `@vercel/speed-insights`; події `web_vitals` у GA4 є, але в `540206735` немає зареєстрованих custom dimensions/metrics для `name` і `value`, тож із Data API не можна дістати перевірені LCP/INP/CLS. Це **відсутність доступного виміру**, а не твердження, що CrUX не має даних. [Google рекомендує CrUX API](https://developers.google.com/speed/docs/insights/v5/get-started) як джерело польових даних. (source: HTTP-запити 2026-09-29; список доступних Vercel-інструментів; `package.json`, `src/lib/web-vitals.ts`; GA4 Admin API custom definitions 2026-09-29)

## Повторна технічна звірка 2026-09-30

- `origin/main` оновлено до `a3d2db5`; PR #373–#376 залишаються відкритими, mergeable, з успішними CI-перевірками. Локальний manifest AH-0.3 містить 232 знімки й має SHA-256 `30ECF258C84FCE4B70622FC90F561D2C532F5290E0D18E2DA0FE41599EBF7EE2`; звіт AH-0.5 містить 812 сценаріїв. Це підтверджує наявність visual і QA baseline, але відкриті PR ще не є змерженими задачами. (source: `git fetch origin main`, `gh pr view 373`…`376`, `artifacts/_local/before/manifest.json`, `artifacts/_local/ah-0.5-legacy-report.json`, live check 2026-09-30)
- Production Google tag знову відповів HTTP 200 і містить `GT-KVJZSX7K` та всі три `G-*` ID. Це повторно підтверджує конфігурацію destinations, **але не замінює Tag Assistant** і не встановлює пару додатковий measurement ID ↔ GA4 stream. (source: HTTP GET Google tag 2026-09-30)
- До рішення власника HYPD Admin metadata підтверджували доступ до `540206735`, `540437869`, `540467725`; після переміщення двох акаунтів у кошик повторний `list_account_summaries` показав лише `540206735`. Read-only інструменти не повертають GSC link, key events чи retention. Доступ до GA4 Admin через браузер зупинила помилка перевірки збережених дозволів. Пункти Admin-чекліста нижче залишаються неперевіреними. (source: HYPD `list_account_summaries` / `get_property_details`, browser access check і повідомлення власника 2026-09-30)
- Повторний запит до PageSpeed Insights API для `/en` mobile повернув HTTP 429. Запит до офіційного [CrUX API](https://developer.chrome.com/docs/crux/api) з доступним локальним Google API key повернув HTTP 403; цей ключ не дав доступу до CrUX. У локальному `gcloud` немає активної авторизації чи вибраного проєкту для [CrUX BigQuery](https://developer.chrome.com/docs/crux/bigquery). Через це перевірених mobile/desktop field LCP, INP і CLS досі немає. HTTP 403/429 не доводять, що в CrUX немає даних сайту. (source: HTTP-запити та `gcloud auth list` / `gcloud config get-value project` 2026-09-30)

### Дані, потрібні для завершення AH-0.6

1. У GA4 Admin **property `540206735`** зафіксувати GSC link, статус `newsletter_subscribe` як key event та event-data retention. У Tag Assistant для production перевірити `G-5R89X6Q5D4`, `page_view`, доставку й consent; відзначити дві залишкові destinations. Не потрібно відкривати акаунти в кошику або звіряти їхні measurement ID для G0. Долю залишкових destinations власник може вирішити окремо після перевірки; до того tag не змінювати. (source: повідомлення власника 2026-09-30; [ga4-gsc](ga4-gsc.md))
2. Отримати CrUX URL-level `PHONE` і `DESKTOP` LCP/INP/CLS для репрезентативних URL нижче або еквівалентні mobile/desktop field-дані Vercel Speed Insights. Записати дату, вікно даних, URL, пристрій і p75; якщо для URL немає достатньо даних, позначити це окремо й не видавати origin-level метрику за метрику типу сторінки. (source: [CrUX API](https://developer.chrome.com/docs/crux/api); URL — AH-0.3 `artifacts/_local/before/manifest.json`)

| Тип | URL для польової перевірки |
|---|---|
| Home | `https://aitodaybrief.com/en` |
| News index | `https://aitodaybrief.com/en/news` |
| News article | `https://aitodaybrief.com/en/news/tools-and-releases/deep-dive-into-chatgpt-work-persistent-filesystem-web-browser-and-cloud-deployme` |
| Daily brief | `https://aitodaybrief.com/en/reasoning-token-compression-and-efficient-agent-execution` |
| Weekly | `https://aitodaybrief.com/en/weekly/multiverse-s-4-bit-model-beats-16-bit-nvidia-grades-its-own-2026-08-23` |

## Що лишається до G0

1. Пройти [чекліст канонічної property](ga4-gsc.md): GSC link, `newsletter_subscribe` як key event, retention 14 місяців і Tag Assistant. До цього всі GA4-метрики тут `(needs verification)`. Рішення про канонічний акаунт уже ухвалене власником; очищення залишкових destinations — окремий наступний крок після перевірки, не новий підпис для G0. (source: повідомлення власника 2026-09-30; [open-questions #1](../open-questions.md#1-конфлікт-трьох-ga4-property))
2. Отримати mobile/desktop field CWV з Vercel Speed Insights або CrUX і вписати їх у таблицю з датою й URL. До цього AH-0.6 часткова, **G0 закритий**. (source: [епік After Hours](../product/after-hours-redesign-epic.md))

## Related pages

- [GA4 / GSC](ga4-gsc.md) — конфігурація й відкриті перевірки.
- [Event taxonomy](event-taxonomy.md) — значення продуктових подій.
- [After Hours epic](../product/after-hours-redesign-epic.md) — AC AH-0.6 і гейт G0.
