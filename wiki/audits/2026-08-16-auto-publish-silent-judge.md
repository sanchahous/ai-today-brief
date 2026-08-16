# Аудит: суддя авто-публікації мовчки не працював вісім ночей

Summary: чому `pipeline_runs.status = 'ok'` вісім ночей поспіль, поки жоден бриф не
виходив у прод; корінь — не збій моделі, а конверт JSON-відповіді, який парсер не читав.
Sources: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16 (`pipeline_runs`,
`item_reviews`, `brief_items`), живий прогін `auto-publish --dry-run` до і після фіксу,
пряма проба судді на брифі `9deed7d1-d426-46fd-9b9b-9a802bf9d945`, `pipeline/auto-publish.ts`
Last updated: 2026-08-16

---

## Симптом

Вісім нічних прогонів поспіль (2026-08-08…15) писали в `pipeline_runs`
(source: прод-`pipeline_runs` stage=`auto_publish` live check 2026-08-16):

```
status: ok    error: NULL
meta.outcomes[]: { action: "left_draft", approved: 0, rejected: 0, judge_unavailable: false }
```

Випуски не виходили. `error` порожній у **всіх** цих ранах. У прогоні 13.08
(`ef47a622`, 480 с) частина брифів опублікувалась (08-10, 08-11, 08-13 — по 7 схвалень),
а 08-08, 08-09 і 08-12 у тому ж рані дали 0/0 без жодного рядка в `item_reviews`.

## Корінь — не той, що здавався

`judge_unavailable: false` — тобто виняток **не** ловився. Суддя відповідав нормально.
Пряма проба на єдиному досі залиплому брифі (`9deed7d1`, 1 pending, `vibe-coding`)
показала точну відповідь `openrouter:deepseek/deepseek-v4-pro-0813`:

```json
{ "ref": 0, "verdict": "approve", "confidence": 0.86,
  "reason": "Broad security and privacy risks in popular AI IDEs…" }
```

Модель зробила **правильний** виклик (source: пряма проба судді 2026-08-16, роль
`daily.auto_publish_judge`). Парсер читав лише `obj.results`:

```ts
const results = Array.isArray(obj.results) ? obj.results : [];
```

Конверта `{results: […]}` не було → порожній масив → у циклі кожен айтем ішов у
`continue // no coverage from the model — leave pending` → 0 схвалено, 0 відхилено,
жодного винятку. Далі `logPipelineRun` писав `status: 'ok'` **безумовно**, а `error`
не заповнювався ніколи.

Тобто це два незалежні дефекти, які склались:

1. **Парсер відкидав валідну відповідь у нестандартному конверті.** Одноелементний
   батч особливо часто повертається голим обʼєктом.
2. **Ран рапортував `ok` за будь-якого результату.** Навіть якби суддя падав, статус
   лишався б `ok`, а `error` — `NULL`.

Три хвилини між стартом рану 13.08 (22:55) і першим успішним викликом (22:58:30) —
це два повні виклики судді на 08-08 і 08-09, які нічого не дали й нікуди не записались.

## Що змінено (гілка `fix/auto-publish-silent-judge`)

| # | Зміна | Файл |
|---|---|---|
| 1 | Парсер читає `{results}`, `{items}`, `{verdicts}`, `{decisions}`, `{data}`, голий масив і **голий обʼєкт**; повертає ще й `returned` — скільки записів реально прийшло | `pipeline/auto-publish.ts` |
| 2 | `judgeResponseIssue()` — семантичний валідатор: «чи можна цю відповідь взагалі використати». Підключений у провайдерний ланцюжок, тож нечитабельна відповідь **перемикає модель**, а не зникає | `pipeline/auto-publish.ts`, `pipeline/llm-json.ts` |
| 3 | Тиша = збій. Непорожній бриф із `approved + rejected == 0` → `action: 'error'`, сира причина в `judgeError` | `pipeline/auto-publish.ts` |
| 4 | `pipeline_runs.status = 'failed'` + `error` зі списком причин. **`'error'` неможливий**: `pipeline_runs_status_check` дозволяє лише `ok / failed / skipped` — міграцію заради синоніма не робили | `pipeline/auto-publish.ts` |
| 5 | Telegram-алерт `🚨 суддя не відпрацював` із сирим текстом причини | `pipeline/auto-publish.ts` |
| 6 | Щоденний пінг людського гейту «N брифів чекають рев'ю» | `pipeline/auto-publish.ts` |
| 7 | CLI виходить із кодом 1 — GitHub Actions run стає червоним, а не лише рядок у БД | `pipeline/scripts/auto-publish.ts` |

Пункт 2 — це і є відповідь на «переключитись на іншу модель, якщо причина в моделі».
Валідатор живе в HTTP-смузі (`validateResponse`), тому провал одного конверта коштує
переходу до наступної моделі черги. Обмеження: `gemini` і `cli`-смуги валідатора не
приймають, тому там та сама перевірка виконується після виклику й дає **чесну помилку**
замість непридатної відповіді.

## Перевірка на живих даних

Той самий бриф `9deed7d1`, той самий `--dry-run`:

| | до фіксу | після фіксу |
|---|---|---|
| результат | `left_draft — approved=0 rejected=0` | `published — approved=1 rejected=0` |
| `pipeline_runs.status` | `ok` | `ok` (бо збою вже немає) |

Помилковий шлях покритий юніт-тестами на чистих функціях (`judgeResponseIssue`,
`judgeSilenceError`, обидва форматери) — відтворити реальну «погану» відповідь моделі
на вимогу неможливо.

## Що це коштувало

Дефект жив із 2026-08-08 по 2026-08-16. 20 матеріалів довелось схвалювати вручну
(source: `item_reviews.reviewer = 'manual:cowork-recovery'`, 20 рядків 2026-08-16). Алерт
(п. 5) або пінг людського гейту (п. 6) показали б проблему **першої ж ночі** — 09.08.

## Related pages

- [dedup-autopublish](../pipeline/dedup-autopublish.md) — початковий дизайн авто-публікації
- [llm-providers](../pipeline/llm-providers.md) — реєстр провайдерів і роль `daily.auto_publish_judge`
- [now](../now.md)
