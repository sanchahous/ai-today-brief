# v10-2026-08-13-google-gemini-2-5-flash-v10-hard-

Summary: Статусний фрагмент v10-2026-08-13-google-gemini-2-5-flash-v10-hard-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: v10-2026-08-13-google-gemini-2-5-flash-v10-hard-

## Status

### now.md

```verbatim
- **Переоцінка виправленим харнесом — перевага V10 не підтвердилась (2026-08-13).** Ті самі
  пікселі, той самий суддя `google/gemini-2.5-flash`, змінені лише правила оцінювання:
  **V10 hard integrity 3/3 → 0/3**, blind preference **3-0 → 1-1 з нічиєю**, розрив зважених
  балів 33.1 → **0.5** пункта (шум того самого судді на незмінних пікселях раніше вимірювався
  у 15.5). V8 headline-grounded зріс 0/3 → 2/3, щойно його перестали оцінювати за специфікацією
  конкурента — baseline був strawman. Блокери V10: `generated_text` на обох детермінованих
  сценах (впечені лістинги і підписи, заборонені політикою `weekly-semantic-story-v5.1`),
  `labels_carry_claim` на Claude-thresholds, пʼять блокерів на Deep Work. Обидві гілки провалюють
  hard integrity за однаковими правилами. **Висновок: заявлена перевага була артефактом
  вимірювання, а не якості картинок.** Питання «чи краще за продакшн» лишається відкритим для
  **цих** прогонів: у targeted-серії V10 порівнювали v10 проти v8, а продакшн-гілку прибрали.
  У ранніших прогонах v6/v7 продакшн **брав** участь як гілка `current` — див. коригування в
  [audits/2026-08-13-pr-229-visual-v10-sonnet-plan](audits/2026-08-13-pr-229-visual-v10-sonnet-plan.md).
  (source: Actions run
  `31739283280`, `experiments/visual-affordance-v10/targeted-v7-corrected-harness/`,
  [open-questions](open-questions.md) §8)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
