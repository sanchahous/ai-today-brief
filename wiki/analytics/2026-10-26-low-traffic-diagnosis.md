# Чому так мало користувачів: діагноз трафіку (2026-10-26)

Summary: «4 активні користувачі за 7 днів» у GA4 — сума трьох окремих причин: opt-in consent з 02.10 ховає майже весь трафік від GA4 і first-party бікона; Google знає лише 57 URL і не перечитує sitemap з червня; соцпублікації стоять у черзі на схвалення з вересня. Блок Tencent Cloud (Singapore) реальну аудиторію не зачепив.
Sources: GA4 Home property `540206735` (скриншот власника, 19–25.10.2026); Google Search Console `sc-domain:aitodaybrief.com` — Ефективність, Сторінки, Файли Sitemap, Перевірка URL-адреси, Статистика сканування, Посилання (live check 2026-10-26); prod Supabase `item_events`, `social_posts`, `social_click_events`, `briefs`, `subscribers` (SQL 2026-10-26); curl production 2026-10-26; Vercel MCP observability (2026-10-26); `src/lib/consent-mode-snippet.ts`, `src/lib/analytics-client.ts`, `src/components/google-analytics.tsx`; PR #396, PR #153
Last updated: 2026-10-26

---

## Висновок

1. **GA4 недораховує через opt-in consent, а не через падіння трафіку.** З 2026-10-02 17:47 UTC (мерж PR #396) GA4-події і first-party бікон `/api/ev` надсилаються лише після «Accept all». Звідси 4 користувачі за 19–25.10. (source: `gh pr view 396` 2026-10-26; `src/lib/analytics-client.ts`)
2. **Реальна причина малої аудиторії — Google майже не знає сайт.** За 6 місяців 5 кліків і 352 покази; відомо 57 URL із 2 134 у sitemap; проіндексовано 10. (source: GSC live check 2026-10-26)
3. **Друга реальна причина — дистрибуція в соцмережі стоїть з 2026-09-03.** 288 постів у статусі `in_review`. (source: prod Supabase `social_posts`, SQL 2026-10-26)
4. **Singapore-блок не причина.** Правило `deny` діє за ASN 132203 (Tencent Cloud), а не за країною; люди з дата-центру не читають. Блок прибрав бот-трафік, який у вересні роздував GA4 до ≈100–520 «користувачів» на добу. (source: [singapore bot traffic](2026-10-02-singapore-bot-traffic.md))

Реальну аудиторію нині не виміряно: GA4 і `item_events` обрізані згодою, серверних лічильників на Vercel Hobby немає (див. [Межі](#межі-знання)).

## 1. Вимірювання: opt-in consent

Код (source: `src/lib/consent-mode-snippet.ts`, `src/lib/analytics-client.ts`, `src/components/google-analytics.tsx`, стан `origin/main` `ed78d9f` 2026-10-26):

- `gtag('consent','default',{analytics_storage:'denied', …})` до будь-якого вибору.
- `trackEvent` повертається без виклику `gtag('event')`, якщо `analyticsAllowed()` = false (нема згоди або `navigator.webdriver`). `send_page_view:false`, тож без згоди GA4 не отримує навіть `page_view`.
- `sendItemBeacon` (`/api/ev` → `item_events`) має той самий гейт, хоча бікон PII-free (добовий `session_hash`).
- Behavioral modeling GA4 вимагає ≥1000 подій на добу з denied-згодою — для сайту такого обсягу недосяжно (assumption, за документацією Google consent mode; поріг на property не перевірено).

Обрив видно у first-party даних — людські (`ua_class='human'`) сесії `item_events` за тиждень:

| Тиждень з | 31.08 | 07.09 | 14.09 | 21.09 | 28.09 | 05.10 | 12.10 | 19.10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Сесії (`distinct session_hash`) | 22 | 46 | 41 | 106 | 64 | 6 | 4 | 4 |
| `view` | 23 | 48 | 42 | 106 | 227 | 14 | 4 | 2 |

(source: prod Supabase `item_events`, SQL 2026-10-26.) Тижні 21.09 і 28.09 містять власні headless-прогони редизайну (source: [singapore bot traffic](2026-10-02-singapore-bot-traffic.md) §Івано-Франківськ).

Наслідки:

- GA4-звіти після 02.10 не порівнювані з вереснем без поправки на згоду. Це прямо зачіпає 28-денне вікно [after-hours-impact](2026-10-06-after-hours-impact.md): воронки за 06.10…03.11 рахуватимуть лише користувачів, які дали згоду.
- `item_events` — reward-сигнал для ранжування — з 02.10 майже порожній (≈4 сесії на тиждень). (source: SQL 2026-10-26)
- Скриншот GA4 за 19–25.10: 4 активні, 4 нові, 58 подій; джерела `(direct)` 2, `chatgpt.com / ai-assistant` 1, `duckduckgo / organic` 1. (source: скриншот GA4 Home власника 2026-10-26)

## 2. Органіка: Google майже не знає сайт

Живі дані GSC (source: Google Search Console, live check 2026-10-26; останнє оновлення звітів 21–23.10.2026):

| Звіт | Значення |
|---|---|
| Ефективність, 6 міс. (02.06–24.10) | **5 кліків, 352 покази**, CTR 1,4%, середня позиція 19,9. Покази найвищі в червні (до ≈20/день), з серпня близько 0–1/день. Покази отримали лише 47 сторінок, переважно старого формату `/en/{brief}/{item}`. |
| Сторінки (індексування) | Відомо **57** URL: проіндексовано **10** (у серпні ≈40), не проіндексовано 47 — «Проскановано, наразі не проіндексовано» 32, «Сторінка з переспрямуванням» 10, noindex 3, 404 — 1, «Копія, Google вибрав інший canonical» 1. |
| Файли Sitemap | `sitemap.xml`: подано й **востаннє прочитано 12.06.2026**, знайдено 338. `news-sitemap.xml`: подано 04.06, прочитано 06.06, знайдено 14. |
| Перевірка URL | `/en/news/creative-ai/black-forest-labs-releases-flux-3-image-klein-…` — **«Невідома Google URL-адреса»**, sitemap і посилання не знайдено. `/en/news/tools-and-releases/cursor-plugins-official-extensions` — проіндексовано, останнє сканування 29.08, «Файли Sitemap: не знайдено відповідних карт сайту». |
| Статистика сканування (90 днів) | 1,62 тис. запитів (≈18/день), середня відповідь 613 мс; за метою **«Оновлення» 100%, «Виявлення» < 1%**; HTML 15%, JS 42%; хост — «Проблем не знайдено». |
| Посилання | **6 зовнішніх посилань** з 3 доменів: `sashakuzmenko.com` 4, `himalayas.app` 1, `linkedin.com` 1. Усі ведуть на `/en`. |

Live-сторона сайту чиста (source: curl production 2026-10-26):

- Googlebot UA: `/en`, `/en/news`, `/uk`, `/robots.txt`, `/sitemap.xml` → 200; `robots.txt` — `Allow: /` для всіх і для AI-краулерів, два `Sitemap:`.
- `sitemap.xml` — 200, `application/xml`, 1,57 МБ, 0,53 с, `X-Vercel-Cache: HIT`; **2 134** URL (866 `en/news` + 866 `uk/news`, решта — concepts, category, weekly, tools, guides, брифи); `lastmod` розподілені з травня по жовтень, не однакові.
- Стаття: власний canonical, `hreflang` en/uk/x-default, `robots: max-image-preview:large`.
- `/` без `Accept-Language` → 307 на `/uk`, хоча `x-default` вказує на `/en` — дрібна неузгодженість, не причина.

Інтерпретація:

- **Переїзд URL 2026-07-24 (PR #153, `nest article URLs under category`)** перевів уже проіндексовані статті на 308-редиректи; нові адреси `/en/news/{category}/{slug}` Google може знайти лише через sitemap або посилання. Збіг дат із падінням показів — (assumption, висока впевненість). Приклад: `/en/cursor-plugins-and-codegraph-…/cursor-official-plugins-extension-ecosystem` → 308 на `/en/news/tools-and-releases/cursor-plugins-official-extensions` (source: curl 2026-10-26).
- **Sitemap не перечитується 4,5 місяці**, а «Виявлення» < 1% сканування: Google не виділяє домену бюджету на пошук нових сторінок. Причину, чому саме sitemap не перечитується, не встановлено (needs verification); технічних помилок на нашому боці не знайдено.
- **Корінь — відсутність авторитету**: 6 беклінків, 4 з них із власного портфоліо. Це збігається з висновком [SEO organic audit](../audits/2026-07-01-seo-organic.md) (молодий домен + 0 беклінків).
- 32 сторінки «Проскановано, не проіндексовано» — Google прочитав і відхилив. Імовірна причина — сигнал низької цінності для агрегованих AI-переписів новин на новому домені (assumption, не перевірено).

## 3. Дистрибуція: соцпублікації стоять

Стан `social_posts`, створені з 2026-07-01 (source: prod Supabase, SQL 2026-10-26):

| Канал | `in_review` | `posted` | Інше |
|---|---:|---:|---|
| telegram | 68 | 4 (останній 03.09) | cancelled 28, failed 1 |
| x | 67 | 0 | cancelled 26, scheduled 3, approved 1 |
| threads | 68 | 0 | cancelled 26, scheduled 3 |
| linkedin | 33 | 0 | cancelled 12, scheduled 3 |
| facebook | 26 | 0 | cancelled 14, scheduled 3 |
| instagram | 26 | 0 | cancelled 14, scheduled 3 |

Разом **288 постів у `in_review`**, останній `in_review` створено 26.10 — генерація працює, публікація ні. Серверні кліки `social_click_events` (від згоди не залежать): 46 за тиждень з 17.08, 3 — з 24.08, 10 — з 31.08, далі 0–1 на тиждень. (source: SQL 2026-10-26)

Постачання контенту стабільне: ≈7 брифів і 41–69 айтемів на тиждень з 03.08 по 25.10; нових `subscribers` за цей час — 1 (тиждень з 21.09). (source: SQL `briefs`, `brief_items`, `subscribers` 2026-10-26)

## Межі знання

- **Справжній обсяг людського трафіку після 02.10 невідомий.** Vercel Observability-запит `vercel.request.count` повертає `402 payment_required` (Observability Plus — лише Pro/Enterprise); Vercel Web Analytics у коді не підключено. (source: Vercel MCP 2026-10-26; `rg "@vercel/analytics" src` 2026-10-26 — 0 збігів)
- Firewall-конфіг через Vercel API не читається (`404 Seawall Config not found`); стан правил узято з [singapore bot traffic](2026-10-02-singapore-bot-traffic.md), повторно не перевірявся.
- Причина, чому Google не перечитує sitemap, не встановлена.
- GSC переглядався з профілю Chrome, що має доступ до ресурсу; профіль `sanchahous@gmail.com` доступу не має. (source: live check 2026-10-26)

## Варіанти виправлення (рішення власника не прийнято)

1. **Соцчерга** — регулярне ручне схвалення або авто-схвалення для частини каналів; найшвидший важіль трафіку.
2. **Вимірювання без згоди** — Vercel Web Analytics (без cookies) і зняття consent-гейту з анонімного `/api/ev`; GA4 лишається opt-in. Юридичну допустимість для EU-відвідувачів треба підтвердити (needs verification).
3. **GSC** — повторно подати обидва sitemap, розбити `sitemap.xml` на індекс із дрібних файлів (свіжі новини окремо), вручну запросити індексацію ключових хабів. Дії в акаунті власника — лише з його явного дозволу.
4. **Авторитет** — беклінки й дистрибуція, власні аналітичні матеріали замість переписів; без цього пп. 1–3 дають обмежений ефект.

## Related pages

- [singapore bot traffic](2026-10-02-singapore-bot-traffic.md)
- [after-hours-impact](2026-10-06-after-hours-impact.md)
- [redesign baseline](2026-09-29-redesign-baseline.md)
- [ga4-gsc](ga4-gsc.md)
- [event-taxonomy](event-taxonomy.md)
- [SEO organic audit](../audits/2026-07-01-seo-organic.md)
- [custom-social-delivery](../marketing/custom-social-delivery.md)
