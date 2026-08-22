# Analytics — довідник (підтримувати актуальним!)

Summary: Довідник GA4 / GSC: property, measurement ID, key events. Один тег збору — прямий gtag.
Sources: live check aitodaybrief.com + GTM-контейнера 2026-08-22, `src/lib/analytics-config.ts`
Last updated: 2026-08-22

> Оновлено: **2026-08-22**. Якщо щось із цього змінюєш (property, ID, key events,
> env) — онови цей файл у тому ж PR.

## Куди течуть дані (архітектура, стан 2026-08-22)

```
aitodaybrief.com
 └─ gtag.js  (NEXT_PUBLIC_GA_MEASUREMENT_ID = G-5R89X6Q5D4)
      ├─ page_view (SPA-роутер: src/components/analytics-provider.tsx → trackPageView)
      └─ всі КАСТОМНІ події коду: newsletter_subscribe, search, scroll_depth, …
         (src/lib/analytics-client.ts → trackEvent)

          → потік «The daily AI news»
           → GA4 property «aitodaybrief» (540467725, акаунт «Ai brief today» 397017915) ← активна
```

**Єдиний тег збору — прямий gtag.** GTM-контейнер `GTM-5S6TXPG5` прибрано з коду
2026-08-22 (PR #312): жива перевірка контейнера показала `"tags":[]` і жодного
GA4-destination всередині — він не збирав нічого і лише додавав другий ID на кожну
сторінку (джерело плутанини «два GA4 ID»). `page_view` шле сам код через SPA-роутер,
`send_page_view:false` у config лишається коректним. Змінна `NEXT_PUBLIC_GTM_ID` у
Vercel більше не читається — можна видалити з env.

- **Search Console:** `sc-domain:aitodaybrief.com`.
- **Consent Mode v2:** analytics granted / ads denied за замовчуванням; CMP opt-out
  оновлює gtag consent (`applyConsentToGtag`).

## ⚠️ Відкритe питання: яка property правильна (з 2026-07-01)

Експорти власника й посилання на звіти показують **активну** property «aitodaybrief»
`540467725` (акаунт `397017915`) — вона отримує реальні `page_view`. У старих записах
(12.06) фігурує «Ai brief today» `540206735` / акаунт `396774992` / логін
`hello@sashakuzmenko.com`; схоже, після реорганізації GA нова property стартувала
«чистою». Що треба перевірити руками в UI Analytics (агенту недоступно):

- [ ] **Measurement ID потоку в 540467725** = `G-5R89X6Q5D4`? Якщо інший — оновити
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` у Vercel і цей файл.
- [ ] **GSC ↔ GA4 link** на 540467725 (Admin → Product links).
- [ ] **Key event `newsletter_subscribe`** позначено на 540467725.
- [ ] **Data retention** = 14 місяців (не дефолтні 2).
- [ ] Tag Assistant: рівно один GA4-config (після видалення GTM це гарантовано одним
  тегом з нашого коду).

## Пастка: схожі властивості

Було три різні GA4-ID в обігу за часів проєкту: `540206735` («Ai brief today», 12.06),
`540281034` («sashakuzmenko», портфоліо — НЕ ЧІПАТИ для брифу), `540467725`
(«aitodaybrief», активна з ~07.2026). Двомовні сайти з однаковими шляхами `/en` `/uk`
виглядають у звітах однаково — завжди звіряй property ID в URL адмінки.

## Що налаштовано (стан 12.06.2026, property 540206735)

> Пункти нижче стосувались старої property — на 540467725 потребують повторної перевірки
> (чек-лист вище).

- ✅ Key event: **`newsletter_subscribe`** (= конверсія підписки на розсилку)
- ✅ Key event: `purchase` (дефолтний, незнімний)
- ✅ Data retention (event data): **14 місяців** (був дефолт 2)
- ✅ GSC ↔ GA4 link
- ✅ Consent Mode v2: analytics granted / ads denied за замовчуванням

> **2026-08-21:** покриття подій розширено (хаби, топ-новини, дайджести, воронка
> підписки, dwell) — повний каталог див.
> [event-taxonomy](event-taxonomy.md). Ця сторінка лишається довідником інфраструктури.

## Залишилось зробити (одноразово)

- [ ] **Звірити property за чек-листом вище** — головне відкрите питання.
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
