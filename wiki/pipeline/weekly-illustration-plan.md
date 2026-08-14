# Weekly-ілюстрації — виконавча специфікація

Summary: покроковий план робіт над продакшн-генерацією ілюстрацій (`pipeline/card-image.ts`)
після розбору живого випуску з вердиктами власника. Написаний як executor spec для моделі
рівня Sonnet 5: файл, функція, точна зміна, тест, критерій «готово».
Sources: `AI_Today_Brief_Visual_Algorithm_Plan.pdf` (власник, розбір V1–V10, поза репо);
живий digest `843975a8-8c19-4eca-96a8-035f76eae3ab` з коментарями власника 2026-08-14;
`pipeline/card-image.ts` (інспекція коду); [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md);
Actions run `31739283280`.
Last updated: 2026-08-14

---

**Для виконавця рівня Sonnet 5.** Кожен таск має файл, функцію, точну зміну, тест і критерій
«готово». Не імпровізуй архітектуру поверх цього. Не роби кількох тасків одним PR.

## Context

Продакшн малює ілюстрації для weekly-дайджесту через `pipeline/card-image.ts`
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

(source: owner review живого digest `843975a8-8c19-4eca-96a8-035f76eae3ab` 2026-08-14)

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
воркера (`generation-worker.ts:1011`) це важить більше за долари.

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

Попередній експеримент V10 (PR #229) реалізував цей задум неправильно — три захардкожені сцени
за регексами, покриття 29%, підкручене вимірювання. Проєктний шар береться, код — ні.

---

## Що вже перевірено в коді (не перевіряй заново)

`pipeline/card-image.ts`:

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

(source: інспекція `pipeline/card-image.ts` 2026-08-14, рядки вказані вище)

Індикатор в адмінці: рядок **«Illustration prompt · fallback»** проти **«· openrouter»**.
У живому випуску кореляція повна — `openrouter` → три різні сценарії, `fallback` → однакові.
(source: owner screenshots із `/admin/weekly/843975a8-…` 2026-08-14: Story 3 і 5 —
`openrouter`, три різні сценарії; Story 1, 2, 4, 6, 7 — `fallback`, однакові або одна картинка)

**Story 4, 6, 7 окремо:** створені 11 серпня з `5/5 attempts`, тоді як 2/3/5 — 12 серпня з
`2/2`. 11 серпня в проді ще був старий 5-раундовий цикл, що лишав один варіант. Вони застарілі,
а не зламані. (source: timestamps і `attempts` в адмінці 2026-08-14; перехід на 2 раунди × 3
варіанти описаний у [now](../now.md) під 2026-08-11) `(assumption)` — підтверджується
перегенерацією, див. A3.

---

## Порядок

```
A → B1 ✅ → B1-fix → B2 → B3 → D1 → C → D2 → E
F (вибір моделі) — незалежна від решти, можна робити паралельно
```

A незалежний. **B1 виконано** — причина знайдена, наступний крок B1-fix. C залежить від B2.
E можна робити паралельно з C.

---

## A. Закрити хвости (не блокує решту)

### A1 ✅ Зроблено — PR #237

Виправлено хибне твердження у wiki про те, що продакшн не брав участі в порівнянні.

### A2. Прогнати bake-off критика

- **Передумова:** змержити PR #236.
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

(source: owner regenerate Story 6 у `/admin/weekly/843975a8-…` 2026-08-14, скріншот
«GENERATION HISTORY · 6 RENDERED VERSIONS»)

---

## B. Три варіанти мають бути справді різними

Головна претензія власника. Без цього все інше не має сенсу — обирати нема з чого.

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

### B1-fix. Дати craft-забороні поправку «не буквально про цю новину»

Правильний патерн уже є в цьому ж файлі, рядком нижче (`:1356`):

```ts
const literalSource = [essence.storyContext, essence.mechanism, ...requiredEntities].join(' ');
if (WEEKLY_OPAQUE_ABSTRACTION.test(flat) && !WEEKLY_OPAQUE_ABSTRACTION.test(literalSource)) {
  errors.push('opaque_abstraction_not_literal_to_story');
}
```

`WEEKLY_CRAFT_BANNED` (`:1347`) такої поправки не має. Дати їй ту саму — і **підняти
обчислення `literalSource` вище**, до цієї перевірки:

```ts
// перенести на початок, до першої заборони
const literalSource = [essence.storyContext, essence.mechanism, ...requiredEntities].join(' ');

if (WEEKLY_CRAFT_BANNED.test(flat) && !WEEKLY_CRAFT_BANNED.test(literalSource)) {
  errors.push('banned UI, collage, or stock-metaphor language');
}
```

Те саме варто розглянути для `WEEKLY_SLUDGE_BANNED` (`:787`) — story про друк/документообіг
має право на стос паперу, — але це окремий крок і без даних його не роби.

**Тест:** `a command-line story may use the word terminal for a physical object` — фікстура з
`essence.storyContext` про command line і pitch «brass adapter card into a teleprinter terminal»
не відхиляється.

**Готово коли:** перегенерація Story 6 дає три лінзи з `openrouter`, а не `fallback`, і три
різні родини мотивів.

### B2. Прибрати тиху деградацію в три копії

**Не починати без B1.** Конкретна зміна залежить від того, що покаже діагностика, але три речі
робляться в будь-якому разі:

1. **`pipeline/card-image.ts:1797`** — прибрати `motifClass: fallback_${lens}`. Фолбеки мають
   ділити один `motifClass` (напр. `fallback_essence`), щоб валідатор бачив їх як однакові,
   якими вони і є.
2. **`:1939`** — краще **два справді різні** варіанти, ніж три однакові. Якщо лінза не отримала
   pitch, вона не має додавати перефразування. Повертати менше брифів, а не добивати кількість.
3. **`:1780-1785`** — якщо фолбек усе-таки потрібен, він має братись **з іншої грамматики**
   (див. C), а не бути іншим описом того самого `essence`.

**Тести (`pipeline/card-image.test.ts`):**
- `does not emit three briefs built from one essence`
- `fallback briefs share a motif class so the sibling validator sees them as duplicates`
- `returns two distinct briefs rather than three near-identical ones`

**Готово коли:** на фікстурі, де журі приймає лише одну лінзу, функція повертає **один** бриф,
а не три; і тест на однаковість motifClass проходить.

### B3. Зробити деградацію видимою в адмінці

- **Файл:** `src/components/admin/weekly-workspace.tsx`
- **Зміна:** біля кожної story показувати `N/3 lenses accepted` і, якщо були фолбеки, які саме
  лінзи деградували. Дані вже є в metadata артефакту (`scene_source`, `concept_lens`).
- **Навіщо:** зараз єдиний сигнал — рядок `Illustration prompt · fallback`, і його треба вміти
  прочитати.

**Готово коли:** власник бачить «2/3 лінзи» без відкривання коду.

---

## C. Режим як третій вимір (сюди повертається V10)

Зараз лінза змінює *що* показано, але не *чим*. Усі три — завжди кінематографічне фото.

### C1. Ввести `grammar` поруч із `lens`

- **Мінімум два режими:** `cinematic_domain_scene` (наявний art director, без змін) і
  `deterministic_technical_hybrid` (схема). Третій — `source_led_fallback`, коли claim не пройшов
  аудит джерела.
- **Тип:** розширити `WeeklyReportageSceneBrief` полем `grammar`, дефолт
  `cinematic_domain_scene`, щоб наявні виклики не змінювали поведінку.

### C2. Роутер обирає грамматику з claim, не з регексів по тексту

- **Портувати:** сигнальний шар `src/lib/weekly-digest/visual-affordance-router-v10.ts`
  (`extractVisualAffordanceSignalsV10`) — він читає `autoClaim.semantics`, а не сирий текст.
- **Не портувати:** `selectAffordanceTreatmentV10` із
  `visual-affordance-treatment-v10.ts` — це три захардкожені сцени за регексами
  (`gemini|community critique`, `deep work|sparring partner`). PDF §14 прямо вимагає
  «Affordance Router **без story-ID hacks**», і саме на цьому реалізація дала покриття 29%.
- **Виправити при портуванні** (перевірені дефекти):
  - `hasExactMetric` (`:63`) сканує `practical`/`takeaway` — обмежити title+summary, інакше
    порада «Budget about 2 hours» перемикає доменну сцену на діаграму;
  - `requiresTemporalSequence` (`:84`) спрацьовує на одному слові `cache`/`split` — вимагати
    ≥2 різних процесних сигнали;
  - `inferRole` у `visual-auto-claim-v5.ts:268,274,277` — `\b` звʼязується лише з першою гілкою
    альтернації, тому «Stripe» → `architecture_transformation`; обгорнути кожну альтернацію
    в `(?:…)`.

### C3. Підключити mapping gate

`validateVisualPropositionV10` (`visual-affordance-router-v10.ts:468`) — це і є §6 PDF
«concept mapping gate». **У PR #229 він виявився мертвим кодом, і саме тому сцени довелось
малювати руками.** Підключити перед рендером: пропозиція без повної таблиці
`source concept → visible object → visible outcome` не рендериться.

Виправити при цьому його власний дефект: `unmapped_semantic_prop` (`:511`) звіряє
`semanticProps[].id` з `mappings[].visibleElement` — два вільнотекстові поля без спільного
контракту. Додати `visibleElementId` і зворотну перевірку; порожній `semanticProps: []` не має
проходити вакуумно.

### C4. Параметричний рендерер схем

- **База:** `visual-generic-svg-v5.ts:257` (`quantitativeScene`), керований
  `autoClaim.semantics.metric` і `claim.quantitativeFacts`.
- **Не брати** три сцени з `visual-affordance-treatment-v10.ts`.

**Готово коли:** story з `quantitativeFacts` отримує схему як **один із** варіантів поруч із
кінематографічним, і власник може порівняти їх в адмінці.

---

### C5. Обовʼязкові правки при портуванні коду V10

Код V10 містить чотири перевірені дефекти. **Портувати «як є» не можна — успадкуєш усі
чотири.** Нижче вже готові зміни; аналізувати не треба, треба застосувати й покрити тестом.

#### C5.1 `markerUnits` — механічна причина «поламаної стрілки»

Перевірено: `grep -rc markerUnits src/lib/weekly-digest/` = **0**. За SVG-специфікацією дефолт
`markerUnits` — `strokeWidth`, тож `markerWidth="12"` при `stroke-width="7"` дає вістря
**84 user units** (~7% ширини картки), а `refX="10"` масштабується до 70 — вістря залазить на
14 px усередину цілі.

Файли: `visual-affordance-treatment-v10.ts:187`, `visual-generic-svg-v5.ts:59`,
`visual-generic-svg-v6.ts:64`, `visual-generic-svg.ts:101` і `:102`.

```
було:  <marker id="…" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
стало: <marker id="…" markerUnits="userSpaceOnUse"
                markerWidth="18" markerHeight="18" refX="16" refY="9" orient="auto">
       <path d="M0 0 18 9 0 18Z" …/>
```

**Тест:** `every arrow marker declares markerUnits="userSpaceOnUse"` — грепом по згенерованому
SVG для кожного рендерера.

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

#### C5.5 `quantitativeScene` малює однакову геометрію для будь-якої величини

`visual-generic-svg-v5.ts:218` хардкодить стек 7-проти-2 і гейджі 0.84/0.27 незалежно від
реальної метрики. «Кеш зменшує вартість на 8%» і «оптична компресія зменшує на 95%» дадуть
**байт-ідентичну** картинку, і обидві стверджують ~71% зниження. Для новинного продукту це
фабрикація величини.

```ts
// вивести ratio з даних, а не з константи
const ratio = parseMetricRatio(claim.quantitativeFacts, semantics.metric); // 0..1 | null
if (ratio == null) {
  // немає розбірливої пари чисел -> НЕ малювати stack()/meter() взагалі,
  // рендерити якісний варіант лише зі стрілкою напрямку
} else {
  rightCount = Math.max(1, Math.round(leftCount * ratio));
  rightLevel = direction === 'decrease' ? ratio : 1 - ratio;
}
```

**Тест:** `two stories with different magnitudes produce different geometry` і
`a story without a parsable metric renders no quantitative stack`.

**Готово для всього C5 коли:** пʼять тестів вище зелені, і `grep -rc markerUnits` по
`src/lib/weekly-digest/` більше не дорівнює нулю.

---

## D. Правда в пікселях

### D1. Структурна заборона тексту (робити разом із B, до C)

- **Детермінований шар:** після побудови SVG кидати, якщо буфер містить `<text` при
  `includeOverlays === false`. Текст живе лише в overlay-шарі, який композититься після пікселів
  і може бути перегенерований під локаль.
- **Генерований шар:** `readable_text` лишається блокером критика, але має вести до
  **targeted repair** (inpaint/crop), а не до перегенерації кадру.
- **Чому зараз протікає:** політика тримається на тексті промпту. Story 3 отримала `Clodfire`,
  `PFfort`; Story 6 — нісенітні підписи на комутаторі.

### D2. Repair на рівні дефекту, не кадру

PDF §10, і §2 називає це головним історичним уроком: *«full-regeneration repair не є надійним;
майже хороший concept може бути знищений наступною regeneration»*.

| Дефект | Дія | Чого не робити |
|---|---|---|
| поламана стрілка / геометрія | перескласти геометрію | не міняти concept |
| впечений текст | локальна правка | не робити full regeneration |
| один провалений стан у sequence | перегенерувати лише цей asset | не всі стани |
| хибна теза / суперечність | **тільки тут** — новий concept | не патчити лейблами |

### D3. Етичний блокер

Story 5: робот тримає малу дитину за голову. У `IMAGE_CRITIC_BLOCKER_CODES`
(`src/lib/content-sim/vision-critic.ts:10`) немає коду для такого. Додати
(напр. `human_dignity_risk`) і згадати в промпті критика.

---

## E. Калібрування (можна паралельно з C)

### E1. Owner-feedback contract

PDF §14.1. В адмінці до кожного варіанта: `approve | local_repair | major_rework | reject`
плюс `reasonTags` із закритого списку (`domain_context_success`, `strong_intuitive_analogy`,
`weak_context`, `generic_diagram`, `weak_visual_thesis`, `labels_carry_claim`, `broken_arrow`,
`disconnected_prop`, `anatomy_error`, `unclear_causal_source`, `good_concept_bad_execution`).

**Навіщо:** сьогодні вердикти власника переносились у
`experiments/critic-ground-truth/owner-verdicts-v6.json` вручну. Вони мають накопичуватись самі
і ставати calibration dataset для критика й роутера.

### E2. Двостадійний критик

PDF §8. Спершу image-only — без headline, без scene brief, без labels: буквальні обʼєкти, дії,
результати, анатомія, впечений текст. Потім story-aware: чи підтримують пікселі claim. Зараз усе
в одному промпті (`buildImageCriticPrompt`), тому критик бачить задум наперед.

### E3. Promotion gate

PDF §15. ≥70% owner preference на свіжому наборі, 0 misleading, 0 unsupported factual assertion,
бюджет ≤$0.10 і latency ≤60 с на прийняте зображення. Без цього наступна зміна знову буде
«здається, краще».

---

## F. Динамічний вибір моделі за ціною і якістю

Вимога власника: не тримати жодної захардкодженої моделі. Сьогодні `sonnet-5`, завтра вийде
`sonnet-5.1` — система має сама знаходити оптимальну модель під кожну задачу, враховуючи знижки
OpenRouter (до 90%).

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

### F4. Зображення і відео — чесна межа

Вимога охоплює «текст, зображення, відео». Тут треба сказати прямо, а не вдавати покриття:

- **Текст** — повністю покривається F2: 411 моделей із цінами й бенчмарками.
- **Зображення** — **не покривається**. Продакшн рендерить через Cloudflare Workers AI
  (`@cf/black-forest-labs/flux-2-klein-9b`); його цін немає в каталозі OpenRouter, і
  бенчмарків якості для image-моделей в `artificial_analysis` теж немає.
- **Відео** — у каталозі рівно **одна** модель. Вибирати нема з чого.

Тому F2 реалізується для тексту, а для зображень потрібен **окремий, менший механізм**: перелік
провайдерів (Cloudflare / Leonardo / Gemini) із цінами з їхніх власних сторінок, оновлюваний
вручну раз на квартал. Не зводь це в одну абстракцію з F2 — інакше збудуєш узагальнення, яке
обслуговує одного провайдера.

### F5. Готово коли

- для ролей із порогом працює `scoreModelForRole`, і тест доводить, що модель із
  `intelligence_index` 14.2 і ціною $0.01 **не** обирається для `weekly.master_writer`;
- у коді немає жодного номера версії моделі:
  `grep -rE "sonnet-5|gpt-5|gemini-3\.[0-9]" pipeline/ src/` порожній поза тестами й фікстурами;
- добовий job оновлює `llm_provider_models` і пише аудит-рядок на кожну роль;
- `/admin/providers` показує обрану модель для кожної ролі з балом і датою;
- `wiki/pipeline/llm-providers.md` оновлено — там живе опис реєстру.

---

## Чого робити не треба

- **Не переносити** `visual-affordance-treatment-v10.ts` — три захардкожені сцени, впечений
  вигаданий JavaScript, і вони провалюють власний `generated_text` гейт.
- **Не додавати регексів по тексту story** для вибору грамматики. Це головна причина, чому V10
  дав 29% покриття.
- **Не міняти критика, поки не полагоджено генерацію** (B). З ~24 переглянутих ілюстрацій
  власник прийняв одну; суворіший критик за такої якості просто заблокує випуск.
- **Не рахувати вартість із лімітів політики** — брати `generation_cost_events`. Реальність
  на порядок вища за конфігурований cap.
- **Не робити full regeneration** там, де дефект локальний.

---

## Верифікація

```bash
npm run pr:check
```

| Хвиля | Як переконатись |
|---|---|
| A2 | звіт bake-off містить `Kept the good`; рішення про модель **не** застосоване автоматично |
| B1 | `experiments/jury-blockers/2026-08-digest-843975a8.md` із реальним розподілом блокерів |
| B2 | на фікстурі з однією прийнятою лінзою повертається один бриф, не три; тести з §B2 зелені |
| B3 | в адмінці видно `N/3 lenses accepted` |
| C | story з метрикою дає схему як один із варіантів; жодна грамматика без рендерера не обирається; SVG містить `markerUnits` |
| D1 | тест: детермінований буфер не містить `<text` при `includeOverlays: false` |
| E1 | owner verdict з адмінки потрапляє в calibration dataset без ручного перенесення |

Після кожної хвилі — `wiki/log.md` (append-only, нові записи **зверху**) + `wiki/index.md`.
Кожна хвиля — окремий PR, `pr:check` перед push, ніколи не в `main` напряму.

---

## Джерела

- `AI_Today_Brief_Visual_Algorithm_Plan.pdf` — проєктна основа (власник, розбір V1–V10)
- Живий digest `843975a8-8c19-4eca-96a8-035f76eae3ab`, 7 story з вердиктами власника 2026-08-14
- `pipeline/card-image.ts:1330-1449, 1780-1810, 1863, 1896-1939` — механізм деградації лінз
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
