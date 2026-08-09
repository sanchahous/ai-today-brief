# Weekly admin runbook — як вести випуск у `/admin/weekly`

Summary: покрокова інструкція для власника/редактора: що натискати у вкладках,
що означають статуси jobs vs Approve, і що робити коли здається що «все зависло».
Sources: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/preflight.ts`,
`claim_weekly_digest_generation_jobs` (editorial_master gate), live fail
`ai-weekly-2026-07-27` 2026-08-04, [weekly-digest](../pipeline/weekly-digest.md),
[editorial-voice](../pipeline/editorial-voice.md),
`weekly_generation_control_plane` implementation 2026-08-09, `src/lib/weekly-digest/pdf.ts`
(PDF page-cap fix, 2026-08-07), admin mobile-responsive fix (гілка
`claude/admin-mobile-responsive-pfb65o`, 2026-08-08)
Last updated: 2026-08-09

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
5. Лише тоді `editorial_master` переходить у **queued** і одразу отримує один GitHub Actions
   worker (cron ~кожні **5 хв** лишається safety-dispatcher).
6. Коли з’явиться **Master quality**:
   - червоні **blockers** → знову Start/retry (guidance підхопить blockers);
   - жовті length warnings часто не блокують Approve, якщо score/gate ок;
   - з 2026-08-06 сюди можуть потрапити нові блокери `editors_view_missing` /
     `discussion_question_missing` (тільки для трьох головних історій) і
     `template_leak:*` (мітка поля, вшита в тіло статті — «Practical scenario:»,
     «Обмеження полягає в тому» тощо) — обидва детерміновані, без участі критика,
     retry сам підхопить guidance. Деталі — [editorial-voice](../pipeline/editorial-voice.md);
   - з `weekly-master-v7` окремо блокуються копія legacy-зразка, абстрактна назва випуску,
     непояснена «енергія», надмірні metadata, UK spelling/grammar/localization та непідтверджена
     заява про «original research». Не апрувити звіт із механічними однаковими 90/100 — це
     ознака некаліброваного critic verdict, а не доказ якості;
   - **Approve version** на quality report.
7. Після успішного master з’являться Article EN/UK і підуть Visuals/Social/PDF/Video jobs.

Довгі master/social/video jobs завжди показують конкретний GitHub run; короткі jobs лишаються
на Vercel. Не потрібно вручну вибирати worker. (source:
`weekly_generation_control_plane` implementation 2026-08-09)

## Як читати нову панель Generation jobs

- **Attempt 2/3** — скільки фактичних worker leases уже було; human approval у `waiting` не
  витрачає спробу.
- **Backend / Open run** — де працює конкретна спроба і пряме посилання на GitHub Actions.
- **Step / provider** — поточний етап і provider/model; для ще не стартованої задачі це явно
  написано, а не замінено здогадом.
- **≈ progress / elapsed / ETA** — збережений прогрес, фактичний час, heartbeat і deadline.
  Поки мало історії, ETA позначено як configured budget.
- **Latest result / next action** — причина попередньої невдачі, retryable чи terminal, коли
  буде retry або що саме має зробити редактор.

`running` без heartbeat понад 90 секунд щохвилинний database reaper закриває як `timed_out` і ставить backoff; третя
інфраструктурна невдача завжди terminal. Для quality/validation/quota помилок автоматичного
retry немає: переглянь конкретну причину, виправ gate і створи linked manual retry.
(source: `supabase/migrations/20260809060929_weekly_generation_control_plane.sql`)

### 3–7. Article → … → Release

На кожній вкладці: дочекайся generation **ready** → переглянь → **Approve**.
Release preflight на Overview / Release покаже, що ще червоне.

На Article:

- **Short intro under the headline (standfirst)** / **Короткий вступ під заголовком** — 1–2
  речення, які видно читачеві одразу під заголовком;
- **Search result title/summary** — рекомендований текст для пошукового preview;
- **Social sharing title/summary (Open Graph)** — заголовок і опис картки при поширенні посилання
  у соцмережах та месенджерах. Open Graph — назва стандарту metadata, не окремий формат статті.

Лічильники 65/160 для search і 70/200 для Open Graph — внутрішній редакційний бюджет для
компактного preview. Це не гарантія відображення: пошуковик або соцмережа може обрізати чи
вибрати інший текст.

Перевіряй не тільки зелені лічильники: title має називати конкретну подію/конфлікт, одиниці та
числа в UK мусять бути локалізовані, а одиничний case study не можна подавати як універсальний
факт про весь agentic AI. Якщо Top 3 не мають чесного спільного зв'язку, не вимагай umbrella-
тему — краще прямо назвати три новини.

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

## Мобільна версія (2026-08-08)

`/admin` тепер зручний з телефону. Нижня навігація (Today…Settings) — два рівні рядки
замість поламаного 7-колонкового grid. Таб-бар секцій (Overview…Release) на
`/admin/weekly/[id]` прогортається пальцем — на краю з'являється м'яке затемнення, якщо
праворуч/ліворуч є ще вкладки поза екраном. Довгі story-ідентифікатори у preflight
blockers тепер переносяться, а не обрізаються за межу екрана.
(source: гілка `claude/admin-mobile-responsive-pfb65o`)

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md) — техніка Content Studio, версії, spend-cap
- [weekly-editorial-selection](../pipeline/weekly-editorial-selection.md) — відбір історій
- [social-cms-runbook](social-cms-runbook.md) — cron / secrets для generate worker
- [owner-checklist](owner-checklist.md) — env і launch-блокери
- [now](../now.md) — поточний випуск
