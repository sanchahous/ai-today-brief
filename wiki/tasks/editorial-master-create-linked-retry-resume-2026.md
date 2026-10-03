# editorial-master-create-linked-retry-resume-2026

Summary: Статусний фрагмент editorial-master-create-linked-retry-resume-2026. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: editorial-master-create-linked-retry-resume-2026

## Status

### now.md

```verbatim
- **editorial_master «Create linked retry» нескінченно повторював мертвий resume (2026-08-22),
  гілка `claude/editorial-master-admin-jobs-af3509`.** Власник повідомив про FAILED job'и в
  `/admin/weekly/71af784b-3c89-47f8-bc38-e3eae4def2a7`. Прод-Supabase live check підтвердив: job
  `c471563f` (**Resume saved master** → `411aba45`) впав на `prepare`, бо
  `priorMasterRetryGuidance` підхопив свіжий `content_quality_report`, який щойно записав сам
  `411aba45` — очікуваний planHash-мисматч. Але **Create linked retry** на цьому job'і RPC
  `retry_weekly_digest_generation_job` копіював `input` без змін, тож дочірній job `299e2c6c`
  успадкував той самий мертвий `resume_from_job_id` і впав ідентично 3 хв по тому — нескінченний
  цикл, кожен наступний ручний retry повторював би те саме. Фікс: RPC вставляє
  `v_source.input - 'resume_from_job_id'`, лінкований retry стартує свіжий master-ран (як
  **Regenerate master**); новий код `resume_source_stale` у `classifyGenerationFailure` замість
  `unknown` з порадою «create a manual retry» (та порада відтворювала провал). Міграцію **не**
  застосовано до прода з цієї сесії — потребує підтвердження власника. Два завислі FAILED job'и
  термінальні, нічого не блокують; owner path: після мержу/застосування натиснути **Regenerate
  master**.
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-22,
  [pipeline/weekly-digest § retry_weekly_digest_generation_job](pipeline/weekly-digest.md#retry_weekly_digest_generation_job-копіював-мертвий-resume_from_job_id--фікс-2026-08-22),
  `supabase/migrations/20260822130000_weekly_manual_retry_drops_stale_resume.sql`,
  `src/lib/weekly-digest/generation-control.ts`)

  **Follow-up того ж дня — глибша причина.** Навіть без «Create linked retry», сама кнопка
  **Resume saved master** майже гарантовано падала з тим самим повідомленням для джоб з
  `needs_owner_review` — саме того кейсу, для якого вона й існує. `priorMasterRetryGuidance`
  брала останній `content_quality_report` по ревізії без винятку для звіту, який щойно
  написала сама джоба-джерело: звіт `411aba45` містить вимір `naturalness: 55` (поріг 80) →
  непорожня guidance → `planHash` резюме відрізняється від `planHash`, з яким `411aba45`
  стартувала (тоді звітів на ревізії не було). Джоба інвалідує власний checkpoint у момент
  написання фінального звіту про себе. Фікс: `priorMasterRetryGuidance` при резюме обмежує
  запит `created_at` джоби-джерела (`fetchMasterResumeSource` + `resolveMasterResumeState`,
  розбито з колишньої `loadMasterResumeState`, бо `created_at` тепер потрібен **до**
  розрахунку `retryGuidance`). Перевірено на проді: межа по `411aba45.created_at` повертає 0
  звітів — той самий порожній набір, що бачила сама джоба о 08:28. Це зміна лише в app-коді
  (`generation-worker.ts`) — деплоїться Vercel-пайплайном при мержі, на відміну від SQL-фіксу
  вище напряму на прод не застосовується.
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-22 —
  `weekly_digest_artifacts.content` для ревізії `c4aea013-e7f6-4769-94dd-099a399d51b2`,
  [pipeline/weekly-digest § Глибша причина](pipeline/weekly-digest.md#глибша-причина-priormasterretryguidance-самозаперечувала-власний-checkpoint-2026-08-22),
  `src/lib/weekly-digest/generation-worker.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
