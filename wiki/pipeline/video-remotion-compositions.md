# Video — Remotion-композиції

Summary: композиції рендерера `ai-today-brief-video`, їх вхідні дані, timing/fps, і схеми
`weekly-video-v2`/`weekly-video-v3`/`weekly-video-result-v2`. Решта цієї сторінки описує лише
композиції, керовані `WeeklyVideoManifest` — `AtbEpisode` — окрема, самодостатня композиція з
власною моделлю даних, див. §«AtbEpisode» нижче.
Sources: `ai-today-brief-video/remotion/Root.tsx`, `AtbWeeklyYouTube.tsx`, `AtbWeeklyShort.tsx`,
`AtbWeeklyThumbnail.tsx`, `AtbNewsVertical.tsx`, `timing.ts`, `types.ts`, `narration.ts`,
`weekly-schema.ts`, `episode/Episode.tsx`, `episode/timeline.ts`,
live check 2026-08-18 (рендер `ai-weekly-2026-08-09`), owner session 2026-08-27 (`atb-episode-26-08`),
owner session 2026-08-28 (обкладинка + субтитри); перенесено з `ai-today-brief-video/wiki` 2026-08-28
(консолідація трьох відео-папок в один репозиторій)
Last updated: 2026-08-28

---

> Цей репозиторій (`ai-today-brief-video`) з 2026-08-28 містить **лише** Remotion-код
> (`remotion/`, `scripts/`, `public/` як слоти, `output/` git-ignored) — без власної wiki/raw.
> Уся документація рендерера живе тут. Канон межі відповідальності —
> [video-boundary](video-boundary.md).

## Композиції (`remotion/Root.tsx`)

| ID | Компонент | Розмір | Джерело даних |
|---|---|---|---|
| `AtbNewsVertical` | `AtbNewsVertical.tsx` | 1080×1920 (`timing.ts`) | легасі `AtbVideoProps` (одна новина, `sample.uk.json`) |
| `AtbEpisode` | `episode/Episode.tsx` | 1920×1080, 30fps | без пропсів — читає `remotion/data/episode-<id>.media.json` напряму, див. §«AtbEpisode» |
| `AtbWeeklyYouTube` | `AtbWeeklyYouTube.tsx` | 1920×1080, `420 × VIDEO_FPS` за замовчуванням | `WeeklyVideoManifest` (весь маніфест) |
| `AtbWeeklyThumbnail` | `AtbWeeklyThumbnail.tsx` | 1280×720, 1 кадр | `WeeklyVideoManifest` + опційний `thumbnailHeadline` |
| `AtbWeeklyShort1..3` | `AtbWeeklyShort.tsx` | 1080×1920 (`timing.ts`) | `WeeklyVideoManifest & { shortIndex: 0\|1\|2 }` |

## `AtbEpisode` — окрема композиція, без weekly-схеми (2026-08-27)

Самодостатній «денний випуск» під `remotion/episode/`: не приймає пропси, не проходить через
`WeeklyVideoManifest`/Zod-валідацію, не має `calculateMetadata`. Тривалість і всі таймінги
рахуються з `remotion/data/episode-<id>.media.json` (пише `scripts/probe-episode-media.mjs` з
narration MP3 і b-roll MP4) — `remotion/episode/timeline.ts` будує `TIMELINE`/`SPEECH_SPANS`/
`MUSIC_LIFTS` з цього файлу, без ручних оцінок довжини.

Сцени монтуються в `Episode.tsx` за `SceneId`: `cold-open` → `opener` (фіксований 240f/8с
брендований інтро-ролик, без narration) → `intro` → `codex` → `claude` → `nvidia` → `radar` →
`outro`. Кожна «історійна» сцена (`codex`/`claude`/`nvidia`/`radar`) ріже свою тривалість
мовлення на рівні беати (`VideoBeat` — живе відео) або `GraphicGround` (типографічний беат:
анімований фон — панорамна hairline-сітка + два teal-відблиски, не статичний чорний екран).
Музика — `MusicBed.tsx`, один-до-одного зі сценами, з ducking/lift по реальних паузах мовлення
(`MUSIC_LIFTS`), не по fixed-відсотку: під голосом 22% (`MUSIC_DUCK`), у паузах 55%
(`MUSIC_LIFT`) — значення виправлено 2026-08-27, до цього було 15%/40% і музику було майже не
чути.

Рендер: `npm run render:episode` (фіксований виклик у `package.json`, без `--props`).
Дані/медіа під `remotion/data/episode-*.media.json` і `public/episodes/<id>/` — не описані в
жодній іншій сторінці цього розділу; [video-script](video-script.md),
[video-avatar-and-voice](video-avatar-and-voice.md), [video-motion-broll](video-motion-broll.md),
[video-editorial-format](../product/video-editorial-format.md) стосуються лише
`AtbWeeklyYouTube`/weekly-схеми.
(source: owner session 2026-08-27, `remotion/episode/Episode.tsx`, `remotion/episode/timeline.ts`,
`remotion/episode/components/MusicBed.tsx`, `remotion/episode/components/Layout.tsx`)

### Обкладинка (thumbnail) — обов'язкова частина релізу (2026-08-28)

**Кожен випуск `AtbEpisode` має мати власну обкладинку для YouTube, згенеровану разом з
епізодом — не окремим кроком «колись потім».** Чеклист —
[video-production-workflow § Інтеграція в Remotion](video-production-workflow.md#інтеграція-в-remotion).

Станом на 2026-08-28 робочого шляху рендеру **немає**. `remotion/episode/thumbnail/Thumbnail.tsx`
існує в коді, але: (1) не зареєстрований як `<Composition>` у `Root.tsx` — `remotion render`/`still`
не бачить такого id; (2) осиротілий від скасованого епізоду 19 серпня — фон
`episodes/2026-08-19/images/thumbnail-bg.jpg` (файла вже нема на диску) і цифри
`2.4T TOTAL PARAMETERS` / `95B ACTIVE PER TOKEN` про Qwen3.8, без стосунку до історій поточного
випуску. Компонент можна взяти за відправну точку композиції (wordmark + великий stat +
label-пара «ціле/активна частина»), але фон і цифри треба міняти під кожен реальний випуск.

Власник надав приклад цільового вигляду (owner-скрін 2026-08-28): wordmark угорі-зліва, великий
білий stat-заголовок на 2–4 рядки, teal pill-бейдж + короткий підпис знизу-зліва, фотореалістичний
фон справа, темний scrim зліва для читабельності. Той конкретний приклад — рендер **старої
weekly-мініатюри** (`WEEKLY DIGEST · 3 top stories · 3 shorts`), не готовий макет під `AtbEpisode`:
формат епізоду (`cold-open`/`codex`/`claude`/`nvidia`/`radar`/`outro`) інший за weekly (3 історії +
shorts), тож бейдж/підпис під нього треба скласти окремо, а не копіювати текст з прикладу.
(source: owner session 2026-08-28, `remotion/episode/thumbnail/Thumbnail.tsx`, `remotion/Root.tsx`)

### Субтитри EN/UK — обов'язкова частина релізу (2026-08-28)

**Кожен випуск `AtbEpisode` має мати субтитри англійською й українською, згенеровані разом з
епізодом.** Чеклист —
[video-production-workflow § Інтеграція в Remotion](video-production-workflow.md#інтеграція-в-remotion).

На відміну від `AtbWeeklyYouTube` (де EN-таймінги йдуть з word boundaries Edge TTS —
[video-avatar-and-voice](video-avatar-and-voice.md)), наратив `AtbEpisode` — готові MP3
без слово-таймінгів, тож EN-доріжка йде з ASR-транскрипту
(`remotion/data/episode-<id>.transcript.json`), не з TTS. Це вже робили для скасованого епізоду
19 серпня — скрипт `scripts/build-episode-captions.mjs` (відновлений з видаленої гілки
`claude/remotion-final-video-19-08-4eae15`, коміт `b219e50`) читає транскрипт + `timeline.ts`
(`LEAD_FRAMES`/`HANDLE_FRAMES`) + `episode-<id>.media.json`, рахує абсолютний час кожного
ASR-сегмента на таймлайні епізоду, ріже нерозбірливі шматки (`DROP_SPANS`) і виправляє
хибнопочуті терміни (`CORRECTIONS` — список специфічний для кожного випуску, під нові
продукти/назви переписувати заново). UK — не друга транскрипція, а переклад, вирівняний
сегмент-в-сегмент проти EN-таймінгів (`episode-<id>-uk-captions.json`); кількість сегментів має
збігатися один-в-один з EN, інакше скрипт падає.

Прогін для `atb-episode-26-08` (2026-08-28): транскрипт faster-whisper "small", 72 EN cue,
77 UK cue (переклад сегмент-в-сегмент). ASR систематично плутав «cache»/«write» з «cash»/«right»
— виправлено звіркою з текстом на екрані самих сцен (`CACHE WRITES`, `CLAUDE CODE` тощо). Два
фрагменти в сцені 05 (`Jetson optimized memory`, `CU opt install`) — імена конкретних skill-ів з
розповіді — **не перевірені** незалежно, ASR міг почути неточно. Обидва `.vtt` пройшли перевірку
конвертацією через `ffmpeg` (VTT → SRT) без помилок на обох мовах.
(source: owner session 2026-08-28, `scripts/build-episode-captions.mjs`,
`remotion/episode/timeline.ts`)

`calculateMetadata` на weekly-композиціях валідує пропси через `validateWeeklyVideoManifest`
(Zod) — некоректний маніфест ламає рендер ще на етапі метаданих, до першого кадру.
`durationInFrames` беруться з озвучки (`weeklyDurationInFrames` / `computeShortTiming`), а без
неї — із суми `scene.durationSeconds`. (source: `remotion/Root.tsx`)

`AtbWeeklyShort` — тонка обгортка над легасі `AtbNewsVertical`: бере `manifest.shorts[shortIndex]`
+ відповідний `assets[].url` за `revisionItemId` і мапить у старий `AtbVideoScript`
(`hook`/`context`/`insight`/`takeaway`). Мова хардкодиться `"uk"`. (source:
`remotion/AtbWeeklyShort.tsx`)

`AtbWeeklyThumbnail` — не кадр із відео: мініатюра має читатись у розмірі сайдбару, тому несе
короткий заголовок cold open (числовий), а не повний редакційний title, і не малює прогрес-бар,
субтитри й рядок джерел. YouTube віддає завантажену custom-мініатюру за
`i.ytimg.com/vi/<id>/maxresdefault.jpg` — саме цей URL сайт зберігає в артефакт `thumbnail`.
(source: `remotion/AtbWeeklyThumbnail.tsx`)

## `AtbWeeklyYouTube` — деталі рендеру

Послідовність `<Sequence>` по `manifest.longForm.scenes` (перша сцена = `Opening`, решта —
`EditorialScene`). Показує `manifest.title`/`theme`/`scene.onScreenText`/`scene.eyebrow`,
картинку історії та рядок джерел у хедері.

**Аудіо є** (з 2026-08-05): коли пропси містять блок `narrationAudio`, кожна сцена отримує
`<Audio>` з Edge TTS-доріжкою, довжина сцени рахується від аудіо (`sceneDurationInFrames` =
lead + мовлення + `SCENE_TAIL_SECONDS` 1.1с), і поверх малюються караоке-субтитри з
word-таймінгів. Без `narrationAudio` композиція лишається німим слайдшоу з абзацем `voiceover`
на екрані. Drop-in слоти: `public/avatar/<digestId>/scene-XX.mp4` (HeyGen-кліп замінює
TTS-доріжку сцени), `public/broll/…` (відео замість статичної ілюстрації), `public/music/bed.mp3`
(підкладка на 7%). (source: `remotion/AtbWeeklyYouTube.tsx`, `remotion/narration.ts`, live check
2026-08-18: 432с, аудіо mean −24.8 dB)

Картинка сцени вибирається через `assetForScene`: сцена `kind: broll` несе власний
`revisionItemId` і отримує ілюстрацію **своєї** історії; решта сцен циклічно беруть із
схваленого набору. До 2026-08-18 мапінг був `assets[index % assets.length]`, через що b-roll
сцени показували чужі картинки. (source: `remotion/weekly-schema.ts`, `remotion/AtbWeeklyYouTube.tsx`)

Хедер має власний градієнт-щит зверху кадру: арт сцени займає праві 53%, і без нього рядок
`Sources:` тонув у зображенні — а `attributionRequired: true` у маніфесті означає, що атрибуція
мусить читатись. (source: `remotion/AtbWeeklyYouTube.tsx`)

## `timing.ts` — константи

```
VIDEO_FPS = 30
VIDEO_WIDTH = 1080, VIDEO_HEIGHT = 1920   // дефолт для Shorts/легасі-композиції
TIMING = { intro 0-210, context 210-240, insight 450-300, takeaway 750-240, outro 990-120 }  // кадри легасі-композиції
VIDEO_DURATION = 1110 кадрів (= 37s @ 30fps)  // легасі-композиція, НЕ Shorts/Weekly
```

`AtbWeeklyYouTube` (1920×1080) і `AtbWeeklyThumbnail` (1280×720) перевизначають розмір напряму
в `<Composition>`, Shorts успадковують `VIDEO_WIDTH`/`VIDEO_HEIGHT` з `timing.ts` (1080×1920).
(source: `remotion/timing.ts`, `remotion/Root.tsx`)

## Схема даних (`remotion/weekly-schema.ts`)

`weeklyVideoManifestSchema` — **discriminated union** за `schemaVersion`, приймає обидві
генерації маніфесту:

| | `weekly-video-v2` (легасі) | `weekly-video-v3` (живий з 2026-08) |
|---|---|---|
| сцена | `purpose`, `visualBrief`, `factIds[]` | `kind` (`cold_open`/`anchor`/`broll`/`outro`), `scenePrompt`, `revisionItemId` |

Спільне для обох: `digestId`/`revisionId` (UUID), `inputHash` (64-hex), `title`, `theme`,
`sourceUrls[]`, `longForm` (locale `en`, `targetDurationSeconds` 360–480, `narration`,
`scenes[]` ≥4, `durationSeconds` ≤180), `shorts` — рівно 3 (`locale: uk`,
`hook`/`context`/`insight`/`takeaway`/`factIds[]`, `durationSeconds` 35–50), `assets[]`
(`artifactId`/`revisionItemId`/`url`/`altText`/`attribution`), `captions.required` (en+uk),
`attributionRequired: true`. `superRefine` перевіряє: сума `scenes[].durationSeconds` у межах
360–480с, і кожен `shorts[].revisionItemId` має відповідний `assets[]`-запис.

`validateWeeklyVideoManifest` нормалізує будь-яку з версій в одну render-форму (`RenderScene`
з полями `eyebrow`/`evidence`/`revisionItemId`), тому композиції не розгалужуються за версією
схеми. Нормалізація торкається **лише** презентаційних полів — `digestId`, `revisionId`,
`inputHash` проходять незмінними, бо сайт звіряє їх один-в-один при імпорті результату.
Для v3 `eyebrow` виводиться з таксономії: `cold_open` → «Cold open», `broll` → «Top 3 · N»,
`anchor` → «In the studio» / «On the radar» (за `id`), `outro` → «Your turn».

Маніфест генерується на боці сайту — `src/lib/weekly-digest/generation-worker.ts`
(`generateVideoManifest`) і константа `WEEKLY_VIDEO_MANIFEST_VERSION` у
`src/lib/weekly-digest/content-studio.ts`. Результат (`weekly-video-result-v2`) валідується у
`src/lib/weekly-digest/video.ts`: тривалість 300–600с, YouTube-id 11 символів, HTTPS-мініатюра,
EN+UK субтитри (URL **або** inline VTT).

## Related pages

- [video-boundary](video-boundary.md)
- [video-script](video-script.md)
- [video-avatar-and-voice](video-avatar-and-voice.md)
- [video-motion-broll](video-motion-broll.md)
- [video-production-workflow](video-production-workflow.md)
- [ops/video-render-runbook](../ops/video-render-runbook.md)
