# Video — живий B-roll (рух новини, не JPEG)

Summary: як замінити статичну ілюстрацію на looped image-to-video кліп події, яку розповідає
сцена. Ресерч безкоштовних i2v-сервісів і промт-рецепт.
Sources: `ai-today-brief-video/scripts/refresh-media-slots.ts`, `remotion/AtbWeeklyYouTube.tsx`
(коміт `608b350`), [video-production-guide §5](../research/2026-08-05-professional-ai-video-guide.md),
owner feedback 2026-08-05, live check заліза 2026-08-05 (AMD, без NVIDIA), owner session
2026-08-27; перенесено з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-27

---

> Ця сторінка — про слот `public/broll/<digestId>/scene-XX.mp4` в `AtbWeeklyYouTube`. Композиція
> `AtbEpisode` бере living B-roll інакше — фіксовані кліпи під `public/episodes/<id>/video/` через
> `footage()` у `remotion/episode/timeline.ts`, не per-digest слоти — див.
> [video-remotion-compositions § AtbEpisode](video-remotion-compositions.md#atbepisode--окрема-композиція-без-weekly-схеми-2026-08-27).

## Навіщо

Власник: фон має бути **подією, що оживає**, як у теленовинах, а не карткою новини на весь
хронометраж. Ken Burns (панорама + scale) — фолбек, коли кліпа немає; він не виконує планку
[product/video-editorial-format](../product/video-editorial-format.md).
(source: research §5, owner session 2026-08-05)

Локальний Wan 2.2 / LTX-2 / ComfyUI **недоступні**: машина без NVIDIA, інтегрована AMD
512 МБ. Мінімум 12–16 ГБ VRAM для пристойного 720p. Тому — хмарні free-ліміти або сток.
(source: research §5, thundercompute.com / radiancesystems.eu 2026-08-05)

## Слот у рендері

```
public/broll/<digestId>/scene-XX.mp4
```

Кліп лупиться на всю сцену (`<Loop>` + `OffthreadVideo`) **замість** still. Індекс `scene-01`
= перша сцена маніфесту, не «перша історія». Після копіювання:

```bash
npm run media:refresh -- remotion/data/<manifest>-narrated.json
```

Скрипт пише `brollVideo` + `brollDurationSeconds` (ffprobe) у `narrationAudio.scenes[]`.
(source: `scripts/refresh-media-slots.ts`, `remotion/AtbWeeklyYouTube.tsx`)

Потреба випуску — орієнтир **6 кліпів/тиждень** (по сцені) ≈ 30 хв ручної i2v-роботи.
(source: research §5)

## Free / cheap image-to-video (web-check 2026-08-05)

| Сервіс | Free-ліміт | Вотермарка | Навіщо нам |
|---|---|---|---|
| **Hailuo 2.3** (hailuoai.video) | черга; ~200 кредитів новачку | **немає** | найбільший обсяг за $0 |
| **Kling 3.0** | 66 кредитів/день ≈ 6×5 с | є на free | найкращий рух |
| **Krea Video** | 10 кредитів/день | **немає** (Kling всередині) | UX; кілька моделей |
| **Veo 3.1** (Gemini/Flow) | 50 кредитів/день ≈ до 12 кліпів | видима «Made with Veo», 720p | запасний |
| Pexels / Pixabay / Mixkit | безліміт | немає | generic: датацентр, код, офіс — лише якщо i2v зірвався; **гірше**, ніж i2v з нашої ілюстрації |

Вотермарки **не** кропати й не замальовувати (ToS). Брати Hailuo/Krea або платити Kling.
(source: whichoneisreal.com, zevor.ai, diyai.io, mindwiredai.com, veo3ai.io — research § джерела)

Платний хвіст L3: Runway / Kling pay / Veo pay — окремий бюджет, не в дефолті.
(source: research §3)

## Промт i2v

Стартовий кадр — **ілюстрація саме цієї сцени** (approved `story_image` з маніфесту), не
стоковий кадр іншої новини.

```
subtle cinematic camera push-in, [subject of this story] slowly [the news event happening],
volumetric light, no text, loop-friendly motion, 5s
```

«No text» — та сама політика, що weekly-ілюстрації (`weekly-semantic-story-v6`): модель не
має впекти заголовки. Рух має показувати **механізм новини** (роутер MoE, memory lookup,
ліцензійний реліз), не абстрактний glow.
(source: research §5; [weekly-illustration-plan](weekly-illustration-plan.md) — ban generated_text)

5–8 с кліп лупиться; loop-friendly важливіший за «кінематографічний обрив».

## Якщо кліпа немає

Рендер не падає. Сцена показує still + Ken Burns. Це **технічний фолбек чернетки**, не
випуск. На YouTube і в CMS такий кадр не їде. Video4 (2026-08-18) зібрали саме так — власник
18.08 відхилив як «фото + текст + озвучка».
(source: рішення власника 2026-08-19, [video-boundary](video-boundary.md), `remotion/AtbWeeklyYouTube.tsx`)

## Related pages

- [product/video-editorial-format](../product/video-editorial-format.md)
- [video-avatar-and-voice](video-avatar-and-voice.md)
- [video-script](video-script.md)
- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md)
