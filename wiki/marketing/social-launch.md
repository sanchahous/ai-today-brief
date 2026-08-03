# Запуск соцмереж AI Today Brief — покроковий playbook

Summary: Чек-лист запуску соцмереж і експорту бренд-ассетів.
Sources: none (analysis)
Last updated: 2026-06-11


**Дата:** 2026-06-11 · **Базується на:** research офіційних доків кожної платформи. **Волатильні цифри (ціни, ліміти, спеки) перехресно верифіковані проти офіційних джерел 2026-06-11** — Telegram/X/Bluesky/LinkedIn/Facebook підтверджені без зауважень, 2 дрібні корекції (Threads-хендл, YouTube-флоу) внесені. Платформи змінюють правила — при виконанні через місяці перевір дати.

**Контекст:** соло-фаундер, мінімум часу. Принцип: **автоматизація — підлога, людські реплаї — драйвер росту.** Все, що можна постити з пайплайна — постимо з пайплайна (код уже частково готовий: `pipeline/scripts/social-repost.ts` для X + Telegram).

---

## 0. Пріоритетна матриця

| Платформа | Пріоритет | Чому | Часу на запуск |
|---|---|---|---|
| **Telegram-канал** | 🔴 must-have | Нативний формат продукту; UA-аудиторія живе тут; бот-інфра вже є; API безкоштовний | ~1 год |
| **X (Twitter)** | 🔴 must-have | «AI Twitter» = ядро ніші; без X новинний AI-бренд не існує для дев-аудиторії | ~2 год + $8/міс Premium |
| **Bluesky (+Mastodon через міст)** | 🟠 strong | Пост-X дев-діаспора; хендл @aitodaybrief.com = безкоштовна верифікація доменом; API free | ~1 год |
| **Threads + Instagram** | 🟠 strong | Threads обігнав X по mobile DAU, текст-перший формат; API free, 250 постів/день, без app review для свого акаунта | ~1.5 год |
| **LinkedIn (Company Page)** | 🟠 strong | ICP тут є, але reach сторінки 2–5% — сторінка = бренд-якір, рост їде через особистий профіль | ~1 год |
| **YouTube (Shorts)** | 🟡 optional | Найдорожчий по часу; зараз — тільки зарезервувати хендл і оформити канал, публікація після автоматизації рендеру | ~30 хв (тільки бронь) |
| **Facebook Page** | ⚪ skip-for-now | 1–2% reach на лінк-пости; з грудня 2025 тест ліміту 2 лінк-пости/міс без Meta Verified. Тільки клейм хендла + UA-аудиторія в майбутньому | ~30 хв (тільки бронь) |

**Наскрізне правило неймінгу:** усюди один хендл **@aitodaybrief** (фолбеки: `@aitodaybrief_`, `@ai_today_brief`). ⚠️ Threads-хендл створюється з Instagram-хендла; розʼєднати можна пізніше, але ціною фіч (бейдж профілю, крос-постинг, Meta Verified) — тримай однаковим.

**Наскрізне правило контенту:** **лінк ніколи не йде в основний пост** на алгоритмічних платформах (X: -30–80% reach + $0.20/пост по API проти $0.015 без URL; LinkedIn/FB теж душать). Формула: нативне саммарі з цінністю → лінк першим реплаєм/коментом/в кінці.

---

## 1. План запуску по тижнях (≤1 год/день)

### Тиждень 0 — підготовка (одного вечора достатньо)
- [ ] Створити бренд-пошту `hello@aitodaybrief.com` (або аліас).
- [ ] Експортнути PNG з бренд-кіта (`artifacts/brand-kit/` → інструкція в README там же): аватар 1024², банери X/LinkedIn/YouTube/Bluesky/Facebook.
- [ ] Перевірити вільність @aitodaybrief на всіх платформах (5 хв).

### Тиждень 1 — must-have: Telegram + X
- **День 1:** Telegram-канал (секція 2) — створення, опис, аватар, лінк-група для комментів, бот-адмін. Сід: додати до 200 контактів + анонс у newsletter.
- **День 2:** X-акаунт (секція 3) — профіль повністю, 3–5 сід-постів, пін інтро. Premium $8/міс **через web** (не iOS).
- **День 3:** X developer console — app, OAuth 1.0a ключі, pay-per-use кредити ($25 ліміт), automation-label. Додати 4 секрети в GitHub → **авто-репост працює з наступного дня** (cron уже в репо: `.github/workflows/social-repost.yml`, 20:00 Київ).
- **День 4–7:** по 15–30 хв реплаїв під великими AI-акаунтами (приватний X-list: Anthropic, OpenAI, karpathy, swyx, simonw, AI-журналісти). Це головний канал росту маленького акаунта в 2026.

### Тиждень 2 — strong: Bluesky + Threads/IG
- **День 1:** Bluesky (секція 4) — акаунт, доменний хендл @aitodaybrief.com (DNS TXT `_atproto` або `/.well-known/atproto-did`), профіль, app password. Міст у федіверс: підписатися на `@ap.brid.gy` — Mastodon-аудиторія безкоштовно.
- **День 2:** Instagram Business + Threads (секція 5) — акаунт, professional, профілі, Meta-app з use case «Access the Threads API» (свій акаунт = без review).
- **День 3–4:** сід-пости всюди, анонс нових каналів у Telegram + newsletter.
- **День 5+:** реплаї на Threads/Bluesky по 10–15 хв (Threads алгоритм любить реплаї; Bluesky — культура розмов).

### Тиждень 3 — LinkedIn + бронювання
- **День 1:** LinkedIn Company Page (секція 6) — створення з особистого профілю, 100% заповнення, CTA «Sign up» → Beehiiv. 5 сід-постів. 50 invite-кредитів на найімовірніших.
- **День 2:** YouTube — бронь хендла + оформлення (секція 7). Facebook — бронь хендла + 5 сід-постів (секція 8). Обидва далі на паузі.
- **День 3+:** рутина: реплаї X/Threads/Bluesky, 3 LinkedIn-пости/тиждень (батчем через нативний планувальник).

### Тиждень 4 — аналітика й дотискання
- Подивитись метрики кожної платформи → подвоїти 2 найкращі формати, решту лишити автопайплайну.
- LinkedIn: при 150+ фоловерах — запустити Page Newsletter (дзеркало weekly digest).
- Розширити авто-репост на Bluesky/Threads (наступна ітерація `social-repost.ts` — API обох безкоштовні).

**Стабільний тижневий бюджет часу після запуску: ~5 год** (15–30 хв/день реплаї + 1 батч-сесія планування).

---

## 2. Telegram-канал 🔴

**Кроки:**
1. New Channel → «AI Today Brief» → Public → хендл `@aitodaybrief` (5–32 символи; якщо зайнято — глянь fragment.com або `@aitodaybrief_com`).
2. Опис (255 симв., лінки клікабельні) — готовий текст нижче.
3. Аватар 512×512 (бренд-кіт).
4. Створити discussion-групу «AI Today Brief Chat» → лінкнути в налаштуваннях каналу (кнопка «Comments» під постами) → антиспам у групі на максимум.
5. Додати наявного бота адміном **тільки** з правом Post Messages. `chat_id` = `@aitodaybrief`.
6. Sign messages = OFF; обмежений сет реакцій; пін «Що це за канал».
7. Сід: вручну додати до 200 підписників з контактів (дозволено) + анонс у Beehiiv і на сайті (хедер/футер + `/telegram` редірект).

**Опис каналу (готовий, 247 симв.):**
> Daily AI & engineering brief for developers — tools, agents, research. Human-curated, no noise.
> Щоденний AI-бриф для розробників українською та англійською.
> 🌐 aitodaybrief.com · ✉️ newsletter: aitodaybrief.com/subscribe

**Каденс:** 1 ранковий пост (08:00 Київ) + макс 1–2 breaking (з `disable_notification=true` — пуш-втома = головна причина відписок). Неділя — weekly digest (вже автоматизовано).

**Перші 30 днів:** каталоги TGStat / telega.io / telegramchannels.me (категорія AI/Tech); 5–10 взаємних шаутаутів з каналами схожого розміру (перевіряй views/subscribers ≈ 10–30% перед домовленістю); shared folder (addlist) свого канал+чат для колаб-постів; «Forward to a dev friend» в кінці великих постів. Опційно: Telegram Ads з малим TON-бюджетом ($50–200, CPM від ~0.1 TON, таргет на конкретні AI-канали; веде тільки на Telegram-ціль — якраз на канал).

**Граблі:** голі URL без саммарі; og:image < 1200×630 → дрібна прев'юшка (наші OG-картки ок; після зміни тегів — кеш збиває @WebpageBot); канал замість каналу+групи; купівля підписників (вбиває ratio для крос-промо назавжди).

---

## 3. X (Twitter) 🔴

**Кроки:**
1. Акаунт на бренд-пошту, хендл `@aitodaybrief`, **одразу верифікувати телефон**.
2. Display name «AI Today Brief», аватар 400×400, банер 1500×500 (контент у центральних ~1200×380 — мобайл ріже краї, аватар перекриває низ-ліво), біо (нижче), Website = aitodaybrief.com.
3. 3–5 сід-постів ДО будь-якого промо. Пін: інтро «що це і для кого».
4. **X Premium $8/міс через web** — для лінк-медіа в 2026 без Premium reach ≈ нуль; це найвищий ROI-спенд на платформі. Premium Business ($200/міс) — не треба.
5. Developer: console.x.com → use case «automated posting of our own daily AI news brief to our own account» → Project → App → **OAuth 1.0a ключі з Keys and Tokens** (App type: Web App/Automated App or Bot). OAuth 1.0a = токени не протухають (без refresh-rotation пасток).
6. Купити pay-per-use кредити + ліміт $25/міс. **Free tier мертвий з 06.02.2026**; ціни: $0.015/пост, **$0.200/пост з URL** (тому лінк — у self-reply), наш обсяг ≈ $7–15/міс.
7. Settings → Automation → позначити акаунт автоматизованим (лінк на особистий акаунт) — вимога правил X.
8. Секрети в GitHub repo Settings → Actions: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`. Перший тест: workflow `Social repost` → Run workflow → dry_run=true.

**Біо (готове, 144 симв.):**
> Daily AI & engineering brief for developers. 120+ sources, zero noise: tools, agents, research. Free daily brief + newsletter ↓

**Каденс:** 2–4 пости/день (1 авто топ-сторі — вже в коді — + 1–3 ручні) + **15–30 хв/день реплаїв** — це і є ріст. Хештеги: 0–1, не більше (алгоритм 2026 їх не любить).

**Перші 30 днів:** приватний list ~50 акаунтів (лаби, karpathy, swyx, simonw, levelsio, AI-репортери) → змістовні реплаї в перші 15–30 хв після їхніх постів; бути першим на 2–3 breaking-сторі (наш пайплайн швидший за журналістів — нативне саммарі, лінк реплаєм); один впізнаваний шаблон картинки (бренд-кіт) на кожному пості; подякувати в DM кожному помітному акаунту, що зареплаїв.

**Граблі:** URL в основному пості (reach -30–80% І 13× ціна API); туторіали 2023–2025 про «1500 безкоштовних постів» — мертві; чистий broadcast без реплаїв = бот-ферма в очах алгоритму; iOS-підписка на Premium (дорожче за web); двічі однаковий текст з Telegram (правила X проти дублювання — переписуй під голос X).

---

## 4. Bluesky + Mastodon 🟠

**Кроки (Bluesky):**
1. Акаунт на bsky.app (пошта, без телефону), тимчасовий хендл.
2. **Доменний хендл:** Settings → Account → Handle → «I have my own domain» → DNS TXT: host `_atproto`, value `did=did:plc:<твій-DID>` (Vercel DNS: `vercel dns add aitodaybrief.com _atproto TXT "did=..."`). Альтернатива без DNS: віддати DID plain-text'ом на `https://aitodaybrief.com/.well-known/atproto-did`. Хвилин за 20 → Verify → хендл **@aitodaybrief.com** = верифікація доменом.
3. Профіль: display name ≤64, біо ≤256 (нижче), аватар 1000×1000, банер 1500×500.
4. App Password: Settings → Privacy & Security → App Passwords (ніколи основний пароль у скрипти).
5. **Федіверс безкоштовно:** підписатися на `@ap.brid.gy` → акаунт видно в Mastodon як `@aitodaybrief.com@bsky.brid.gy`. Нативний Mastodon-акаунт (mastodon.social, прапорець bot, rel=me верифікація через лінк у футері сайту) — пізніше, коли каденс стабільний.

**Біо (готове, 178 симв.):**
> Daily AI & engineering brief for developers — tools, agents, research, hand-curated from 120+ sources. EN + UA. Full brief & newsletter: aitodaybrief.com

**Каденс:** 2–3 пости/день + 10–15 хв реплаїв. **Критична технічна деталь для авто-постингу:** Bluesky НЕ генерує лінк-прев'ю сам — скрипт мусить тягнути OG-метадані, вантажити hero-картинку через `uploadBlob` (≤1 МБ) і чіпляти `app.bsky.embed.external`, інакше пост виглядає голим. SDK: `@atproto/api` (TypeScript — рідний для нашого стека). Ліміт постів — нерелевантний (1666/год можливих проти наших 3/день).

**Перші 30 днів:** starter pack «AI news & research on Bluesky» (творців паків фоловлять і шерять усі, кого додав); кастомний keyword-feed; ~100 фоловів релевантних акаунтів у перший тиждень (фоловбек-культура ще щедра); ключові слова (назви моделей) у тексті постів — вони ловляться кастомними фідами (хештеги на Bluesky не працюють, на Mastodon — навпаки, основа дискаверу, 2–4 на пост).

**Граблі:** «AI-curated» фреймінг у федіверсі = ворожість (анти-AI настрої) — формулювання тільки **«human-curated for developers»**; alt-тексти обов'язкові культурно; createSession на кожен пост (ліміт 30/5 хв) — кешуй JWT.

---

## 5. Threads + Instagram 🟠

**Кроки:**
1. IG-акаунт на бренд-пошту, хендл `@aitodaybrief` (⚠️ Threads успадковує цей хендл; змінити окремо можна, але втрачаються бейдж/крос-постинг/Verified-перенос — фактично тримаємо однаковим).
2. Switch to professional → **Business** (не Creator) → категорія «Media/News Company».
3. Профіль: аватар 320×320+, біо 150 симв. (нижче), до 5 лінків (порядок: сайт, newsletter, Telegram — показується тільки перший).
4. Threads-апка → логін через IG → хендл підтягнеться → окреме довше біо.
5. Meta Business Portfolio (business.facebook.com) → підключити IG (+ створити паркувальну FB-сторінку заразом, секція 8).
6. 2FA на IG, FB і Business Portfolio.
7. **Автоматизація Threads (free, без review):** developers.facebook.com → Create App → use case «Access the Threads API» (⚠️ у апки буде ДВА app ID — потрібен Threads-специфічний) → додати свій акаунт як Threads Tester → прийняти інвайт у налаштуваннях Threads → long-lived token (60 днів; **крон на рефреш з першого дня**, інакше тихо помре на 61-й). Ліміти: 250 постів/добу, текст ≤500 симв., двокроковий контейнер: `POST /{user-id}/threads` → `/{user-id}/threads_publish`.
8. В Accounts Center увімкнути auto-share IG→Facebook; auto-share IG→**Threads вимкнути** (Threads має отримувати нативний текст через API, не кадровану картинку).

**Біо IG/Threads (готове, 138 симв.):**
> Daily AI & engineering brief for developers 🤖
> Tools · agents · research — zero noise
> EN + UA · free daily ↓

**Каденс:** Threads 1–3/день (1 авто з пайплайна + 1–2 ручні реплаї/тейки; реплаї не рахуються в ліміт постів). IG: 2–3 каруселі/тиждень (1080×1350 або 1080×1440, всі слайди один ратіо, до 20 слайдів; weekly digest = якірна карусель) + Story з link-стікером у дні публікацій (єдине місце клікабельного лінка поза біо).

**Граблі:** Reels — свідомо ігноруємо (час-провалля для соло); IG publishing API їсть **тільки JPEG** з публічного URL; підписи IG не мають клікабельних лінків — не витрачай їх на URL; новий акаунт перші 1–2 тижні «прогрівати» вручну перед увімкненням API-постингу (анти-спам евристики).

---

## 6. LinkedIn Company Page 🟠

**Кроки:**
1. Спершу особистий профіль у порядку: фото, хедлайн зі згадкою AI Today Brief, підтверджена пошта `@aitodaybrief.com` (сторінки з free-mail-only акаунтів ловлять верифікаційний фрикшн).
2. Desktop → «For Business» → Create a Company Page → тип «Company». Name «AI Today Brief», URL `linkedin.com/company/ai-today-brief` (клейм одразу — зміна потім ламає лінки), industry «Technology, Information and Media», size 1, Privately Held.
3. Tagline 120 симв. (нижче) + About 2000 симв. (перші ~150 видно до «see more» — фронт-лоуд ключових слів) + 3 хештеги.
4. Лого 400×400 (⚠️ LinkedIn рендерить лого і на світлому, і на темному — наш SVG з запеченим темним фоном, не прозорий), cover 4200×700 (текст по центру ~60% ширини: мобайл ріже боки, лого перекриває низ-ліво).
5. CTA-кнопка: **«Sign up» → Beehiiv** (не просто на головну).
6. Додати собі позицію Founder @ AI Today Brief → сторінка показує 1 співробітника, твої пости атрибутуються бренду.
7. 3–5 постів ДО інвайтів → потім усі 50 invite-кредитів/міс (так, ліміт зрізали з 250 до 50 у 2026; кредити повертаються за прийняті — цілься в тих, хто точно прийме; ре-спенд 1-го числа).
8. **Newsletter сторінки — місяць 2** (вимоги: 150+ фоловерів + історія регулярного контенту). При запуску всі фоловери отримують one-time notification — спершу наростити базу.

**Tagline (готовий, 92 симв.):**
> Daily curated AI & engineering brief for developers — signal, not noise. EN + UA.

**About (готовий, перші 150 симв. самодостатні):**
> AI Today Brief is a daily, human-curated AI & engineering brief for developers, founders and tech leads. We read 120+ sources and publish only what changes how you build: tool releases, agents, research, practical guides. In English and Ukrainian. Free daily brief and newsletter at aitodaybrief.com.

**Автоматизація — важливе обмеження:** офіційний Community Management API вимагає **зареєстровану юрособу** + тижні-місяці review — **не блокуємось на ньому.** Реалістичний шлях: Buffer free (3 канали) / Make / Zapier постять на сторінку через свій доступ; або нативний планувальник LinkedIn (до 3 міс наперед) батчем раз на тиждень. Пайплайн може генерувати тексти постів, публікація — через ці інструменти.

**Каденс:** сторінка 3–5/тиждень (реальна підлога — 3); особистий профіль = справжній двигун (5–8× reach сторінки) — репост контенту сторінки особисто + 10–15 хв коментарів. Топ-формат 2026: **PDF/document-каруселі** (~3× імпресій картинок) — «Top 5 AI stories this week» у бренд-стилі.

**Граблі:** голі лінк-пости душаться; RSS-дампи без коментаря = місто-привид; невидимий прозорий логотип на світлому фоні; план «зростемо інвайтами» мертвий (50/міс).

---

## 7. YouTube — зарезервувати зараз, публікувати потім 🟡

**Зараз (30 хв):** Google-акаунт бізнесовий + 2FA → перемикач каналів → **«Create a new channel»** (імʼя + хендл) = Brand Account «AI Today Brief» (незалежний від особистого Google, можна додавати менеджерів, переживе передачу) → хендл `@aitodaybrief` → верифікація телефоном (youtube.com/verify) → оформлення: аватар квадратний (наш 1024×1024; рендериться 98×98, ліміт ~15 МБ), банер 2560×1440 (⚠️ **тільки центральні 1546×423 видно на всіх девайсах** — wordmark строго туди; бренд-кіт врахував), опис (нижче), лінки (перший = кнопка на хедері: сайт, далі Beehiiv/Telegram), keywords, made-for-kids = No.

**Опис каналу (готовий):**
> Daily AI & engineering brief for developers — the 5 stories that matter, every day. Tool releases, agents, research, practical guides. Human-curated from 120+ sources. Free daily brief + newsletter: aitodaybrief.com
> Щоденний AI-бриф для розробників — українською та англійською.

**Публікація — тільки коли буде автоматизований рендер** (Remotion/FFmpeg з пайплайна: headline-картки + TTS; у нас уже є summary + hero + video_script_* поля). Економіка каналу: Shorts RPM $0.01–0.08 — це **фуннель на newsletter, не дохід**. Формат: «3 AI stories in 45s», 3–5/тиждень, 1080×1920, хук у перші 2 сек, великі вшиті титри, CTA в пін-коменті (описи Shorts ніхто не бачить). API: videos.insert став дешевим (квоти ~100 аплоадів/день), але **до проходження compliance audit API-аплоади замкнені в private** — подати «Audit and Quota Extension Form» заздалегідь, коли дійдемо до рендеру.

**Граблі:** липень-2025 політика «inauthentic content» демонетизує конвеєрний TTS-слоп — рятує оригінальний кураторський голос і бренд-стиль; Shorts-перегляди не йдуть у 4000 годин YPP; EN+UA в одному фіді вбиває ретеншн (UA — через auto-dubbing/multi-audio пізніше).

---

## 8. Facebook Page — тільки клейм ⚪

**30 хв один раз:** з особистого профілю (2FA обов'язково — сторінка вмирає разом з акаунтом-адміном) → facebook.com/pages/create → «AI Today Brief», категорія «Media/News Company» → біо ~101 симв. (нижче) → аватар (бренд-кіт), cover 851×315 (текст у центральних ~640 px) → **хендл @aitodaybrief у Settings → Username — головна причина створення** → CTA «Sign up» → Beehiiv → 3–5 сід-постів → підключити до Business Portfolio.

**Біо (готове, 96 симв.):**
> Daily AI & engineering brief for developers. Human-curated, EN + UA. → aitodaybrief.com

**Чому скіп:** reach лінк-постів 1–2%; referral-трафік паблішерам -75% з 2018; Meta тестує ліміт **2 органічні лінк-пости/міс** без Meta Verified ($14.99/міс). Єдиний живий сценарій — UA-аудиторія (FB топ-3 в Україні): якщо колись підемо — нативні картки + лінк у коменті, UA-пости з geo-таргетом на Україну через Graph API (Standard Access для своєї сторінки — без review). День-30 гейт: немає трафіку → автопілот/сплячка.

---

## 9. Бренд-кіт

Файли: `artifacts/brand-kit/` (SVG, експорт у PNG — інструкція в README.md поруч):

| Файл | Розмір | Для чого |
|---|---|---|
| `avatar.svg` | 1024×1024 | Усі аватарки (X 400², TG 512², IG 320²+, YT 800², LI 400², FB, Bluesky) — один файл, різний експорт |
| `banner-x.svg` | 1500×500 | X **і** Bluesky **і** Mastodon (однаковий спек) |
| `banner-linkedin.svg` | 4200×700 | LinkedIn cover (safe-центр врахований) |
| `banner-youtube.svg` | 2560×1440 | YouTube (контент у центральних 1546×423) |
| `banner-facebook.svg` | 851×315 | Facebook cover (центральні 640 px) |

Стиль: фон `#0f1115`, акцент `#f0c040`, текст `#e8e8e8`/`#9aa1ad`, серіфний wordmark (Fraunces) + Inter. Аватар = монограма «ATB·» (wordmark на колі нечитабельний).

---

## 10. Секрети CI (GitHub → Settings → Secrets → Actions)

| Секрет | Звідки | Статус |
|---|---|---|
| `TELEGRAM_CHANNEL_ID` | `@aitodaybrief` або numeric `-100…` | був для weekly digest — перевикористовується |
| `X_API_KEY` / `X_API_SECRET` | console.x.com → App → Keys and Tokens (Consumer Keys) | ➕ додати |
| `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | там же (Access Token and Secret для свого акаунта) | ➕ додати |

Авто-репост: `.github/workflows/social-repost.yml`, щодня 17:00 UTC (20:00 Київ). Поки секретів X нема — скрипт постить тільки в Telegram і пише warning (не падає). Тест: Run workflow → dry_run.

---

## 11. KPI на 90 днів (реалістичні для соло)

| Канал | 30 днів | 90 днів |
|---|---|---|
| Telegram | 200 (сід) → 350 | 800–1 000 |
| X | 150–300 | 800–1 500 (з реплай-рутиною) |
| Bluesky | 100–250 | 500–1 000 |
| Threads | 100–200 | 500+ |
| LinkedIn Page | 75–150 (→ запуск newsletter) | 300–500 |
| Головна метрика | **переходи на сайт + підписки newsletter** з UTM-міток per-платформа | newsletter залишається north star |

UTM-конвенція: `?utm_source=x|telegram|bluesky|threads|linkedin&utm_medium=social&utm_campaign=daily`.
