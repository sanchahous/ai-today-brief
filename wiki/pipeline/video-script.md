# Video — сценарій і граматика сцен

Summary: як сайт пише `video_script` / `weekly-video-v3` і як рендерер `ai-today-brief-video`
читає сцени. Агенти не вигадують іншу драматургію.
Sources: [weekly-digest](weekly-digest.md) (PR6, 2026-08-06), `src/lib/weekly-digest/video-script-llm.ts`,
`src/lib/weekly-digest/content-studio.ts` (`validateVideoScript`),
`ai-today-brief-video/remotion/weekly-schema.ts`, live check 2026-08-18 (`ai-weekly-2026-08-09`),
owner session 2026-08-27; перенесено з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-27

---

> Ця сторінка — про `video_script`/`weekly-video-v3` (`AtbWeeklyYouTube`). Композиція `AtbEpisode`
> не бере сценарій із сайту — сцени й таймінг фіксовані в `remotion/episode/timeline.ts`, див.
> [video-remotion-compositions § AtbEpisode](video-remotion-compositions.md#atbepisode--окрема-композиція-без-weekly-схеми-2026-08-27).

## Хто що пише

Сайт, не рендерер, генерує сценарій окремим LLM-job `video_script` (не всередині
статті — саме той мега-виклик давав німе слайдшоу). Після Approve script job `video_manifest`
збирає `weekly-video-v3` з трьома approved Top 3 `story_image` і ready cover.
(source: [weekly-digest](weekly-digest.md) PR6)

Рендерер **не редагує** `digestId`, `revisionId`, `inputHash`. Сайт відшиє result, якщо хоч
один не збігається. (source: `src/lib/weekly-digest/video.ts`)

## Драматургія теленовин (`weekly-video-v3`)

`SCENE_KINDS` у коді: `cold_open`, `anchor`, `broll`, `outro`.
(source: `remotion/weekly-schema.ts`)

Порядок, який пише `video-script-llm.ts`:

| Сцена | Роль | Типовий хронометраж у скрипті |
|---|---|---|
| `cold_open` | хук: число / конфлікт, без «вітаємо» | 15–25 с |
| `broll` (x15) | 3 топ новини по 5 сцен на кожну (вступ, процес, деталі, результат, цінність). Близько 15 відео по ~10 секунд. | ~10 с на сцену |
| radar / extra `anchor` | quick-hits | коротко |
| `outro` | discussion / CTA | короткий |

Eyebrow на рендері: `cold_open` → «Cold open»; `broll` → «Top 3 · N»; `outro` → «Your turn». (source: `remotion/weekly-schema.ts`)

B-roll **не** мапиться як `assets[index % assets.length]` — це показувало чужі картинки.
`assetForScene` бере ілюстрацію за `revisionItemId` сцени. Виправлено 2026-08-18.
(source: `remotion/AtbWeeklyYouTube.tsx`)

## WPS-гейт на сайті

`validateVideoScript`: `durationSeconds ≈ words(voiceover)/2.6 ±20%`. Плюс:

- `shorts_count` / `shorts_contract` — рівно 3 UK Shorts, факти лише зі своїх `claimIds`;
- `video_duration` — сума сцен 360–480 с **у маніфесті** (план LLM, не фінальний MP4);
- `scene_structure` — ≥3 b-roll, по одній на feature;
- `scene_story_link`;
- template-leak на voiceover/Shorts.

Audio-first рендер може дати іншу тривалість: 2026-08-18 епізод вийшов **432 с** при
manifest-оцінках, бо Edge TTS + хвіст 1.1 с диктують кадри. Сайт приймає result 300–600 с.
(source: `src/lib/weekly-digest/video.ts`, live render 2026-08-18)

## Shorts

Три вертикальні UK-роліки: `hook` / `context` / `insight` / `takeaway`. Мова в композиції
захардкоджена `"uk"`. Озвучка — `uk-UA-OstapNeural`. Планові 35–50 с у маніфесті; живі
2026-08-18 вийшли 62/69/81 с через audio-first.
(source: `remotion/AtbWeeklyShort.tsx`, [ops/video-render-runbook](../ops/video-render-runbook.md))

## Легасі v2

Рендерер приймає `weekly-video-v2` (`purpose` / `visualBrief` / `factIds`) і нормалізує в ту
саму render-форму. Нові випуски сайту — v3. (source: [video-remotion-compositions](video-remotion-compositions.md))

## Related pages

- [product/video-editorial-format](../product/video-editorial-format.md)
- [video-avatar-and-voice](video-avatar-and-voice.md)
- [video-motion-broll](video-motion-broll.md)
- [video-production-workflow](video-production-workflow.md)
