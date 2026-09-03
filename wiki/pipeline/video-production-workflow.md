# Video — виробничий флоу

Summary: два окремі флоу монтажу в `ai-today-brief-video`: (A) `AtbWeeklyYouTube` —
маніфест-driven, іде від апрувленого weekly-дайджесту сайту; (B) `AtbEpisode` — creator-driven,
власник вручну складає озвучку/аватар/кліпи у робочій директорії за фіксованою структурою.
Не плутати одне з іншим — різні композиції, різні входи.
Sources: `ai-today-brief-video/README.md`, [video-boundary](video-boundary.md),
[ops/video-render-runbook](../ops/video-render-runbook.md), live check 2026-08-18; проста
модель від власника (колишній `E:\ATBvideobrief\26-08-2026\ПОЧНИ-ТУТ.md`); структура робочої
директорії (колишній `ai-today-brief-video/wiki/ops/creator-materials-guide.md`, owner session
2026-08-28); перенесено й злито 2026-08-28 (консолідація трьох відео-папок в один репозиторій)
Last updated: 2026-08-28

---

## A. Weekly-дайджест (`AtbWeeklyYouTube`) — 7 кроків від маніфесту

1. Експортувати апрувлений, версійований `weekly-video-v3` маніфест із сайту (Video-таб
   `/admin/weekly/[id]` → Approve version на артефакті `video_manifest`). Легасі v2
   рендерер також приймає. (source: [video-remotion-compositions](video-remotion-compositions.md))
2. `npm run validate:manifest -- path/to/manifest.json` — розбіжність або відсутнє зображення
   для якоїсь із Top 3 історій = hard stop (див. [ops/video-render-runbook](../ops/video-render-runbook.md)).
3. Згенерувати озвучку: `npm run narration:generate -- path/to/manifest.json` (Edge TTS, $0).
   Ведучий — drop-in PiP (`public/avatar/<digestId>/scene-XX.mp4`); живий фон —
   `public/broll/…`. Без кліпів рендер робочий, але це L0, не планка формату.
   (source: [video-avatar-and-voice](video-avatar-and-voice.md), [video-motion-broll](video-motion-broll.md))
4. Субтитри: `scripts/generate-captions.ts` (EN з word-таймінгів, UK з
   `<manifest>-uk-captions.json`). Відрендерити 16:9 master, still-thumbnail і 3× Shorts.
   Перед рендером: `npm run media:refresh`, якщо поклали аватар/B-roll/музику.
5. Залити апрувлений епізод + custom thumbnail на YouTube **вручну**.
6. Зібрати `weekly-video-result-v2` через `scripts/build-result-manifest.ts --youtube-id=…`
   (`digestId`/`revisionId`/`inputHash` копіюються з пропсів, VTT інлайном) — вставляється
   назад у Video-таб сайту (`saveWeeklyVideoAction`, поле «Render result manifest»).
7. Сайт відхилить результат, якщо хоч один з трьох незмінних ідентифікаторів не збігається з
   апрувленим маніфестом (`validateWeeklyVideoResultManifest`, `src/lib/weekly-digest/video.ts`).

### Що автоматизовано, що ручне

| Крок | Статус |
|---|---|
| Генерація маніфесту (сайт) | ✅ автоматично (LLM job `video_manifest`, жива схема `weekly-video-v3`) |
| Валідація маніфесту (рендерер) | ✅ автоматично (`validate:manifest`) |
| Озвучка Edge TTS | ✅ автоматично (`narration:generate`) |
| HeyGen / talking-photo аватар | 🔴 вручну, слот PiP; без нього випуск робочий (L0) |
| i2v B-roll | 🔴 вручну, Hailuo/Krea; без нього — Ken Burns (фолбек) |
| Рендер 16:9 + Shorts + thumbnail | ✅ автоматично (Remotion CLI), **з аудіо** якщо є `narrationAudio` |
| Субтитри EN/UK | ✅ автоматично (`generate-captions.ts`); UK-переклад — редагований JSON |
| Заливка на YouTube | 🔴 вручну |
| Збірка result-маніфесту | ✅ майже: скрипт, але потрібен YouTube-id |
| Імпорт результату назад у сайт | 🔴 вручну (paste JSON у Video-таб) |

---

## B. Епізод (`AtbEpisode`) — ручна робоча директорія креатора

На відміну від A, `AtbEpisode` не бере сценарій/маніфест із сайту. Власник сам записує/генерує
озвучку, аватар-кліпи й B-roll у робочій папці на диску, звідти все копіюється в
`ai-today-brief-video/public/episodes/<id>/` і монтується.

### Проста модель (орієнтир, чотири роботи по порядку)

Найпростіший спосіб тримати це в голові — чотири окремі задачі, кожна в своїй папці:

1. **Озвучка** — весь епізод голосом: N текстів → N аудіофайлів,
   ціль ~5 хв.
2. **Графіка** — кадри з цифрами, графіками та діаграмами для візуалізації.
3. **Кліпи** — німі B-roll-ролики для кожної історії (типово: початок / процес / результат /
   сенс / цінність).
4. **Монтаж** — коли є голос + кліпи, віддати інструкцію в Remotion.

Назва сервісу (Eleven Labs, HeyGen, Artlist, Hailuo…) не важлива — текст і промпти ті самі
незалежно від того, в якому інструменті їх згенеровано.

### Стандартна структура папок (Creator Guide, формат 2.0)

Для кожного нового випуску — папка з датою у форматі `DD-MM-YYYY`:

```text
<робоча-папка>\DD-MM-YYYY\
│
├── intro\
│   ├── intro-bg.mp4        # Згенероване відео-тло для інтро (рівно 8 секунд, 16:9).
│   └── intro-vo.mp3        # Дикторська озвучка для інтро (наприклад, з ElevenLabs).
│
├── music\
│   └── energetic\          # Набір драйвових/енергійних треків для фону.
│       ├── track-1.mp3     # Бажано мати 5-8 різних треків.
│       └── ...
│
├── avatar\
│   ├── scene-02-avatar.mp4 # Вертикальне відео ведучого з HeyGen (на хромакеї або чорному фоні).
│   ├── scene-02-audio.mp3  # Оригінальна озвучка ведучого (для ідеального ліп-синку).
│   ├── scene-06-avatar.mp4
│   ├── scene-06-audio.mp3
│   ├── scene-07-avatar.mp4
│   └── scene-07-audio.mp3
│
└── broll\
    ├── claude-початок.mp4  # Згенеровані відео-вставки (B-Roll) для кожної сцени.
    ├── nvidia-процес.mp4
    └── ...
```

Робоча папка (раніше `E:\ATBvideobrief\`) з 2026-08-28 — `ai-today-brief/raw/_local/video/`
(gitignored, за конвенцією [CLAUDE.md](../../CLAUDE.md)). Матеріали 19-08 і 26-08-2026 архівовано
там під час консолідації.

### Інтеграція в Remotion

1. **Імпорт медіа:** скопіювати всі файли з робочої папки випуску в `ai-today-brief-video/public/episodes/DD-MM-YYYY/`:
   - Інтро: `public/episodes/DD-MM-YYYY/video/intro-bg.mp4`
   - Озвучка інтро: `public/episodes/DD-MM-YYYY/video/voice/intro-vo.mp3`
   - Музика: `public/episodes/DD-MM-YYYY/audio/energetic/*.mp3`
   - Аватар і звук: `public/episodes/DD-MM-YYYY/video/avatar/`
2. **Оновити Timeline:** переконатись, що в `remotion/episode/timeline.ts` налаштовані
   правильні довжини для кожної сцени відповідно до нових аудіофайлів.
3. **Мапінг B-Roll:** перевірити `episode-DD-MM-YYYY.media.json`, щоб ключі футажів збігалися
   з іменами B-Roll відео, уникаючи дублювання кадрів у сусідніх сценах.
4. **Рендер:** `npm run render:episode` (або попередньо перевірити через `npm run studio`).
5. **Обкладинка (thumbnail) — ОБОВ'ЯЗКОВО:** кожен випуск отримує власну YouTube-обкладинку
   разом з епізодом, не окремим кроком «колись потім». Деталі —
   [video-remotion-compositions § Обкладинка](video-remotion-compositions.md#обкладинка-thumbnail--обовязкова-частина-релізу-2026-08-28).
6. **Субтитри EN/UK — ОБОВ'ЯЗКОВО:** кожен випуск отримує субтитри англійською й українською
   разом з епізодом. Пайплайн (ASR-транскрипт → корекції → EN VTT → переклад сегмент-в-сегмент
   → UK VTT) — [video-remotion-compositions § Субтитри](video-remotion-compositions.md#субтитри-enuk--обовязкова-частина-релізу-2026-08-28).

### Ключові принципи формату 2.0

- **Аватар:** більше не «картинка в картинці». Аватар відображається на повен зріст у правій
  частині екрану, плавно зливаючись із фоном студії (CSS-маска `linear-gradient`). Обов'язково
  використовувати аудіо з HeyGen, щоб уникнути розсинхрону.
- **Музичний мікс:** `MusicBed.tsx` динамічно міксує енергійні треки під кожну конкретну сцену,
  у всіх сценах (не лише в інтро). Під голосом музика приглушується до **22%** (`MUSIC_DUCK`), а
  в реальних паузах мовлення (`MUSIC_LIFTS`) піднімається до **55%** (`MUSIC_LIFT`). Значення
  оновлено 2026-08-27 — до цього було 15%/40%, і музику на слух було майже не чути.
- **Процедурне інтро:** замість накладання тексту на відео, текст `AI TODAY BRIEF` рендериться
  React'ом з кібер-ефектами (RGB glitch, floating HUD) поверх `intro-bg.mp4`.

## Related pages

- [video-boundary](video-boundary.md)
- [video-remotion-compositions](video-remotion-compositions.md)
- [video-script](video-script.md)
- [ops/video-render-runbook](../ops/video-render-runbook.md)
- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [video-youtube-delivery](video-youtube-delivery.md)
