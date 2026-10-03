# openrouter-2026-08-30-get-api-v1-credits-60-50-1

Summary: Статусний фрагмент openrouter-2026-08-30-get-api-v1-credits-60-50-1. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: openrouter-2026-08-30-get-api-v1-credits-60-50-1

## Status

### now.md

```verbatim
- **Рахунок OpenRouter поповнено (2026-08-30 вечір).** `GET /api/v1/credits`:
  куплено $60, витрачено $50.16, залишок **$9.84**. Платні лінії знову доступні.
  Сухий прогін каталогу (без `chat/completions`, лише list + ранкер) на 384 моделі:
  `fable` і аліаси `~` у чергах немає. Живі капи: social 2, weekly 1, daily 6.
  **Social writer/critic:** `meta/muse-spark-1.2` (AA 56.8, $1.37/M) →
  `google/gemini-3.7-flash` (56, $0.94/M). Далі в родинах: deepseek-v4-pro,
  `z-ai/glm-5.2:free` (52.6), gpt-5.6-luna, qwen3.8. **Weekly writer (cap=1):**
  лише `z-ai/glm-5.2:free` — mix 0.2/0.8 викидає muse/gemini flash за стелю $1.5;
  наступна платна родина була б `openai/gpt-5.6-luna` ($0.99/M). **Weekly critic
  (cap=1):** `deepseek/deepseek-v4-pro-0813` (53.2, $1.26/M). **Daily summarize/
  verify:** deepseek-v4-pro → glm-5.2:free → gpt-5.6-luna → qwen3.8 →
  minimax-m3:free → mimo-v2.5-pro.
  (source: живий `api/v1/credits` + `fetchOpenRouterCatalogForRole` 2026-08-30 15:12 UTC;
  [research/2026-08-30-openrouter-routing-api §12](research/2026-08-30-openrouter-routing-api.md))
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
