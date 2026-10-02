# Analytics — довідник (підтримувати актуальним!)

Summary: Єдина активна property 540206735; GSC link, newsletter_subscribe як key event, retention 14 місяців і Tag Assistant підтверджено доказами власника. Google tag продовжує надсилати звернення на три destinations; доля двох залишкових призначень — окреме рішення.
Sources: повідомлення й скриншоти власника 2026-09-30 (селектор property і деталі GSC link); HYPD `list_account_summaries` і live Google tag 2026-09-30; GA4 Data API 2026-09-29; `src/lib/analytics-config.ts`; [redesign baseline](2026-09-29-redesign-baseline.md)
Last updated: 2026-10-02

> Оновлено: **2026-10-02** (правила читання Singapore/China); стан property — **2026-09-30**. Якщо щось із цього змінюєш (property, ID, key events,
> env) — онови цей файл у тому ж PR.

## Поточний стан (перевірка 2026-09-30)

Власник перемістив у кошик акаунти `396975517` («Ai today brief») і `397017915`
(«Ai brief today»); GA підтвердив переміщення другого. Активним лишився акаунт
`396774992` («Ai brief today») з property `540206735`, потоком «The daily AI news»
і production measurement ID `G-5R89X6Q5D4`. HYPD `list_account_summaries` після цієї дії
повернув лише `396774992` / `540206735`. За повідомленням власника, акаунти можна
відновити через Admin → Кошик протягом 35 днів. (source: повідомлення власника
2026-09-30; HYPD `list_account_summaries`, live check 2026-09-30)

Завантажений Google tag досі містить `G-0TEJ3H5V85` і `G-T7X6D6TL84` поряд із
`G-5R89X6Q5D4`. Tag Assistant власника показує відправлені звернення `page_view`,
`newsletter_impression` і `web_vitals` до **всіх трьох destinations**. Це не доводить
приймання чи зберігання даних у property акаунтів у кошику. Код не містить ID зайвих
акаунтів, property чи двох додаткових measurement ID; він читає
`NEXT_PUBLIC_GA_MEASUREMENT_ID`. (source: скриншот Tag Assistant власника 2026-09-30;
[витяг доказів](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json);
HTTP GET Google tag і `rg` у коді 2026-09-30)

## Куди текли дані до переміщення акаунтів у кошик (перевірка 2026-09-29)

```
aitodaybrief.com
 └─ gtag.js  (NEXT_PUBLIC_GA_MEASUREMENT_ID = G-5R89X6Q5D4)
      ├─ page_view (SPA-роутер: src/components/analytics-provider.tsx → trackPageView)
      └─ всі КАСТОМНІ події коду: newsletter_subscribe, search, scroll_depth, …
         (src/lib/analytics-client.ts → trackEvent)

          → Google tag GT-KVJZSX7K з трьома destinations:
             G-5R89X6Q5D4 → потік 15002930155 «The daily AI news»
                            → property 540206735, акаунт 396774992
             G-0TEJ3H5V85 / G-T7X6D6TL84 → два інші потоки
                            → історичні property 540437869 і 540467725
                            (пару G-* ↔ property не було звірено)
```

**За 2026-09-01…28 дані надходили до трьох property.** Production HTML має лише
`G-5R89X6Q5D4` і не має GTM; JS цього Google tag містить усі три destination ID.
GA4 Data API підтвердив production-події в кожному з трьох потоків за 2026-09-01…28.
Для baseline After Hours обрано `540206735`, бо його measurement ID підтверджено
[аудитом 12.06](../audits/2026-06-12-analytics-gsc.md) і live HTML. Порівняння та обмеження —
у [redesign baseline](2026-09-29-redesign-baseline.md). (source: live HTML / Google tag і GA4 Data API 2026-09-29)

GTM-контейнер `GTM-5S6TXPG5` прибрано з коду
2026-08-22 (PR #312): жива перевірка контейнера показала `"tags":[]` і жодного
GA4-destination всередині — він не збирав нічого і лише додавав другий ID на кожну
сторінку (джерело плутанини «два GA4 ID»). `page_view` шле сам код через SPA-роутер,
`send_page_view:false` у config лишається коректним. Змінна `NEXT_PUBLIC_GTM_ID` у
Vercel більше не читається — можна видалити з env.

- **Search Console:** `sc-domain:aitodaybrief.com`.
- **Consent Mode v2:** analytics granted / ads denied за замовчуванням; CMP opt-out
  оновлює gtag consent (`applyConsentToGtag`).

## Admin-конфігурація канонічної property — перевірено 2026-09-30

Станом на 2026-09-29 усі три property отримують production-трафік; теза, що лише
`540467725` активна, була хибною. Дані в `540206735` ближчі до встановленого тегу і повніші
за 28-денний період; `540467725` недоотримала частину Singapore/direct `page_view` 25–28.09.
Причина відмінності ще не встановлена. (source: GA4 Data API, [redesign baseline](2026-09-29-redesign-baseline.md))

- [x] **Production measurement ID:** HTML `G-5R89X6Q5D4`, історично потік `540206735`.
  (source: live HTML 2026-09-29; [аудит 12.06](../audits/2026-06-12-analytics-gsc.md))
- [x] **Канонічна property:** власник залишив `540206735`; два зайві акаунти переміщено
  в кошик. Звірка двох додаткових measurement ID з потоками більше не є умовою G0.
  (source: повідомлення власника 2026-09-30; HYPD live check 2026-09-30)
- [x] **GSC ↔ GA4 link** для канонічної `540206735`: скриншот власника показує
  доменний ресурс `aitodaybrief.com`, потік «The daily AI news» / `15002930155`
  і дату зв'язування 2026-09-23; окремий скриншот підтверджує контекст акаунта
  `396774992` / property `540206735`. (source: два скриншоти власника 2026-09-30)
- [x] **Key event `newsletter_subscribe`**: зірочка активна. Також позначені
  `close_convert_lead` і `qualify_lead`; `purchase` не позначена. Список повідомляє,
  що потік даних за останні 28 днів не виявлено; це підтвердження налаштування,
  а не успішної фактичної підписки. Подія коду означає успішну відповідь subscribe API,
  окремої email-confirmed події немає. (source: повідомлення й скриншот власника
  2026-09-30; `src/components/home/newsletter-form.tsx`; [event-taxonomy](event-taxonomy.md))
- [x] **Data retention**: event data **14 місяців**, user data **14 місяців**;
  reset після нової дії користувача увімкнено. (source: скриншот власника 2026-09-30)
- [x] **Tag Assistant:** підключено `aitodaybrief.com`, знайдено `G-5R89X6Q5D4` /
  `GT-KVJZSX7K`; `page_view` відправлено на канонічний ID і дві залишкові destinations.
  На події Config `analytics_storage = granted`, `ad_storage`, `ad_user_data`,
  `ad_personalization = denied` — і початкові, і поточні значення. Сценарій opt-out
  у цих скриншотах не показано. (source: повідомлення й два скриншоти Tag Assistant
  власника 2026-09-30; [витяг доказів](../../artifacts/after-hours/analytics/2026-09-30-ga4-admin-verification.json))

Власник повідомив, що всі налаштування вже були такими, змін не робив.
Admin/Tag Assistant умови AH-0.6 закриті; очищення destinations не є умовою G0.
(source: повідомлення власника 2026-09-30)

## Пастка: схожі властивості

Для брифу активна `540206735`; `540437869` і `540467725` належали двом акаунтам,
які власник перемістив у кошик 2026-09-30. **Історично** всі три мали production-події
2026-09-01…28. Окремо `540281034` («sashakuzmenko») стосується портфоліо — не чіпати.
Двомовні сайти з однаковими шляхами `/en` `/uk` виглядають у звітах однаково —
звіряй property ID і stream ID, не лише назву. (source: повідомлення власника 2026-09-30;
HYPD live check 2026-09-30; GA4 Data API 2026-09-29;
[аудит 12.06](../audits/2026-06-12-analytics-gsc.md))

## Що налаштовано (стан 12.06.2026, property 540206735)

> Пункти нижче описують історичний стан `540206735` на 12.06; поточні Admin-налаштування
> звірено 2026-09-30 за чеклістом вище. Історична зірочка `purchase` тепер неактивна.

- ✅ Key event: **`newsletter_subscribe`** (= конверсія підписки на розсилку)
- ✅ Key event: `purchase` (дефолтний, незнімний)
- ✅ Data retention (event data): **14 місяців** (був дефолт 2)
- ✅ GSC ↔ GA4 link
- ✅ Consent Mode v2: analytics granted / ads denied за замовчуванням

> **2026-08-21:** покриття подій розширено (хаби, топ-новини, дайджести, воронка
> підписки, dwell) — повний каталог див.
> [event-taxonomy](event-taxonomy.md). Ця сторінка лишається довідником інфраструктури.

## Залишилось зробити (одноразово)

- [x] **Admin-чекліст канонічної property і Tag Assistant завершено** доказами власника 2026-09-30.
- [ ] **Окремо після G0:** власнику вирішити, чи прибрати дві залишкові destinations із
  Google tag; не змінювати tag без перевірки. (source: повідомлення власника 2026-09-30)
- [ ] **`sponsor_inquiry_click` → key event.** Подія ще жодного разу не надходила,
  тому її нема в списку. Коли хтось вперше клікне CTA на /advertise:
  Admin → Events → Recent events → зірочка біля `sponsor_inquiry_click`.
- [ ] (Опційно) Фільтр внутрішнього трафіку: Admin → Data streams → потік →
  Configure tag settings → Define internal traffic (потрібен статичний IP) +
  Admin → Data filters → активувати. Поки трафік малий, direct ≈ власні заходи.

## Як читати цифри (runbook)

- **Конверсії підписки:** Reports → Engagement → Key events (`newsletter_subscribe`).
- **Звідки трафік:** Reports → Acquisition → Traffic acquisition; розріз
  Session source/medium. Робочі канали станом на 12.06: Threads, Facebook.
- **Пошукові запити/кліки:** колекція Search Console у звітах GA, або напряму в
  GSC → Performance.
- **Singapore і China:** з ~22.09.2026 більшість «Direct» — автоматизований трафік (Tencent
  Cloud), див. [діагноз](2026-10-02-singapore-bot-traffic.md). Додавайте порівняння
  «Країна ≠ Singapore, China»; чистий baseline — 2026-09-01…21. Власні headless-перевірки
  (Playwright і т. п.) із 2026-10-02 PR мовчать у GA4 через `navigator.webdriver`; до того вони
  потрапляли в звіти як «Івано-Франківськ».
- **Тест-події:** одна синтетична `newsletter_subscribe` з
  `placement=ga-setup-test` відправлена 12.06.2026 (для появи події в списку) —
  у звітах за червень її можна ігнорувати/відфільтрувати за placement.

## Історія / повʼязане

- Повний аудит запуску: `wiki/audits/2026-06-12-analytics-gsc.md`
  (розділ 2 — виправлені цифри; 6.1 — як розплутали властивості).
- Чек-лист звірки property: §6
  [../audits/2026-07-01-seo-organic.md](../audits/2026-07-01-seo-organic.md).
- SEO-фікси 12.06: PR #76 (lastmod, brief→concept чипи, publisher.logo,
  canonical-fallback, пагінація sitemap, title головної).
- [event-taxonomy](event-taxonomy.md) — каталог подій коду (оновлено 2026-08-21).

## Related pages

- [event-taxonomy](event-taxonomy.md)
- [../seo/on-site-audit-2026-08-21](../seo/on-site-audit-2026-08-21.md)
