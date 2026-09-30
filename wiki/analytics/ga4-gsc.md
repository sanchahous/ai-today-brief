# Analytics — довідник (підтримувати актуальним!)

Summary: Довідник GA4 / GSC: єдина активна property 540206735; два зайві акаунти в кошику, а Google tag досі містить три destinations. Admin-чекліст відкритий.
Sources: повідомлення й скриншоти власника 2026-09-30 (селектор property і деталі GSC link); HYPD `list_account_summaries` і live Google tag 2026-09-30; GA4 Data API 2026-09-29; `src/lib/analytics-config.ts`; [redesign baseline](2026-09-29-redesign-baseline.md)
Last updated: 2026-09-30

> Оновлено: **2026-09-30**. Якщо щось із цього змінюєш (property, ID, key events,
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
`G-5R89X6Q5D4`. Це **залишкова конфігурація tag**, а не доказ фактичної доставки
до видалених акаунтів. Код не містить ID зайвих акаунтів, property чи двох додаткових
measurement ID; він читає `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Tag Assistant ще потрібен
для перевірки доставки й consent. (source: HTTP GET Google tag 2026-09-30; `rg` у
`src/`, `pipeline/`, `supabase/`, `e2e/`, `scripts/`, `public/` 2026-09-30)

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

## ⚠️ Відкрите питання: Admin-конфігурація канонічної property

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
- [ ] **Key event `newsletter_subscribe`** у `540206735` і семантика підтвердження.
- [ ] **Data retention** `540206735` = 14 місяців (історично 14; поточний стан не перевірено).
- [ ] **Tag Assistant:** перевірити `G-5R89X6Q5D4`, `page_view`, фактичну доставку й consent;
  відзначити залишкові destinations. Один HTML-тег сам по собі не доводить доставку.

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
> потребують повторної перевірки за чек-листом вище.

- ✅ Key event: **`newsletter_subscribe`** (= конверсія підписки на розсилку)
- ✅ Key event: `purchase` (дефолтний, незнімний)
- ✅ Data retention (event data): **14 місяців** (був дефолт 2)
- ✅ GSC ↔ GA4 link
- ✅ Consent Mode v2: analytics granted / ads denied за замовчуванням

> **2026-08-21:** покриття подій розширено (хаби, топ-новини, дайджести, воронка
> підписки, dwell) — повний каталог див.
> [event-taxonomy](event-taxonomy.md). Ця сторінка лишається довідником інфраструктури.

## Залишилось зробити (одноразово)

- [ ] **Завершити Admin-чекліст канонічної property і Tag Assistant вище**.
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
