# Video — тижневий чеклист випуску (`AtbWeeklyYouTube`)

Summary: порядок ручної роботи власника/агента від апрувленого маніфесту до YouTube на $0
стеку, з аватаром і живим B-roll коли кліпи готові.
Sources: [ops/video-render-runbook](video-render-runbook.md),
[research/2026-08-05-professional-ai-video-guide §5](../research/2026-08-05-professional-ai-video-guide.md),
live прогін `ai-weekly-2026-08-09` 2026-08-18; перенесено з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-19

---

Команди й підводні камені Windows — у [ops/video-render-runbook](video-render-runbook.md). Тут —
**що не пропустити**, щоб це було репортажем, а не слайдшоу.

1. Експорт апрувленого `weekly-video-v3` з Video-таба сайту. Не чіпати
   `digestId` / `revisionId` / `inputHash`.
2. `npx tsx scripts/validate-manifest.ts <manifest.json>`
3. `npm run narration:generate -- <manifest.json>` — Edge TTS EN+UK, `narration-v1`.
4. `npx tsx scripts/generate-captions.ts <manifest>-narrated.json --emit-sentences`
   потім без прапорця — EN/UK VTT. Дописати UK-переклад, якщо JSON порожній.
5. **Живий фон:** i2v з ілюстрації кожної сцени (Hailuo/Krea) →
   `public/broll/<digestId>/scene-XX.mp4`. Рецепт —
   [pipeline/video-motion-broll](../pipeline/video-motion-broll.md).
6. **Ведучий (опційно, але в планці формату — інтро/аутро):** talking-photo/HeyGen →
   `public/avatar/<digestId>/scene-01.mp4` і `scene-0N.mp4` на outro. Деталі —
   [pipeline/video-avatar-and-voice](../pipeline/video-avatar-and-voice.md).
7. Опційно: `public/music/bed.mp3` з YouTube Audio Library.
8. `npm run media:refresh -- <manifest>-narrated.json`
9. Рендер 16:9, still-thumbnail, shorts (див. runbook). Перевірити, що аудіо не тиша
   (ffprobe volumedetect; орієнтир live 2026-08-18: mean ≈ −25 dB, не −91 dB).
10. Залити MP4 + custom thumbnail на YouTube. Shorts — окремі вертикальні файли, не гейт CMS.
11. `npx tsx scripts/build-result-manifest.ts <manifest>-narrated.json --youtube-id=<11>`
12. Paste JSON у Video → Save → Approve `video_final` / captions / thumbnail. PDF EN/UK
    стануть `stale` — перезатвердити на сайті.

Кроки 5–6 **не пропускати** перед YouTube. Тексти і промти копіюй з **Shooting package**
у Video-табі `ai-today-brief`. L0 (JPEG + текст + TTS) можна зібрати як чернетку пайплайна,
але це не випуск і не закриває CMS.
(source: рішення власника 2026-08-19, [product/video-editorial-format](../product/video-editorial-format.md))

## Related pages

- [ops/video-render-runbook](video-render-runbook.md)
- [pipeline/video-production-workflow](../pipeline/video-production-workflow.md)
- [pipeline/video-youtube-delivery](../pipeline/video-youtube-delivery.md)
