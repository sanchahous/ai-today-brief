# Weekly admin runbook — як вести випуск у `/admin/weekly`

Summary: покрокова інструкція для власника/редактора: що натискати у вкладках,
що означають статуси jobs vs Approve, і що робити коли здається що «все зависло».
Sources: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/preflight.ts`,
`claim_weekly_digest_generation_jobs` (editorial_master gate), live fail
`ai-weekly-2026-07-27` 2026-08-04, [weekly-digest](../pipeline/weekly-digest.md),
[editorial-voice](../pipeline/editorial-voice.md), `src/lib/weekly-digest/pdf.ts`
(PDF page-cap fix, 2026-08-07)
Last updated: 2026-08-07

---

## Головне правило (прочитай один раз)

| Статус | Що це означає | Що робити тобі |
|---|---|---|
| Job **succeeded** / pack **ready** | Система **згенерувала** артефакт | Переглянути → **Approve version** |
| Review **in_review** | Чекає людського апруву | **Approve** або Request changes |
| Review **approved** | Можна йти далі по пайплайну | Нічого, наступний крок |
| Job **queued** + packs не approved | Worker **свідомо не стартує** master | Approve усі 3 Top packs |
| Job **failed** + quality report | Critic / gate відхилив master | Читай blockers → Start/retry |

**Succeeded ≠ approved.** Це найчастіша причина «чому master у черзі».

## Шлях випуску (зліва направо)

```
Stories → Research → Article → Visuals → Social → PDF → Video → Release
```

Overview показує preflight blockers з лінком на вкладку. Іди зверху вниз.

### 1. Stories

1. Відбери **Top 3** + **3–4 Radar** (разом 6–7).
2. **Save stories**.
3. Без збереженого набору Content Studio не стартує.

### 2. Research (критичний human gate)

1. **Start / retry Content Studio** — ставить `research_pack` ×3 і `editorial_master` у чергу.
2. Дочекайся трьох packs **ready** (Generation jobs: succeeded).
3. На **кожній** Feature-картці: **Approve version** (owner, AAL2).
4. Лічильник **Approved research** має стати **3/3**.
5. Лише тоді cron (~кожні **5 хв**) claim-ить `editorial_master`.
6. Коли з’явиться **Master quality**:
   - червоні **blockers** → знову Start/retry (guidance підхопить blockers);
   - жовті length warnings часто не блокують Approve, якщо score/gate ок;
   - з 2026-08-06 сюди можуть потрапити нові блокери `editors_view_missing` /
     `discussion_question_missing` (тільки для трьох головних історій) і
     `template_leak:*` (мітка поля, вшита в тіло статті — «Practical scenario:»,
     «Обмеження полягає в тому» тощо) — обидва детерміновані, без участі критика,
     retry сам підхопить guidance. Деталі — [editorial-voice](../pipeline/editorial-voice.md);
   - **Approve version** на quality report.
7. Після успішного master з’являться Article EN/UK і підуть Visuals/Social/PDF/Video jobs.

Опція: **Write master via Claude subscription** — той самий job через GitHub Actions
(без OpenRouter $), не миттєво. (source: Research tab copy)

### 3–7. Article → … → Release

На кожній вкладці: дочекайся generation **ready** → переглянь → **Approve**.
Release preflight на Overview / Release покаже, що ще червоне.

## Типові «чому не їде»

| Симптом | Ймовірна причина | Дія |
|---|---|---|
| `editorial_master` **queued**, packs succeeded | Packs ще **in_review** | Approve 3/3 |
| Spinner на queued master | UI раніше крутив навіть коли gate блокує | Шукай банер «Waiting for pack approvals» |
| Master **failed**, score 8x, blockers | Critic / deterministic gate | Читай Master quality → retry |
| Після retry знову `UNSUPPORTED_*` на деталі зі статті | Старий короткий excerpt / вузькі claims | Переконайся що packs **v3** з довгим excerpt; Approve знову |
| Visuals/Social не з’являються | Master ще не succeeded | Спочатку зелений Research gate |
| Release blocked на video | Немає Remotion pipeline / captions | Owner override лише для trial (див. preflight) |
| PDF: сторінки радар-історій (4-7) виглядають скорочено (без картинки/панелей) | Так задумано з 2026-08-07 — повний розворот тепер лише для Top 3 | Нормально, не баг; деталі — [weekly-digest](../pipeline/weekly-digest.md#pdf-page-count-contract-violation--фікс-2026-08-07) |

## Що не робити

- Не Approve **Master quality** при `passed: false` — master у ревізію не записався.
- Не спамити Start/retry без Approve packs — master все одно не стартує.
- Не правити Article body вручну, щоб «обійти» failed master — правильний шлях retry / research.

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md) — техніка Content Studio, версії, spend-cap
- [weekly-editorial-selection](../pipeline/weekly-editorial-selection.md) — відбір історій
- [social-cms-runbook](social-cms-runbook.md) — cron / secrets для generate worker
- [owner-checklist](owner-checklist.md) — env і launch-блокери
- [now](../now.md) — поточний випуск
