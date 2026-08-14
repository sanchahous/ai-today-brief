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
5. Реальні витрати — **$0.36–0.90 на story**, тобто $4–6 на випуск.

(source: owner review живого digest `843975a8-8c19-4eca-96a8-035f76eae3ab` 2026-08-14; ledger
`generation_cost_events` у тому ж digest — Story 2 `$0.9050 / 9 jobs`, Story 3 `$0.6906 / 8 jobs`,
Story 1 `$0.5655 / 8 jobs`)

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
A → B1 → B2 → B3 → D1 → C → D2 → E
```

A незалежний. **B1 — діагностика, і B2 не можна починати без її результату.** C залежить від B2.
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

### A3. Власник (не код)

Натиснути **Regenerate** на Story 4, 6, 7 у `/admin/weekly/843975a8-…`. Якщо вони дадуть по три
варіанти — гіпотеза про застарілі артефакти підтверджена і ці три story випадають зі скоупу B.

---

## B. Три варіанти мають бути справді різними

Головна претензія власника. Без цього все інше не має сенсу — обирати нема з чого.

### B1. Діагностика: які саме блокери валять журі

**Це вимірювання, а не здогад. Не пропускай і не заміняй припущенням.**

- **Джерело:** `logEvent('warn', 'publish', 'Weekly concept jury missing distinct lenses -- retrying', …)`
  у `pipeline/card-image.ts:1925`. Поле `errors` містить рядки виду `${lens}/${title}: ${blockers}`.
- **Де шукати:** логи Actions-воркера `weekly-master-cli-worker.yml` за прогони `story_image`
  дайджесту `843975a8-8c19-4eca-96a8-035f76eae3ab`, плюс `weekly_digest_generation_events`
  у Supabase.
- **Що порахувати:** розподіл блокерів по частоті. Очікувані кандидати з коду
  (`:1330-1428`): `sibling_scene_echo`, `sibling_motif_class_reuse`, `character_budget`,
  `opaque_abstraction_not_literal_to_story`, `desk/laptop default…`,
  `banned UI, collage, or stock-metaphor language`, `visible_mechanism_missing`.
- **Записати:** `experiments/jury-blockers/2026-08-digest-843975a8.md` — таблиця
  «блокер → скільки разів → на яких lens/story». Плюс: скільки story дійшли до 3 прийнятих лінз,
  скільки до 2, скільки до 0.

**Готово коли:** є таблиця з реальними числами, і видно один-два домінантні блокери.

> **Гіпотеза, яку треба або підтвердити, або відкинути числами:** обмеження siblings
> накопичуються протягом випуску (`:1896` передає сцени всіх попередніх story), тому пізнім
> story фізично бракує простору. Якщо це так — `SIBLING_SCENE_ECHO_THRESHOLD` і
> `character_budget` треба рахувати **в межах story**, а не всього випуску.

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
- **Обовʼязково виправити перед використанням:** у жодному `<marker>` немає `markerUnits`
  (`grep -rc markerUnits src/lib/weekly-digest/` = 0), тому вістря стрілки рендериться
  розміром 84 user units і залазить у ціль. Це механічна причина owner-тегу «стрілка поламана».
  Додати `markerUnits="userSpaceOnUse"`.
- **Заборонено:** hardcoded величини. `quantitativeScene` зараз малює 7-vs-2 стовпці незалежно
  від реальної метрики — для «−8%» і «−95%» вийде однакова картинка.

**Готово коли:** story з `quantitativeFacts` отримує схему як **один із** варіантів поруч із
кінематографічним, і власник може порівняти їх в адмінці.

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
