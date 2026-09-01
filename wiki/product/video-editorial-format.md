# Video — редакційна планка (жива сцена новини)

Summary: що вважається якісним weekly-відео AI Today Brief і що заборонено як «слайдшоу». Це
продуктова планка для агентів і власника; технічні слоти — у pipeline-сторінках. Об'єднує
колишні `product/editorial-format.md` і `strategy/quality-bar.md` з `ai-today-brief-video/wiki`
— вони описували ту саму планку з двох боків (детальний розбір і короткий чек-лист).
Sources: [research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md),
[weekly-digest](../pipeline/weekly-digest.md) (PR6 video_script), [video-boundary](../pipeline/video-boundary.md),
live render `ai-weekly-2026-08-09` 2026-08-18, owner feedback 2026-08-05 («жива подія на фоні,
як у теленовинах»), owner session 2026-08-27; перенесено й злито з `ai-today-brief-video/wiki`
2026-08-28
Last updated: 2026-08-27

---

> Ця сторінка описує планку `AtbWeeklyYouTube` (weekly-схема). Окрема композиція `AtbEpisode`
> (`remotion/episode/`) — самодостатній денний випуск без weekly-манифесту, з власним каноном
> (жива B-roll + анімований `GraphicGround` для типографічних беатів, ніяких статичних чорних
> екранів) — див.
> [video-remotion-compositions § AtbEpisode](../pipeline/video-remotion-compositions.md#atbepisode--окрема-композиція-без-weekly-схеми-2026-08-27).

## TL;DR — випуск не «готовий», навіть якщо MP4 технічно зібрався, без:

- чутного голосу (не тиша −91 dB);
- сцен, що тримаються мовлення, а не вигаданого `durationSeconds`;
- фону — руху події новини, не вічного JPEG;
- EN+UK субтитрів у result-маніфесті.

Рендерер `ai-today-brief-video` існує окремо від сайту саме заради цієї планки: Remotion —
важкий тулчейн з іншим циклом релізів, невиправданий у Vercel-білді.
(source: [video-boundary](../pipeline/video-boundary.md))

## Цільова картинка

Глядач бачить **репортаж**, не презентацію. Три шари одночасно:

1. **Голос** веде історію (закадр).
2. **Задній план — подія новини в русі**: image-to-video з ілюстрації *цієї* історії, або
   looped B-roll кліп у `public/broll/`. Статичний JPEG на весь хронометраж — це провал формату,
   навіть якщо Ken Burns його трохи ворушить.
3. **Красиві переходи, графіка та типографіка**: професійно зверстані кадри з цифрами, графіками та діаграмами для візуалізації даних.

Це вимога власника від 2026-08-05, не естетична примха.
(source: [research/2026-08-05-professional-ai-video-guide §5](../research/2026-08-05-professional-ai-video-guide.md))

## Що вважається провалом

Аудит німого `atb-weekly-youtube-live.mp4` (2026-08-05): AAC-доріжка існувала, але це тиша: mean
volume **−91 dB**; 6 сцен по 45–75 с тримали порожнє полотно; voiceover був **надрукований** на
екрані. Корінь: `durationSeconds` вигадував LLM під 360–480 с, а реальний
narration був ~1000 символів ≈ 97 с мовлення.
(source: той самий research §1; [weekly-digest](../pipeline/weekly-digest.md) PR6)

Правило: **тривалість сцени диктує аудіо, не навпаки (audio-first).**

## Вісім принципів (не послаблювати)

1. Audio-first: спочатку озвучка, потім хронометраж.
2. Хук ≤ 3 с: число або конфлікт, не «вітаємо».
3. Рух кожні 2–3 с. Статичний кадр > 4 с = дроп.
4. Субтитри завжди (караоке на епізоді; VTT EN+UK для YouTube).
5. Одна думка = одна сцена, орієнтир 15–25 с мовлення.
6. Музика під голосом ≈ 7% volume / близько −20 дБ від мовлення.
7. Професійні переходи та графіка: плавна зміна сцен, використання інфографіки (цифри, діаграми) для підтримки розповіді.
8. Довгий YouTube-епізод = довший narration-скрипт на сайті (ціль ~3500–4000 символів EN на
   6–8 хв), не розтягнуті паузи.

(source: [research/2026-08-05-professional-ai-video-guide §4](../research/2026-08-05-professional-ai-video-guide.md))

## Розподіл праці з сайтом

Сайт (`ai-today-brief`) пише й апрувить **сценарій** `video_script` і збирає
`weekly-video-v3` маніфест: cold open → b-roll на кожну Top 3 історію → radar →
outro, плюс 3 UK Shorts. WPS-валідатор `durationSeconds ≈ words(voiceover)/2.6 ±20%` б'є
слайдшоу ще до рендеру. (source: [weekly-digest](../pipeline/weekly-digest.md) PR6)

Рендерер (`ai-today-brief-video`): озвучка, красиві переходи, живий фон, Remotion, YouTube,
result-маніфест. Межа — [video-boundary](../pipeline/video-boundary.md).

Контрприклад, не планка: `ai-weekly-2026-08-09` L0 від 2026-08-18 — 432 с Edge TTS поверх
JPEG і on-screen тексту. Власник 2026-08-19: це не випуск.

Автоматизацію YouTube свідомо не робимо, доки не пройдуть 1–2 ручні випуски.
(source: `ai-today-brief-video/README.md`)

## Related pages

- [pipeline/video-script](../pipeline/video-script.md)
- [pipeline/video-avatar-and-voice](../pipeline/video-avatar-and-voice.md)
- [pipeline/video-motion-broll](../pipeline/video-motion-broll.md)
- [pipeline/video-boundary](../pipeline/video-boundary.md)
- [research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md)
