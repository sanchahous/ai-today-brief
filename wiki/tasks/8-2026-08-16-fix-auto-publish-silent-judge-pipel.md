# 8-2026-08-16-fix-auto-publish-silent-judge-pipel

Summary: Статусний фрагмент 8-2026-08-16-fix-auto-publish-silent-judge-pipel. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: 8-2026-08-16-fix-auto-publish-silent-judge-pipel

## Status

### now.md

```verbatim
- **Суддя авто-публікації мовчки не працював 8 ночей — виправлено (2026-08-16), гілка
  `fix/auto-publish-silent-judge`.** `pipeline_runs` вісім ранів поспіль (08-08…15) писав
  `status='ok'`, `error=NULL`, `{action:'left_draft', approved:0, rejected:0,
  judge_unavailable:false}`, а випуски не виходили. **Корінь не той, що здавався:** суддя
  не падав — він відповідав правильно (`{"ref":0,"verdict":"approve","confidence":0.86,…}`),
  але **без конверта `{results:[…]}`**, а парсер читав тільки `obj.results` → порожній масив
  → кожен айтем ішов у `continue // no coverage` → нуль рішень без винятку. Другий,
  незалежний дефект: `logPipelineRun` писав `status:'ok'` **безумовно**, `error` не
  заповнювався ніколи. Виправлено: (1) парсер читає 5 варіантів конверта + голий масив +
  голий обʼєкт; (2) `judgeResponseIssue` як семантичний валідатор у провайдерному ланцюжку —
  нечитабельна відповідь **перемикає модель**; (3) непорожній бриф із 0 рішень = `action:'error'`;
  (4) `status='failed'` + `error` (значення `'error'` неможливе — `pipeline_runs_status_check`
  дозволяє лише `ok/failed/skipped`); (5) Telegram-алерт із сирою причиною; (6) щоденний пінг
  «N брифів чекають рев'ю»; (7) CLI виходить кодом 1, тож Actions-ран червоніє.
  **Перевірено наживо** на досі залиплому брифі `9deed7d1` (08-08 пак 2): до фіксу
  `left_draft approved=0 rejected=0`, після — `published approved=1`. Ціна дефекту: 20
  матеріалів довелось схвалювати вручну 16.08. Деталі —
  [audits/2026-08-16-auto-publish-silent-judge](audits/2026-08-16-auto-publish-silent-judge.md).
  (source: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-16, пряма проба судді,
  `pipeline/auto-publish.ts`, `pipeline/llm-json.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
