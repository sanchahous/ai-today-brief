# After Hours — продуктовий baseline перед редизайном

Summary: AH-0.6 фіксує GA4-показники за 28 повних днів, пояснює три property для одного сайту й відокремлює доступні продуктові метрики від CWV, яких поки не вдалося отримати.
Sources: GA4 Data API через підключення HYPD (read-only запити 2026-09-29); live HTML `https://aitodaybrief.com/en` і Google tag `https://www.googletagmanager.com/gtag/js?id=G-5R89X6Q5D4` (2026-09-29); [аудит налаштування GA4](../audits/2026-06-12-analytics-gsc.md); `src/components/analytics/home-click-trackers.tsx`, `src/components/home/newsletter-form.tsx`, `src/app/api/subscribe/route.ts`, `src/lib/web-vitals.ts`.
Last updated: 2026-09-29

---

## Межі вимірювання

Період: **2026-09-01…2026-09-28 включно**, часовий пояс усіх трьох property — `Europe/Kiev`; дата зняття — **2026-09-29**. Для продуктових таблиць нижче застосовано `hostName = aitodaybrief.com` і property **`540206735`**, якщо явно не зазначено інше. `screenPageViews` рахує перегляди, `activeUsers` — користувачів, `sessions` — сеанси; числа з різних property не додаються. (source: GA4 Data API `properties/540206735:runReport`, dimensions `hostName`, `eventName` / `pagePath`, metrics `sessions`, `activeUsers`, `eventCount`, `screenPageViews`, дата запиту 2026-09-29)

**Статус усіх GA4-чисел у цій сторінці: `(needs verification)`.** Production property визначено за встановленим тегом, але Admin-чек-лист [open-questions #1](../open-questions.md#1-конфлікт-трьох-ga4-property) ще не завершено: ID двох додаткових потоків, GSC link, key event, retention і Tag Assistant треба звірити. Цей baseline придатний для порівняння за тією самою property й сегментом, але не є підставою підсумовувати трафік трьох property. (source: live HTML і Google tag 2026-09-29; [ga4-gsc](ga4-gsc.md))

## Чому три property отримують трафік

Production HTML містить один `gtag` ID — **`G-5R89X6Q5D4`** — і не містить `GTM-*`. Історичний аудит прив'язав цей measurement ID до потоку `The daily AI news` у **`540206735`**. Натомість конфігурація завантаженого Google tag `GT-KVJZSX7K` містить три `vtp_instanceDestinationId`: `G-5R89X6Q5D4`, `G-0TEJ3H5V85` і `G-T7X6D6TL84`. [Google описує](https://support.google.com/tagmanager/answer/11994839?hl=en), що один Google tag може надсилати події кільком destination. Це пояснює три звіти при одному тегу в коді. Прив'язка **двох додаткових** `G-*` до конкретних property ще потребує перевірки в Admin → Data streams; доступний конектор повертає stream ID, але не measurement ID. (source: live HTML / Google tag 2026-09-29; [аудит 12.06](../audits/2026-06-12-analytics-gsc.md) §6)

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

## Що лишається до G0

1. У GA4 Admin звірити measurement ID потоків `15017434008` і `15017406308` з двома додатковими destination `G-*`, потім вирішити, чи залишати потрійну доставку. Налаштування не змінювати за одним лише звітом. (source: live Google tag і GA4 Data API 2026-09-29)
   **Рекомендація:** після цієї звірки залишити `540206735` канонічною, а дві інші destinations
   від'єднати від tag, якщо вони не мають окремої погодженої мети; самі property з історією
   не видаляти. Це прибере три паралельні звіти надалі, але не перепише минулі дані. (analysis)
2. Пройти решту [чек-листа property](ga4-gsc.md): GSC link, `newsletter_subscribe` як key event, retention 14 місяців, Tag Assistant. До того всі GA4-метрики тут `(needs verification)`. (source: [open-questions #1](../open-questions.md#1-конфлікт-трьох-ga4-property))
3. Отримати mobile/desktop field CWV з Vercel Speed Insights або CrUX і вписати їх у таблицю з датою й URL. До цього AH-0.6 часткова, **G0 закритий**. (source: [епік After Hours](../product/after-hours-redesign-epic.md))

## Related pages

- [GA4 / GSC](ga4-gsc.md) — конфігурація й відкриті перевірки.
- [Event taxonomy](event-taxonomy.md) — значення продуктових подій.
- [After Hours epic](../product/after-hours-redesign-epic.md) — AC AH-0.6 і гейт G0.
