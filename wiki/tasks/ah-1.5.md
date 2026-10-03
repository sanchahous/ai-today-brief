# AH-1.5

Summary: Статусний фрагмент AH-1.5. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: ah-1.5

## Status

### now.md

```verbatim
- **AH-1.5 код інтегровано через #385 і #386; #386 явно підтверджено власником.** Main `c477b09`, CI #386 зелений. Tracking guard більше не є незмердженим залишком. Погодження #386 не закриває UK Home/Article/Weekly, Preview CLS, H1/legacy QA або G1. (source: повідомлення власника 2026-10-01; [AH-1.5 validation](product/after-hours-ah-1-5-validation.md))
```

### now.md

```verbatim
- **Прод віддавав знімок БД від 02.09 — виправлення в гілці `fix/build-memo-stale-across-builds`
  (2026-09-30), змерджено через #383 у `2ba2b27`.** `/en/news`, `/en`, категорії, `/rss.xml`, item-записи в
  `sitemap.xml` і весь `news-sitemap.xml` показували дані до брифу 31.08, хоча в БД брифи є до
  29.09. Корінь — `withBuildMemo` (#350): диск-memo без часу й без ідентичності білду Vercel
  відновлював у кожен наступний деплой (≈23 прод-деплої). Тепер запис має `t`, TTL 30 хв, scope за
  `VERCEL_DEPLOYMENT_ID`, а старі файли чистяться. Read-only перевірку після merge зафіксовано в [AH-1.5 validation](product/after-hours-ah-1-5-validation.md#production-check-після-383): `/rss.xml` newest =
  Sep 29, `news-sitemap.xml` має свіжі матеріали. Runtime `/api/revalidate` і build-логи Vercel не
  перевірено (Hobby, 401/403).
  (source: [ops/supabase-egress-2026-09 § Регресія 2026-09-30](ops/supabase-egress-2026-09.md#регресія-2026-09-30-memo-пережив-білд);
  live check production + prod Supabase 2026-09-30)
```

### handoff

```verbatim
- **#386 змерджено й явно підтверджено власником:** «ПР закритий значить підтверджую 386». Main `c477b09`; CI, включно з [Playwright run 36826783157](https://github.com/sanchahous/ai-today-brief/actions/runs/36826783157), success. Tracking follow-up більше не є локальним залишком чи draft. UK Home/Article/Weekly із #385, прийняття локального CLS, H1/legacy QA та G1 лишаються відкритими. (source: [PR #386](https://github.com/sanchahous/ai-today-brief/pull/386); [AH-1.5 validation](after-hours-ah-1-5-validation.md); повідомлення власника)
```

### epic-5.3

```verbatim
| AH-1.5 | ◐ Типографіка — [merged PR #385](https://github.com/sanchahous/ai-today-brief/pull/385): local fonts, Georgia UK, шкала, eyebrow; [follow-up tracking #386](https://github.com/sanchahous/ai-today-brief/pull/386), merged і підтверджено власником; UK/CLS/H1/legacy AC відкриті ([докази](after-hours-ah-1-5-validation.md)) | M | агент + власник | D3 ✅, D4 ✅ | B14, G09 |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
