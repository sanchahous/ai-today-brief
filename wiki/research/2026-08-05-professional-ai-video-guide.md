# Професійне AI-відео: гайд ціна/якість (2026)

Summary: як робити професійні відео-сюжети з озвучкою, аватаром та інтерактивною подачею за
мінімальний бюджет; чому поточний weekly-випуск виглядав аматорськи і що саме це виправляє.
Sources: аудит `output/atb-weekly-youtube-live.mp4` (ffprobe/volumedetect 2026-08-05), web-research
2026-08-05 (HeyGen/Synthesia/ElevenLabs/Suno pricing), код `ai-today-brief-video/remotion/`, live
рендер 2026-08-05; перенесено з `ai-today-brief-video/wiki` 2026-08-28
Last updated: 2026-08-19

---

## 1. Діагноз: чому старе відео не працювало

Аудит `atb-weekly-youtube-live.mp4` (2026-08-05):

| Проблема | Факт | Чому це вбиває відео |
|---|---|---|
| Німота | аудіодоріжка AAC існує, але це тиша: mean/max volume **-91 dB** | звук — 50% сприйняття; глядач закриває беззвучне відео за 3–5 с |
| Слайдшоу | 6 сцен × 45–75 с, текст статично висить | у сцени лише 10–25 с «контенту» (158–339 символів voiceover), решта — порожнє очікування |
| Текст замість мовлення | voiceover надрукований на екрані | глядач не читає абзаци з екрана; це презентація, не відео |
| Немає людини | нема ні аватара, ні голосу | нуль емоційного зв'язку, нуль авторитету |

Корінь: сцени тримали хронометраж маніфесту (395 с), а не хронометраж контенту (~97 с мовлення).
**Перше правило професійного відео: тривалість сцени диктує аудіо, а не навпаки (audio-first).**

## 2. Що вже зроблено в `ai-today-brief-video`

Безкоштовний рівень — повністю автоматичний, $0/міс:

1. **TTS-озвучка**: `npm run narration:generate` → Edge TTS (нейронні голоси Microsoft, free):
   EN `en-US-AndrewMultilingualNeural` для епізоду, UK `uk-UA-OstapNeural` для Shorts.
   Скрипт: `scripts/generate-narration.ts` + `scripts/tts_generate.py` (потрібен
   `pip install edge-tts`). Записує MP3 у `public/narration/<digestId>/` і
   `*-narrated.json` props-файл з блоком `narrationAudio`.
2. **Word-level таймінги**: WordBoundary-івенти Edge TTS → караоке-субтитри
   (`remotion/Captions.tsx`): показується фраза, активне слово підсвічується акцентом.
   Це стандарт утримання уваги у 2026 (глядачі дивляться без звуку в стрічці).
3. **Audio-first таймінг**: `remotion/narration.ts` — сцена = тривалість кліпу + 1.1 с
   хвоста. Епізод стиснувся з 6:35 порожніх до ~1:45 щільних.
4. **Рух у кадрі**: Ken Burns зі змінним напрямком панорами по сценах, spring-в'їзди
   заголовків і рубрик, прогрес-бар. Правило: **щось має рухатись кожні 2–3 секунди**.
   Це фолбек. Цільовий фон — i2v-кліп події, див. канон
   [pipeline/video-motion-broll](../pipeline/video-motion-broll.md).

Live 2026-08-18 (`ai-weekly-2026-08-09`): офіційний `weekly-video-v3` + Edge TTS дав **432 с**
(аудіо mean −24.8 dB), не 1:45. Цифра ~1:45 була для короткого checkpoint-скрипту 2026-08-05.
Довший епізод = довший `video_script` на сайті.
5. **Слот під аватара**: поклади HeyGen-кліп у `public/avatar/<digestId>/scene-01.mp4` —
   він автоматично з'явиться PiP-карткою в сцені і замінить TTS-доріжку (голос бере з кліпу).
6. **Слот під музику**: поклади трек у `public/music/bed.mp3` — заграє лупом на 7% гучності.
   Джерела: YouTube Audio Library (free, безпечно для монетизації) або Suno Pro ($8/міс,
   комерційна ліцензія на згенеровану музику; free-план Suno — НЕ для монетизації).

Рендер: `npm run render:weekly:narrated` (16:9) та `npm run render:shorts -- <narrated.json>`
(9:16 з озвучкою й таймінгом від аудіо).

## 3. Драбина ціна/якість (актуальні ціни, web-check 2026-08-05)

| Рівень | Стек | Ціна/міс | Що отримуєш |
|---|---|---|---|
| **L0 — зараз** | Edge TTS + Remotion motion + караоке-субтитри | **$0** | пристойний «faceless» диджест; голос гарний, але без клону |
| **L1 — голос** | + ElevenLabs (free 10 хв/міс без комерції; Starter $5/міс — комерція + клон голосу) або OpenAI TTS API (~$0.015/хв, комерція ок) | $0–5 | помітно жвавіші інтонації; свій клон голосу = впізнаваність бренду |
| **L2 — аватар** | + HeyGen Creator ($29/міс, 600 кредитів: ~10 хв Avatar IV або ~200 хв Avatar III, 1080p, без вотермарки) або Synthesia ($14/міс план уже з custom avatar) | $14–29 | людина-ведучий у кадрі; наш PiP-слот вже готовий приймати кліпи |
| **L3 — продакшн** | + Suno Pro (музика під бренд) + власний avatar clone (HeyGen photo/video clone) + B-roll генератори (Runway/Kling/Veo — окремий бюджет) | $40–80 | рівень «студійного» ютуб-каналу; можна продавати як послугу |

Безкоштовний вхід у L2: HeyGen Free = 3 відео/міс до 1 хв у 720p з вотермаркою — вистачає
на тест «чи працює аватар для нашої аудиторії» до оплати.

Локальні open-source аватари (LivePortrait, EchoMimic, Hallo) вимагають GPU і дають гіршу
синхронізацію губ, ніж HeyGen Avatar III — на нашому залізі не варте часу (assumption).

## 4. Принципи, які відрізняють «професійне» від «слайдшоу»

1. **Audio-first**: пишеш/генеруєш озвучку → тривалість сцен виводиш з неї. Ніколи навпаки.
2. **Хук ≤ 3 с**: перша фраза - конфлікт або число («141,006 runs reviewed…»), не «Вітаємо».
3. **Рух кожні 2–3 с**: Ken Burns, в'їзд тексту, зміна плану. Статичний кадр > 4 с = дроп.
4. **Субтитри завжди**: 60%+ переглядів у стрічках — без звуку. Караоке-стиль тримає око.
5. **Одна думка = одна сцена**: 15–25 с на сцену; довше — розбивай.
6. **Музика під мовленням: −20 дБ від голосу** (у нас 7% volume) — відчувається, не заважає.
7. **Аватар ≠ весь кадр**: PiP-картка 20–25% площі; головне — контент, ведучий — довіра.
8. **Хронометраж від контенту**: хочеш 6–8 хв на YouTube — пиши довший narration-скрипт
   (зараз website-LLM генерує ~1000 символів ≈ 97 с; для 6 хв треба ~3500–4000 символів),
   а не розтягуй 97 с контенту на 395 с полотна.

## 5. Формат репортажу: «жива подія на фоні + ведучий» без бюджету

Вимога власника (2026-08-05): не ілюстрації, а рухома подія на фоні, як у теленовинах.
Жорстке обмеження заліза: на машині **немає NVIDIA GPU** (інтегрована AMD, 512 МБ) —
локальні Wan 2.2 / LTX-2 / ComfyUI недоступні, мінімум 12–16 ГБ VRAM (source: web-research
2026-08-05 + live check заліза). Отже — безкоштовні ліміти хмарних сервісів.

### Живий фон (image-to-video з наявних FLUX-ілюстрацій)

| Сервіс | Free-ліміт | Вотермарка | Нотатка |
|---|---|---|---|
| **Hailuo 2.3** (hailuoai.video) | практично без ліміту (черга) | **немає** | найкращий обсяг задарма; 200 кредитів новачку |
| **Kling 3.0** | 66 кредитів/день ≈ 6×5с | є на free | найкраща якість руху |
| **Krea Video** | 10 кредитів/день | **немає** (з Kling всередині) | найкращий UX, кілька моделей |
| **Veo 3.1** (Gemini/Flow) | 50 кредитів/день ≈ до 12 відео | видима «Made with Veo», 720p | тільки як запасний |
| Стокове відео: Pexels / Pixabay / Mixkit | безкоштовно | немає | generic b-roll: датацентри, код, офіси |

Потреба випуску — **6 кліпів/тиждень** (по одному на сцену) ≈ 30 хв ручної роботи в Hailuo
або Krea: завантажив ілюстрацію сцени → промт руху → 5–8 с кліп → `public/broll/<digestId>/scene-XX.mp4`
→ `npm run media:refresh` → рендер. Слот вже в коді (коміт `608b350`): кліп лупиться на всю
сцену замість статичної картинки. Вотермарки не обрізати і не замальовувати — це порушення
ToS; брати сервіси, де free-tier без вотермарки, або платити.

Промт-рецепт i2v: «subtle cinematic camera push-in, [суб'єкт кадру] slowly [дія події],
volumetric light, no text, loop-friendly motion, 5s» — подавати саме ілюстрацію сцени,
тоді фон збігається з брендом випуску.

### Ведучий (аватар) задарма

Телевізійний стандарт — ведучий в кадрі лише на **інтро та аутро**, середину несе b-roll із
закадровим голосом. Це знімає потребу в дорогих хвилинах аватара: на випуск треба ~40–60 с.

- Free-варіанти talking-photo: **Vidnoz** (безкоштовні хвилини щодня), **D-ID** (trial),
  **HeyGen Free** (3 відео/міс × 1 хв, 720p, вотермарка), Dreamina/OmniHuman (щоденні кредити).
- Аватар = власне фото власника → автентичність + бренд-актив (фото-аватар «оживає» і
  промовляє текст інтро). Кліп кладеться у `public/avatar/<digestId>/scene-01.mp4` — PiP-слот
  уже в композиції, TTS тієї сцени автоматично вимикається.
- Коли з'явиться дохід: Synthesia $14/міс (custom avatar) або HeyGen Creator $29/міс — це
  єдина справді «платна» ланка професійного вигляду.

### Тижневий чек-лист випуску ($0)

1. `npm run narration:generate` — озвучка + субтитри (≈2 хв).
2. Hailuo/Krea: 6 i2v-кліпів з ілюстрацій сцен (≈30 хв, безкоштовно).
3. (Опційно) інтро-кліп аватара з Vidnoz/HeyGen Free → `public/avatar/.../scene-01.mp4`.
4. (Опційно) музика: YouTube Audio Library → `public/music/bed.mp3`.
5. `npm run media:refresh` → `npm run render:weekly:narrated` → перегляд → YouTube.

## 6. Наступні кроки до «відео на замовлення»

1. Прогнати narrated-версії 2–3 випусків, зібрати retention у YouTube Studio (хук/дропи).
2. Увімкнути L1: ElevenLabs Starter — клон голосу власника = унікальний бренд-актив.
3. Тест L2: HeyGen Free (3×1 хв) — аватар-інтро до епізоду; якщо ретеншн росте — Creator.
4. Довший narration у website-маніфесті (video_script LLM-джоб): цільові 3500+ символів EN.
5. Портфоліо для замовлень: цей же пайплайн з іншим брендингом = продукт «відео-диджест
   під ключ» (типова ціна на ринку $50–300/відео — needs verification).

## Related pages

- [product/video-editorial-format](../product/video-editorial-format.md)
- [pipeline/video-avatar-and-voice](../pipeline/video-avatar-and-voice.md)
- [pipeline/video-motion-broll](../pipeline/video-motion-broll.md)
- [pipeline/video-script](../pipeline/video-script.md)
- [ops/video-weekly-checklist](../ops/video-weekly-checklist.md)
- [pipeline/video-remotion-compositions](../pipeline/video-remotion-compositions.md)
- [ops/video-render-runbook](../ops/video-render-runbook.md)
- [pipeline/video-production-workflow](../pipeline/video-production-workflow.md)

## Джерела web-research (2026-08-05)

- HeyGen pricing: arcade.software/post/heygen-pricing, konabayev.com/blog/heygen-pricing
- HeyGen vs Synthesia: hollymack.com/synthesia-vs-heygen (Synthesia $14/міс custom avatar;
  HeyGen прибрав unlimited-плани 2026-05-15)
- TTS: bigvu.tv (ElevenLabs free 10 хв/міс, без комерції), costgoat.com/pricing/openai-tts
  (~$0.015/хв), texttolab.com/pricing
- Музика: terms.law (Suno commercial з Pro $8/міс), suno.com/hub/royalty-free-music
- Free i2v-ліміти: whichoneisreal.com/compare/best-free-ai-video (Kling 66/день),
  zevor.ai (Hailuo без вотермарки, Krea 10/день), diyai.io (вотермарки free-tier'ів)
- Veo free: mindwiredai.com 2026-04-09 (Flow 50 кредитів/день), veo3ai.io (видима вотермарка)
- Локальні моделі: thundercompute.com (Wan 2.2 GGUF 6-8GB@480p), radiancesystems.eu
  (LTX-2 720p = 12-24GB fp8) — недосяжно без NVIDIA GPU
- Free avatar: wavespeed.ai/blog (огляд), vidnoz.com, media.io
