# Video — render runbook

Summary: точні команди для сетапу, перегляду, рендеру, субтитрів і збірки result-маніфесту в
`ai-today-brief-video`; куди йде вивід; чому HeyGen/YouTube лишаються ручними.
Sources: `ai-today-brief-video/package.json`, `scripts/validate-manifest.ts`,
`scripts/render-shorts.ts`, `scripts/generate-narration.ts`, `scripts/generate-captions.ts`,
`scripts/build-result-manifest.ts`, `.gitignore`, live check 2026-08-18 (повний прогін
`ai-weekly-2026-08-09`); перенесено з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-19

---

Усі команди виконуються з кореня `ai-today-brief-video` (окремий репозиторій — лише
Remotion-код, без власної wiki з 2026-08-28; канон межі — [video-boundary](../pipeline/video-boundary.md)).

## Сетап

```bash
npm install
npm run typecheck
npm run lint
```

Для озвучки додатково: `pip install edge-tts` (Python) і `ffprobe`/`ffmpeg` у PATH.
Перевірено 2026-08-18: edge-tts 7.2.7, ffmpeg 8.1.1, node 22, python 3.11.

## Повний прогін живого випуску (порядок кроків)

Приклад — `ai-weekly-2026-08-09`, маніфест `weekly-video-v3`:

```bash
npx tsx scripts/validate-manifest.ts remotion/data/weekly-live-ai-weekly-2026-08-09.json
npm run narration:generate -- remotion/data/weekly-live-ai-weekly-2026-08-09.json
npx tsx scripts/generate-captions.ts remotion/data/weekly-live-ai-weekly-2026-08-09-narrated.json --emit-sentences
npx tsx scripts/generate-captions.ts remotion/data/weekly-live-ai-weekly-2026-08-09-narrated.json
npx remotion render remotion/index.ts AtbWeeklyYouTube output/atb-weekly-2026-08-09.mp4 --props=remotion/data/weekly-live-ai-weekly-2026-08-09-narrated.json
npx remotion still remotion/index.ts AtbWeeklyThumbnail output/atb-weekly-2026-08-09-thumbnail.png --props=remotion/data/weekly-live-ai-weekly-2026-08-09-narrated.json
npm run render:shorts -- remotion/data/weekly-live-ai-weekly-2026-08-09-narrated.json
```

Фактичні числа прогону 2026-08-18: 12 967 кадрів, ~9 хв рендеру, 432с / 122 МБ /
1920×1080 / h264+aac, аудіо mean −24.8 dB. Shorts — 62/69/81с (довші за планові 37/44/48с у
маніфесті, бо audio-first таймінг рахує довжину від реального UK-мовлення, а не від оцінки LLM).

## Перегляд у Remotion Studio

```bash
npm run studio            # порожній index, без дефолтних пропсів
npm run studio:weekly     # з sample.weekly.json
```

## Рендер на sample/demo-даних

```bash
npm run render:demo       # легасі AtbNewsVertical, sample.uk.json → output/atb-demo-uk.mp4
npm run render:weekly     # AtbWeeklyYouTube, sample.weekly.json → output/atb-weekly-youtube.mp4
npm run render:shorts     # 3× AtbWeeklyShort, sample.weekly.json → output/atb-weekly-short-{1,2,3}.mp4
npm run validate:manifest # перевіряє remotion/data/sample.weekly.json за замовчуванням
```

## Рендер на реальному маніфесті

`validate:manifest` і `render:shorts` приймають шлях аргументом:

```bash
npm run validate:manifest -- path/to/manifest.json
npm run render:shorts -- path/to/manifest-narrated.json
```

`render:weekly` — це фіксований `remotion render` виклик із
`--props=remotion/data/sample.weekly.json` прямо в самому npm-скрипті (`package.json`) — для
іншого файлу викликати Remotion CLI напряму, а не через npm-скрипт:

```bash
npx remotion render remotion/index.ts AtbWeeklyYouTube output/<назва>.mp4 --props=path/to/manifest.json
```

Ніколи не редагувати `digestId`, `revisionId`, `inputHash` у переданому маніфесті — сайт звірить
їх один-в-один при імпорті результату. (source: `README.md`)

## Озвучка

```bash
npm run narration:generate                       # live-маніфест за замовчуванням
npm run narration:generate -- path/to/manifest.json --voice-en=... --voice-uk=... --rate=+0%
```

Пише MP3 у `public/narration/<digestId>/` (гітігнорено) і `<manifest>-narrated.json` з блоком
`narrationAudio` (аудіо, тривалості, word-таймінги). Далі:

```bash
npm run render:weekly:narrated                   # 16:9 з озвучкою і audio-first таймінгом
npm run render:shorts -- path/to/manifest-narrated.json   # 9:16 UK з озвучкою
```

Edge TTS повертає word boundaries без пунктуації, тому `alignWords` зіставляє кожен boundary з
токеном джерела. Дві пастки, полагоджені 2026-08-18: токен `—` нормалізується в порожній рядок і
через `target.includes(candidate)` «з'їдав» наступне справжнє слово (втрачалось 11 слів на
випуск); а на десяткових числах (`Qwen3.8`, `GPT-5.6`) TTS видає окремий boundary для `.` і для
цифри, що розривало речення надвоє. Покриття після фіксу — 1000 з 1001 слова.
(source: `scripts/generate-narration.ts`, live check 2026-08-18)

Drop-in слоти: `public/avatar/<digestId>/scene-XX.mp4` — HeyGen-кліп стає PiP-карткою сцени й
замінює її TTS-доріжку; `public/broll/<digestId>/scene-XX.mp4` — відео замість ілюстрації;
`public/music/bed.mp3` — музична підкладка лупом на 7% гучності.
Канон: [pipeline/video-avatar-and-voice](../pipeline/video-avatar-and-voice.md),
[pipeline/video-motion-broll](../pipeline/video-motion-broll.md). Драбина ціна/якість —
[research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md).
Тижневий порядок кроків — [ops/video-weekly-checklist](video-weekly-checklist.md).

## Субтитри EN/UK

```bash
npx tsx scripts/generate-captions.ts <manifest>-narrated.json --emit-sentences  # 1) каркас EN-речень
npx tsx scripts/generate-captions.ts <manifest>-narrated.json                   # 2) обидва VTT
```

EN VTT будується з word-таймінгів Edge TTS, згрупованих у ті самі караоке-фрази, що й burned-in
субтитри. UK VTT — це переклад, який неможливо протаймити з аудіо (long form озвучується лише
англійською), тому він вирівнюється **по реченнях** проти EN-таймінгів. Переклад лежить у
`<manifest>-uk-captions.json` і мусить мати рівно стільки речень на сцену, скільки EN — інакше
скрипт падає з помилкою, бо субтитр, що поїхав по таймінгу, гірший за відсутній. Задовгі UK-cue
(>84 символів) ріжуться пропорційно символам у межах вікна свого речення.

Прогін 2026-08-18: 47 EN-речень → 186 EN-cue і 126 UK-cue.

Для `AtbEpisode` субтитри йдуть іншим шляхом — з ASR-транскрипту, не з TTS word-таймінгів, див.
[pipeline/video-remotion-compositions § Субтитри](../pipeline/video-remotion-compositions.md#субтитри-enuk--обовязкова-частина-релізу-2026-08-28).

## Мініатюра

```bash
npx remotion still remotion/index.ts AtbWeeklyThumbnail output/<назва>-thumbnail.png --props=<manifest>-narrated.json
```

1280×720. Заголовок — `onScreenText` cold open (короткий, числовий); перекрити можна пропсом
`thumbnailHeadline`. Файл завантажується на YouTube як custom thumbnail, після чого
`https://i.ytimg.com/vi/<id>/maxresdefault.jpg` віддає саме його — і цей URL іде в артефакт
`thumbnail` на сайті.

## Result-маніфест для сайту

```bash
npx tsx scripts/build-result-manifest.ts <manifest>-narrated.json --youtube-id=<11 симв> \
  --video=output/<назва>.mp4 --published-at=<ISO>
```

Пише `<manifest>-result.json` (`weekly-video-result-v2`): `digestId`/`revisionId`/`inputHash`
копіюються з пропсів рендеру, тривалість — з `ffprobe` по MP4, субтитри вставляються **inline**
(сайт приймає URL або inline VTT; inline знімає потребу хостити два файли). Вміст файлу
вставляється у Video → «Render result manifest» → **Save video workspace**.

Після імпорту сайт створює чотири артефакти (`video_final`, `captions:en`, `captions:uk`,
`thumbnail`) у стані `in_review` — власник апрувить кожен окремо. Збереження `video_final` за
дизайном RPC `save_weekly_digest_artifact` ставить `pdf` у `stale`, тому PDF EN/UK доведеться
перезатвердити. (source: `ai-today-brief` RPC `save_weekly_digest_artifact`, live check 2026-08-18)

## Куди йде вивід

`output/` — у `.gitignore`, не комітиться. Містить кінцеві MP4, мініатюри й прев'ю-PNG.
YouTube — платформа доставки, не архів майстер-копій. Опубліковані/промастерені епізоди
архівуються в `ai-today-brief/artifacts/_local/video-masters/`; проміжні/L0-чернетки — ні
(source: [pipeline/video-boundary § Media retention](../pipeline/video-boundary.md#media-retention)).

Файли `<manifest>-narrated.json`, `-en-sentences.json`, `-captions-*.vtt`, `-result.json`
живуть у `remotion/data/` поруч із маніфестом — це вхід рендеру, а не деліверабл.

## HeyGen / YouTube

`.env.example` навмисно порожній (лише коментар) — жодної автоматизації ще не підключено.
HeyGen avatar-наратив і заливка на YouTube виконуються власником вручну поза цим репозиторієм.
Без HeyGen випуск повністю робочий: Edge TTS дає голос на всі сцени (драбина L0, $0).

## Related pages

- [pipeline/video-production-workflow](../pipeline/video-production-workflow.md)
- [ops/video-weekly-checklist](video-weekly-checklist.md)
- [pipeline/video-avatar-and-voice](../pipeline/video-avatar-and-voice.md)
- [pipeline/video-motion-broll](../pipeline/video-motion-broll.md)
- [pipeline/video-youtube-delivery](../pipeline/video-youtube-delivery.md)
- [pipeline/video-remotion-compositions](../pipeline/video-remotion-compositions.md)
