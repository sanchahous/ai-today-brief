# Singapore / direct: автоматизований трафік, що засмічує GA4 (діагноз 2026-10-02)

Summary: сплеск «Direct» у GA4 з ~22.09 — це автоматизований трафік із дата-центру Tencent Cloud (AS132203, Сінгапур), підтверджений на стороні сервера; аномалія Івано-Франківська — власні headless-перевірки редизайну. Сторінка фіксує докази, межі знання, стан захисту й правила читання GA.
Sources: Vercel Firewall → Traffic і Logs (project `ai-today-brief`, live check 2026-10-02), Vercel Usage (CDN Requests, Fast Origin Transfer, 2026-10-02), GA4 Home property `540206735` (live check 2026-10-02), prod Supabase `item_events` (SQL 2026-10-02), `git log origin/main` 2026-09-13…25, повідомлення власника 2026-10-02, [redesign baseline](2026-09-29-redesign-baseline.md), [ga4-gsc](ga4-gsc.md)
Last updated: 2026-10-02

---

## Висновок

1. **Singapore/direct — автоматизований трафік, не аудиторія.** Він з'явився ~22.09 і зростав до 29–30.09. Код сайту між 13.09 і 25.09 не змінювався (у `origin/main` лише `docs`-коміти 25.09), тож причина зовнішня. (source: `git log origin/main --since=2026-09-13 --until=2026-09-26` 2026-10-02)
2. **Івано-Франківськ (589 користувачів) — власний трафік.** Власник живе в Івано-Франківську й ганяв Playwright/headless-агентів проти production у межах редизайну. Це не бот і не аудиторія. (source: повідомлення власника 2026-10-02)
3. **Реальна аудиторія мала:** Organic Search 11–19 сеансів, AI Assistant 1–3, Organic Social 3 за період (source: GA4 Home 2026-10-02 та перший аналіз 2026-10-01; точні числа залежать від вікна дат).

## Докази для Singapore (сервер, не GA)

| Що | Значення | Джерело |
|---|---|---|
| ASN | AS132203 (Tencent Cloud) — **3,2 тис. із 7,2 тис.** запитів за добу (44%) | Vercel Firewall → Traffic, Past Day, 2026-10-02 |
| Розподіл IP | жоден IP не домінує (максимум 141 запит) — пул адрес | там само, Top IPs |
| TLS-відбиток | JA4 `t13d131000_f57a46bbacb6_e7c285222651` — **2,9 тис.** запитів; 13 шифрів, без ALPN. Chrome дає 15 шифрів і h2 (`t13d1516h2_8daaf6152771_…`) | там само, Top JA4 Digests |
| User-Agent | Windows Chrome 116 / 131 / 124 / 133, по ≈350–390 запитів кожен — версії 1–3 річної давнини, рівномірна ротація | там само, Top User Agents |
| Запит із логу | стаття відкрита з `Received in Singapore (sin1)`, UA Chrome/124 Windows; за 1–4 с — `/en/privacy`, `/en/terms`, `/en/guides` та ще ~12 nav/footer-сторінок з referer = та сама стаття | Vercel Logs, 2026-10-02 14:01:24 EEST |
| Форма росту | CDN Requests/день: ≈5–8 тис. до 21.09, далі ≈5 → 6,5 → 9,5 → 10,5 → 12 → 14 → 14 → **19 тис. (29–30.09)** → ≈10 тис. (01.10) | Vercel Usage → CDN Requests (значення зчитані зі стовпчиків графіка, ±) |
| GA4 | активні користувачі ≈100 → 520 на добу 25.09 → 01.10; Singapore 1,2 тис. за 7 днів, Direct 1,9 тис. сеансів | GA4 Home, 7 днів до 2026-10-02 |

Зв'язок «ці запити = ті сеанси, які GA позначає Singapore» **не доведений напряму**: GA не показує ASN. Він випливає зі збігу країни (`sin1`), UA, дати початку, обсягу й форми росту. (assumption, високої впевненості)

> ⚠️ Нюанс: UA каже «Chrome», а домінантний TLS-відбиток — не Chrome. Тож частина трафіку, імовірно, не браузер. GA при цьому бачить `page_view`, `web_vitals` та ін., тобто JS виконується — механізм (headless-браузер із підміненим UA чи два етапи) не встановлено.

## Чому GA не відфільтрував

GA4 виключає лише відомих ботів за списком і UA. Тут UA — звичайний Chrome. До того ж `navigator.webdriver` до 2026-10-02 код не перевіряв. (source: `src/lib/analytics-client.ts` до PR цієї сторінки)

## Івано-Франківськ

589 користувачів із міста з'явилися лише в останні дні (раніше ≈0 за GA4 Home) і збігаються з днями епіку, коли агенти ганяли headless-Chromium проти production. First-party `item_events` показує це ж: 30.09 одна сесія (`session_hash`) із **140 переглядами** трьох статей за 4,5 год, 01.10 — дві сесії з 16 і 9 переглядами за 4 секунди, усі з «людським» UA, який фільтр `BOT_RE` у `/api/ev` не ловить. (source: prod Supabase `item_events`, SQL 2026-10-02; повідомлення власника 2026-10-02)

## Вплив

- **GA4:** звіти непридатні для рішень без вилучення Singapore. Baseline AH-0.6 за 25–28.09 на ≈87% забруднений (701 із 702 `page_view` Singapore — це вже було в [baseline](2026-09-29-redesign-baseline.md)).
- **First-party reward-сигнал (`item_events`):** сплеску від Singapore немає (≈15–25 сесій/добу, 21–29.09), але його засмічують власні headless-прогони (див. вище). Бот здебільшого відкриває хаби, не статті, а `view`-бікон спрацьовує лише на статтях — відсутність сплеску тут слабкий доказ. (source: SQL 2026-10-02; `src/components/item-engagement-tracker.tsx`)
- **Квоти Vercel:** CDN 260 тис. із 1 млн (Hobby), Fast Data Transfer 5,3 із 100 ГБ. Бот не є причиною перевищення Fast Origin Transfer — див. [vercel-origin-transfer](../ops/vercel-origin-transfer.md). (source: Vercel Usage 2026-10-02)

## Стан захисту

- **Bot Protection увімкнено власником 2026-10-02 у режимі `Log`** (дашборд показує «Logging»); **AI Bots — теж `Log`**, не `Deny`: `robots.txt` навмисно впускає AI-краулери заради AEO. Кастомних правил немає. (source: скриншот і дашборд Vercel Firewall 2026-10-02; [robots.ts](../../src/app/robots.ts))
- **Чому не `Challenge` одразу:** `pg_net` кожні 5 хв викликає `/api/internal/social/publish-due`, `weekly/release-due`, `weekly/generate` (не браузер) — challenge мовчки зупинив би соцпублікації й weekly-реліз; `e2e/a11y-layout-matrix.spec.ts:278` ходить у production через `request.get(...)`; RSS-читачі й link-preview боти також не браузери. (source: Vercel Firewall → Top User Agents, Top Request Paths 2026-10-02; `e2e/a11y-layout-matrix.spec.ts`)
- **Перші дані `Log` (2026-10-02, ≈30 хв після ввімкнення): 73 позначені запити.** 64 — з ASN Tencent (Chrome/117 Windows — 43, `Sogou web spider/4.0` — 21; найактивніший IP 43.159.39.29 — 20), 7 — **наш власний `pg_net` на `/api/internal/*`**, 1 — `ExaSearchBot`, 1 — China Telecom. Тобто Bot Protection ловить саме цей трафік (JA4 `t13d131000_…` — 44 запити), але `Challenge` без винятку зупинив би cron. Sogou — пошуковий краулер Tencent, для EN/UK-аудиторії малоцінний; `ExaSearchBot` — AI-пошук, який варто свідомо дозволити чи заблокувати (AEO). (source: Vercel Firewall → Traffic, фільтр `managed_bot_protection`, 2026-10-02)
- **План:** (1) додати `bypass`-правило для `/api/internal/*`; (2) перемкнути Bot Protection на `Challenge`; (3) перевірити Singapore у GA4 і Firewall → Traffic через добу; (4) якщо Singapore лишається — `deny` за ASN132203 (не за країною, щоб не зачепити реальних людей). RSS-читачі й CI (`request.get` у e2e) перевірити окремо. (assumption)
- Створити firewall-конфіг через Vercel API/конектор не вдалося (`404 Seawall Config not found` і для `PATCH`, і для `PUT`); налаштування робилися в дашборді. (source: спроби конектора 2026-10-02)

## Код (PR цієї сторінки)

`navigator.webdriver === true` (Playwright, Puppeteer, Selenium) тепер вимикає GA4 (`window['ga-disable-<ID>']` в init-скрипті, що покриває і автоматичні події gtag.js) та обидва first-party біконі (`/api/ev`, `/api/daily/visual-engagement`). Це не зупиняє ботів, які приховують прапорець, — їх тримає край. (source: `src/lib/analytics-config.ts` `gtagInitScript`, `src/lib/analytics-client.ts` `isAutomatedBrowser`)

## Як читати GA4 тепер

- Додавайте порівняння **«Країна ≠ Singapore» (і China)**; дані GA4 видалити не можна.
- Чистий baseline для редизайну — **2026-09-01…21**. Дані з 22.09 містять бот, а 29.09–01.10 ще й власні перевірки.
- Не порівнювати «до/після» релізу без однакового вилучення.

## Що не встановлено

- Хто оператор бота й чому він почав ~22.09.
- Механізм: headless-браузер із підміненим UA чи HTTP-клієнт плюс окремі GA-хіти.
- Чи зупинить Bot Protection (`Challenge`) цей трафік — залежить від результатів `Log`.
- Події на сеанс, hostname і роздільна здатність саме для Singapore в GA4 не знімалися (доступ до GA мав лише один із двох профілів Chrome).

## Related pages

- [redesign baseline](2026-09-29-redesign-baseline.md)
- [ga4-gsc](ga4-gsc.md)
- [event-taxonomy](event-taxonomy.md)
- [vercel-origin-transfer](../ops/vercel-origin-transfer.md)
- [open-questions](../open-questions.md)
