# weekly-illustration-cost-quality-loop-hardening-

Summary: Статусний фрагмент weekly-illustration-cost-quality-loop-hardening-. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-illustration-cost-quality-loop-hardening-

## Status

### now.md

```verbatim
- **Weekly illustration cost/quality loop hardening (2026-08-11):** owner-аудит Story 2/3/5/6
  підтвердив, що 5-round repair loop був дорогим seed roulette, фінальний repair лишав один variant,
  а critic пропускав opaque tubes/switchboards із високими шаблонними scores. Новий контракт —
  максимум 2 раунди по 3 паралельні renders + 3 паралельні vision reviews; batch critiques
  агрегуються й суцільний semantic fail змінює метафору. Додано `opaque_abstraction`, обовʼязковий
  pixel evidence/headline-substitution test, до двох character scenes для human-centered stories,
  provider-call cost ledger і cumulative Story revision spend у Visuals. (source: owner incident
  report 2026-08-11, `pipeline/card-image.ts`, `src/lib/content-sim/`,
  `src/lib/weekly-digest/generation-worker.ts`, `src/components/admin/weekly-workspace.tsx`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
