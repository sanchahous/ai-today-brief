# A2 — vision critic bake-off, рішення

Summary: порівняння трьох OpenRouter vision-моделей на owner-вердиктах v6. Модель
продакшну не перемикали.
Sources: Actions run `31879588071` (2026-08-15), `bakeoff-report.md`,
`experiments/critic-ground-truth/owner-verdicts-v6.json`,
[weekly-illustration-plan](../../wiki/pipeline/weekly-illustration-plan.md) A2
Last updated: 2026-08-15

---

## Прогін

- Валідний: [Actions `31879588071`](https://github.com/sanchahous/ai-today-brief/actions/runs/31879588071)
  на `feat/weekly-critic-bakeoff-a2` (~28 хв, 0 errors).
- Хибний: `31879216723` на `main` — скрипт падав на `row.story.title` (v6-маніфест має
  `headline`). API не викликався. Не читати.

Пакет: run `31611857768`, artifact `visual-compiler-v6-targeted-ab-evaluated`.
Промпт: прод `buildImageCriticPrompt`, policy `weekly-semantic-story-v5.1`.
3 семпли на картинку.

## Таблиця (читати обидві колонки)

| Model | Rejected the bad | Kept the good | Cost |
|---|---:|---:|---:|
| `google/gemini-2.5-flash` | 6/6 | **0/1** | $0.0894 |
| `anthropic/claude-sonnet-5` | 6/6 | **0/1** | $0.7612 |
| `google/gemini-3.1-pro-preview` | 5/6 | **0/1** | $1.0714 |

Усі три зарубали єдину owner-схвалену картку (`2-current`). Правило специфікації:
якщо `claude-sonnet-5` дає `Kept the good = 0/1` — **unfit**. `gemini-3.1-pro-preview`
ще й пропустив reject (`4-compiler` → critic pass, median 88, spread 38).

## Рішення

`CONTENT_SIM_VISION_OPENROUTER_MODEL` **не** змінюється. Залишається дефолт
`google/gemini-2.5-flash` (`pipeline/providers/vision.ts`).

Обмеження: позитив **n=1**. Тест може дискваліфікувати модель, не підтвердити її.
Жодна з трьох не пройшла ship-сторону; flash лишається як поточна, найдешевша і з
повним reject recall, не як «переможець bake-off».

Картинки дайджесту лишаються ручними. Автогенерації дайджест-картинок цей прогін
не вмикає.
