# Analytics — довідник (підтримувати актуальним!)

Summary: Довідник GA4 / GTM / GSC: property, measurement ID, key events.
Sources: none (analysis)
Last updated: 2026-06-12


> Оновлено: **2026-06-12**. Якщо щось із цього змінюєш (property, ID, key events,
> env) — онови цей файл у тому ж PR.

> ⚠️ **ПОТРЕБУЄ ЗВІРКИ (2026-07-01).** Експорти власника й посилання на звіти
> показують **іншу** GA4-property, ніж документована нижче: акаунт «Ai brief today»
> `397017915`, property «aitodaybrief» **`540467725`** (отримує реальні `page_view`).
> Нижче ж описана `540206735` / акаунт `396774992`. Схоже, GA переорганізовано після
> 12.06 і **нова property стартувала «чистою»** — GSC-link, key event
> `newsletter_subscribe` та 14-міс retention могли не перенестися. Перш ніж довіряти
> цифрам/налаштуванням нижче — пройти чек-лист §6 у
> [../audits/2026-07-01-seo-organic.md](../audits/2026-07-01-seo-organic.md),
> звірити measurement ID у Vercel і оновити ЦЕЙ файл.

## Куди течуть дані (архітектура)

```
aitodaybrief.com
 ├─ gtag.js  (NEXT_PUBLIC_GA_MEASUREMENT_ID = G-5R89X6Q5D4, send_page_view: false)
 │    └─ всі КАСТОМНІ події коду: newsletter_subscribe, search, scroll_depth, …
 │       (src/lib/analytics-client.ts → trackEvent)
 └─ GTM   (NEXT_PUBLIC_GTM_ID = GTM-5S6TXPG5)
      └─ page_view (тому в gtag send_page_view вимкнено — щоб не дублювати)

            обидва → потік «The daily AI news» (stream 15002930155)
                     → GA4 property «Ai brief today» (540206735)
                     → GA-акаунт 396774992
                     → Google-логін hello@sashakuzmenko.com
```

- **Search Console:** `sc-domain:aitodaybrief.com` — теж під `hello@sashakuzmenko.com`.
- **GSC ↔ GA4 звʼязані** (12.06.2026). Звіти Search Console в GA: Reports → Library →
  колекція Search Console (зʼявляються протягом ~48 год після лінку).

## ⚠️ Пастка: дві схожі властивості

| | Продукт (правильна) | Портфоліо (НЕ ЧІПАТИ для брифу) |
|---|---|---|
| Назва | **«Ai brief today»** | «sashakuzmenko» |
| Property ID | **540206735** | 540281034 |
| Потік | «The daily AI news» → aitodaybrief.com | «Sasha Kuzmenko» → sashakuzmenko.com |
| Google-логін | hello@sashakuzmenko.com | sanchahous@gmail.com |

Обидва сайти двомовні зі шляхами `/en` `/uk` і схожими назвами подій — у звітах
вони виглядають майже однаково. **Завжди перевіряй property ID в URL** (`…p540206735…`).
В Analytics заходити з `?authuser=hello%40sashakuzmenko.com`.

## Що налаштовано (стан на 12.06.2026)

- ✅ Key event: **`newsletter_subscribe`** (= конверсія підписки на розсилку)
- ✅ Key event: `purchase` (дефолтний, незнімний)
- ✅ Data retention (event data): **14 місяців** (був дефолт 2)
- ✅ GSC ↔ GA4 link
- ✅ Consent Mode v2: analytics granted / ads denied за замовчуванням
- ✅ Інструментація коду повна — 16+ подій течуть (див. `src/lib/analytics-client.ts`
  і виклики `trackEvent` по компонентах). Нічого дотрекувати не потрібно.

## Залишилось зробити (одноразово)

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
- **Пошукові запити/кліки:** через 48 год після лінку — колекція Search Console
  у звітах GA, або напряму в GSC → Performance.
- **Тест-події:** одна синтетична `newsletter_subscribe` з
  `placement=ga-setup-test` відправлена 12.06.2026 (для появи події в списку) —
  у звітах за червень її можна ігнорувати/відфільтрувати за placement.

## Історія / повʼязане

- Повний аудит запуску: `wiki/audits/2026-06-12-analytics-gsc.md`
  (розділ 2 — виправлені цифри; 6.1 — як розплутали властивості).
- SEO-фікси того ж дня: PR #76 (lastmod, brief→concept чипи, publisher.logo,
  canonical-fallback, пагінація sitemap, title головної).
