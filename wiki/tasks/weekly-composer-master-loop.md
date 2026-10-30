# weekly-composer-master-loop

Summary: Статусний фрагмент фіксу недільної петлі weekly composer → editorial_master, яка давала сплески MiMo-V2.6-Pro в OpenRouter.
Sources: прод `generation_cost_events` і `weekly_digest_generation_jobs` live check 2026-10-30; [weekly-digest](../pipeline/weekly-digest.md)
Last updated: 2026-10-30

---

Task: weekly-composer-master-loop

## Status

```verbatim
- **Weekly composer master loop (2026-10-30):** composer ставить Content Studio один раз на дайджест. Якщо editorial_master уже був на іншій ревізії, startWeeklyContentStudio нічого не ставить (skipped: master_already_ran_for_digest). Причина: кожен master активує нову ревізію, а composer кожні 30 хв у неділю брав активну ревізію з новим ключем — 7–17 master-прогонів на випуск з 27.09 по 25.10. (source: [weekly-digest](../pipeline/weekly-digest.md), прод live check 2026-10-30)
```

## Log

- 2026-10-30 — розбір сплесків MiMo-V2.6-Pro (11.10 $0.88 / 25 викликів, 18.10 $0.72 / 21) привів до weekly critic, а не Daily Visual; фікс у `src/lib/weekly-digest/orchestrator.ts`. (source: прод `generation_cost_events` live check 2026-10-30)

## Next

Відкрите (поза цим PR): у каталозі OpenRouter MiMo-V2.6-Pro має `reasoning.mandatory=false` без `supported_efforts`/`default_enabled`, тож `minimalReasoningEffort` нічого не надсилає і critic витрачає 13–32k output-токенів на виклик. Вимкнення reasoning для таких моделей треба перевірити наживо перед зміною. (source: `GET openrouter.ai/api/v1/models` 2026-10-30, `pipeline/openrouter-value.ts`)
