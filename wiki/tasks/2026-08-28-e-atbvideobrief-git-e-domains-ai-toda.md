# 2026-08-28-e-atbvideobrief-git-e-domains-ai-toda

Summary: Статусний фрагмент 2026-08-28-e-atbvideobrief-git-e-domains-ai-toda. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: 2026-08-28-e-atbvideobrief-git-e-domains-ai-toda

## Status

### now.md

```verbatim
- **Консолідація трьох відео-папок в один репозиторій (2026-08-28).** Власник тримав
  відео-роботу в трьох місцях і перестав орієнтуватись: `E:\ATBvideobrief` (без git, ручний
  запис матеріалів по датах), `E:\domains\ai-today-brief-video` (окремий git-репо, що встиг
  обрости власною wiki на 27 сторінок, `raw/`, датованою `19-08-2026/`, і 314 МБ `.git` через
  прогалину в `.gitignore` — правило `public/avatar/` не покривало вкладені датовані підпапки
  типу `public/26-08-2026/avatar/`, тож ~300 МБ голосу/кліпів/музики закомітились напряму), і
  цей репозиторій. Звели все знання й усі сирі матеріали сюди: 15 сторінок з
  `ai-today-brief-video/wiki` перенесено й де треба злито (наприклад `editorial-format.md` +
  `quality-bar.md` → одна сторінка; дублікат-дзеркало ADR і три застарілі per-digest знімки
  (`agentic-workflow`, `video4-living-scenes`, `video4-operator-pack`) видалено, а не
  перенесено — самі позначали себе як «архівний знімок») під префіксом `video-` у `pipeline/`,
  `ops/`, `product/`, `research/`. Сирі матеріали — dedup-звірка показала, що майже все в
  `ATBvideobrief` унікальне, а видео-репо мало свої правки (текстові супутні файли з дрібними
  редагуваннями, зроблені вже в робочій копії) — тому обидва джерела спершу скопійовано
  окремо (269 файлів, 881 МБ), а тоді очищено від дублів по SHA-1: 128 з 269 файлів були
  байт-у-байт копіями, 18 текстових файлів замінено фінальними (робоча копія) версіями
  замість чернеток, `actual/current_weekly.pdf` виявився дублем `weekly-journal-en.pdf`.
  Результат — 123 унікальні файли, 386 МБ, плоска структура по датах
  (`19-08-2026/`, `26-08-2026/`, `intro/`) у `raw/_local/video/` (gitignored); повний журнал
  злиття — `raw/_local/video/_dedup-manifest.txt`. Промастерений `atb-episode-26-08.mp4`
  (156 МБ) — у
  `artifacts/_local/video-masters/`. `ai-today-brief-video` лишився **тільки** Remotion-кодом
  (`remotion/`, `scripts/`, `public/` як слоти, `output/`); його git-історію переписано
  (`git filter-repo`), щоб прибрати важкі медіа з усієї історії. `E:\ATBvideobrief` видалено
  після підтвердженого копіювання. Деталі й повна мапа перенесених сторінок —
  [pipeline/video-boundary](pipeline/video-boundary.md).
  (source: dedup-звірка + robocopy 2026-08-28, `git filter-repo` на `ai-today-brief-video`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
