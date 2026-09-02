# Video — YouTube як доставка, не архів

Summary: куди їде готовий епізод, які метадані повертаються на сайт, чому Shorts окремо.
Sources: [video-boundary](video-boundary.md), `src/lib/weekly-digest/video.ts`,
`ai-today-brief-video/scripts/build-result-manifest.ts`,
[marketing/social-launch](../marketing/social-launch.md); перенесено з
`ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-09-02

---

YouTube — публічний плеєр і embed на `aitodaybrief.com`. Майстер-копія MP4 лишається локально в
`ai-today-brief-video/output/` (гітігнор) або в архіві `ai-today-brief/artifacts/_local/video-masters/`
для вже опублікованих епізодів — не в git і не «на YouTube як на диску».
(source: [video-boundary § Media retention](video-boundary.md#media-retention))

Сайт приймає лише `weekly-video-result-v2`: 11-символьний id, HTTPS thumbnail, duration
120–1200 с, captions EN+UK (URL або inline VTT). Немає поля для MP4-файла в CMS — банер Video
таба: «YouTube is the final video storage — no MP4 upload».
(source: `src/components/admin/weekly-workspace.tsx`, `src/lib/weekly-digest/video.ts`)

Custom thumbnail 1280×720 (`AtbWeeklyThumbnail`) завантажується в Studio; публічний URL
`https://i.ytimg.com/vi/<id>/maxresdefault.jpg` іде в артефакт `thumbnail`.
(source: [video-remotion-compositions](video-remotion-compositions.md))

Shorts (9:16 UK) — воронка, не CMS-гейт. Соц-запуск оцінював Shorts RPM $0.01–0.08 і застерігав
проти inauthentic-AI банів; API-аплоад лишається ручним, доки не буде compliance audit.
(source: [marketing/social-launch](../marketing/social-launch.md))

Автозаливку не плануємо до 1–2 успішних ручних випусків. L0-слайдшоу
(`ai-weekly-2026-08-09` від 2026-08-18) на YouTube **не** їде.
(source: рішення власника 2026-08-19)

## Related pages

- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [video-production-workflow](video-production-workflow.md)
- [ops/video-render-runbook](../ops/video-render-runbook.md)
