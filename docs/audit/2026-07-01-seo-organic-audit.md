# SEO + маркетинг аудит — чому нема органіки — aitodaybrief.com

**Дата:** 2026-07-01
**Джерела:** GSC (`sc-domain:aitodaybrief.com`) + GA4 (акаунт «Ai brief today» `397017915`, property «aitodaybrief» `540467725`) + прямий аудит коду + жива перевірка `/sitemap.xml`, `/news-sitemap.xml`, `/robots.txt`.
**Контекст:** сайту ~4 тижні. Це аудит фази запуску. Продовження [2026-06-12](2026-06-12-analytics-gsc-audit.md).

---

## 1. Головний висновок

Технічний SEO-фундамент **чистий** — проблема не в коді. Органіки нема, бо:

1. **Домену ~4 тижні → нульовий авторитет.** Для нового сайту органічний пошук у перші 3–6 міс ≈ 0. Це норма, не баг.
2. **232 сторінки «Виявлено — не проіндексовано».** Google знайшов URL (через sitemap), але не витрачає бюджет сканування, бо на домен ніхто не лінкує → немає сигналу довіри.
3. **Немає дистрибуції.** 201/229 нових користувачів — Direct (переважно UA = свої). Organic Search — 13/міс. Зовні сайт не знаходять.

**Причина = молодий домен + 0 беклінків + AI-агрегований контент + немає активної дистрибуції.** Лікується діями поза сайтом, не кодом.

---

## 2. Що перевірено в коді (все ОК ✅)

| Перевірка | Стан |
|---|---|
| `robots.txt` | Allow all, `Disallow` нема, обидва sitemap вказані, AI-боти вітаються |
| `sitemap.xml` | Динамічний (`revalidate=3600`), 456 URL, `<lastmod>` + hreflang. Живий |
| `news-sitemap.xml` | Живий, найсвіжіша публікація — сьогоднішня. Оновлюється при публікації |
| Канонікали | Self-canonical + hreflang (en/uk/x-default) на всіх сторінках |
| Дедуп-канонікал | Републікації → 308 (next.config) або canonical+`noindex` fallback |
| JSON-LD | `NewsArticle` + `Person`(#person) + `Organization`(#org) + breadcrumbs |
| `middleware.ts` | Лише мовний редірект на `/` за гео — **ботів не блокує**, WAF нема |
| Item-сторінки | SSG (`generateStaticParams`), швидкі; реальний h1 (sr-only) |
| Google News | Publisher Center **зареєстровано** ✅ |

**Артефакти в GSC, які НЕ є багами** (очікувані для redirect/dedup-архітектури): «Сторінка з переспрямуванням» (4), «Виключено тегом noindex» (1). Не тиснути «Перевірити виправлення».

---

## 3. Що зроблено цим PR (код)

**IndexNow — миттєвий пінг рекраулу.** Google IndexNow **ігнорує**, але Bing/Yandex — ні, а Bing живить пошук ChatGPT/Copilot → пряме підсилення AEO/GEO-стратегії (robots.ts уже вітає `OAI-SearchBot`).

- `src/lib/indexnow.ts` (+тести) — ядро (санітизація URL, payload, best-effort submit).
- `src/app/indexnow-key.txt/route.ts` — віддає ключ пошуковикам (`keyLocation`).
- `src/app/api/telegram/route.ts` — `handlePublish` пінгує при виході брифа в прод (бриф + схвалені айтеми обома мовами + фіди).
- `npm run indexnow:backfill` — разовий пуш усіх наявних URL із живого sitemap.

**Разова активація (робить власник):**
1. Згенерувати ключ: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` (напр. `35c47bc3eb5b0dbf65b5fa66e74f34d2`).
2. Vercel → env `INDEXNOW_KEY` = ключ (Production). Redeploy.
3. Той самий `INDEXNOW_KEY` у env пайплайну (GitHub Actions secret) для бекфілу.
4. Перевірити `https://aitodaybrief.com/indexnow-key.txt` → віддає ключ.
5. Bing Webmaster Tools → додати сайт (імпорт із GSC у 2 кліки), підтвердити IndexNow-ключ.
6. Прогнати `npm run indexnow:backfill` один раз.

---

## 4. Off-site чек-лист (робить власник — це і є важіль) 🔴

**A. Google-індексація (ручний поштовх, поки нема авторитету):**
- [ ] GSC → Inspect URL → **Request indexing** для 10 найкращих сторінок (концепт-хаби `anthropic-api`, `context-engineering`; топ-новини; головна en/uk). ~10/день ліміт.
- [ ] GSC → Sitemaps → підтвердити, що `/sitemap.xml` і `/news-sitemap.xml` = Success.
- [ ] Через 1–2 тижні порівняти «Проіндексовано» — має рости.

**B. Беклінки / авторитет (найбільший важіль — без цього Google не індексуватиме масово):**
- [ ] Запостити **оригінальні** активи (не агрегацію!): ATB-бенчмарк, prompt-optimizer на **Hacker News (Show HN)**, **Lobsters**, **dev.to**, **Reddit** (r/LocalLLaMA, r/ChatGPTCoding — link-out обережно).
- [ ] Сабмітити в AI-каталоги/розсилки: TAAFT (There's An AI For That), Futurepedia, AI-tool директорії.
- [ ] Гостьові згадки / крос-пост дайджестів у профільні Telegram/Discord-спільноти.
- [ ] Мета: 5–10 якісних дофоллов за місяць. **День-10 стрибок до 106 користувачів = один такий пост.** Дистрибуція, не пасивне SEO.

**C. Google News / Discover (Publisher Center вже є):**
- [ ] Перевірити в Publisher Center, що видання «здорове» (немає policy-warnings, лого/іконки залиті).
- [ ] Стабільний темп публікацій + `max-image-preview:large` (вже стоїть) → Discover-eligibility.

**D. Bing/AEO:**
- [ ] Bing Webmaster Tools + IndexNow (див. §3). Bing → цитування в ChatGPT.

---

## 5. Маркетинг — два червоні сигнали з даних

| Проблема | Дані (черв 2026) | Дія |
|---|---|---|
| **Розсилка не конвертує** | модалка показана 41 → форму почали 8 → підписка **1** | окремий фікс воронки: оффер, timing, копірайт |
| **Утримання ≈ 0** | Week-1 retention практично 0 | без утримання зростання протікає; дистрибуція + email-петля |

Висновок: бракує **машини дистрибуції + петлі утримання**, а не SEO-налаштувань. SEO для новин дозріває місяцями.

---

## 6. GA4 — звірити (можлива втрата налаштувань) ⚠️

**Розбіжність property:** зараз активна «aitodaybrief» `540467725` (акаунт `397017915`), а в [ANALYTICS.md](../ANALYTICS.md) документована стара `540206735` (акаунт `396774992`). Схоже, GA переорганізовано після 12.06. Нова property стартує «чистою» — перевірити, що **перенеслося**:

- [ ] **Measurement ID:** Admin → Data streams → який `G-…` у `540467725`? Звірити з Vercel `NEXT_PUBLIC_GA_MEASUREMENT_ID` (у docs було `G-5R89X6Q5D4` — якщо новий, оновити env і ANALYTICS.md).
- [ ] **GSC ↔ GA4 link** на новій property (Admin → Product links → Search Console).
- [ ] **Key event `newsletter_subscribe`** позначено (Admin → Events / Key events).
- [ ] **Data retention** = 14 міс (не дефолтні 2).
- [ ] **Tag Assistant** (tagassistant.google.com): рівно **один** GA4-config тег (щоб нова property не додала другий measurement ID → подвійний облік); `page_view` лише з GTM; глянути 39 сесій «Unassigned» (timing/consent).

Після звірки — оновити `docs/ANALYTICS.md` (він застарів).

---

## 7. Пріоритет дій

1. 🔴 **Беклінки + Request indexing** — єдиний реальний важіль для Google зараз.
2. 🟡 **Активувати IndexNow** (§3) + Bing WMT — швидкий Bing/AEO-виграш.
3. 🟡 **Звірити GA4-property** (§6) — щоб не втратити конверсії/ретеншн.
4. 🟢 **Фікс воронки розсилки** — окремою задачею.
5. 🟢 Reader Revenue Manager (`NEXT_PUBLIC_SWG_PRODUCT_ID`) — пізніше.
