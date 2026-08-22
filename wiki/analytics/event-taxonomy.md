# Event taxonomy — каталог GA4-івентів і first-party біконів

Summary: єдиний каталог усіх аналітичних подій сайту: що рахуємо, звідки стреляє кожна подія, які параметри несе, куди тече (GA4 і/або first-party бікон `/api/ev`).
Sources: `src/lib/analytics-client.ts`, `src/lib/analytics-events.ts`, `src/lib/tool-telemetry.ts`, `src/components/analytics/*`, `src/hooks/use-engaged-dwell.ts`, код-ревʼю 2026-08-21
Last updated: 2026-08-21

---

Навіщо окрема сторінка: [ga4-gsc](ga4-gsc.md) описує **інфраструктуру** (property, GTM, consent,
key events), а ця — **подієву таксономію коду**. Додаючи нову подію, онови обидві.

## Принципи

1. **Один вхід** — `trackEvent(name, params)` з `src/lib/analytics-client.ts`: consent-gated,
   надсилає в GA4 (`gtag`) і, для item-подій, у first-party бікон `/api/ev` (reward-сигнал
   для пайплайну, PII-free session hash).
2. **Нові імена подій** оголошуються в `src/lib/analytics-events.ts` (`ANALYTICS_EVENTS` +
   param-білдери) — не рядковими літералами в компонентах. Це тримає імена унікальними й
   протестованими.
3. **Події на клік обгортаються** client-компонентом-обгорткою (`src/components/analytics/`),
   а не переписуванням Server Component на `'use client'` — обгортки ловлять `onClickCapture`
   навколо server-renderених лінків.

## Каталог подій, доданих 2026-08-21 (source: `src/components/analytics/*`, код-ревʼю 2026-08-21)

| Подія | Де стріляє | Параметри | Призначення |
|---|---|---|---|
| `hub_view` | concepts/category/digests/guides index (`HubViewTracker`) | `hub_type`, `slug` | Відвідуваність хабів окремо від page_view |
| `weekly_top_click` | Головна: featured + secondary картки; брифи: рядки айтемів (`WeeklyTopClickTracker`) | `slot` (`featured`/`secondary`), `rank?`, `slug` | Клікабельність топ-новин |
| `digest_card_click` | Головна: weekly-блок («Read full», PDF, обкладинка) | `target`, `kind` | Кліки в дайджест із домашньої |
| `category_hub_click` | Головна: сітка категорій | `slug` | Перехід у категорійні хаби |
| `hero_cta_click` | Головна: hero CTA | `cta` (`primary`/`secondary`) | Ефективність героя |
| `digest_view` / `scroll_50` / `story_open` / `subscribe_click` / `pdf_download` / `video_play` | Weekly-сторінка (`digest-engagement.tsx`) | `weekly_slug` | Дзеркало engagement у GA4 — раніше лише Supabase |
| `view` / `scroll_*` / `outbound_click` / `dwell` | Гайди (`PageEngagementTracker`) | `page_type`, `slug`, `lang` | Engagement не-item сторінок (GA4-only) |
| `newsletter_impression` | Форми підписки (1/сесію/placement) | `placement` | Верх воронки підписки |
| `newsletter_form_start` | Перший фокус/клік у форму | `placement` | Мідль воронки |
| `newsletter_submit_error` | Фейл сабміту | `placement`, `reason` | Точки втрати |
| `social_profile_click` | Футер: соцлінки + LinkedIn CTA (`SocialLinkTracker`) | `network`, `placement` | Перехід на соцканали |
| `dwell` (бікон) | Item/guide сторінки, 30 с активної видимості (`useEngagedDwell`) | `value: 30` | Engaged-читання → reward-сигнал |

## Воронка підписки (як читати)

`newsletter_impression → newsletter_form_start → newsletter_subscribe (key event)` —
плюс `newsletter_submit_error` як окрема точка втрати. Раніше вимірювався лише фінальний крок
(41 показів → 8 стартів → 1 підписка станом на 2026-07-01 —
[source: audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md) §5); тепер видно,
де саме губляться читачі.

## Що лишилось поза цим заходом

- `sponsor_inquiry_click` досі чекає першого живого кліку, щоб стати key event —
  чек-лист у [ga4-gsc](ga4-gsc.md).
- Custom dimensions у GA4 для нових параметрів (`hub_type`, `slot`, `placement`) не
  реєструвались — без них параметри пишуться, але не розрізають звіти (needs verification
  після перших даних).

## Related pages

- [ga4-gsc](ga4-gsc.md) — property, GTM, consent, key events, пастка двох властивостей
- [../audits/2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md) — вихідний аудит воронки
- [../seo/on-site-audit-2026-08-21](../seo/on-site-audit-2026-08-21.md) — SEO-частина того ж заходу
