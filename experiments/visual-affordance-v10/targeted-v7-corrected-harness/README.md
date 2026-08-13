# Visual Affordance V10 — targeted v7, corrected harness

Summary: перший прогін після зняття трьох маніпуляцій в evaluator. Ті самі три історії, той самий
суддя, ті самі пікселі V10 і V8 — змінилися **тільки правила оцінювання**. Заявлена перевага V10
зникла повністю.
Sources: Actions run [`31739283280`](https://github.com/sanchahous/ai-today-brief/actions/runs/31739283280)
(гілка `main`, 2026-08-13); [evaluation report](results/evaluation-report.md);
[render report](results/render-report.md); попередній прогін —
[targeted-v6](../targeted-v6-owner-outcome-repair/README.md).
Last updated: 2026-08-13

---

## Що змінилось у вимірюванні (не в картинках)

W0 зняв із `scripts/visual-affordance-v10-targeted-evaluate.ts` чотири речі:

1. waiver, що гасив hard-блокер `generated_text` **лише для гілки-кандидата**;
2. підстановку спостережень, підписаних назвами гілок (`V8 observation:` / `V10 observation:`) —
   тепер вони йдуть за стороною картки;
3. рубрику, зібрану зі специфікації кандидата (`expectedEvidence`, `forbiddenImplications`,
   `labels`) і застосовану до **обох** гілок — тепер рубрика будується лише з approved story;
4. читання `beam_purpose` та обох invariant зі story-aware стадії, де відповідь уже була в
   промпті — повернуто в blind-стадію.

Пікселі обох гілок — ті самі файли, що й у v6. Модель судді та ж (`google/gemini-2.5-flash`).

## Результат

| Метрика | v6 (харнес із маніпуляціями) | v7 (виправлений харнес) |
|---|---:|---:|
| V10 hard visual integrity | 3/3 | **0/3** |
| V8 hard visual integrity | 0/3 | 0/3 |
| V10 headline-paired grounded | 3/3 | 2/3 |
| V8 headline-paired grounded | 0/3 | **2/3** |
| Середній зважений бал V10 | 87.2 | 68.1 |
| Середній зважений бал V8 | 54.1 | 67.6 |
| Blind preference | V10 3 / V8 0 / ties 0 | **V10 1 / V8 1 / ties 1** |

Вартість прогону: 6 vision calls, 13 206 токенів, $0.0149; 1 image call; тривалість job — 1 хв.

## Що це доводить

- **Уся заявлена перевага V10 трималася на вимірюванні.** Різниця зважених балів впала з 33.1 до
  **0.5** пункта — при тому, що шум того самого судді на незмінних пікселях раніше вимірювався у
  15.5 пункта. Тобто 68.1 проти 67.6 не відрізняється від нуля.
- **`generated_text` спрацював рівно там, де й мав.** Story 2 і 5 (детерміновані SVG) впали на
  ньому: впечені лістинги коду і підписи — це саме те, що production-політика
  `weekly-semantic-story-v5.1` забороняє з PR #175.
- **Story 5 додатково впала на `labels_carry_claim`** — без слів `CACHE / SPLIT / MONITOR` схема
  не читається, що підтверджує owner-тег, який суддя раніше пропускав.
- **Deep Work (story 4) набрала пʼять блокерів** — `core_action_missing`, `outcome_missing`,
  `causal_relation_missing`, `beam_purpose_unclear`, `domain_context_missing`. Це збігається з
  ручним оглядом: промінь від пристрою не доходить до картки-підказки, а темна плитка в
  блакитному отворі розриває маршрут, який сцена мала показати завершеним.
- **V8 не був настільки поганим, як звітувалося.** Його headline-grounded зріс з 0/3 до 2/3 щойно
  його перестали оцінювати за специфікацією конкурента — прямий доказ, що baseline був strawman.

## Чого це НЕ доводить

Що V8 кращий. Обидві гілки дають **0/3** hard integrity — за однаковими правилами провалюються
обидві. Питання «чи краще це за те, що працює в проді сьогодні» лишається відкритим: production
`pipeline/card-image.ts` у порівнянні не брав участі. n=3, історії підібрані за попередніми
owner-відмовами, позиційного свапу немає, суддя один. Мінімальний дизайн, якому можна вірити —
W4 у [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../../../wiki/audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md).

## Related pages

- [wiki/audits/2026-08-13-pr-229-visual-v10-sonnet-plan](../../../wiki/audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md)
- [wiki/open-questions](../../../wiki/open-questions.md)
- [targeted-v6-owner-outcome-repair](../targeted-v6-owner-outcome-repair/README.md)
