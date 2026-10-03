# feat-llm-registry-phase-7-2026-08-07-main-7-code

Summary: Статусний фрагмент feat-llm-registry-phase-7-2026-08-07-main-7-code. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: feat-llm-registry-phase-7-2026-08-07-main-7-code

## Status

### now.md

```verbatim
- **Гілка `feat/llm-registry-phase-7`** (відгалужена 2026-08-07 від `main`) — **Фаза 7 (Codex
  CLI) виконана.** Новий `pipeline/providers/cli/codex.ts` — перший реальний другий споживач
  `cli-provider.ts`'s Фаза-1-скелету (доти — нуль споживачів). Автентифікація `CODEX_API_KEY`,
  `codex exec --json --skip-git-repo-check --sandbox read-only`, NDJSON-парсер бере `text` з
  останньої `agent_message`-події. Зареєстровано в `registry.ts`'s `KNOWN_CLI_PROVIDERS['codex-cli']`
  — робить DB-ланцюжок з `codex-cli` резолвним через `/admin/providers`, **нічого не вмикає за
  замовчуванням** (не входить у жоден `defaultChain`). ⚠️ **Не верифіковано живим прогоном** —
  немає `CODEX_API_KEY`/бінарника в сесії; флаги й env var узяті з офіційної документації
  OpenAI (звірено між кількома сторінками), не з реального запуску. 940/940 тестів (+10),
  `tsc`/`eslint`/`npm run build` чисті. Деталі —
  [pipeline/llm-providers § Фаза 7](pipeline/llm-providers.md#статус). **З плану лишається:**
  тільки спостереження живого прод-циклу 6a/6b (не dry-run) з часом — усе інше зроблено.
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
