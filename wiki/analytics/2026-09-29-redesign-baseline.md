# After Hours — продуктовий baseline перед редизайном

Summary: AH-0.6 підготовлено до merge: канонічна GA4 property 540206735 та Admin/Tag Assistant перевірені доказами власника. Власник погодив лабораторний CWV baseline home/news/article з недостатніми CrUX-даними й виключив daily/weekly із вимоги AH-0.6.
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
Tag Assistant власника тепер підтверджує **відправлення звернень** на всі три ID;
приймання й зберігання в property акаунтів у кошику не встановлено. Очищення
залишкових destinations — окреме рішення власника, не умова G0.
(source: пошук `rg`, HTTP GET Google tag і скриншот Tag Assistant 2026-09-30;
[витяг доказів](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json))

## Межі вимірювання

**GSC link підтверджено 2026-09-30:** скриншот власника показує доменний ресурс
`aitodaybrief.com`, потік «The daily AI news» / `15002930155` і дату зв'язування
2026-09-23. Другий скриншот показує акаунт `396774992` / property `540206735`.
Нові скриншоти власника підтвердили `newsletter_subscribe` як key event,
event/user retention 14 місяців, `page_view` на канонічний ID і consent на Config:
analytics granted, ads denied. Налаштування не змінювалися. (source: повідомлення
й чотири нові скриншоти власника 2026-09-30; [ga4-gsc](ga4-gsc.md))

Період: **2026-09-01…2026-09-28 включно**, часовий пояс усіх трьох property — `Europe/Kiev`; дата зняття — **2026-09-29**. Для продуктових таблиць нижче застосовано `hostName = aitodaybrief.com` і property **`540206735`**, якщо явно не зазначено інше. `screenPageViews` рахує перегляди, `activeUsers` — користувачів, `sessions` — сеанси; числа з різних property не додаються. (source: GA4 Data API `properties/540206735:runReport`, dimensions `hostName`, `eventName` / `pagePath`, metrics `sessions`, `activeUsers`, `eventCount`, `screenPageViews`, дата запиту 2026-09-29)

**Конфлікт property й Admin-чекліст закрито 2026-09-30.** Загальну позначку
`(needs verification)` через невизначену property знято. API-числа лишаються
історичним baseline із межами вимірювання нижче: proxy-воронки, відсутня
email-confirmed подія, неповні cohort-ідентифікатори й невідома природа
Singapore/direct. Нові скриншоти не доводять причину історичних аномалій.
Звіти різних property не додаються. (source: повідомлення й скриншоти власника
2026-09-30; [ga4-gsc](ga4-gsc.md); GA4 Data API 2026-09-29)

## Чому три property отримували трафік у період baseline

Production HTML містить один `gtag` ID — **`G-5R89X6Q5D4`** — і не містить `GTM-*`. Історичний аудит прив'язав цей measurement ID до потоку `The daily AI news` у **`540206735`**. Натомість конфігурація завантаженого Google tag `GT-KVJZSX7K` містить три `vtp_instanceDestinationId`: `G-5R89X6Q5D4`, `G-0TEJ3H5V85` і `G-T7X6D6TL84`. [Google описує](https://support.google.com/tagmanager/answer/11994839?hl=en), що один Google tag може надсилати події кільком destination. Це пояснює три історичні звіти при одному тегу в коді. Прив'язку **двох додаткових** `G-*` до конкретних property не було перевірено; після переміщення зайвих акаунтів у кошик вона не є умовою G0. (source: live HTML / Google tag 2026-09-29; повідомлення власника 2026-09-30; [аудит 12.06](../audits/2026-06-12-analytics-gsc.md) §6)

| Property / акаунт | Потік GA4 | Production sessions | Production events | Production active users |
|---|---|---:|---:|---:|
| `540206735` / `396774992` | `15002930155` · The daily AI news | 1 069 | 8 204 | 1 034 |
| `540437869` / `396975517` | `15017434008` · aitodaybrief | 1 063 | 7 933 | 1 029 |
| `540467725` / `397017915` | `15017406308` · aitodaybrief | 738 | 5 917 | 708 |

Джерело таблиці: GA4 Data API, кожна з `properties/540206735`, `properties/540437869`, `properties/540467725`, dimensions `streamId`, `streamName`, `hostName`, metrics `sessions`, `eventCount`, `activeUsers`, `hostName = aitodaybrief.com`, період 2026-09-01…28, запит 2026-09-29. У кожній property окремо є також один `localhost`-сеанс і 39 подій, які виключено з таблиці. Числа є історичним API-знімком; методологічні обмеження наведено вище.

За Admin API property `540206735` створено 2026-06-04 06:42 UTC, а `540437869` і
`540467725` — 2026-06-06 18:13 та 18:16 UTC відповідно. Дві додаткові property могли бути
додані під час повторного налаштування 06.06, але журналу зміни Google tag у доступному
підключенні немає, тому це **гіпотеза**, а не доведена причина дії людини. Нинішній механізм
потрійної доставки підтверджено конфігурацією tag. (source: GA4 Admin API `getProperty`,
live Google tag, запити 2026-09-29)

**Робоча property для AH-0.6 — `540206735`.** Це єдиний потік, чий measurement ID незалежно підтверджено встановленим production-тегом. `540437869` повторює його `page_view` (1 171 проти 1 171 на всіх host), а `540467725` має 822. Різниця останньої виникає головно 25–28.09: у `540206735` є 702 `page_view` із Сінгапуру, з них 701 — `(direct) / (none)`; у `540467725` сингапурських переглядів 369. Причина неповної доставки до третьої property та якість цього трафіку не встановлені — автоматичним бот-трафіком його не оголошуємо. (source: GA4 Data API, `eventName = page_view`, dimensions `date`, `country`, `sessionSourceMedium`, періоди 2026-09-01…28 і 2026-09-25…28, запит 2026-09-29)

## Продуктові метрики

### Обсяг і маршрути

За 2026-09-01…28 production-хост має **1 069 sessions**, **1 034 active users**, **1 159 `page_view`**. GA4 `newVsReturning` окремо показує **9 returning active users / 31 sessions**; це категорія користувачів за весь період, а не 7-денний retention. (source: GA4 Data API `540206735`, `hostName = aitodaybrief.com`, dimensions `eventName`, `newVsReturning`, metrics `eventCount`, `activeUsers`, `sessions`, запит 2026-09-29; межі інтерпретації наведено в тексті)

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

Джерело таблиці: GA4 Data API `540206735`, dimensions `pagePath`, `hostName`, metric `screenPageViews`, фільтр `hostName = aitodaybrief.com`, повні 535 рядків за 2026-09-01…28, запит 2026-09-29. Маршрути `search`, `admin`, `digests` та інші не включено в наведені вісім груп; сума рядків не має дорівнювати всім `page_view`. Числа є історичним API-знімком; методологічні обмеження наведено вище.

### Запитані воронки

| Воронка | Baseline за 2026-09-01…28 | Інтерпретація |
|---|---|---|
| Home lead → article | 68 home views; `weekly_top_click` — 0; `hero_cta_click` — 1 | `1 / 68 = 1,5%` є лише **кліками hero на перегляд home**, не CTR lead → article: показ конкретного lead і його подальший article view не зв'язані у звіті. |
| Home → daily | 68 home views; 10 daily views | Це окремі перегляди, не послідовна воронка: події переходу home → daily у таксономії немає. |
| Weekly completion | `digest_view` **11** → `scroll_50` **1** → `story_open` **1** active users | GA4 `runFunnelReport`: до другого кроку дійшло `1 / 11 = 9,1%`; мала вибірка. Послідовність подій не доводить, що scroll і story open були на тій самій weekly-сторінці, отже це proxy, не підтверджене завершення читання. Усі три події є на production-хості; funnel API не підтримав у цьому конекторі додатковий host-фільтр. |
| Concept → guide → tool | 8 concept, 10 guide, 4 tool views | Це окремі page views; послідовне проходження не підтверджене й конверсія не обчислюється. |
| Newsletter | `newsletter_impression` **284** active users / **336** events → `newsletter_form_start` **0** → `newsletter_subscribe` **0** | Production-хост. GA4 funnel без host-фільтра показує 285 на першому кроці, зокрема 1 localhost-користувача. Подія `newsletter_subscribe` спрацьовує після успішної відповіді API Beehiiv, а не після окремого підтвердження листом; крок `confirmed` у GA4 відсутній. |

Джерело таблиці: GA4 Data API `540206735`, `eventName` / `pagePath`, `eventCount`, `activeUsers`, `screenPageViews`, production host-фільтр; для weekly і newsletter — `runFunnelReport` із послідовними eventName-кроками, 2026-09-01…28, запит 2026-09-29. Семантика кліків і підписки: `src/components/analytics/home-click-trackers.tsx`, `src/components/home/newsletter-form.tsx`, `src/app/api/subscribe/route.ts`, [event-taxonomy](event-taxonomy.md). Числа є історичним API-знімком; методологічні обмеження наведено вище.

### Повернення через 7 днів

Серед **192 нових користувачів** із датою першої сесії 2026-09-01…21 і production host-фільтром GA4 не повернув жодного рядка активності на пізнішу дату того самого вересневого cohort; спостережуване повернення до 7-го дня — **0/192**. Це **нижня межа за наявними ідентифікаторами**, а не достовірний продуктовий retention: `firstSessionDate = (not set)` присутній у 24 днях і дає сумарно 135 денних user-count (не 135 унікальних людей). Пізніші когорти виключено, бо їхні 7 днів ще не завершились. (source: GA4 Data API `540206735`, dimensions `firstSessionDate`, `date`, `hostName`, metrics `activeUsers`, `newUsers`, `hostName = aitodaybrief.com`, 2026-09-01…28, запит 2026-09-29; інтерпретація потребує перевірки, межі наведено в тексті)

### Аномалія в останні дні

З **808** усіх `page_view` 25–28.09 у `540206735` **702** припадають на Singapore, із них **701** — `(direct) / (none)`. Це **86,9%** переглядів за чотири дні. Після релізу порівнювати ті самі дні тижня, країни й джерела трафіку; окремо показувати загальний і Singapore/direct сегменти. Не вилучати цей трафік із baseline без доказу його природи. (source: GA4 Data API `540206735`, dimensions `date`, `country`, `sessionSourceMedium`, filter `eventName = page_view`, 2026-09-25…28, запит 2026-09-29; інтерпретація потребує перевірки, межі наведено в тексті)

## CWV: mobile і desktop

| Тип | Mobile LCP / INP / CLS | Desktop LCP / INP / CLS |
|---|---|---|
| Home (root → `/en`) | CrUX: недостатньо даних | CrUX: недостатньо даних |
| News index | CrUX: недостатньо даних | CrUX: недостатньо даних |
| News article (MoEmail) | CrUX: недостатньо даних | CrUX: недостатньо даних |
| Daily brief | виключено з AH-0.6 власником | виключено з AH-0.6 власником |
| Weekly | виключено з AH-0.6 власником | виключено з AH-0.6 власником |

Стан таблиці — **2026-09-30**, за HTML-звітами власника. У шести звітах для трьох
типів сторінок CrUX прямо повідомляє про недостатні дані сторінки; польових
p75 LCP/INP/CLS, вікна збору й origin fallback у збережених звітах немає. Це
не встановлює відсутності origin-level даних домену в інших джерелах.
(source: [витяг із шести HTML-звітів](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json))

**Погодження власника 2026-09-30:** CWV baseline home/news/article прийнято з
лабораторними метриками та зафіксованою відсутністю достатніх CrUX-даних.
Daily/weekly виключено з вимоги **AH-0.6**. Це виняток для baseline; бюджети
й перевірки CWV наступних фаз епіку не змінені. (source: пряме погодження
власника 2026-09-30; [епік](../product/after-hours-redesign-epic.md))

На 2026-09-29 перевірених **field**-значень для цих типів сторінок не отримано: офіційний PageSpeed Insights API двічі повернув HTTP 429 навіть для одного mobile URL, браузерна перевірка була зупинена перевіркою дозволів, а доступний Vercel-конектор не надає Speed Insights metrics. У репозиторії немає `@vercel/speed-insights`; події `web_vitals` у GA4 є, але в `540206735` немає зареєстрованих custom dimensions/metrics для `name` і `value`, тож із Data API не можна дістати перевірені LCP/INP/CLS. Це **відсутність доступного виміру**, а не твердження, що CrUX не має даних. [Google рекомендує CrUX API](https://developers.google.com/speed/docs/insights/v5/get-started) як джерело польових даних. (source: HTTP-запити 2026-09-29; список доступних Vercel-інструментів; `package.json`, `src/lib/web-vitals.ts`; GA4 Admin API custom definitions 2026-09-29)

## Повторна технічна звірка 2026-09-30

### PageSpeed-звіти, надані власником

Після помилки доступу браузера власник зберіг шість HTML-звітів у
`C:\Users\Oleksandr\Downloads\temp`. **Файли прочитано 2026-09-30** статичним
розбором без виконання скриптів. Кожен HTML містить mobile і desktop панелі;
для витягу вибрано активну панель, а метрики звірено між двома копіями звіту.
Назви файлів, SHA-256, URL, пристрої й усі витягнуті метрики збережено в
[JSON-витягу](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json).
Home перевірено як root URL із фінальним `/en`; решта URL не змінились.
Daily і weekly у наборі відсутні; власник виключив їх із вимоги AH-0.6 2026-09-30.
(source: HTML-файли власника 2026-09-30, JSON-витяг;
[картка AH-0.6](../product/after-hours-redesign-epic.md#ah-06-продуктовий-і-cwv-baseline))

| Ціль за адресою звіту | Mobile | Desktop |
|---|---|---|
| Home: `https://aitodaybrief.com/` | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com/d6pdbnzd3m?form_factor=mobile) | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com/d6pdbnzd3m?form_factor=desktop) |
| News: `/en/news` | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com-en-news/36ivm3stfy?form_factor=mobile) | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com-en-news/36ivm3stfy?form_factor=desktop) |
| Article: `/en/news/agents-and-mcp/automate-agent-email-verification-with-open-source-moemail-model-context-protoco` | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com-en-news-agents-and-mcp-automate-agent-email-verification-with-open-source-moemail-model-context-protoco/mflb8h6fye?form_factor=mobile) | [PageSpeed](https://pagespeed.web.dev/analysis/https-aitodaybrief-com-en-news-agents-and-mcp-automate-agent-email-verification-with-open-source-moemail-model-context-protoco/mflb8h6fye?form_factor=desktop) |

#### Лабораторний baseline Lighthouse — 2026-09-30

| Сторінка | Пристрій | Час (GMT+3) | Performance | FCP, с | LCP, с | TBT, мс | CLS | Speed Index, с |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Home → `/en` | Mobile | 12:23 | 95 | 1,2 | 1,2 | 180 | 0,102 | 2,0 |
| Home → `/en` | Desktop | 12:23 | 84 | 0,4 | 0,7 | 350 | 0,014 | 1,0 |
| `/en/news` | Mobile | 12:24 | 64 | 1,5 | 7,1 | 100 | 0,224 | 1,9 |
| `/en/news` | Desktop | 12:24 | 86 | 0,4 | 1,8 | 210 | 0,001 | 1,0 |
| Article (MoEmail) | Mobile | 12:27 | 95 | 1,7 | 2,3 | 140 | 0,070 | 1,7 |
| Article (MoEmail) | Desktop | 12:27 | 92 | 0,4 | 0,6 | 240 | 0,001 | 0,7 |

Джерело таблиці: [JSON-витяг](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json)
із шести збережених HTML. Lighthouse **13.5.0**, HeadlessChromium **153.0.8010.36**;
mobile — емульований Moto G Power, desktop — емульований комп'ютер. Це одиничні
лабораторні запуски; їхні LCP/CLS не є field p75, а TBT не є INP. Найгірший
mobile-результат у цій вибірці — news: LCP 7,1 с, CLS 0,224. Ці числа збережено
для порівняння наступних запусків; власник прийняв їх як baseline із винятком
щодо field-чисел для AH-0.6.
(source: HTML-звіти власника 2026-09-30, JSON-витяг)

### Попередні технічні перевірки цього дня

- `origin/main` оновлено до `a3d2db5`; PR #373–#376 залишаються відкритими, mergeable, з успішними CI-перевірками. Локальний manifest AH-0.3 містить 232 знімки й має SHA-256 `30ECF258C84FCE4B70622FC90F561D2C532F5290E0D18E2DA0FE41599EBF7EE2`; звіт AH-0.5 містить 812 сценаріїв. Це підтверджує наявність visual і QA baseline, але відкриті PR ще не є змерженими задачами. (source: `git fetch origin main`, `gh pr view 373`…`376`, `artifacts/_local/before/manifest.json`, `artifacts/_local/ah-0.5-legacy-report.json`, live check 2026-09-30)
- Production Google tag знову відповів HTTP 200 і містить `GT-KVJZSX7K` та всі три `G-*` ID. Це повторно підтверджує конфігурацію destinations, **але не замінює Tag Assistant** і не встановлює пару додатковий measurement ID ↔ GA4 stream. (source: HTTP GET Google tag 2026-09-30)
- До рішення власника HYPD Admin metadata підтверджували доступ до `540206735`, `540437869`, `540467725`; після переміщення двох акаунтів у кошик повторний `list_account_summaries` показав лише `540206735`. Read-only інструменти не повертають GSC link, key events чи retention. Доступ до GA4 Admin через браузер зупинила помилка перевірки збережених дозволів. На момент цієї ранньої спроби Admin-чекліст був неперевіреним; пізніше його закрито скриншотами власника (див. актуальний стан вище). (source: HYPD `list_account_summaries` / `get_property_details`, browser access check і повідомлення власника 2026-09-30)
- Повторний запит до PageSpeed Insights API для `/en` mobile повернув HTTP 429. Запит до офіційного [CrUX API](https://developer.chrome.com/docs/crux/api) з доступним локальним Google API key повернув HTTP 403; цей ключ не дав доступу до CrUX. У локальному `gcloud` немає активної авторизації чи вибраного проєкту для [CrUX BigQuery](https://developer.chrome.com/docs/crux/bigquery). Через це перевірених mobile/desktop field LCP, INP і CLS досі немає. HTTP 403/429 не доводять, що в CrUX немає даних сайту. (source: HTTP-запити та `gcloud auth list` / `gcloud config get-value project` 2026-09-30)

### Дані, потрібні для завершення AH-0.6

**Усі запитані докази отримано 2026-09-30.** Погоджений обсяг CWV — три типи,
mobile/desktop; daily/weekly виключені лише з AH-0.6. (source: пряме погодження
власника 2026-09-30; [витяг доказів](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json))

| Умова | Результат |
|---|---|
| Канонічна property | `540206735`, акаунт `396774992`, `G-5R89X6Q5D4` |
| GSC link | підтверджено для потоку `15002930155` |
| `newsletter_subscribe` key event | зірочка активна; фактичну нову підписку не тестували |
| Retention | event data і user data по 14 місяців |
| Tag Assistant | канонічний тег і `page_view`; Config consent analytics granted / ads denied |
| Залишкові destinations | звернення відправляються на обидва ID; приймання акаунтами в кошику не встановлено |
| CWV | лабораторний baseline home/news/article та недостатні CrUX-дані прийняті власником |

Джерела таблиці: повідомлення й скриншоти власника 2026-09-30;
[GA4 довідник](ga4-gsc.md), [витяг доказів](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json),
[PageSpeed витяг](../../artifacts/after-hours/analytics/2026-09-30-pagespeed-summary.json).

## Що лишається до G0

**G0 підписано власником 2026-09-30:** «Погоджую G0 та merge PR #373–#376».
Докази й AC AH-0.6 прийнято; інтеграція baseline — через
[PR #376](https://github.com/sanchahous/ai-today-brief/pull/376), після неї можна
продовжувати AH-1.3. Повторного погодження аналітики або підпису G0 не потрібно.
Пакет доказів — у [handoff](../product/after-hours-epic-handoff.md#пакет-для-підпису-g0).
Очищення destinations і причина Singapore/direct не блокують G0; вони лишаються
окремими питаннями. (source: пряме погодження власника 2026-09-30;
[витяг погодження](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json);
[епік](../product/after-hours-redesign-epic.md), [ga4-gsc](ga4-gsc.md))

## Related pages

- [GA4 / GSC](ga4-gsc.md) — конфігурація й відкриті перевірки.
- [Event taxonomy](event-taxonomy.md) — значення продуктових подій.
- [After Hours epic](../product/after-hours-redesign-epic.md) — AC AH-0.6 і гейт G0.
