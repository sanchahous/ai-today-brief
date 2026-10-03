# weekly-digest-2026-09-03-claude-weekly-digest-sp

Summary: Статусний фрагмент weekly-digest-2026-09-03-claude-weekly-digest-sp. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: weekly-digest-2026-09-03-claude-weekly-digest-sp

## Status

### now.md

```verbatim
- **Weekly digest реліз розділено на дві частини: сайт+соц окремо від відео (2026-09-03),
  гілка `claude/weekly-digest-split-release-6fd035`.** Власник: не затримувати сайт/соц через
  найповільніший крок пайплайну (відео), і ніколи не привʼязувати соцмережі до відео взагалі.
  Три паралельні копії Ship-гейту (SQL `weekly_digest_preflight`, `buildHallucinationBoard`
  `REQUIRED_SLOTS`, TS-фолбек `validateWeeklyDigestPreflight`) більше не вимагають
  `video_script`/`video_manifest`/`video_final`/`captions`/`thumbnail` — **Ship** публікує
  сайт (стаття, visuals, PDF) і всі шість соцпостів, щойно готові, без відео. Новий RPC
  `publish_weekly_digest_video` (security invoker, AAL2 owner, той самий preflight-error
  формат що й `ship_weekly_digest`) — окрема дія «Publish video» на Release-табі: коли
  video_final+captions+thumbnail затверджені на вже опублікованій ревізії, проставляє їм
  `published_at` і ревалідує публічну сторінку; статус дайджесту лишається `published`,
  соцпости не чіпаються. Публічна сторінка вже фільтрувала артефакти по
  `published_at is not null` — тож сайт без готового відео рендерився коректно й раніше,
  бракувало лише самого гейту й дії публікації відео. `guard_weekly_digest_artifact_write()`
  безумовно блокував зміну `published_at` поза release worker; додано вузький GUC-виняток
  `app.weekly_digest_video_publish` за тим самим патерном, що вже є для visual-refresh
  promotion. Соцмережі й раніше не залежали від відео в контенті (`social-adapter.ts` не
  згадує video/youtube) — розділення гейту прибирає єдиний звʼязок структурно.
  Міграція `20260903150000_weekly_digest_two_phase_release.sql` **ще не застосована на
  проді** — потребує окремого підтвердження власника перед деплоєм.
  (source: owner session 2026-09-03; [weekly-digest § Реліз у два етапи](pipeline/weekly-digest.md#реліз-у-два-етапи-сайт-окремо-від-відео-2026-09-03),
  [weekly-admin-runbook](ops/weekly-admin-runbook.md);
  `supabase/migrations/20260903150000_weekly_digest_two_phase_release.sql`,
  `src/lib/weekly-digest/preflight.ts`, `src/lib/weekly-digest/hallucination-board.ts`,
  `src/app/admin/(cms)/weekly/actions.ts`, `src/components/admin/weekly-workspace.tsx`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
