# legacy-social-posts-repair-guard-2026-08-17-code

Summary: Статусний фрагмент legacy-social-posts-repair-guard-2026-08-17-code. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: legacy-social-posts-repair-guard-2026-08-17-code

## Status

### now.md

```verbatim
- **Legacy Social posts проходять repair до фінального guard (2026-08-17), гілка
  `codex/social-existing-post-repair`.** Recovery `606d0463…` успішно відновив 2/6, довів усі
  6/6 channels до clean checkpoints, створив 8 Instagram assets, LinkedIn document і package,
  але на 92% guard побачив старі reports у всіх posts. Причина: fallback lookup за
  `package_id + channel` виконувався після update branch, тож existing post знаходився, але не
  ремонтувався. Lookup тепер передує спільному versioned update; додано regression helper tests.
  (source: production job `606d0463-d479-49a3-828a-cf48232b8dff`, Actions run `32063924268`,
  `src/lib/weekly-digest/generation-worker.ts`, `generation-worker.test.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
