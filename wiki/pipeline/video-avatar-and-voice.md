# Video — аватар і озвучка

Summary: як з'являється голос і ведучий у кадрі: Edge TTS за замовчуванням, PiP-слот під
HeyGen/Vidnoz, коли кліп покладено в `public/avatar/`.
Sources: `ai-today-brief-video/remotion/narration.ts`, `AtbWeeklyYouTube.tsx`,
`scripts/generate-narration.ts`, `scripts/refresh-media-slots.ts`,
[video-production-guide](../research/2026-08-05-professional-ai-video-guide.md),
[weekly-digest](weekly-digest.md) (anchor = HeyGen-слот), owner session 2026-08-27; перенесено
з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-27

---

> Ця сторінка — про `narration-v1`/Edge TTS-контракт `AtbWeeklyYouTube`. Композиція `AtbEpisode`
> має свою озвучку й свій анімований фон для сцен без відео (`GraphicGround`) — див.
> [video-remotion-compositions § AtbEpisode](video-remotion-compositions.md#atbepisode--окрема-композиція-без-weekly-схеми-2026-08-27).

## За замовчуванням — голос без студії ($0)

`npm run narration:generate` (Edge TTS, `pip install edge-tts`):

| Locale | Голос | Де грає |
|---|---|---|
| EN | `en-US-AndrewMultilingualNeural` | 16:9 епізод |
| UK | `uk-UA-OstapNeural` | 3 Shorts |

Пише MP3 у `public/narration/<digestId>/` (гітігнор) і блок `narrationAudio` версії
`narration-v1` у `*-narrated.json`: кліпи, word boundaries, голоси.
(source: `scripts/generate-narration.ts`, `remotion/narration.ts`)

Audio-first: кадри сцени = lead + тривалість кліпу + хвіст **1.1** с
(`SCENE_TAIL_SECONDS`). Відкриття має extra lead 0.6 с. Мінімум 3 с на сцену.
(source: `remotion/narration.ts`)

Караоке-субтитри (`remotion/Captions.tsx`) підсвічують активне слово — стандарт утримання в
стрічці без звуку. Word-align: тире `—` нормалізується в порожній рядок і без фіксу «з'їдало»
наступне слово; десяткові (`Qwen3.8`) Edge TTS ріже на `.` + цифру. Після фіксу 2026-08-18
покриття 1000/1001 слова.
(source: `scripts/generate-narration.ts`, live check 2026-08-18)

YouTube-VTT: `scripts/generate-captions.ts` — EN з тих самих фраз, UK з
`<manifest>-uk-captions.json` (рівно стільки речень на сцену, інакше скрипт падає).
(source: [ops/video-render-runbook](../ops/video-render-runbook.md))

## Ведучий у кадрі — drop-in у коді, обов'язковий для випуску

Телевізійний стандарт, який ми беремо: аватар **лише інтро й аутро** (схеми `cold_open` /
`anchor` на старті та `outro`). Середину несе B-roll + закадр. На випуск треба ~40–60 с
аватара, не 7 хвилин губ.
(source: [video-production-guide §5](../research/2026-08-05-professional-ai-video-guide.md),
`ai-today-brief` video_script: `anchor` = HeyGen-слот)

Слот:

```
public/avatar/<digestId>/scene-XX.mp4
```

`scene-01.mp4` = перша сцена маніфесту. Після копіювання файлу:

```bash
npm run media:refresh -- remotion/data/<manifest>-narrated.json
```

Композиція малює PiP-картку (`OffthreadVideo`) і **вимикає TTS цієї сцени** — голос іде з
кліпу (`if (scene.avatarVideo) return null` на audio layer).
(source: `remotion/AtbWeeklyYouTube.tsx`, `scripts/refresh-media-slots.ts`)

Площа ведучого — 20–25% кадру; головне — новина.
(source: [product/video-editorial-format](../product/video-editorial-format.md))

## Сервіси аватара (ресерч 2026-08-05)

| Рівень | Сервіс | Що відомо | Нотатка |
|---|---|---|---|
| Тест | **HeyGen Free** | 3 відео/міс, до 1 хв, 720p, вотермарка | перевірити, чи аудиторія тримається з ведучим |
| Тест | **Vidnoz** | безкоштовні хвилини щодня (needs verification на поточний тариф) | talking-photo |
| Тест | **D-ID** | trial | talking-photo |
| Тест | Dreamina / OmniHuman | щоденні кредити | (needs verification) |
| L2 | **HeyGen Creator** | ~$29/міс, 600 кредитів: ~10 хв Avatar IV або ~200 хв Avatar III, 1080p, без вотермарки | web-check 2026-08-05 |
| L2 | **Synthesia** | ~$14/міс план із custom avatar | порівняння hollymack.com 2026-08-05 |
| L3 | photo/video clone власника | той самий Creator+ | бренд-актив |

Локальні LivePortrait / EchoMimic / Hallo — GPU; на інтегрованій AMD без CUDA не варте часу
(assumption, research §3).

Вотермарки free-tier не обрізати (ToS). Без аватара **рендер збирається** (L0 Edge TTS),
але це слайдшоу і **не випуск**. HeyGen/YouTube ключів у `.env` немає навмисно
(`ai-today-brief-video/README.md`: remain manual in v1). (source: рішення власника 2026-08-19)

## Голос вищого рівня (L1)

ElevenLabs: free 10 хв/міс без комерції; Starter ~$5/міс — комерція + клон. OpenAI TTS API
~$0.015/хв, комерція ок. Клон голосу власника = впізнаваність; підключати після 2–3
Edge-випусків із retention.
(source: research §3, bigvu.tv / costgoat.com web-check 2026-08-05)

Музика: `public/music/bed.mp3` на 7% гучності, луп. YouTube Audio Library (free, monetization-safe)
або Suno Pro ~$8/міс (free Suno — не для монетизації).
(source: research §2 / terms.law)

## Related pages

- [product/video-editorial-format](../product/video-editorial-format.md)
- [video-script](video-script.md)
- [video-motion-broll](video-motion-broll.md)
- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [research/2026-08-05-professional-ai-video-guide](../research/2026-08-05-professional-ai-video-guide.md)
