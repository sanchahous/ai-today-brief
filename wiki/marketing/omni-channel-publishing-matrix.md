# Wiki: Omni-Channel Publishing Matrix & Workflow Standards

Summary: система шаблонів верстки weekly digest під шість соцканалів — блоки-примітиви
з обов'язковою практикою, жорсткі ліміти, політика лінків і хештегів, готові адаптації
та чек-лист перед публікацією.
Sources: `src/lib/social/quality.ts` (`CHANNEL_RULES`), `src/lib/social/providers.ts`,
`src/lib/social/instagram-carousel.ts`, `src/lib/weekly-digest/social-adapter.ts`
(`CHANNEL_CONTRACT`), `src/lib/weekly-digest/social-facts.ts`,
`src/app/r/s/[token]/route.ts`, `src/lib/weekly-digest/preflight.ts`
(`WEEKLY_SOCIAL_MATRIX`), прод-розбір релізу `ai-weekly-2026-08-09` 2026-08-21,
deterministic contract gate 2026-08-28, Telegram Топ 3/Радар/CTA gate 2026-08-28
Last updated: 2026-09-03

---

## 0. Розбір релізу 20.08: що саме зламалось

Перший ручний реліз дав шість зауважень власника. Нижче — що показала прод-БД, а не
скріншоти (source: `social_posts` package `612df95c`, live check 2026-08-21).

| # | Симптом | Що в базі | Корінь |
|---|---|---|---|
| 1 | LinkedIn — полотно тексту | `post_text` 996 симв., **0 переносів рядка** | Генератор. `CHANNEL_CONTRACT.linkedin` не мав жодної вимоги до верстки |
| 2 | Telegram — блоки злиплись | 1495 симв., 9 переносів, **0 порожніх рядків** | Те саме: одинарний `\n` не дає абзацу |
| 3 | Instagram — пост «ні про що» | 7 слайдів ✅, caption 490 ✅ | Структура правильна. Дефект не технічний, а редакційний — §1 |
| 4 | Threads — один пост без ланцюжка й лінка | **`content_parts` = 4 частини** з URL в останній | Пайплайн згенерував правильно. Це моя помилка ручного постингу 20.08 |
| 5 | Facebook — порожня OG-картка | `assets` = 1, лінк = `/r/s/<token>` | `/r/s/` віддавав 302 з `no-store` — скрапер Facebook не резолвить OG крізь такий редирект |
| 6 | X — «нікуди не веде» | `content_parts` = 2, `first_comment` ✅ | Root без лінка — **так і має бути**. Але в self-reply пішов голий URL без тексту. **2026-09-03:** гейт `x_reply_bare_url` + компактний `?s=` URL |

**Побічна знахідка того самого кореня, що й №5:** у `social_click_events` **34 кліки з
`device_class='bot'` проти 8 живих** (4 mobile + 4 desktop). Кожен прев'ю-скрапер
рахувався як клік — 81% таблиці кліків був сміттям.

---

## 1. Головний дефект: «сухо» — це не стиль, це відсутній блок

Власник сформулював так: пости подають новину, але не показують, **навіщо це читачеві й
що з цим робити**. Розбір підтвердив, що це не питання смаку.

**Матеріал для практики вже існує в базі.** У всіх 7 історій випуску заповнені
`practical_en` (107–269 символів) і `takeaway_en`. Приклади:

> **Story 1:** «A team building a long-context coding or document agent can pull the
> checkpoint from Hugging Face, serve it via vLLM or SGLang, and set reasoning to 'low'
> for bulk passes — but without GB300-class NVLink hardware, matching NVIDIA's reported
> throughput isn't guaranteed.»

> **Story 4:** «A developer routes Claude Code's API traffic through PrivAiTe's proxy;
> tool-call parameters get scrubbed before leaving the machine, adding 42 seconds per
> session.»

Це саме те «пощупати», якого бракувало. І `buildWeeklySocialFactSnapshot`
(`social-facts.ts`) **передає ці поля письменнику** — вони були в `sourceFacts`.

**Чому вони не потрапили в жоден пост:** промпт письменника ніколи їх не просив. Він
складався майже виключно із заборон — «Do not list all headlines», «Do not truncate»,
«Never open with…» — і жодної позитивної вимоги дати читачеві дію. Критик оцінював
фактичну точність, платформну відповідність і оригінальність. Корисності не оцінював ніхто.

Це рівно та асиметрія, про яку вже був зафіксований фідбек власника: коли гейт складається
з самих заборон, копія дрейфує в канцелярит — формально бездоганний, нікому не потрібний.

---

## 2. Архітектура: блоки-примітиви

| Код | Блок | Що містить | Правило |
|---|---|---|---|
| `HOOK` | Гак | Теза з конкретним числом | Одне речення, число в перших 10 словах |
| `ANCHOR` | Якірна метрика | Цифра, на яку читач має спертись | Контраст (2,4T проти 95B), не одиничне число |
| `WHY` | Чому це важливо | Наслідок для того, хто будує | Формат «це означає, що…» |
| **`USE`** | **Що зробити** | **Назва інструменту + крок + ціна/ліміт** | **Обов'язковий у кожному каналі. Джерело — `practical_*`** |
| `EVIDENCE` | Докази | 1–2 інші факти тижня з наслідком | Джерело + число + наслідок |
| `READ` | Стратегічний висновок | Що змінюється в рішеннях | Без прогнозів, лише зсув критерію |
| `DECISION` | Питання читачеві | Питання до інженерної команди | Справжнє питання, не риторика |
| `LINK` | Трекований URL | канонічна сторінка з `?s=<token>` | Рівно один, де дозволено |
| `TAGS` | Хештеги | Пошук і дискавері | Політика §5 |

**Порядок:** `HOOK → ANCHOR → WHY → USE → EVIDENCE → READ → DECISION → LINK → TAGS`.

`USE` стоїть **перед** `EVIDENCE` навмисно: віддача читачеві має прийти раніше, ніж друга
порція аналітики. Канал може викинути `READ` або `EVIDENCE`, але **не `USE`** — пост без
нього не проходить редакційну планку, навіть якщо всі числа правильні.

### Анатомія блока `USE`

Три обов'язкові елементи, інакше це не практика, а переказ:

1. **Назва** — модель, інструмент, ендпоінт, прапорець, поріг або умова ліцензії.
2. **Крок** — що конкретно зробити («забрати чекпоінт з HF, підняти через vLLM, поставити
   reasoning=low для масових проходів»).
3. **Ціна або межа** — скільки коштує, скільки додає латентності, де ламається
   («без GB300 NVLink заявленої пропускної здатності не буде», «+42 с на сесію»).

Без третього елемента блок перетворюється на рекламу, і критик має його зарубати.

### Розкладка блоків по каналах

| Блок | LinkedIn | X | Telegram | Threads | Facebook | Instagram |
|---|---|---|---|---|---|---|
| `HOOK` | ✅ | ✅ | ✅ | part 1 | ✅ | slide 1 |
| `ANCHOR` | ✅ | ✅ | ✅ | part 1 | ✅ | slide 2 |
| `WHY` | ✅ | ✅ | ✅ | part 2 | ✅ | slide 2 |
| **`USE`** | ✅ блок | self-reply | ✅ блок | part 3 | ✅ | slide 7 |
| `EVIDENCE` | ✅ (2) | ➖ | ✅ (2) | part 2 | ✅ (2) | slides 3–4 |
| `READ` | ✅ | ➖ | ✅ | ➖ | ✅ | slides 5–6 |
| `DECISION` | ✅ | ➖ | ✅ | part 4 | ✅ | ➖ |
| `LINK` | 1-й коментар | self-reply | у тілі | остання part | у тілі | ❌ link in bio |
| `TAGS` | 3 | 0–2 | 0 | 0 (topic в UI) | 2–3 | 5 у caption |

---

## 3. Жорсткі ліміти (фактичні, з коду)

Значення з `CHANNEL_RULES` (`src/lib/social/quality.ts`) і провайдерів. Порушення
будь-якого — **blocking**, Approve не пройде.

| Канал | Локаль | Символи (hard) | Цільовий діапазон | Хештеги | Емодзі | URL у тілі | Медіа |
|---|---|---|---|---|---|---|---|
| **LinkedIn** | `en` | 300–3000 | 700–1200 | ≤3 | ≤3 | **заборонено** | 1 картинка, alt обов'язковий |
| **X** | `en` | 40–280 | 180–260 | ≤2 | ≤2 | **заборонено** | 1 картинка ≤5 МБ |
| **Telegram** | `uk` | 80–4096 | 900–1600 | ≤3 | ≤8 | рівно 1 | 1 картинка |
| **Threads** | `uk` | 3–5 частин × ≤500 | 4 частини | ≤2 | ≤3 | лише остання частина | 1 картинка |
| **Facebook** | `uk` | 120–63206 | 700–1400 | ≤3 | ≤5 | рівно 1 | 1 картинка |
| **Instagram** | `en` | caption 180–800 | 7 слайдів фіксовано | ≤5 | ≤5 | **заборонено** | 7 JPEG 1080×1350 |

**Локаль не обирає редактор** — вона зашита в `WEEKLY_SOCIAL_MATRIX`:
`telegram/facebook/threads = uk`, `x/linkedin/instagram = en`. Розсинхрон цієї матриці з
SQL-копією тримав Approve недосяжним із 2026-07-23 по 2026-08-20 — не чіпати односторонньо.

### Верстка — те, що зламалось найпершим

- **Абзац = порожній рядок.** Одинарний `\n` у Telegram і Facebook дає злиплі рядки, а не
  абзац. Саме через це «Топ-3:» приліпилось до попереднього блоку.
- **LinkedIn читають по діагоналі.** Одне речення на рядок, порожній рядок між блоками.
  996 символів без жодного переносу — це те, що бачив власник 20.08.
- **Markdown рендериться тільки в Telegram.** З 2026-08-21 Telegram шлеться з
  `parse_mode: HTML`, тож `**жирний**` і `` `code` `` там працюють. У решті пʼяти каналів
  ті самі маркери друкуються сирими — гейт блокує їх кодом `raw_markup`.
- **Три крапки заборонені** (`artificial_ellipsis`), як і `<PART>`, `<SLIDE>`, `<CAPTION>`
  (`service_markers`) та zero-width/bidi (`forbidden_characters`).
- **Telegram + картинка понад 1024 символи.** Автоматика робить правильно: `sendPhoto` з
  підписом `AI Today Brief`, далі `sendMessage` з повним текстом як reply. **Ручний постинг
  мусить повторювати цю схему** — інакше отримаєте 4 обрізані дублікати, як 20.08.

---

## 4. Політика розміщення лінка

| Канал | Куди йде tracked URL (`?s=`) | Чому |
|---|---|---|
| **LinkedIn** | 1-й коментар | Зовнішній лінк у тілі ріже охоплення сторінки |
| **X** | self-reply **з текстом** | Root має бути link-free; голий URL у reply — змарнований слот, туди йде `USE` |
| **Telegram** | у тілі, в кінці | Канал не карає лінки |
| **Threads** | тільки остання частина треду | Лінк у першій частині обриває дочитування |
| **Facebook** | у тілі + прев'ю-картка | Прев'ю дає клікабельну площу |
| **Instagram** | ніде в тексті | Підпис не клікабельний; CTA — «link in bio» |

## 5. Політика хештегів

| Канал | Кількість | Розміщення | Тип |
|---|---|---|---|
| **LinkedIn** | рівно 3 | окремий рядок у самому низу | ультра-таргетовані: `#AI #LLM #DeepTech` |
| **X** | 0–2 | вплетені в текст природно | контекстні; 0 — прийнятний дефолт |
| **Telegram** | **0** | — | канал має власну навігацію |
| **Threads** | 0 у тексті | нативний Topic у UI | одна тема, не кластер `#` |
| **Facebook** | 2–3 | останній рядок | широкі, під пошук спільнот |
| **Instagram** | 5 | у кінці caption | вузькі технічні; жодних `#instagood` |

---

## 6. Готові адаптації

Перероблено після розбору 20.08: додано блок `USE` з реальних `practical_*` полів випуску
й справжню верстку. Заміри проти `CHANNEL_RULES` 2026-08-21:

| Шаблон | Символи | Порожніх рядків | Хештеги | Емодзі | URL | Вердикт |
|---|---|---|---|---|---|---|
| LinkedIn | 1116 | 14 | 3 | 2 | 0 | ✅ (лінк у 1-му коментарі) |
| X root | 224 | 2 | 0 | 0 | 0 | ✅ |
| X self-reply | 236 | 1 | 0 | 0 | 1 | ✅ |
| Telegram | 1371 | 9 | 0 | 0 | 1 | ✅ |
| Threads | 4 частини (141/246/238/202) | — | 0 | 0 | 1 | ✅ |
| Facebook | 1249 | 7 | 3 | 0 | 1 | ✅ |
| Instagram caption | 730 | 4 | 5 | 0 | 0 | ✅ |

Порівняння з релізом 20.08: LinkedIn мав **0** порожніх рядків проти 14 тепер, Telegram —
**0** проти 9. Блок `USE` був відсутній у всіх шести каналах.

### 6.1 LinkedIn (`en`)

```text
Alibaba's Qwen3.8 ships 2.4 trillion parameters.

Only 95 billion fire per token.

Anchor on the second number. It decides whether you can run this at all.

🛠️ What you can do this week

Pull the checkpoint from Hugging Face.
Serve it through vLLM or SGLang.
Set reasoning to "low" for bulk passes.

That gives you a long-context coding or document agent on your own stack, with no hyperscaler contract underneath it.

The catch: without GB300-class NVLink hardware you will not hit NVIDIA's published throughput. Benchmark your own rack before you promise anything to anyone.

📉 Two more signals from the same week

IBM's ALTK-Evolve matched ACE's accuracy on one-seventh the inference tokens. Agent memory is a cost lever now, not a design detail.

0 of 178 Chinese models above 20B shipped non-commercial. License terms stopped being the blocker.

Open AI is no longer won by raw size.

It is won by what your stack can exploit: sparse compute, lighter agent memory, permissive weights.

Which of those three is your stack actually ready for today?

Full weekly breakdown in the first comment.

#AI #LLM #DeepTech
```

**1-й коментар** (компактний `?s=`, без UTM; URL з нового рядка):

```text
Full weekly digest with the quantization-healing step.

https://aitodaybrief.com/en/weekly/{slug}?s=<token>
```

LinkedIn **не розгортає OG в коментарях**. Автопостинг кріпить
`content.article` (source = той самий compact URL, thumbnail = cover) на сам пост.
Якщо постиш руками — встав Destination у композер поста і дочекайся картки; у
коментар лишай короткий рядок + compact URL.

> Шаблон 6.1 тепер відповідає коду: з 2026-08-21 `linkedin.rootUrlStrategy = 'none'`,
> лінк у тілі **блокується**, а `firstComment` обовʼязковий і постить його автоматика.
> **2026-09-03:** коментар більше не несе повний UTM (він ламає вигляд і все одно
> без превʼю). OG живе на пості через Posts API `content.article`.

### 6.2 X (`en`)

**Root post (link-free):**

```text
Qwen3.8 is 2.4T parameters. Only 95B fire per token.

That ratio, not the headline number, is what makes it deployable on plain vLLM instead of a hyperscaler cluster.

Open weights are being priced by routing efficiency now.
```

**Self-reply — сюди йде `USE`, а не голий лінк:**

```text
Practical version: pull the checkpoint from HF, serve on vLLM or SGLang, set reasoning to "low" for bulk passes. Without GB300-class NVLink you will not match NVIDIA's throughput numbers.

Full week: https://aitodaybrief.com/en/weekly/{slug}?s=<token>
```

### 6.3 Telegram (`uk`, порожній рядок між блоками)

```text
Найсильніший сигнал тижня — не розмір Qwen3.8, а те, скільки з нього реально працює.

2,4 трильйона параметрів. На кожен токен активуються 95 мільярдів.

Що з цим робити вже цього тижня: забрати чекпоінт з Hugging Face, підняти через vLLM або SGLang і поставити reasoning у «low» для масових проходів. Це дає власного агента для довгого контексту чи роботи з документами — без контракту з гіперскейлером.

Застереження: без заліза класу GB300 NVLink заявленої NVIDIA пропускної здатності ви не отримаєте. Міряйте на своїй стійці, перш ніж щось обіцяти.

Ще два сигнали того ж тижня:

• IBM Research ALTK-Evolve зрівнялася з ACE за точністю, витративши до однієї сьомої токенів. Пам'ять агента стала статтею витрат, а не деталлю дизайну.

• Hugging Face не знайшов жодної некомерційної ліцензії серед 178 китайських релізів понад 20B. Умови використання перестали бути блокером.

Радар безпеки: PrivAiTe проганяє трафік Claude Code через власний проксі й вичищає параметри викликів до того, як вони покинуть машину — ціна близько 42 секунд на сесію. У власних тестах він пропустив до 2 секретів із 24, тож це шар пом'якшення, а не гарантія.

Якщо дивитись лише на параметри, легко промахнутися повз головне. Зараз вирішує те, скільки ваг реально працює, скільки токенів з'їдає пам'ять і що дозволяє ліцензія.

Повний тижневий дайджест: https://aitodaybrief.com/en/weekly/{slug}?s=<token>
```

### 6.4 Threads (`uk`, 4 частини)

```text
[1/4]
Qwen3.8 має 2,4 трильйона параметрів. Але на кожен токен активуються лише 95 мільярдів — і саме це число варто запам'ятати, а не заголовкове.

[2/4]
Ефективність маршрутизації означає, що модель такого розміру розгортається на звичайному vLLM або SGLang, а не тільки на кластері гіперскейлера. Той самий тиждень: IBM ALTK-Evolve зрівнялася з ACE, витративши до однієї сьомої токенів на інференс.

[3/4]
Якщо хочете спробувати: чекпоінт з Hugging Face, підняти через vLLM чи SGLang, reasoning у «low» для масових проходів. Чесна ціна питання — без заліза класу GB300 NVLink заявленої пропускної здатності не буде, тож міряйте на своїй стійці.

[4/4]
Питання до інфраструктурних команд: ваш стек уміє використовувати розріджені обчислення й пермісивні ваги, чи ви платите за щільні моделі за звичкою?

Повний розбір: https://aitodaybrief.com/en/weekly/{slug}?s=<token>
```

**Topic:** `AI` — обирається в нативному UI. Маркери `[1/4]` тут лише для читабельності
wiki, у пост вони не йдуть.

### 6.5 Facebook (`uk`)

```text
Цього тижня Alibaba виклала Qwen3.8 — 2,4 трильйона параметрів. Але на кожен токен активуються лише 95 мільярдів, і значення має саме ця цифра.

Ефективність маршрутизації означає, що модель такого розміру запускається на звичайному vLLM чи SGLang, а не тільки на кластері гіперскейлера.

Що це дає на практиці: команда, яка будує агента для довгого контексту або роботи з документами, може забрати чекпоінт з Hugging Face, підняти його через vLLM або SGLang і поставити reasoning у «low» для масових проходів. Чесне застереження — без заліза класу GB300 NVLink заявленої пропускної здатності не буде.

Той самий патерн повторився двічі за тиждень. IBM Research показала, що ALTK-Evolve зрівнялася з ACE за точністю, витрачаючи до однієї сьомої токенів на інференс. А Hugging Face зафіксував: жоден зі 178 китайських релізів понад 20 мільярдів параметрів цього року не вийшов під некомерційною ліцензією.

Разом це означає одне: відкритий AI більше не виграють самим лише масштабом. Виграють ефективністю, дешевшою пам'яттю агентів і ліцензіями, які дозволяють будувати на моделі бізнес.

Якщо ви відповідаєте за інфраструктуру — ваш стек до цього готовий?

Повний розбір тижня: https://aitodaybrief.com/en/weekly/{slug}?s=<token>

#AI #OpenSource #ШтучнийІнтелект
```

### 6.6 Instagram (`en`, 7 слайдів)

Структура фіксована в коді (`INSTAGRAM_CAROUSEL_SLIDE_KINDS`). Ліміти: cover ≤72, решта
заголовків ≤54, тіло ≤120.

| # | Kind | Headline | Body |
|---|---|---|---|
| 1 | cover | `Qwen3.8 fires 95B of its 2.4T parameters` | — |
| 2 | story | `2.4T parameters. 95B active.` | `Fine-grained MoE routing makes the largest open model runnable on standard vLLM or SGLang.` |
| 3 | story | `IBM's ALTK-Evolve matches ACE` | `Same accuracy on as little as one-seventh the inference tokens. Agent memory is now a cost lever.` |
| 4 | story | `0 of 178 Chinese models restricted` | `No release above 20B parameters shipped under a non-commercial license this year.` |
| 5 | comparison | `Scale vs. routing efficiency` | `Raw parameter count is a headline. Active parameters per token decide where you can deploy.` |
| 6 | caveat | `You still need the right silicon` | `Without GB300-class NVLink, NVIDIA's published throughput will not reproduce on your own rack.` |
| 7 | takeaway | `Try it: HF checkpoint on vLLM` | `Pull from Hugging Face, serve via vLLM or SGLang, set reasoning to low for bulk passes.` |

**Caption:**

```text
Alibaba's Qwen3.8 ships 2.4 trillion parameters but activates only 95 billion per token — the routing efficiency that decides whether you need a hyperscaler cluster or a standard vLLM deployment.

Want to try it this week? Pull the checkpoint from Hugging Face, serve it through vLLM or SGLang, and set reasoning to "low" for bulk passes. Without GB300-class NVLink hardware you will not match NVIDIA's published throughput, so benchmark your own rack first.

Two more signals: IBM Research matched ACE's accuracy on one-seventh the inference tokens, and zero of 178 Chinese releases above 20B carried a non-commercial license.

Full weekly breakdown — link in bio.

#OpenSourceAI #LLMOps #MixtureOfExperts #AIInfrastructure #vLLM
```

---

## 7. Конформанс: що вже змінено в коді, що лишається

**Змінено 2026-08-21** (гілка `claude/weekly-digest-release-aug-fcfe9c`):

| Файл | Зміна | Ефект |
|---|---|---|
| `social-adapter.ts` → `CHANNEL_CONTRACT` | вимога верстки (порожні рядки; для LinkedIn — одне речення на рядок) + обов'язковий блок практики в усіх 6 каналах | Контракт підставляється і в промпт письменника, і в промпт критика — критик тепер аудитує це під `platformFlags` без змін парсера |
| `social-adapter.ts` → промпт письменника | новий блок `WHAT THIS COPY MUST GIVE THE READER` | Перша **позитивна** вимога в промпті: назва інструменту + крок + ціна/ліміт; пряма вказівка будувати копію на `practical_*`, а не переказувати заголовок |
| `src/app/r/s/[token]/route.ts` | боти отримують 200 HTML з `canonical`/`og:url` замість 302 `no-store`; клік для бота не пишеться | Ціль — жива OG-картка у Facebook і чиста таблиця кліків |
| `src/lib/social/telegram-format.ts` (новий) + `providers.ts` | `parse_mode: 'HTML'` для Telegram; спершу екранування `&<>`, потім промоція закритого whitelist `**bold**` → `<b>`, `` `code` `` → `<code>`, ``` ```блок``` ``` → `<pre>` | Telegram нарешті рендерить акценти й назви прапорців. MarkdownV2 відкинуто: він вимагає екранувати 15 символів, і один пропущений валить усе повідомлення |
| `quality.ts` → `raw_markup` | розмітка заборонена **скрізь, крім Telegram** | Не дає `**` протекти в LinkedIn чи Facebook, де вона друкується сирою |
| `quality.ts` → `linkedin.rootUrlStrategy` | `'one'` → **`'none'`** + нове блокування `linkedin_comment_url` | Тіло LinkedIn-поста більше не містить URL |
| `providers.ts` → `LinkedInPublisher` | після публікації постить `firstComment` через `/rest/socialActions/{urn}/comments`; збій = `partial_linkedin_comment` (`ambiguous`, під реконсиляцію, без ретраю). **2026-09-03:** пост несе `content.article` (compact `?s=` + thumbnail), коментар — короткий рядок + той самий compact URL без UTM | Автопостинг лінка 1-м коментарем; OG-картка на пості, не в коментарі (LinkedIn коментарі не unfurl) |
| `weekly-action-board.tsx` (новий) + `weekly/[slug]/page.tsx` | блок «Що взяти в роботу цього тижня» одразу під героєм; відео перенесено з кінця статті на початок колонки | Рівень випуску, якого бракувало: 3–5 дій із `practical_*`, кожна з якорем на свою історію |

**Змінено 2026-08-28.** Рядок «критик тепер аудитує це під `platformFlags`» вище описував увесь
захист верстки станом на 21.08 — і саме тому Telegram знову зламався 28.08 (68/100 platform-fit,
~1700 симв. без `**bold**` і без `` `backticks` ``): вимоги були прозою в промпті, критик міг їх
просто не помітити в конкретному раунді, і жоден код це не перевіряв. `channelContractIssues()`
у `social-adapter.ts` тепер детерміновано перевіряє: контрактний діапазон символів
(telegram/facebook/x/linkedin), Telegram bold+backticks, порожній рядок між блоками
(telegram/facebook/linkedin) і LinkedIn «не один щільний абзац» (жоден блок між порожніми
рядками не довший за 400 символів). Кожне порушення — іменований blocking issue незалежно від
того, що сказав критик, тож промпт ремонту щоразу називає точний дефект. `CHANNEL_CONTRACT` для
telegram/facebook/linkedin тепер прямо запрошує одну невелику іконку/емодзі на заголовок
практичного блоку (той самий 🛠️/📉 патерн, що й у шаблонах §6.1 нижче) — до цього емодзі в
промпті не згадувались жодного разу, лише `CHANNEL_RULES.maxEmoji` ставив стелю.
(source: `src/lib/weekly-digest/social-adapter.ts`, `src/lib/weekly-digest/social-adapter.test.ts`;
[weekly-digest § Social copy: channel-contract format rules](../pipeline/weekly-digest.md#social-copy-channel-contract-format-rules-were-critic-only-no-deterministic-gate-2026-08-28))

**Follow-up 2026-08-28, той самий день.** Linked retry `f5453cae` після #335 підтвердив
довжину/bold/backticks, але впав на структурі: три головні новини сиділи в «📡 Радар», CTA був
злитий з аналітикою. Лічити ≥4 абзаци недостатньо. Код тепер вимагає окремий перший рядок
Топ 3 / Top 3, окремий перший рядок Радар / Radar, і короткий останній блок з URL (≤180
символів). Коди: `telegram_block_structure`, `telegram_top3_block_required`,
`telegram_radar_block_required`, `telegram_top3_radar_merged`, `telegram_cta_merged`.
(source: прод-Supabase job `f5453cae-307c-439e-ba5e-9db891eb095d` 2026-08-28 12:42 UTC;
`src/lib/weekly-digest/social-adapter.ts`)

**Лишається** (потребує рішення власника):

| # | Правило | Що каже код | Статус |
|---|---|---|---|
| 1 | Instagram: 5–8 хештегів | caption ≤5 (`instagram_caption_hashtags`) | ❌ однорядкова правка ліміту, якщо редакція наполягає |
| 2 | LinkedIn: 4 емодзі у зразку ТЗ | `maxEmoji: 3` | ⚠️ рішення редакції, не баг. Шаблон використовує 2 |
| 3 | `USE`-блок: чи справді практичний, чи просто згаданий інструмент | аудитує лише критик через `platformFitScore`, §9 | ⚠️ навмисно залишено судженням критика — це редакційна, не механічна перевірка |

> ⚠️ **Не перевірено наживо.** Фікс `/r/s/` типізується і проходить тести, але поведінку
> скрапера Facebook звідси перевірити неможливо. Після деплою прогнати URL через
> **Facebook Sharing Debugger** (Scrape Again) і переконатись, що картка тягне обкладинку
> й заголовок. До цієї перевірки вважати пункт 5 з §0 виправленим **гіпотетично**.

---

## 8. Omni-Channel Pre-Publish Checklist

### A. Користь читачеві — перше, що перевіряємо
- [ ] У пості є блок `USE`: **назва** інструменту/моделі/налаштування, **крок**, **ціна або межа**.
- [ ] Практика взята з `practical_*` історії, а не вигадана під час верстки.
- [ ] Читач, дочитавши, знає що спробувати, змінити або перевірити цього тижня.
- [ ] Немає обіцянки без застереження — якщо названо виграш, названа й ціна.

### B. Контент і факти
- [ ] Кожне число звірене з approved-артефактом, не з чернетки.
- [ ] Кожен факт має назване джерело.
- [ ] `HOOK` містить число в перших 10 словах.
- [ ] `DECISION` — справжнє питання, на яке інженер може відповісти «так/ні».

### C. Верстка і ліміти
- [ ] **Порожній рядок між блоками**, а не одинарний перенос.
- [ ] LinkedIn: одне речення на рядок; жодного абзацу довше 3 рядків.
- [ ] Довжина в цільовому діапазоні §3, не лише в hard-межах.
- [ ] Локаль відповідає `WEEKLY_SOCIAL_MATRIX` (UK: Telegram, Facebook, Threads).
- [ ] Емодзі ≤ ліміту (LinkedIn — 3).
- [ ] Немає Markdown, `…`, `...`, `<PART>`, `<SLIDE>`, `<CAPTION>`.
- [ ] Вставлено як plain text (Ctrl+Shift+V).

### D. Лінки
- [ ] Рівно один канонічний URL з `?s=<token>` там, де дозволено; нуль там, де ні.
- [ ] X: root без URL; **self-reply містить текст, а не голий лінк**.
- [ ] LinkedIn: лінк у 1-му коментарі, опублікований одразу після поста.
- [ ] Threads: **усі 4 частини опубліковані ланцюжком**, URL лише в останній.
- [ ] Instagram: у caption URL немає, лінк у біо актуальний.
- [ ] Клікнути лінк перед публікацією — редирект веде на правильний випуск.
- [ ] Facebook/LinkedIn: прев'ю-картка підтягнула обкладинку й заголовок, а не голий домен.

### E. Хештеги
- [ ] Кількість відповідає §5 (Telegram — рівно 0).
- [ ] Окремим рядком, не всередині речення.
- [ ] Набір відрізняється від минулотижневого хоча б на один тег.

### F. Медіа
- [ ] Картинка з вкладки Social **поточної** ревізії.
- [ ] Instagram: рівно 7 JPEG 1080×1350, порядок збережено.
- [ ] Alt-текст заповнений скрізь, де є картинка.
- [ ] X: файл ≤5 МБ.
- [ ] Telegram: якщо текст >1024 — фото окремо, текст reply-повідомленням.

### G. Публікація
- [ ] Правильний акаунт і сторінка (не особистий профіль).
- [ ] Facebook: перемикач «Просувати допис» вимкнений.
- [ ] Час у майбутньому за Europe/Kyiv.
- [ ] Після публікації відкрити живий пост і перечитати перші два рядки на мобільному.

### H. Після
- [ ] Живий URL і external ID внесені в аудит-запис, якщо постили руками.
- [ ] Помилку в опублікованому тексті виправляють видаленням і перепублікацією, а не
      редагуванням — редагування ламає content hash і апрув.

---

## 9. Відкриті питання

1. **Чи потрібен окремий бал критика за практичність.** Зараз вона аудитується всередині
   `platformFitScore` через контракт. Окремий бал дав би вимірність, але потребує зміни
   `parseWeeklySocialCritic` і схеми `quality_report`.

## Related pages

- [social-launch](social-launch.md) — запуск і підключення каналів хвилями
- [custom-social-delivery](custom-social-delivery.md) — кастомна соц-доставка
- [company-page-playbook](company-page-playbook.md) — LinkedIn company page
- [card-images](card-images.md) — генерація візуалів
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md) — вкладка Social у релізному процесі
- [social-cms-runbook](../ops/social-cms-runbook.md) — інфраструктура соц-CMS
