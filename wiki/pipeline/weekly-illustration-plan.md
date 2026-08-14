# Weekly-ілюстрації — виконавча специфікація

Summary: executor spec робіт над ілюстраціями дайджестів після рішення власника 2026-08-15 —
картинки daily/weekly генерує людина вручну, система готує професійні промпти, автогенерація
лишається тільки для зображень новин на сайті. Файл, функція, точна зміна, тест, «готово».
Sources: рішення власника 2026-08-15; `AI_Today_Brief_Visual_Algorithm_Plan.pdf` (розбір V1–V10,
поза репо); живий digest `843975a8-8c19-4eca-96a8-035f76eae3ab` з вердиктами власника 2026-08-14;
інспекція коду 2026-08-15 (перелік файлів — у розділі «Джерела»); Actions run `31739283280`.
Last updated: 2026-08-15

---

**Для виконавця рівня Sonnet 5.** Кожен таск має файл, функцію, точну зміну, тест і критерій
«готово». Не імпровізуй архітектуру поверх цього. Не роби кількох тасків одним PR.

---

## 0. Зміна режиму — 2026-08-15

**Рішення власника:** картинки для **daily** і **weekly** дайджестів більше **не генеруються
автоматично**. Власник генерує їх сам у своєму інструменті й завантажує в адмінку. Система
натомість зобовʼязана готувати **професійні текстові промпти**. **Зображення для новин на сайті
лишаються на повній автогенерації.**
(source: рішення власника 2026-08-15)

### Межа — що авто, що вручну

| Поверхня | Обсяг | Хто малює | Що робить система |
|---|---:|---|---|
| **Зображення новини** (`brief_items.card_image_url`) | ~180/міс | **авто** (FLUX/OpenRouter) | усе як зараз: сцена → промпт → рендер → Storage |
| **Weekly story-ілюстрація** (`story_image`) | 28/міс (7 story × 4 випуски) | **вручну** | 3 різні концепти → 3 промпти → чекає upload |
| **Weekly обкладинка** (`cover`) | 4/міс | **вручну** | 1 промпт → чекає upload |
| **Daily обкладинка випуску** | ~30/міс | **вручну** | 1 промпт у Telegram-review |
| **Weekly соц-візуали** (`web_hero`, `open_graph`, `instagram_*`) | 16/міс | **авто-композит** | без змін: текст поверх завантажених story-зображень |
| **Daily соц-картки** (`social_asset`) | за розкладом | **авто-композит** | без змін: текст поверх card image новини |

**Композит — це не генерація.** `src/lib/weekly-digest/visuals.ts` і
`src/lib/social/assets.ts:150` не малюють зображень: вони беруть уже наявні
(`story_image` / `card_image_url`) і накладають текст. Вони лишаються автоматичними, просто
джерелом пікселів для weekly стає завантажений власником файл. Не чіпай цей шар.
(source: рішення власника 2026-08-15, `visuals.ts:221` `story_image_download_failed`)

### Що це робить із рештою плану

| Розділ | Доля |
|---|---|
| **B** (три різні варіанти) | **лишається головним** — тепер це три різні *промпти*, а не три рендери. Причина деградації (B1) і фікс (B1-fix) чинні дослівно: вони працюють на етапі побудови брифу, до будь-якого рендеру |
| **P** (промпт як продукт) | **новий розділ, головна нова робота** |
| **M** (ручний upload + вимкнення авто-рендеру) | **новий розділ** |
| **C** (grammar) | лишається, але грамматика тепер — вимір **промпту**. C4 (параметричний SVG-рендерер) **виведено зі scope**: це теж автогенерація картинки |
| **C5** | 5.2/5.3/5.4 лишаються (дефекти сигнального шару роутера); **5.1 і 5.5 виведено зі scope** разом із SVG-рендерерами |
| **D1** (заборона тексту) | переписано: детермінований SVG-шар відпадає, вимога «no text» переїжджає в промпт і в post-upload QA |
| **D2** (repair на рівні дефекту) | для дайджестів — це тепер **порада власнику**, не авто-дія; для новин лишається як було |
| **D3** (етичний блокер) | лишається — працює і на новинах, і в post-upload QA |
| **E** (калібрування) | лишається, але одиниця навчання — **промпт**, а не рендер |
| **F** (вибір моделі) | текстова частина без змін; F4 звужується до однієї поверхні — новини |
| **G** (бюджет) | переписано: авто-витрата на weekly-зображення → **$0**; підписка вперше стає доречною формою |

---

## Context

Продакшн малював ілюстрації для weekly-дайджесту через `pipeline/card-image.ts`
(art director → FLUX klein) з vision-критиком і repair-циклом. Власник переглянув живий випуск
`843975a8-8c19-4eca-96a8-035f76eae3ab` (7 story) і дав вердикти. Головне з них:

1. **Три варіанти під кожною story виглядають однаково.** Задум був — три різні підходи
   (literal context / mechanism / consequence). Фактично власник отримує три перефразування
   одного сценарію, тобто вибору немає.
2. **Три story мають лише одну ілюстрацію.**
3. **Немає вибору режиму.** Власник двічі просить: іноді потрібна кінематографічна сцена, іноді
   діаграма чи інфографіка. Зараз усі три лінзи — завжди фото.
4. Впечений текст протікає в прод (`Clodfire`, `PFfort` у Story 3; нісенітні підписи в Story 6)
   попри політику `weekly-semantic-story-v5.1`.
5. **Вартість — не проблема; проблема — час.** Див. окремий розділ нижче.

**З ~24 переглянутих ілюстрацій власник прийняв одну.** Саме це, а не вартість, і привело до
рішення 2026-08-15: доки автоматика не вміє вигравати вибір, вибір робить людина, а автоматика
готує їй матеріал.

(source: owner review живого digest `843975a8-8c19-4eca-96a8-035f76eae3ab` 2026-08-14,
рішення власника 2026-08-15)

### Про бюджет — не оптимізуй його, поки не заміряєш

Реальний зріз OpenRouter за 2026-08-14, вікно 06:09–09:14 (23 виклики):

| | |
|---|---:|
| **Разом** | **$0.3625** |
| `deepseek-v4-pro` — редакційний текст | $0.3513 (**94%**) |
| `gemini-2.5-flash` — vision-критик | $0.0113 (3%) |

**Гроші йдуть на генерацію тексту, а не зображень.** Vision-критик коштує копійки.
Білінг Cloudflare за самі рендери сюди не входить — він окремий.

Реальний ризик у тих самих логах — **латентність**: два скасовані виклики змарнували 885 с,
найдовший тривав **720 с** (стеля провайдера) і повернув нічого. При 95-хвилинному дедлайні
воркера (`generation-worker.ts:1011`) це важить більше за долари. **Після переходу на ручні
картинки з weekly-джоби зникає найдовший крок — FLUX-рендери (~190 с на виклик) і vision-раунди
поверх них.** Лишається планування концептів, тобто джоба стає в рази коротшою.

> ⚠️ **Не повторюй помилок попередніх оцінок.** Цифра «$19–53/рік» була виведена з лімітів
> політики (занижена), цифра «$4–6 на випуск / $200–300 на рік» — з накопичувального
> `Story revision spend` в адмінці, який містить `legacy aggregate` за багато днів
> перегенерацій (завищена). **Жодна з них не підтверджена.** Річної цифри поки не існує;
> щоб її отримати, потрібен чистий замір одного випуску від початку до кінця, включно з
> білінгом Cloudflare. До того часу — не наводь річних сум і не оптимізуй вартість.

(source: `openrouter_activity_2026-08-14.csv`, 23 виклики, обчислено 2026-08-14)

Проєктна основа — `AI_Today_Brief_Visual_Algorithm_Plan.pdf` власника (11 с., розбір V1–V10).
Його ключова теза: *«Правильний алгоритм не питає "cinematic чи diagram?". Він питає: який
visual grammar найприродніше доводить одну core claim цієї новини?»* — і **явно вимагає
зберегти current art director як один із генераторів**. Це не заміна FLUX, це маршрутизація.
Після 2026-08-15 та сама теза працює на промптах: грамматика визначає, **як написаний промпт**,
а не яким рендерером його виконано.

Попередній експеримент V10 (PR #229) реалізував цей задум неправильно — три захардкожені сцени
за регексами, покриття 29%, підкручене вимірювання. Проєктний шар береться, код — ні.

---

## Що вже перевірено в коді (не перевіряй заново)

### Механіка деградації лінз — `pipeline/card-image.ts`

- **`:1863`** — журі має рівно **2 спроби**:
  `for (let attempt = 0; attempt < 2 && accepted.length < targetLenses.length; attempt += 1)`
- **`:1939`** — лінзи без прийнятого pitch отримують
  `fallbackSceneBrief(lens, baseFallbackScene, essence)`
- **`:1780-1785`** — усі три фолбек-брифи будуються з **одного** `essence`
  (`storyContext` / `mechanism` / `consequence`), змінюється лише обгортка:
  `tableau` / `cutaway` / `environment`. FLUX отримує ті самі іменники → малює те саме.
- **`:1797`** — фолбеку присвоюється `motifClass: fallback_${lens}`, тому валідатор дублікатів
  бачить три різні motif class і **не** відхиляє однакові сцени.
- **`:1330-1428`** — `validateMetaphorPitch`. **`:1433-1439`** — пʼять помилок є advisory
  (не блокують): `story_anchor_not_grounded_in_context`,
  `metaphor does not clearly argue the essence`, `mechanism_not_visible`,
  `consequence_not_visible`, `scene_missing_story_context`. **Усе інше блокує.**
- **`:1896-1904`** — валідатор отримує `externalSiblings` (сцени **інших** story цього випуску)
  плюс `acceptedHints` (вже прийняті лінзи цієї story). Обмеження накопичуються протягом випуску:
  `sibling_motif_class_reuse`, `sibling_scene_echo`, `character_budget` (≥2 персонажі),
  `dual_contrast_digest_cap`.

Індикатор в адмінці: рядок **«Illustration prompt · fallback»** проти **«· openrouter»**.
У живому випуску кореляція повна — `openrouter` → три різні сценарії, `fallback` → однакові.
(source: owner screenshots із `/admin/weekly/843975a8-…` 2026-08-14: Story 3 і 5 —
`openrouter`, три різні сценарії; Story 1, 2, 4, 6, 7 — `fallback`, однакові або одна картинка)

**Story 4, 6, 7 окремо:** створені 11 серпня з `5/5 attempts`, тоді як 2/3/5 — 12 серпня з
`2/2`. 11 серпня в проді ще був старий 5-раундовий цикл, що лишав один варіант. Вони застарілі,
а не зламані. (source: timestamps і `attempts` в адмінці 2026-08-14; перехід на 2 раунди × 3
варіанти описаний у [now](../now.md) під 2026-08-11) `(assumption)` — підтверджується
перегенерацією, див. A3.

### Що вже існує для ручного режиму (не будуй заново)

- **Ручний upload уже працює.** `uploadWeeklyArtifactAction`
  (`src/app/admin/(cms)/weekly/actions.ts:1649`) приймає `cover`, `story_image`, `social_asset`,
  `thumbnail`, `pdf`; ліміт 12 MB; `sharp` ресайзить у **1600×900** (`fit: 'cover'`, `focal_point`),
  пише JPEG q91 progressive; зберігає alt / alt_en / alt_uk; верифікує байти після запису;
  ставить `generation_status: 'ready'`, `review_status: 'in_review'`,
  `metadata.source = 'manual_upload'`.
- **UI для нього теж є** — форма «Upload a replacement» у Visuals
  (`src/components/admin/weekly-workspace.tsx:2802`).
- **Промпти вже зберігаються** в metadata артефакту (`positive_prompt` / `negative_prompt`) і
  показуються рядком «Illustration prompt» (`weekly-workspace.tsx:711-713, 1007`).
- **Job уже вміє не рендерити.** `generateStoryImage` (`generation-worker.ts:2429`) має гілку
  `input.source_url` → `sourceKind = 'editor_url'`: зображення береться за URL, art director не
  викликається.
- **`artifact_type` має закритий CHECK** (`supabase/migrations/20260723095458_weekly_digest_v2.sql:369`)
  — новий тип потребує адитивної міграції.
- **Preflight уже вимагає зображення:** `requireArtifact('story_image', …)` на кожну story і
  `requireArtifact('cover', …)` (`src/lib/weekly-digest/preflight.ts:496`); гейт
  `simulation_not_passed` спрацьовує лише при `contentSimCleared === false` (`:449`), тобто
  завантажений вручну файл його не тригерить.
- **Daily адмінки не існує.** У `src/app/admin/(cms)/` є `weekly`, `calendar`, `costs`,
  `engagement`, `packages`, `providers`, `results`, `settings` — сторінки брифів немає. Daily-review
  іде в Telegram (`pipeline/notify.ts:40` `notifyReview`).
- **`briefs` не має jsonb-колонки** (`supabase/migrations/001_initial_schema.sql:25`) — daily
  cover prompt нема куди покласти без міграції.

(source: інспекція коду 2026-08-15, рядки вказані вище)

---

## Порядок

```
B1-fix ✅ → B2 → P1 → P2 → M1 → M2 → B3 → P3 → C → D → E
A2, F, G — незалежні, можна паралельно
```

**B1 виконано** (причина знайдена). B1-fix і B2 йдуть першими, бо від них залежить якість
промптів — а промпт тепер і є продукт. P1/P2 без них випустять три однакові промпти.
M (ручний режим) можна робити паралельно з B, але вмикати — після P1.

---

## A. Закрити хвости (не блокує решту)

### A1 ✅ Зроблено — PR #237

Виправлено хибне твердження у wiki про те, що продакшн не брав участі в порівнянні.

### A2. Прогнати bake-off критика

Актуальність після 2026-08-15 **знижена, але не нульова**: критик далі працює на новинах і
стає post-upload QA (розділ M2). Не робити цього першим.

- **Передумова знята:** PR #236 змержено в `main` 2026-08-15 (`e689211`) — воркфлоу готовий до
  запуску.
- **Дія:** `gh workflow run vision-critic-bakeoff.yml --repo sanchahous/ai-today-brief --ref main`
- **Що читати:** колонки `Rejected the bad` і **`Kept the good`** разом. Якщо
  `claude-sonnet-5` дає `Kept the good = 0/1` — він заріже єдину картку, яку власник схвалив,
  і **не годиться**; лишаємось на `gemini-2.5-flash`.
- **Не робити:** не перемикати `CONTENT_SIM_VISION_OPENROUTER_MODEL` автоматично. Це рішення
  власника.
- **Обмеження, яке треба назвати у звіті:** позитив рівно один (n=1). Тест може дискваліфікувати
  модель, але не підтвердити.

### A3 ✅ Зроблено 2026-08-14 — і результат змінює B

Власник перегенерував Story 6. Тепер вона має **три обрані концепти + історію з шести рендерів**
(2 раунди × 3 варіанти), кожен зі своєю лінзою і `motifClass`. **Гіпотеза про застарілі
артефакти підтверджена** — Story 4, 6, 7 були продуктом старого 5-раундового циклу, а не
зламаного журі.

**Але перегенерація виявила другу, окрему проблему, якої не було видно раніше.** Шість рендерів
Story 6 мають різні назви й `motifClass`, а візуально це **одна родина**:

```
round 1: Single-Slot Vending Console  · Remote Tool Driveshaft · Frayed Single Cord
round 2: Single Slot Tool Cabinet     · Single Shaft Tool Carousel · Single Key Fragile Output
scores:  25 · 25 · 0 · 25 · 15 · 25      (усі провалені)
```

Усі шість — деревʼяні шафи з інструментами в майстерні. `motifClass` у всіх починається з
`single_…`, бо `essence.mechanism` для цієї story — «single command flag», і **спільний
`essence` тягне всі три лінзи в одну метафоричну родину**. Лінза змінює ракурс, але простір
метафор уже звужено до одного.

**Наслідок для B2:** перевірка на дублікати за рівністю рядка `motifClass` цього не ловить —
`single_slot_cabinet` і `single_shaft_carousel` формально різні. Диверсифікацію треба робити на
рівні **родини мотивів** (матеріал / середовище / тип субʼєкта), а не назви. Це доповнює B2, не
замінює його: фолбек-колапс і конвергенція журі — два різні дефекти з тим самим симптомом.

**Після 2026-08-15 цей дефект стає дорожчим, а не дешевшим.** Раніше три схожі рендери власник
міг просто відкинути; тепер три схожі *промпти* означають, що він піде генерувати три схожі
картинки власним часом і власними кредитами.

(source: owner regenerate Story 6 у `/admin/weekly/843975a8-…` 2026-08-14, скріншот
«GENERATION HISTORY · 6 RENDERED VERSIONS»)

---

## B. Три промпти мають бути справді різними

Головна претензія власника. Без цього все інше не має сенсу — обирати нема з чого.
Формулювання змінилось (промпти замість рендерів), **код і причини — ті самі**: обидва дефекти
живуть у плануванні концепту, до будь-якого рендеру.

### B1 ✅ Виконано 2026-08-14 — причина знайдена

Повний звіт: `experiments/jury-blockers/2026-08-digest-843975a8.md`.

**Результат для поточного `main`** (прогін `31785537265`, story «…Server-Side Tools to the
**Command Line**»): пʼять відхилених pitch-ів, в усіх пʼятьох **один і той самий** блокер —
`banned UI, collage, or stock-metaphor language`.

Назви відхилених pitch-ів пояснюють усе:

```
literal_context/Slim adapter cartridge in TERMINAL expansion port
mechanism/Insertion of a brass adapter card into a TELEPRINTER
consequence/Developer pressing one TERMINAL button
```

**Причина.** `WEEKLY_CRAFT_BANNED` (`pipeline/card-image.ts:783`) містить
`terminal(?:\s+window)?` і матчить **слово** будь-де. Список писався проти кліше «екран
терміналу», але не розрізняє екран і фізичний обʼєкт: «terminal expansion port» — це роз'єм.
**Story про командний рядок неможливо описати, не вживши цього слова**, тому падають усі три
лінзи → фолбек → три шафи з інструментами.

Це не поріг для тюнінгу. Це заборона, що спрацьовує **на предметі самої новини**.

> ⚠️ Не переноси сюди числа з прогонів 2026-08-12. Там домінували
> `story_anchor_not_grounded_in_context`, `scene_missing_story_context` та інші —
> усі пʼять входять у `CONCEPT_SEMANTIC_ADVISORIES` і блокувати не мали. Ремонт v5.1 від
> 12 серпня це полагодив; у сьогоднішньому прогоні їх немає. Дефект мав **дві різні причини в
> різний час**.

**Не рахуй блокери наївним split по комі** — `banned UI, collage, or stock-metaphor language`
це один рядок із комами всередині, і split роздуває його у три позиції.

### B1-fix ✅ Зроблено 2026-08-15 — craft-заборона з поправкою «не буквально про цю новину»

`validateMetaphorPitch` більше не валить pitch за `WEEKLY_CRAFT_BANNED`, якщо заборонений
термін уже є в `storyContext` / `mechanism` / required entities. Голий `terminal`
додатково дозволений, коли джерело говорить про `command line` / `CLI` — інакше CLI-story
все одно падала б, бо новини пишуть «command line», а pitch — «terminal expansion port».
`terminal window` і решта UI-кліше лишаються забороненими навіть на CLI-новині (виняток
потерміновий). `WEEKLY_SLUDGE_BANNED` не чіпали.

**Тест:** `a command-line story may use the word terminal for a physical object` — зелений.
Контроль: CLI-story з `terminal window` / `glowing brain` / collage все одно відхиляється.

Наступне — **B2** (не добивати кількість трьома однаковими фолбеками).

Історичний патерн (opaque abstraction) скопійовано потерміново, а не як один regex на весь
grab-bag: інакше CLI-новина з словом `terminal` у контексті відкривала б і `glowing brain`.
`WEEKLY_SLUDGE_BANNED` не чіпали — story про друк/документообіг може мати право на стос паперу,
але без даних цього кроку немає.

**Жива перевірка ще відкрита:** «планування Story 6 дає три лінзи з `openrouter`» — це критерій
на реальному випуску, не юніт-тест. Юніт-гейт зелений.

### B2. Прибрати тиху деградацію в три копії

**Не починати без B1.** Три речі робляться в будь-якому разі:

1. **`pipeline/card-image.ts:1797`** — прибрати `motifClass: fallback_${lens}`. Фолбеки мають
   ділити один `motifClass` (напр. `fallback_essence`), щоб валідатор бачив їх як однакові,
   якими вони і є.
2. **`:1939`** — краще **два справді різні** варіанти, ніж три однакові. Якщо лінза не отримала
   pitch, вона не має додавати перефразування. Повертати менше брифів, а не добивати кількість.
3. **`:1780-1785`** — якщо фолбек усе-таки потрібен, він має братись **з іншої грамматики**
   (див. C), а не бути іншим описом того самого `essence`.

Плюс дефект із A3 — **родина мотивів, а не рядок `motifClass`**. Нових полів у контракті не
треба, `MetaphorPitch` (`:735-754`) уже має все потрібне:

```ts
// нова функція поруч із tokenizeSceneForEcho (:988)
export function motifFamilyKey(pitch: MetaphorPitch): [string, string, string] {
  return [
    headNoun(pitch.subject),   // останній іменник фрази: "tool cabinet" -> cabinet
    headNoun(pitch.setting),   // "workshop bench" -> workshop
    pitch.subjectKind,
  ];
}
```

**Критерій дубліката: збіг ≥2 позицій із трьох.** `Single Slot Tool Cabinet` у майстерні і
`Single Shaft Tool Carousel` у майстерні збігаються за `setting` і `subjectKind` → одна родина →
другий відхиляється як `sibling_motif_family_reuse`. `headNoun` — остання значуща лексема без
стоп-слів, без стемінгу: множина зводиться простим правилом `-s/-es`, глибша морфологія не
потрібна й не виправдана.

**Тести (`pipeline/card-image.test.ts`):**
- `does not emit three briefs built from one essence`
- `fallback briefs share a motif class so the sibling validator sees them as duplicates`
- `returns two distinct briefs rather than three near-identical ones`
- `two motif classes from the same material and setting count as one family`

**Готово коли:** на фікстурі, де журі приймає лише одну лінзу, функція повертає **один** бриф,
а не три; тест на однаковість motifClass проходить; тест на родину мотивів проходить.

### B3. Зробити деградацію видимою в адмінці

- **Файл:** `src/components/admin/weekly-workspace.tsx`
- **Зміна:** біля кожної story показувати `N/3 промпти готові` і, якщо були фолбеки, які саме
  лінзи деградували. Дані вже є в metadata артефакту (`scene_source`, `concept_lens`).
- **Навіщо:** власник має бачити «тут система не змогла придумати третій підхід» **до того**, як
  витратить свій час на генерацію за слабким промптом.

**Готово коли:** власник бачить «2/3 лінзи» без відкривання коду.

---

## P. Промпт як продукт

Досі промпт був внутрішнім артефактом, який ніхто не читав. Тепер це **єдиний вихід системи**
для дайджестів. Він має бути придатний до копіювання в чужий інструмент без правок.

### P1. Формат: один канонічний промпт + похідні синтаксиси

**Рішення власника:** канонічний natural-language промпт плюс автоматично похідні форми.
(source: рішення власника 2026-08-15)

- **Новий файл:** `pipeline/prompt-export.ts` (чистий, без БД і без мережі — щоб тестувався
  фікстурами).
- **Вхід:** `WeeklyReportageSceneBrief` (з `grammar` після C1) + `EditorialEssence` + accent.
- **Вихід:**

```ts
export interface ManualImagePrompt {
  conceptLens: 'literal_context' | 'mechanism' | 'consequence';
  grammar: 'cinematic_domain_scene' | 'deterministic_technical_hybrid' | 'source_led_fallback';
  title: string;            // назва концепту, людською мовою
  canonical: string;        // 60-120 слів, розгорнутий natural-language промпт
  midjourney: string;       // стислий синтаксис + --ar 16:9 --style raw --no text
  negative: string;         // окремий блок для інструментів, що приймають negative prompt
  aspectRatio: '16:9';
  notes: string[];          // що саме має бути видно, щоб концепт спрацював
}
```

- **`canonical`** пишеться для Nano Banana / Gemini / ChatGPT / Grok: субʼєкт першим, далі дія,
  середовище, світло, оптика, матеріал. Джерело — уже наявні `buildWeeklyPrompt`
  (`card-image.ts:1978`) і `buildEditorialConceptPrompt` (`:1956`); **не переписуй їх** —
  `prompt-export.ts` перекладає їхній вихід у форму, придатну для людини.
- **`midjourney`** — той самий зміст, стисло, з параметрами. Ніяких «--v 7» чи інших номерів
  версій у коді (те саме правило, що у F: `grep` на версії має лишатись порожнім).
- **`negative`** — з наявного `negativePrompt()` (`card-image.ts:330`) плюс обовʼязкове
  `no text, no letters, no logos, no watermarks, no UI` (див. D1).
- **`notes`** — 2–4 пункти: «має бути видно X», «читач має зрозуміти Y без підпису». Це те, за
  чим власник оцінює результат і за чим працює post-upload QA.

**Еталон, за яким звіряти вихід.** Story: «Anthropic переносить server-side tools у командний
рядок»; концепт `mechanism`; грамматика `cinematic_domain_scene`.

```
canonical:
A brass adapter card being pushed into the expansion slot of a 1970s teleprinter
terminal, close three-quarter view, hands of a single engineer in frame. The card
is half inserted; the contact strip catches a hard rim light while the slot
interior stays in shadow, so the act of connection is the brightest thing in the
picture. Matte industrial plastics, worn enamel, fine dust in a shaft of window
light. Shallow depth of field, 50mm, natural daylight, muted teal and amber.
Photographic reportage, no illustration styling. Labels and captions are added
later in a separate layer — the image itself carries no writing of any kind.

midjourney:
brass adapter card half inserted into a 1970s teleprinter expansion slot, engineer
hands, rim light on contact strip, worn enamel, dust in window light, 50mm shallow
depth of field, muted teal and amber, photographic reportage --ar 16:9 --style raw
--no text, letters, logos, watermarks, UI

negative:
text, letters, numbers, captions, logos, watermarks, UI, screens, interface
elements, collage, split screen, stock-photo handshake, glowing brain, floating
holograms, extra fingers, melted motion blur

notes:
- видно рівно один механізм: щось вставляється в роз'єм, і це найяскравіше в кадрі
- читач має зрозуміти «інструмент під'єднали до старої системи» без підпису
- жодного екрана в кадрі — інакше сцена читається як «про UI», а не про з'єднання
```

Це **не шаблон для підстановки**, а планка: субʼєкт першим реченням, механізм видимий
фізично, оптика й світло названі, заборона тексту явна, `notes` перевіряються оком за секунди.

**Тести (`pipeline/prompt-export.test.ts`):**
- `canonical prompt leads with the subject, not with the style`
- `midjourney line carries the aspect ratio and the no-text flag`
- `negative prompt always bans text, letters and logos`
- `no model version numbers appear in any exported form`

**Готово коли:** три концепти story дають три `ManualImagePrompt`, і жоден із них не потребує
ручного редагування перед вставкою в інструмент.

### P2. Де промпти живуть і як їх бачить власник

**Зберігання — новий artifact type `story_prompt_set`.**

- **Міграція:** адитивно розширити CHECK у
  `supabase/migrations/20260723095458_weekly_digest_v2.sql:369` новою міграцією
  (`…_weekly_story_prompt_set.sql`); додати гілку в `save_weekly_digest_artifact` (dependency
  logic, `:825-880`) — залежність та сама, що в `story_image`; **не** додавати його в
  `PUBLIC_IMAGE_TYPES` (`publication-assets.ts:8`) — це текст, він ніколи не публічний.
- **Чому артефакт, а не `job.output`:** промпт — це deliverable ревізії, він має версіонуватись
  разом зі статтею. `job.output` живе на дайджесті й після нової ревізії показуватиме промпт до
  вже переписаної story. Альтернатива без міграції існує (писати в `job.output`), але вона
  саме цю прив'язку і губить — не бери її.
- **Вміст:** `content = { prompts: ManualImagePrompt[], policy, generated_at }`,
  `generation_status: 'ready'`, `locale: 'neutral'`.

**UI — вкладка Visuals (`weekly-workspace.tsx`).** Під кожною story:

- три картки концептів: назва, лінза, грамматика, `notes`;
- три кнопки копіювання на картку — **Canonical**, **Midjourney**, **Negative**;
- поруч — слот `story_image` зі станом: `очікує зображення` / `завантажено, on review` /
  `approved`;
- наявна форма «Upload a replacement» (`:2802`) переїжджає в цю ж картку, щоб копіювання промпту
  і завантаження результату були в одному місці; `revision_item_id` підставляється зі story,
  `artifact_type` фіксований `story_image`.

**Тест:** e2e (`e2e/`) — на story з готовим `story_prompt_set` видно три кнопки копіювання і
слот upload; після upload стан слота змінюється.

**Готово коли:** власник відкриває Visuals, копіює промпт, генерує в себе, перетягує файл — і
жодного разу не відкриває код чи БД.

### P3. Daily: промпт обкладинки випуску

Daily-адмінки не існує, тож доставка — тим самим каналом, яким уже йде review.

- **Файл:** `pipeline/run-daily.ts` (після публікації, поруч із блоком `fillCardImages` на
  `:627`) + `pipeline/notify.ts:40` (`notifyReview`).
- **Дія:** один виклик art director на **випуск** (не на новину) з входом «топ-3 заголовки +
  intro» → `ManualImagePrompt` через `pipeline/prompt-export.ts` → окреме Telegram-повідомлення
  в review-чат: назва концепту, canonical, midjourney, negative, у `<pre>`-блоках для копіювання
  одним тапом.
- **Роль у реєстрі:** нова `daily.cover_scene` у `PROVIDER_ROLES`
  (`pipeline/providers/registry.ts:36`), `QUALITY_AXIS = 'intelligence'`, без порога — це один
  короткий виклик на випуск. Не перевикористовуй `weekly.card_image_scene`: у неї інший контракт
  входу (одна story, не випуск) і інший бюджет.
- **Зберігання:** нова колонка `briefs.cover_prompt jsonb null` (міграція; таблиця не має jsonb
  взагалі — `001_initial_schema.sql:25`). Без неї промпт існує лише в історії чату.
- **Обсяг:** ~30/міс, один LLM-виклик на випуск, вартість у межах похибки (розділ G).
- **Не робити:** не генерувати обкладинку автоматично «про запас» — це прямо суперечить рішенню
  2026-08-15.

**Тест:** `daily cover prompt is built from the edition top stories, not from a single item`.

**Готово коли:** після кожного публікованого випуску в review-чаті лежить готовий промпт
обкладинки, і власник не пише його руками.

---

## M. Ручний режим: вимкнути авто-рендер, прийняти файл

### M1. Weekly `story_image` більше не рендерить

- **Файл:** `src/lib/weekly-digest/generation-worker.ts`, `generateStoryImage` (`:2429`).
- **Зміна:** гілка без `source_url` більше не викликає
  `generateWeeklyReportageIllustrations` / `runWeeklyImageSimLoop`. Джоба:
  1. будує `essence` і три концепти (`weeklyReportageSceneBriefs`, `card-image.ts:1818`);
  2. проганяє їх через `prompt-export.ts`;
  3. пише артефакт `story_prompt_set`;
  4. завершується `succeeded` з `needs_owner_review` — «промпти готові, чекаю зображення».
- **Гілку `source_url` не чіпати** — вона лишається робочим шляхом «взяти зображення за URL».
- **`cover` — так само:** один концепт, один `ManualImagePrompt`, без рендеру.
- **Backend не міняти в цій хвилі.** `story_image` лишається в
  `LONG_RUNNING_GENERATION_JOB_TYPES` (`generation-control.ts:45-49`) і на GitHub Actions. Після
  зняття FLUX-рендерів джоба стане короткою — але це треба **виміряти на реальному випуску**, і
  лише потім переносити назад у Vercel-поллер окремим PR. Не роби обидві зміни разом: саме
  сплутані рендер і транспорт дали серпневі 300-секундні падіння.
- **Прапорець:** `WEEKLY_STORY_IMAGE_MODE=prompt_only|render` у `.env.example`, дефолт
  `prompt_only`. Дає відкат без деплою і чесно документує, що авто-рендер існує, але вимкнений.

**Тести (`generation-worker.test.ts`):**
- `story_image job in prompt_only mode writes a prompt set and never calls the image provider`
- `story_image job with source_url still ingests the URL`

**Готово коли:** прогін weekly не робить жодного виклику до Cloudflare/OpenRouter-image, а у
Visuals зʼявляються промпти.

### M2. Post-upload QA — попереджає, не блокує

**Рішення власника:** завантажене зображення один раз перевіряється, попередження показується,
рішення лишається за власником. (source: рішення власника 2026-08-15)

- **Файл:** `src/app/admin/(cms)/weekly/actions.ts`, `uploadWeeklyArtifactAction` (`:1649`), після
  успішного `save_weekly_digest_artifact`.
- **Дія:** один виклик image-only критика (`buildImageCriticPrompt`,
  `src/lib/content-sim/vision-critic.ts`) — **без** headline і scene brief (див. E2). Записати
  результат у `metadata.post_upload_qa`: `{ blockers, scores, model, cost_usd, checked_at }`.
- **Не блокує нічого.** `contentSimCleared` лишається `undefined` для ручних файлів, тож
  `simulation_not_passed` (`preflight.ts:449`) не спрацьовує — і не має.
- **Показ:** у картці story поруч зі слотом — жовтий рядок «QA: впечений текст (2 місця)» з
  посиланням «Ігнорувати» / «Замінити файл».
- **Вартість:** ~$0.0005 на перевірку × 32 зображення/міс ≈ **$0.02/міс**. Не оптимізуй.
- **Виклик робити асинхронно від upload** — власник не має чекати на критика, щоб побачити, що
  файл прийнято.

**Тест:** `a failing post-upload QA does not add a preflight blocker`.

**Готово коли:** після завантаження власник за кілька секунд бачить або «QA чисто», або перелік
проблем — і в обох випадках може йти далі.

### M3. Підказки preflight під новий процес

- **Файл:** `src/lib/weekly-digest/preflight.ts`, `ARTIFACT_GATE_GUIDANCE` (`:331`).
- **Зміна:** `story_image.fixMissing` і `cover.fixMissing` більше не кажуть «Regenerate». Новий
  текст: «Visuals → скопіюй промпт концепту → згенеруй у своєму інструменті → завантаж файл у
  слот story».
- **Вага гейта (`:175`) не чіпати** — зображення лишається обовʼязковим для релізу.

**Готово коли:** блокер `artifact_missing` веде власника до промпту, а не до неіснуючої кнопки.

---

## C. Грамматика як третій вимір промпту

Зараз лінза змінює *що* показано, але не *чим*. Усі три — завжди кінематографічне фото.
Після 2026-08-15 грамматика визначає **як написаний промпт**: сцена, схема чи джерело-орієнтований
кадр. Рендерера в цьому шарі більше немає.

### C0 ⚠️ Передумова, якої ще немає: `autoClaim` у продакшн-шляху

**Перевірено 2026-08-15:** `grep` по `generation-worker.ts` і `card-image.ts` на
`autoClaim` / `visual-auto-claim` дає **нуль**. Модуль `visual-auto-claim-v5.ts` має споживачів
лише всередині експериментального кластера V10 (`visual-affordance-router-v10.ts`,
`visual-generic-svg-v5.ts`, їхні тести і `scripts/visual-*`).

Тобто C2 не можна «просто портувати»: сигнальний шар читає `autoClaim.semantics`, а в
продакшн-story такої структури **не існує** — там є `EditorialEssence`
(`card-image.ts:1100`, `1713`) з іншим контрактом.

**Перед C2 потрібен окремий крок:** або міст `EditorialEssence → VisualAutoClaim`, або
переписати сигнали під `essence`. **Обсяг цього кроку не оцінений** — його треба оцінити першим
ділом, коли черга дійде до C, і не планувати C як «портування» до того.

Це єдина частина плану без відповіді на питання «що саме змінити». Решта розділів виконувані як
є. (source: `grep autoClaim` по `src/lib/weekly-digest/generation-worker.ts` і
`pipeline/card-image.ts` 2026-08-15 — порожньо)

### C1. Ввести `grammar` поруч із `lens`

- **Мінімум два режими:** `cinematic_domain_scene` (наявний art director, без змін) і
  `deterministic_technical_hybrid` (схема — **як текстовий опис для ручної побудови**, не як
  SVG-рендер). Третій — `source_led_fallback`, коли claim не пройшов аудит джерела.
- **Тип:** розширити `WeeklyReportageSceneBrief` полем `grammar`, дефолт
  `cinematic_domain_scene`, щоб наявні виклики не змінювали поведінку.
- **`prompt-export.ts` пише промпт по-різному** для кожної грамматики: для схеми — перелік
  елементів, підписів (які власник додасть сам у редакторі), напрямку стрілок і того, що саме
  порівнюється.

### C2. Роутер обирає грамматику з claim, не з регексів по тексту

- **Портувати:** сигнальний шар `src/lib/weekly-digest/visual-affordance-router-v10.ts`
  (`extractVisualAffordanceSignalsV10`) — він читає `autoClaim.semantics`, а не сирий текст.
- **Не портувати:** `selectAffordanceTreatmentV10` із
  `visual-affordance-treatment-v10.ts` — це три захардкожені сцени за регексами
  (`gemini|community critique`, `deep work|sparring partner`). PDF §14 прямо вимагає
  «Affordance Router **без story-ID hacks**», і саме на цьому реалізація дала покриття 29%.
- **Виправити при портуванні** — див. C5.

### C3. Підключити mapping gate

`validateVisualPropositionV10` (`visual-affordance-router-v10.ts:468`) — це і є §6 PDF
«concept mapping gate». **У PR #229 він виявився мертвим кодом, і саме тому сцени довелось
малювати руками.** Підключити **перед видачею промпту**: концепт без повної таблиці
`source concept → visible object → visible outcome` не потрапляє в `story_prompt_set`.

Виправити при цьому його власний дефект: `unmapped_semantic_prop` (`:511`) звіряє
`semanticProps[].id` з `mappings[].visibleElement` — два вільнотекстові поля без спільного
контракту. Додати `visibleElementId` і зворотну перевірку; порожній `semanticProps: []` не має
проходити вакуумно.

### C4 ⛔ Виведено зі scope (2026-08-15)

Параметричний SVG-рендерер схем (`visual-generic-svg-v5.ts:257`, `quantitativeScene`) — це
автоматична генерація зображення для дайджесту, тобто рівно те, що рішення 2026-08-15 скасовує.
Схема тепер описується промптом (C1) і будується власником.

Код не видаляти — він лишається для можливого майбутнього використання на **новинах**, де
автогенерація чинна. Не інвестуй у нього в межах цього плану.

**Готово для C коли:** story з `quantitativeFacts` отримує один із трьох промптів у грамматиці
схеми, і власник бачить у картці, що цей концепт — діаграма, а не фото.

### C5. Обовʼязкові правки при портуванні коду V10

Код V10 містить перевірені дефекти. **Портувати «як є» не можна.** Після виведення SVG зі scope
лишаються три з пʼяти — ті, що стосуються сигнального шару.

#### C5.1 ⛔ `markerUnits` — зі scope

Стосується виключно SVG-рендерерів (C4). Не робити. Опис дефекту збережено в історії цієї
сторінки й у [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md).

#### C5.2 `hasExactMetric` бере поля порад

`visual-affordance-router-v10.ts:63` сканує `sourceText(story)`, а той (`:47`) склеює
`title + summary + why + practical + takeaway`. Порада «Budget about 2 hours for the first run»
вмикає метрику, після чого `deterministic_technical_hybrid` (пріоритет 96) перекриває
`cinematic_domain_scene` (92) — доменна сцена перетворюється на діаграму.

```ts
// додати поруч із sourceText()
function metricSourceText(story: HoldoutStoryInput): string {
  return [story.title, story.summary].join(' ').replace(/\s+/g, ' ').trim();
}

// hasExactMetric(): замінити sourceText(input.story) на metricSourceText(input.story)
// і вимагати підтвердження фактом, а не самим лише регексом:
return (
  (input.autoClaim.claim.quantitativeFacts ?? []).length > 0 ||
  Boolean(input.autoClaim.semantics.metric) ||
  METRIC_RE.test(metricSourceText(input.story))
);
```

**Тест:** `an incidental duration in practical does not switch a domain story to the diagram grammar`
— фікстура з `practical: 'Budget about 2 hours for the first run.'` і без метрики в
title/summary має лишитись на `cinematic_domain_scene`.

#### C5.3 `requiresTemporalSequence` спрацьовує на одному слові

`visual-affordance-router-v10.ts:84` вмикає процесну граматику від одного `cache` / `split` /
`failure` — усі три надзвичайно часті в AI-новинах.

```ts
const hits = metricSourceText(story).match(
  /\b(crash|resume|restart|checkpoint|cach(?:e|ing)|split|monitor|fuzz(?:ing)?|failure|repair|retest|retry|interruption|continuation)\b/gi,
) ?? [];
return new Set(hits.map((h) => h.toLowerCase())).size >= 2;
```

**Тест:** `a single mention of caching does not select the process grammar`.

#### C5.4 `inferRole` — `\b` звʼязується лише з крайніми гілками

`visual-auto-claim-v5.ts:268, 274, 277`. Вираз виду `/\b(a|b|c)\b/` ставить межу слова тільки
перед `a` і після `c`. Тому підрядок `strip` у «**Strip**e» дає
`architecture_transformation`, `tops?` у «lap**tops**» — `benchmark_comparison` з примусовою
вимогою метрики. «Stack Overflow», «multiplayer», «pruned», «compacted» падають так само.

```
:268  /\b(?:benchmark|evaluation|leaderboard|tops?|pass rate|score)\b/
:274  /\b(?:policy|access control|authori[sz]|blocked|refused|guardrail)\b/
:277  /\b(?:lower|compiler?|dialect|layers?|stack|strip|prune|compact|transform)\b/
```

**Тест:** `inferRole does not classify "OpenAI partners with Stripe" as architecture_transformation`.

#### C5.5 ⛔ `quantitativeScene` геометрія — зі scope

Стосується SVG-рендерера (C4). Не робити. Але **правило лишається чинним для промпту**: якщо
метрику неможливо розібрати, промпт не має вимагати конкретних пропорцій — інакше власник
намалює величину, якої в новині немає. Це фабрикація незалежно від того, хто тримає пензель.

**Готово для C5 коли:** три тести вище зелені.

---

## D. Правда в пікселях

### D1. Заборона тексту — тепер у промпті й у QA

- **Промпт:** `negative` у кожному `ManualImagePrompt` **завжди** містить
  `no text, no letters, no logos, no watermarks, no UI`; `canonical` окремим реченням каже, що
  підписи додаються поверх пізніше. Без винятків — це не стилістична порада, а вимога локалізації:
  текст живе в overlay-шарі, який композитить `visuals.ts` і який можна перегенерувати під локаль.
- **QA:** `readable_text` лишається блокером у критика і показується як попередження після
  завантаження (M2).
- **Детермінований шар зі SVG** (кидати, якщо буфер містить `<text`) — **зі scope**, разом із C4.
- **Чому це взагалі проблема:** політика трималась на тексті промпту. Story 3 отримала `Clodfire`,
  `PFfort`; Story 6 — нісенітні підписи на комутаторі. Генератор власника має ту саму слабкість,
  тому вимога переїжджає в промпт, а не зникає.

**Тест:** `every exported negative prompt bans text` (уже в P1).

### D2. Repair на рівні дефекту — тепер порада, не дія

PDF §10, і §2 називає це головним історичним уроком: *«full-regeneration repair не є надійним;
майже хороший concept може бути знищений наступною regeneration»*. Для ручного режиму цей урок
переформульовується як **текст поради власнику** в результаті QA:

| Дефект | Що радить QA | Чого не радити |
|---|---|---|
| поламана геометрія / стрілка | перезібрати композицію тим самим промптом | не міняти концепт |
| впечений текст | локальна правка (inpaint / crop) | не перегенеровувати кадр |
| один провалений стан у sequence | перегенерувати лише цей кадр | не всі |
| хибна теза / суперечність | **тільки тут** — інший концепт із трьох | не патчити лейблами |

Для **новин** (авто-гілка) repair-цикл лишається кодом і працює як раніше.

### D3. Етичний блокер

Story 5: робот тримає малу дитину за голову. У `IMAGE_CRITIC_BLOCKER_CODES`
(`src/lib/content-sim/vision-critic.ts:10`) немає коду для такого. Додати
(напр. `human_dignity_risk`) і згадати в промпті критика. Працює в обох гілках — на новинах як
блокер, на завантаженнях як попередження (M2).

---

## E. Калібрування

Одиниця навчання змінилась: раніше вчились на рендерах, тепер — на **промптах**. Питання, на яке
має відповідати датасет: *який промпт дав зображення, яке власник прийняв*.

### E1. Owner-feedback contract

PDF §14.1. В адмінці до кожного **концепту** (не до кожного рендеру):
`used | used_with_edits | rejected` плюс `reasonTags` із закритого списку
(`domain_context_success`, `strong_intuitive_analogy`, `weak_context`, `generic_diagram`,
`weak_visual_thesis`, `labels_carry_claim`, `broken_arrow`, `disconnected_prop`, `anatomy_error`,
`unclear_causal_source`, `good_concept_bad_execution`).

Зберігати разом із `story_prompt_set` і з `metadata.post_upload_qa` завантаженого файлу — так
пара «промпт → результат → вердикт» замикається сама.

**Навіщо:** сьогодні вердикти власника переносились у
`experiments/critic-ground-truth/owner-verdicts-v6.json` вручну. Вони мають накопичуватись самі
і ставати calibration dataset для роутера і для критика.

### E2. Двостадійний критик

PDF §8. Спершу image-only — без headline, без scene brief, без labels: буквальні обʼєкти, дії,
результати, анатомія, впечений текст. Потім story-aware: чи підтримують пікселі claim. Зараз усе
в одному промпті (`buildImageCriticPrompt`), тому критик бачить задум наперед.

**Для post-upload QA (M2) перша стадія обовʼязкова**: критик не має знати, який промпт мав бути
виконаний — інакше він оцінює намір, а не картинку.

### E3. Promotion gate

PDF §15 задавав пороги для автоматичної гілки. Для ручного режиму метрика інша — вона про
**якість промпту**, а не про якість рендеру:

- ≥60% концептів дають прийнятне зображення **з першої-другої спроби** власника;
- 0 misleading / 0 unsupported factual assertion у прийнятих;
- ≤10 хвилин власника на одну story (промпт → генерація → upload);
- 3/3 промпти на story справді різні (перевіряється B2).

Без цього наступна зміна знову буде «здається, краще». Порогів для **новин** це не стосується —
там лишається стара рубрика.

---

## F. Динамічний вибір моделі за ціною і якістю

Вимога власника: не тримати жодної захардкодженої моделі. Сьогодні `sonnet-5`, завтра вийде
`sonnet-5.1` — система має сама знаходити оптимальну модель під кожну задачу, враховуючи знижки
OpenRouter (до 90%).

Розділ **не змінюється** рішенням 2026-08-15 — він про текстові моделі, а текст лишається
автоматичним. Змінюється тільки F4.

### F0. Дві перевірені речі, які визначають дизайн

**1. Прапорця знижки в API немає — і він не потрібен.** `?discount=true` на
`https://openrouter.ai/api/v1/models` **ігнорується**: 411 моделей і з ним, і без нього. Жодна
модель не містить слова `discount` у відповіді. Але ціни в API **вже враховують знижку** —
перевірено звіркою зі скриншотом власника:

| Модель | Сайт (зі знижкою) | API `pricing` |
|---|---|---|
| `inclusionai/ling-2.6-flash` | $0.01 / $0.03 «90% off» | **$0.010 / $0.030** |
| `inclusionai/ring-2.6-1t` | $0.075 / $0.625 «75% off» | **$0.075 / $0.625** |

Отже скрейпити список знижок не треба. Треба **перестати хардкодити модель і перераховувати
рейтинг на живих цінах**. Знижка потрапить у розрахунок сама.

**2. Сигнал якості в API є.** Поле `benchmarks.artificial_analysis` з
`intelligence_index`, `coding_index`, `agentic_index` — заповнене для **224 із 411** моделей.
`pipeline/openrouter-models.ts:26-32` **вже має ці типи**.

> ⚠️ **Пастка, проти якої і потрібен цей функціонал.** `ling-2.6-flash` — знижка 90%, ціна
> $0.01/M, і `intelligence_index` = **14.2**. Найбільша знижка ≠ найкращий вибір. Гнатись за
> знижкою без порогу якості — гірше, ніж хардкодити хорошу модель.

(source: `https://openrouter.ai/api/v1/models` live check 2026-08-14, 411 моделей)

### F1. Що вже є і що бракує

**Є:** `fetchOpenRouterModels()` (`openrouter-models.ts:314`) тягне живий каталог; типи вже
парсять `pricing` і `benchmarks`; `DEFAULT_MODEL_PRIORITY` свідомо тримає лише **родини**
(`deepseek`, `anthropic/claude`, `google/gemini`), без номерів версій — це вже правильна основа;
реєстр із ролями, БД (`llm_providers` / `llm_provider_models` / `llm_role_chains`) і
`/admin/providers` працюють.

**Бракує:** `rankOpenRouterModelIds()` (`:303`) сортує через `compositeRankScore` — це
**патерн імені + підрядок пріоритету + довжина контексту**. Ні `pricing`, ні `benchmarks` у
ранжуванні **не беруть участі взагалі**. Тобто каталог тягнеться, ціни й бенчмарки парсяться —
і викидаються.

### F2. Формула

Новий файл `pipeline/providers/model-scoring.ts`. Один бал на модель для конкретної ролі.

**Вісь якості залежить від ролі** — не одна на всіх:

```
QUALITY_AXIS: Record<ProviderRole, 'intelligence' | 'coding' | 'agentic'>
  weekly.master_writer -> intelligence
  weekly.master_critic -> intelligence
  daily.summarize      -> intelligence
  daily.verify         -> intelligence
  custom_research      -> agentic
  (решта — за списком PROVIDER_ROLES, registry.ts:36)
```

**Поріг якості** — нижче нього модель не розглядається для цієї ролі, якою б дешевою не була:

```
QUALITY_FLOOR: Record<ProviderRole, number>
  weekly.master_writer -> 40   // редакційний текст = головний продукт
  weekly.master_critic -> 40
  daily.summarize      -> 25
```

**Ціна рахується за профілем ролі**, бо ролі мають різний баланс токенів: редакційний writer —
completion-heavy з reasoning-токенами, критик — prompt-heavy через зображення.

```
TOKEN_MIX: Record<ProviderRole, { prompt: number; completion: number }>
  weekly.master_writer -> { prompt: 0.2, completion: 0.8 }
  weekly.image_critic  -> { prompt: 0.8, completion: 0.2 }

effectivePricePerM(model, role) =
  (pricing.prompt * mix.prompt + pricing.completion * mix.completion) * 1e6

scoreModelForRole(model, role):
  quality = benchmarks.artificial_analysis[AXIS + '_index']
  if quality == null            -> null   // немає даних, не кандидат
  if quality < QUALITY_FLOOR    -> null   // нижче порога, не кандидат
  price = effectivePricePerM(model, role)
  if price <= 0                 -> null   // :free уже виключені, лишити перевірку
  return quality / price                  // якість на долар
```

**Правила, які треба закодувати явно:**

- **Модель без `benchmarks` не є кандидатом для ролі з порогом.** 187 із 411 не мають даних.
  Для них лишається наявний family-fallback — але тільки як хвіст ланцюжка, не перший вибір.
- **`intelligence_index` буває `null` при заповненому `coding_index`** (реальний приклад:
  `ring-2.6-1t`). Обробляти кожну вісь окремо, не припускати наявності всіх трьох.
- **Ніяких номерів версій у коді.** `sonnet-5` не має згадуватись ніде — вибір іде з живого
  каталогу. Це вже закладено в `DEFAULT_MODEL_PRIORITY`; не зламай при рефакторі.
- **Результат — ланцюжок, не одна модель.** Реєстр уже працює ланцюжками (`llm_role_chains`);
  брати топ-3 за балом, а не єдиного переможця.

### F3. Оновлення і аудит

- **Кадансу «щоразу» не робити.** Каталог — 411 моделей; тягнути його на кожен виклик означає
  повторити помилку, яку вже фіксили у Фазі 2 реєстру (кожна чернетка окремо била живий
  каталог). Використати наявний `createRegistryLoader` — один резолв на прогін.
- **Оновлювати раз на добу** окремим job (`schedule` + `workflow_dispatch`), який перераховує
  бали й записує в `llm_provider_models`. Знижки живуть днями, не хвилинами.
- **Записувати рішення.** Кожне переранжування пише рядок: роль → обрана модель → бал → ціна →
  індекс якості → дата. Без цього неможливо відповісти на питання «чому сьогодні пише інша
  модель». Показати в `/admin/providers`.
- **Захист від тихої деградації:** якщо новий переможець має якість помітно нижчу за поточного,
  не перемикатись автоматично — позначити в адмінці й лишити рішення власнику. Дешевша модель,
  що псує випуск, коштує дорожче за зекономлені центи.

### F4. Зображення і відео — межа після 2026-08-15

- **Текст** — повністю покривається F2: 411 моделей із цінами й бенчмарками.
- **Зображення** — тепер це **одна поверхня, новини**. Продакшн рендерить через Cloudflare
  Workers AI (`@cf/black-forest-labs/flux-2-klein-9b`); цін у каталозі OpenRouter немає,
  бенчмарків якості для image-моделей в `artificial_analysis` теж немає.
- **Дайджести** — вибір моделі робить власник у своєму інструменті. Кодом це не автоматизується
  і **не має**.
- **Відео** — у каталозі рівно **одна** модель. Вибирати нема з чого.

Тому для зображень достатньо **мінімального** механізму: перелік провайдерів новинної гілки
(Cloudflare / OpenRouter image / Leonardo) із цінами з їхніх сторінок, оновлюваний вручну раз на
квартал. **Не будуй абстракцію під це** — після 2026-08-15 вона обслуговувала б одну гілку з
одним провайдером.

### F5. Готово коли

- для ролей із порогом працює `scoreModelForRole`, і тест доводить, що модель із
  `intelligence_index` 14.2 і ціною $0.01 **не** обирається для `weekly.master_writer`;
- у коді немає жодного номера версії моделі:
  `grep -rE "sonnet-5|gpt-5|gemini-3\.[0-9]" pipeline/ src/` порожній поза тестами й фікстурами;
- добовий job оновлює `llm_provider_models` і пише аудит-рядок на кожну роль;
- `/admin/providers` показує обрану модель для кожної ролі з балом і датою;
- `wiki/pipeline/llm-providers.md` оновлено — там живе опис реєстру.

---

## G. Розподіл бюджету після переходу на ручні картинки

Розділ [F](#f-динамічний-вибір-моделі-за-ціною-і-якістю) вирішує *як обирати модель*; цей —
*куди взагалі вкладати гроші*. Рішення 2026-08-15 переносить weekly-зображення з рахунка API на
час і підписку власника.

### G1. Обсяг — виміряно, не оцінено

| Що | Скільки | Хто платить | Джерело |
|---|---:|---|---|
| Новини (1 зображення на новину) | **~180 / міс** | **API, авто** | RSS проду: 3–7 новин/добу, у середньому ~6 |
| Weekly story (7 story × 3 концепти) | 84 промпти / **28 зображень** | **власник, вручну** | 4 випуски × 7 story |
| Weekly обкладинка | 4 / міс | власник, вручну | |
| Daily-дайджест обкладинка | ~30 / міс | власник, вручну | |
| Weekly відео | 4 / міс | окремий бюджет | |

> ⚠️ **Мініатюра і повне зображення — це ОДНЕ зображення, не два.** `src/lib/news.ts:207`:
> `imageUrl: it.card_image_url ?? it.image_url`. Генерується один файл, розміри робить
> `src/lib/image-loader.ts`. Не плануй 360 генерацій там, де їх 180.

**84 промпти ≠ 84 генерації.** Власник обирає один концепт із трьох і генерує його — тому
реальний обсяг ручної роботи це **28 зображень/міс** плюс повтори невдалих.

(source: `https://aitodaybrief.com/rss.xml` live check 2026-08-14; `pipeline/run-daily.ts`;
`.github/workflows/pipeline.yml` — 6 прогонів/добу; рішення власника 2026-08-15)

### G2. Автоматична гілка — тільки новини

| Модель | $/зображення | Новини (180/міс) |
|---|---:|---:|
| `openai/gpt-5-image-mini` | 0.0096 | **$1.73** |
| Cloudflare FLUX.2 klein *(зараз)* | 0.0150 | $2.70 |
| `google/gemini-2.5-flash-image` | 0.0387 | $6.97 |

Новини показуються у слоті 92 px у списку — якість топової моделі там ніхто не побачить.
Цільова автоматична витрата на зображення: **$1.73–2.70/міс.**

**Дотичний відкритий пункт новинної гілки:** origin-файли карток важать ~488 КБ PNG, і це
компенсується ресайзом на кожному показі (`src/lib/image-loader.ts` через Supabase transform).
Правильніше зменшувати їх у `pipeline/card-image.ts` при генерації. Деталі —
[ops/vercel-image-quota](../ops/vercel-image-quota.md).

**Що скасовується рішенням 2026-08-15:**

- ~~підняти `CONTENT_SIM_MAX_IMAGE_SPEND_USD` до $0.50 для weekly~~ — weekly більше не рендерить;
  ліміт (`pipeline/card-image.ts:48`, `.env.example:197`) лишається жорстким і стосується лише
  новинної гілки;
- ~~weekly на `gemini-3-pro-image` $11.29/міс~~ — цих грошей у рахунку більше немає;
- ~~другий раунд рендерів~~ — раундів немає взагалі.

**Що додається:** ~30 LLM-викликів на місяць для daily cover prompt (P3) і ~32 QA-виклики
(M2) — разом менше **$0.10/міс**. У межах похибки.

(source: `https://openrouter.ai/api/v1/models` live check 2026-08-14; рішення власника 2026-08-15)

### G3. Ручна гілка — тепер тут доречна підписка

До 2026-08-15 підписка була неправильною формою: 180 новин на місяць дешевше платити поштучно.
**Для ручних 28 зображень/міс висновок протилежний** — поштучна оплата чужого інструменту
незручна, а місячний план дає необмежені спроби, чого власнику якраз і бракувало.

| Варіант | $/міс | Нотатка |
|---|---:|---|
| Midjourney Standard | 30 | безлімітний Relax; **API немає**, автоматизація неможлива — але вона більше й не потрібна |
| Google AI Pro (Nano Banana Pro) | ~20 | найкраще тримає складені сцени з кількох обʼєктів |
| Artlist | ~10 | кредити, не безліміт — див. G5 |
| Поштучно через OpenRouter | ~1–4 | найдешевше, але без інтерфейсу для ручної роботи |

**Рекомендація:** один місяць тріалу того інструменту, який власник уже знає, **після** того як
B1-fix/B2 полагодять різноманіття промптів. Порядок важливий — інакше неможливо відрізнити
слабку модель від слабкого брифу.

### G4. Разом

```
Новини (авто)          gpt-5-image-mini / FLUX klein     $1.73–2.70
Промпти + QA (авто)    LLM, ~62 виклики/міс                 <$0.10
Weekly + daily (руки)  підписка на вибір власника          $0–30
Відео: аватар          HeyGen / Vidnoz                     $20–27
Відео: сцени           Luma  (або Three.js — $0)            $0–10
Голос                  ElevenLabs Starter                      $5
                                                        ───────────
                                                        $27–75/міс
```

Плюс наявні ~$60/міс (Claude Pro + ChatGPT Plus + Cursor Pro), уже сплачені.

**Відео лишається найдорожчою статтею** — воно коштує більше, ніж уся генерація зображень разом.
Оптимізувати треба його, а не $1.73 на новини. Варіант, який варто розглянути серйозно: фонові
сцени кодом (Three.js) замість AI-відео — нуль вартості, повна консистентність між кадрами (чого
AI-відео не дає), і для сайту про AI-інженерію процедурна графіка доречніша за стокову
«кінематографію». Контракт із відео-репо вже спроєктовано —
`wiki/pipeline/video-boundary.md`, manifest `weekly-video-v1`, окреме репо
`ai-today-brief-video`. Не проєктуй це заново.

### G5. Що варто знати про підписки перед тріалом

**Artlist.** «До 1 650 зображень» і «до 206 відео» — це той самий пул 16 500 кредитів,
порахований за **найдешевшою** моделлю кожної категорії (10 і 80 кредитів). Реальні:
Nano Banana ~100, Nano Banana Pro ~400 (після знижки ~160), Veo 3.1 з аудіо ~4 000 (~2 500).
Тобто **одне відео Veo 3.1 = 15–24% місячного плану**. Офіційної таблиці кредитів Artlist не
публікує — вартість показує при наведенні на Generate.

**Midjourney не автоматизується взагалі:** публічного API немає, офіційний — лише Enterprise за
заявкою, сторонні обгортки порушують ToS. Після 2026-08-15 це перестало бути дискваліфікацією:
weekly-картинки й так робляться руками.

### G6. Що не брати з зовнішніх порад

| Порада | Реальність |
|---|---|
| «Claude як директор метафор» | вже працює — роль `weekly.card_image_scene`; після 2026-08-15 його вихід іде в промпт, а не в рендер |
| «Pollinations для картинок сайту» | вже є як щабель 4 (`card-image.ts:16`); робити його основним — публічне API без SLA на бойовому сайті, і якості не додасть |
| «Написати скрипт, що бере новину і генерує картинку» | вже написано, працює 6×/добу |
| «Imagen 4 Fast $0.02» | **вимикається 17.08.2026** |
| «Записувати голос ChatGPT Advanced Voice системним звуком» | сіра зона ToS для комерційного медіа + розмовний режим погано керується по темпу; $5 ElevenLabs знімає обидві проблеми |

Ринкові діапазони цін із зовнішніх оглядів ($0.03–0.12) **не збігаються** з фактичними цінами
цього акаунта (0.0096–0.1344). Бери виміряні, не оглядові.

---

## Чого робити не треба

- **Не генерувати картинки дайджестів автоматично** — навіть «про запас», навіть «щоб було з чим
  порівняти». Це пряме порушення рішення 2026-08-15.
- **Не блокувати реліз результатом post-upload QA.** Він попереджає, вирішує людина.
- **Не чіпати композитний шар** (`visuals.ts`, `social/assets.ts`) — він не генерує зображень.
- **Не переносити** `visual-affordance-treatment-v10.ts` — три захардкожені сцени, впечений
  вигаданий JavaScript, і вони провалюють власний `generated_text` гейт.
- **Не додавати регексів по тексту story** для вибору грамматики. Це головна причина, чому V10
  дав 29% покриття.
- **Не інвестувати в SVG-рендерери** (C4/C5.1/C5.5) — виведені зі scope.
- **Не рахувати вартість із лімітів політики** — брати `generation_cost_events`.
- **Не робити full regeneration** там, де дефект локальний.
- **Не переносити `story_image` з GitHub Actions у Vercel одночасно зі зняттям рендеру** —
  спершу виміряти реальну тривалість джоби без FLUX.

---

## Верифікація

```bash
npm run pr:check
```

| Хвиля | Як переконатись |
|---|---|
| A2 | звіт bake-off містить `Kept the good`; рішення про модель **не** застосоване автоматично |
| B1 | `experiments/jury-blockers/2026-08-digest-843975a8.md` із реальним розподілом блокерів |
| B1-fix | тест `a command-line story may use the word terminal for a physical object` зелений; контроль UI-кліше на CLI-story теж зелений; живе планування Story 6 ще не прогнано |
| B2 | на фікстурі з однією прийнятою лінзою повертається один бриф, не три; тест на родину мотивів зелений |
| B3 | в адмінці видно `N/3 промпти готові` |
| P1 | три `ManualImagePrompt` на story; жоден не потребує ручного редагування; negative завжди банить текст |
| P2 | у Visuals є три кнопки копіювання і слот upload в одній картці; артефакт `story_prompt_set` пишеться |
| P3 | після публікації daily в review-чаті лежить промпт обкладинки; `briefs.cover_prompt` заповнена |
| M1 | прогін weekly не робить жодного image-виклику; `WEEKLY_STORY_IMAGE_MODE=render` повертає стару поведінку |
| M2 | провальний QA **не** додає preflight-блокер; результат видно в картці story |
| M3 | блокер `artifact_missing` веде до промпту, а не до кнопки Regenerate |
| C | story з метрикою дає промпт у грамматиці схеми, і це видно власнику |
| E1 | вердикт власника з адмінки потрапляє в calibration dataset без ручного перенесення |

Після кожної хвилі — `wiki/log.md` (append-only, нові записи **зверху**) + `wiki/index.md`.
Кожна хвиля — окремий PR, `pr:check` перед push, ніколи не в `main` напряму.

---

## Джерела

- Рішення власника 2026-08-15 — картинки дайджестів вручну, промпти автоматично, новини без змін
- `AI_Today_Brief_Visual_Algorithm_Plan.pdf` — проєктна основа (власник, розбір V1–V10)
- Живий digest `843975a8-8c19-4eca-96a8-035f76eae3ab`, 7 story з вердиктами власника 2026-08-14
- `pipeline/card-image.ts:1330-1449, 1780-1810, 1863, 1896-1939` — механізм деградації лінз
- `src/app/admin/(cms)/weekly/actions.ts:1649` — наявний ручний upload
- `src/lib/weekly-digest/{generation-worker.ts:2429, preflight.ts:331-496, visuals.ts}` — джоба,
  гейти і композитний шар
- [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md)
  — review PR #229 і що з нього взято
- Actions run `31739283280` — переоцінка V10 виправленим харнесом (0/3, 1-1)
- `experiments/critic-ground-truth/owner-verdicts-v6.json` — вердикти власника як ground truth

## Related pages

- [pipeline/weekly-digest](weekly-digest.md) — як влаштований weekly-пайплайн загалом
- [pipeline/content-sim](content-sim.md) — vision-критик і гейти
- [marketing/card-images](../marketing/card-images.md) — політика ілюстрацій
- [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md) — review експерименту V10
- [open-questions](../open-questions.md) — відкриті питання
- [now](../now.md) — поточний стан
